"""
Anthropic provider implementation.
"""

import json
import time
import uuid
import aiohttp
import logging
from typing import Dict, Any, Optional, AsyncGenerator, List, TYPE_CHECKING

from .base import BaseProvider

if TYPE_CHECKING:
    from background_task_manager import BackgroundTask, TaskStatus
else:
    # Import at runtime to avoid circular imports
    import background_task_manager
    BackgroundTask = background_task_manager.BackgroundTask
    TaskStatus = background_task_manager.TaskStatus

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseProvider):
    """Anthropic Claude API provider implementation."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.anthropic.com/v1"):
        """Initialize Anthropic provider.
        
        Args:
            api_key: Anthropic API key
            base_url: Base URL for Anthropic API (default: https://api.anthropic.com/v1)
        """
        super().__init__(api_key, base_url)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def start(self):
        """Start the provider session."""
        if not self.session:
            self.session = aiohttp.ClientSession()
    
    async def stop(self):
        """Stop the provider session."""
        if self.session:
            await self.session.close()
            self.session = None
    
    def _convert_messages(self, messages: List[Dict[str, Any]]) -> tuple[Optional[str], List[Dict[str, Any]]]:
        """Convert OpenAI-style messages to Anthropic format.
        
        Returns:
            tuple: (system_message, converted_messages)
        """
        system_parts = []
        converted_messages = []
        
        for msg in messages:
            if msg['role'] == 'system':
                system_parts.append(msg['content'])
            else:
                converted_messages.append({
                    'role': msg['role'],
                    'content': [{'type': 'text', 'text': msg['content']}]
                })
        
        # Validate message sequence (must alternate user/assistant, start with user)
        validated_messages = self._validate_message_sequence(converted_messages)
        
        system_message = '\n\n'.join(system_parts) if system_parts else None
        return system_message, validated_messages
    
    def _validate_message_sequence(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Ensure messages alternate between user and assistant, starting with user."""
        if not messages:
            return messages
        
        validated = []
        last_role = None
        
        for msg in messages:
            if msg['role'] == last_role:
                # Merge with previous message
                if validated:
                    last_msg = validated[-1]
                    last_msg['content'][0]['text'] += '\n\n' + msg['content'][0]['text']
                continue
            
            validated.append(msg)
            last_role = msg['role']
        
        # Ensure starts with user
        if validated and validated[0]['role'] != 'user':
            validated.insert(0, {
                'role': 'user',
                'content': [{'type': 'text', 'text': 'Please respond to the following:'}]
            })
        
        return validated
    
    async def create_completion(self, task: "BackgroundTask", payload: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
        """Create a streaming completion using Anthropic API.
        
        Args:
            task: The background task containing request details
            payload: The prepared request payload
            
        Yields:
            Dict[str, Any]: Streaming response data chunks
        """
        if not self.session:
            await self.start()
        
        # Convert messages to Anthropic format
        system_message, converted_messages = self._convert_messages(payload.get('messages', []))
        
        # Prepare Anthropic-specific payload
        anthropic_payload = {
            'model': payload['model'],
            'messages': converted_messages,
            'stream': True,
            'max_tokens': payload.get('max_tokens', 4096)
        }
        
        if system_message:
            anthropic_payload['system'] = system_message
        
        if 'temperature' in payload:
            anthropic_payload['temperature'] = payload['temperature']
        if 'top_p' in payload:
            anthropic_payload['top_p'] = payload['top_p']
        if 'stop' in payload:
            stop_sequences = payload['stop']
            if isinstance(stop_sequences, str):
                stop_sequences = [stop_sequences]
            anthropic_payload['stop_sequences'] = stop_sequences
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "User-Agent": "Wavelength/1.0"
        }
        
        logger.info(f"Request payload for {task.model}: {json.dumps(anthropic_payload, indent=2)}")
        
        # Make the request to Anthropic
        async with self.session.post(
            f"{self.base_url}/messages",
            json=anthropic_payload,
            headers=headers
        ) as response:
            
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"API Error {response.status}: {error_text}")
            
            # Process streaming response
            content_buffer = []
            sequence_number = 0
            generation_id = None
            
            async for line in response.content:
                if task.status == TaskStatus.CANCELLED:
                    break
                    
                line = line.decode('utf-8').strip()
                if not line or not line.startswith('data: '):
                    continue
                    
                data_str = line[6:]  # Remove 'data: ' prefix
                
                if data_str == '[DONE]':
                    break
                    
                try:
                    data = json.loads(data_str)
                    logger.info(f"Streaming data: {json.dumps(data, indent=2)}")
                    
                    # Handle different Anthropic stream event types
                    if data.get('type') == 'message_start':
                        generation_id = data.get('message', {}).get('id')
                        if generation_id:
                            task.openrouter_generation_id = generation_id
                            logger.info(f"Got generation ID: {generation_id}")
                    
                    elif data.get('type') == 'content_block_delta':
                        text_content = data.get('delta', {}).get('text')
                        if text_content:
                            content_buffer.append(text_content)
                            logger.info(f"Content chunk: {text_content[:100]}...")
                    
                    # Store streaming event
                    event = {
                        'sequence_number': sequence_number,
                        'data': data,
                        'timestamp': time.time()
                    }
                    task.stream_events.append(event)
                    sequence_number += 1
                    
                    # Yield the event for real-time streaming
                    yield event
                    
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse SSE data: {data_str}")
            
            # Combine content buffer safely
            task.output_text = ''.join(content_buffer) if content_buffer else ""
            
            # Build output structure similar to OpenAI's format
            task.output = [
                {
                    "id": f"msg_{uuid.uuid4().hex}",
                    "type": "message",
                    "status": "completed",
                    "content": [
                        {
                            "type": "output_text",
                            "text": task.output_text
                        }
                    ],
                    "role": "assistant"
                }
            ]
    
    async def get_generation_stats(self, generation_id: str) -> Optional[Dict[str, Any]]:
        """Get generation statistics from Anthropic.
        
        Args:
            generation_id: The generation ID to get stats for
            
        Returns:
            Optional[Dict[str, Any]]: Generation statistics or None if not found
        """
        # Anthropic doesn't have a direct stats endpoint like OpenRouter
        # This is a placeholder for potential future Anthropic stats API
        logger.info(f"Stats retrieval not available for Anthropic generation {generation_id}")
        return None
