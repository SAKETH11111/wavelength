"""
OpenAI provider implementation.
"""

import json
import time
import uuid
import aiohttp
import logging
from typing import Dict, Any, Optional, AsyncGenerator, TYPE_CHECKING

from .base import BaseProvider

if TYPE_CHECKING:
    from background_task_manager import BackgroundTask, TaskStatus
else:
    # Import at runtime to avoid circular imports
    import background_task_manager
    BackgroundTask = background_task_manager.BackgroundTask
    TaskStatus = background_task_manager.TaskStatus

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseProvider):
    """OpenAI API provider implementation."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1"):
        """Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key
            base_url: Base URL for OpenAI API (default: https://api.openai.com/v1)
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
    
    async def create_completion(self, task: "BackgroundTask", payload: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
        """Create a streaming completion using OpenAI API.
        
        Args:
            task: The background task containing request details
            payload: The prepared request payload
            
        Yields:
            Dict[str, Any]: Streaming response data chunks
        """
        if not self.session:
            await self.start()
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Wavelength/1.0"
        }
        
        # Add reasoning parameters for o1/o3 models
        model_name = task.model.lower()
        if any(reasoning_model in model_name for reasoning_model in ['o1', 'o3']):
            if task.reasoning and task.reasoning.get('effort'):
                effort = task.reasoning['effort']
                if effort in ['low', 'medium', 'high']:
                    payload['reasoning_effort'] = effort
        
        logger.info(f"Request payload for {task.model}: {json.dumps(payload, indent=2)}")
        
        # Make the request to OpenAI
        async with self.session.post(
            f"{self.base_url}/chat/completions",
            json=payload,
            headers=headers
        ) as response:
            
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"API Error {response.status}: {error_text}")
            
            # Process streaming response
            content_buffer = []
            reasoning_buffer = []
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
                    
                    # Store generation ID for later polling
                    if 'id' in data and not generation_id:
                        generation_id = data['id']
                        task.openrouter_generation_id = generation_id
                        logger.info(f"Got generation ID: {generation_id}")
                        
                    # Process content chunks
                    if 'choices' in data and data['choices']:
                        choice = data['choices'][0]
                        if 'delta' in choice:
                            if 'content' in choice['delta'] and choice['delta']['content'] is not None:
                                content_buffer.append(choice['delta']['content'])
                                logger.info(f"Content chunk: {choice['delta']['content'][:100]}...")
                            
                            # Check for reasoning content
                            if 'reasoning' in choice['delta'] and choice['delta']['reasoning'] is not None:
                                reasoning_buffer.append(choice['delta']['reasoning'])
                                logger.info(f"Found reasoning: {choice['delta']['reasoning'][:200]}...")
                            
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
            
            # Store reasoning summary if available
            if reasoning_buffer:
                task.reasoning_summary = ''.join(reasoning_buffer)
                logger.info(f"Final reasoning summary length: {len(task.reasoning_summary)}")
            
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
        """Get generation statistics from OpenAI.
        
        Args:
            generation_id: The generation ID to get stats for
            
        Returns:
            Optional[Dict[str, Any]]: Generation statistics or None if not found
        """
        # OpenAI doesn't have a direct stats endpoint like OpenRouter
        # This is a placeholder for potential future OpenAI stats API
        logger.info(f"Stats retrieval not available for OpenAI generation {generation_id}")
        return None
