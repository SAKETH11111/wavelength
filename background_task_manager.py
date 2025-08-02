import asyncio
import uuid
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
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


class BackgroundTaskManager:
    def __init__(self, provider):
        """Initialize BackgroundTaskManager with a provider.
        
        Args:
            provider: An instance of BaseProvider for handling API calls
        """
        self.provider = provider
        self.tasks: Dict[str, BackgroundTask] = {}
        self._executor_task = None
        self._queue = asyncio.Queue()
        
    async def __aenter__(self):
        await self.start()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()
        
    async def start(self):
        """Start the background task executor"""
        if hasattr(self.provider, 'start'):
            await self.provider.start()
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
        
        if hasattr(self.provider, 'stop'):
            await self.provider.stop()
            
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
        """Execute a single background task using the provider"""
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
            
            # Delegate to provider for API call
            async for event in self.provider.create_completion(task, payload):
                # Events are already processed and stored by the provider
                pass
            
            # Poll for generation stats if we have an ID
            if task.openrouter_generation_id:
                await asyncio.sleep(1)  # Give the API a moment to process
                stats = await self.provider.get_generation_stats(task.openrouter_generation_id)
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