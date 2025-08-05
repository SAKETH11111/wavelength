"""
OpenRouter provider implementation.
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


class OpenRouterProvider(BaseProvider):
    """OpenRouter API provider implementation."""
    
    def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1"):
        """Initialize OpenRouter provider.
        
        Args:
            api_key: OpenRouter API key
            base_url: Base URL for OpenRouter API (default: https://openrouter.ai/api/v1)
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
        """Create a streaming completion using OpenRouter API.
        
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
            "HTTP-Referer": "https://github.com/openrouter-background-tasks",
            "X-Title": "OpenRouter Background Tasks"
        }
        
        logger.info(f"Request payload for {task.model}: {json.dumps(payload, indent=2)}")
        
        # Make the request to OpenRouter
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
            in_reasoning = False
            
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
                            
                            # Check for reasoning content in multiple possible locations
                            reasoning_text = None
                            if 'reasoning' in choice['delta'] and choice['delta']['reasoning'] is not None:
                                reasoning_text = choice['delta']['reasoning']
                                logger.info(f"Found reasoning in delta.reasoning: {reasoning_text[:200]}...")
                            elif 'thoughts' in choice['delta'] and choice['delta']['thoughts'] is not None:
                                reasoning_text = choice['delta']['thoughts']
                                logger.info(f"Found reasoning in delta.thoughts: {reasoning_text[:200]}...")
                            
                            if reasoning_text:
                                reasoning_buffer.append(reasoning_text)
                                in_reasoning = True
                    
                    # Also check for reasoning at the top level of the data
                    if 'reasoning' in data and data['reasoning'] is not None:
                        logger.info(f"Found top-level reasoning: {str(data['reasoning'])[:200]}...")
                        if isinstance(data['reasoning'], str):
                            reasoning_buffer.append(data['reasoning'])
                        elif isinstance(data['reasoning'], dict) and 'content' in data['reasoning']:
                            reasoning_buffer.append(data['reasoning']['content'])
                        in_reasoning = True
                            
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
                logger.info(f"Reasoning summary preview: {task.reasoning_summary[:500]}...")
            else:
                logger.warning("No reasoning content captured during streaming")
            
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
        """Get generation statistics from OpenRouter.
        
        Args:
            generation_id: The generation ID to get stats for
            
        Returns:
            Optional[Dict[str, Any]]: Generation statistics or None if not found
        """
        if not self.session:
            await self.start()
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}"
            }
            
            async with self.session.get(
                f"{self.base_url}/generation?id={generation_id}",
                headers=headers
            ) as response:
                
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"Failed to get generation stats: {response.status}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting generation stats: {e}")
            return None