import asyncio
import uuid
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
import aiohttp
import json
from enum import Enum
from dataclasses import dataclass, asdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class BackgroundTask:
    id: str
    status: TaskStatus
    model: str
    input: List[Dict[str, Any]]
    reasoning: Optional[Dict[str, Any]] = None
    created_at: float = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    output_text: Optional[str] = None
    output: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    openrouter_generation_id: Optional[str] = None
    stream_cursor: int = 0
    stream_events: List[Dict[str, Any]] = None
    reasoning_summary: Optional[str] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()
        if self.stream_events is None:
            self.stream_events = []

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['status'] = self.status.value
        return data


class OpenRouterBackgroundTaskManager:
    def __init__(self, api_key: str, base_url: str = None):
        self.api_key = api_key
        self.base_url = base_url or "https://openrouter.ai/api/v1"
        self.tasks: Dict[str, BackgroundTask] = {}
        self.session: Optional[aiohttp.ClientSession] = None
        self._executor_task = None
        self._queue = asyncio.Queue()
        
    async def __aenter__(self):
        await self.start()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()
        
    async def start(self):
        """Start the background task executor"""
        self.session = aiohttp.ClientSession()
        self._executor_task = asyncio.create_task(self._task_executor())
        logger.info("Background task manager started")
        
    async def stop(self):
        """Stop the background task executor"""
        if self._executor_task:
            self._executor_task.cancel()
            try:
                await self._executor_task
            except asyncio.CancelledError:
                pass
                
        if self.session:
            await self.session.close()
            
        logger.info("Background task manager stopped")
        
    async def _task_executor(self):
        """Main task executor loop"""
        while True:
            try:
                task_id = await self._queue.get()
                task = self.tasks.get(task_id)
                
                if not task:
                    continue
                    
                if task.status == TaskStatus.CANCELLED:
                    continue
                    
                await self._execute_task(task)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in task executor: {e}")
                
    async def _execute_task(self, task: BackgroundTask):
        """Execute a single background task"""
        try:
            task.status = TaskStatus.IN_PROGRESS
            task.started_at = time.time()
            
            # Prepare request payload
            payload = {
                "model": task.model,
                "messages": task.input,
                "stream": True  # Always use streaming for better control
            }
            
            # Always request reasoning for all models
            payload["reasoning"] = task.reasoning or {"effort": "high"}
            payload["reasoning"]["summary"] = "auto"
            
            # Also try to enable reasoning visibility through other parameters
            payload.setdefault("stream_options", {})["include_usage"] = True
            
            # Try different reasoning request formats for different providers
            if "grok" in task.model.lower() or "x-ai" in task.model.lower():
                # xAI/Grok specific parameters
                payload["reasoning"] = {"summary": "detailed"}
                payload["include"] = ["reasoning.encrypted_content", "reasoning.summary"]
            elif "openai" in task.model.lower():
                # OpenAI specific parameters
                payload["reasoning"] = {"effort": "high", "summary": "auto"}
            
            logger.info(f"Request payload for {task.model}: {json.dumps(payload, indent=2)}")
                
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/openrouter-background-tasks",
                "X-Title": "OpenRouter Background Tasks"
            }
            
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
                
                # Poll for generation stats if we have an ID
                if generation_id:
                    await asyncio.sleep(1)  # Give the API a moment to process
                    stats = await self._get_generation_stats(generation_id)
                    logger.info(f"Generation stats: {json.dumps(stats, indent=2) if stats else 'None'}")
                    if stats:
                        # Extract detailed usage information including reasoning tokens
                        usage = {
                            'prompt_tokens': stats.get('tokens_prompt', 0),
                            'completion_tokens': stats.get('tokens_completion', 0),
                            'total_tokens': stats.get('total_cost', 0),
                            'reasoning_tokens': 0
                        }
                        
                        # Check for reasoning tokens in various possible locations
                        if 'usage' in stats:
                            usage.update(stats['usage'])
                            
                            # xAI/Grok format: completion_tokens_details.reasoning_tokens
                            if 'completion_tokens_details' in stats['usage']:
                                comp_details = stats['usage']['completion_tokens_details']
                                if 'reasoning_tokens' in comp_details:
                                    usage['reasoning_tokens'] = comp_details['reasoning_tokens']
                        
                        # Look for reasoning tokens in native_tokens_details (OpenRouter format)
                        if 'native_tokens_details' in stats:
                            details = stats['native_tokens_details']
                            if 'reasoning_tokens' in details:
                                usage['reasoning_tokens'] = details['reasoning_tokens']
                            elif 'completion_tokens_details' in details:
                                comp_details = details['completion_tokens_details']
                                if 'reasoning_tokens' in comp_details:
                                    usage['reasoning_tokens'] = comp_details['reasoning_tokens']
                        
                        # Direct reasoning_tokens field
                        if 'reasoning_tokens' in stats:
                            usage['reasoning_tokens'] = stats['reasoning_tokens']
                        
                        task.usage = usage
                        
                task.status = TaskStatus.COMPLETED
                task.completed_at = time.time()
                
        except asyncio.CancelledError:
            task.status = TaskStatus.CANCELLED
            raise
        except Exception as e:
            logger.error(f"Task {task.id} failed: {e}")
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = time.time()
            
    async def _get_generation_stats(self, generation_id: str) -> Optional[Dict[str, Any]]:
        """Get generation statistics from OpenRouter"""
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
            
    async def create_response(
        self,
        model: str,
        input: List[Dict[str, Any]],
        background: bool = True,
        stream: bool = False,
        reasoning: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> BackgroundTask:
        """Create a new background response"""
        
        task_id = f"resp_{uuid.uuid4().hex}"
        
        task = BackgroundTask(
            id=task_id,
            status=TaskStatus.QUEUED,
            model=model,
            input=input,
            reasoning=reasoning
        )
        
        self.tasks[task_id] = task
        
        if background:
            # Queue for background execution
            await self._queue.put(task_id)
        else:
            # Execute immediately (for testing)
            await self._execute_task(task)
            
        return task
        
    async def retrieve_response(self, response_id: str) -> Optional[BackgroundTask]:
        """Retrieve a response by ID"""
        return self.tasks.get(response_id)
        
    async def cancel_response(self, response_id: str) -> Optional[BackgroundTask]:
        """Cancel a background response"""
        task = self.tasks.get(response_id)
        if task and task.status in [TaskStatus.QUEUED, TaskStatus.IN_PROGRESS]:
            task.status = TaskStatus.CANCELLED
            task.completed_at = time.time()
        return task
        
    async def stream_response(
        self, 
        response_id: str, 
        starting_after: Optional[int] = None
    ):
        """Stream events from a background response"""
        task = self.tasks.get(response_id)
        if not task:
            return
            
        start_idx = starting_after + 1 if starting_after is not None else 0
        
        # Stream historical events
        for event in task.stream_events[start_idx:]:
            yield event
            
        # If task is still running, wait for new events
        if task.status in [TaskStatus.QUEUED, TaskStatus.IN_PROGRESS]:
            last_count = len(task.stream_events)
            
            while task.status in [TaskStatus.QUEUED, TaskStatus.IN_PROGRESS]:
                await asyncio.sleep(0.1)
                
                # Check for new events
                if len(task.stream_events) > last_count:
                    for event in task.stream_events[last_count:]:
                        yield event
                    last_count = len(task.stream_events)