"""
Enhanced background task manager with provider registry support.
"""

import asyncio
import uuid
import time
from typing import Dict, Any, Optional, List
import json
import logging

from .task_manager import BackgroundTaskManager, BackgroundTask, TaskStatus
from .provider_registry import provider_registry, ProviderType

logger = logging.getLogger(__name__)


class EnhancedBackgroundTaskManager(BackgroundTaskManager):
    """Enhanced task manager that uses the provider registry for multi-provider support."""
    
    def __init__(self):
        """Initialize enhanced task manager with provider registry."""
        # Don't call super().__init__() as we don't need a single provider
        self.tasks: Dict[str, BackgroundTask] = {}
        self._executor_task = None
        self._queue = asyncio.Queue()
        self.provider_registry = provider_registry
    
    async def start(self):
        """Start the background task executor and all providers."""
        await self.provider_registry.start_all()
        self._executor_task = asyncio.create_task(self._task_executor())
        logger.info("Enhanced background task manager started with provider registry")
    
    async def stop(self):
        """Stop the background task executor and all providers."""
        if self._executor_task:
            self._executor_task.cancel()
            try:
                await self._executor_task
            except asyncio.CancelledError:
                pass
        
        await self.provider_registry.stop_all()
        logger.info("Enhanced background task manager stopped")
    
    async def _execute_task(self, task: BackgroundTask):
        """Execute a single background task using the appropriate provider."""
        try:
            task.status = TaskStatus.IN_PROGRESS
            task.started_at = time.time()
            
            # Get the appropriate provider for this model
            provider = self.provider_registry.get_provider_for_model(task.model)
            if not provider:
                raise Exception(f"No provider available for model: {task.model}")
            
            logger.info(f"Using provider {provider.__class__.__name__} for model {task.model}")
            
            # Prepare request payload
            payload = {
                "model": task.model,
                "messages": task.input,
                "stream": True  # Always use streaming for better control
            }
            
            # Add reasoning parameters if specified
            if task.reasoning:
                payload["reasoning"] = task.reasoning
            else:
                # Default reasoning for reasoning-capable models
                model_info = self.provider_registry.get_model_info(task.model)
                if model_info and model_info.get('supports_reasoning', False):
                    payload["reasoning"] = {"effort": "high", "summary": "auto"}
            
            # Stream options for better usage tracking
            payload.setdefault("stream_options", {})["include_usage"] = True
            
            # Delegate to provider for API call
            async for event in provider.create_completion(task, payload):
                # Events are already processed and stored by the provider
                pass
            
            # Poll for generation stats if we have an ID
            if task.openrouter_generation_id:
                await asyncio.sleep(1)  # Give the API a moment to process
                stats = await provider.get_generation_stats(task.openrouter_generation_id)
                if stats:
                    logger.info(f"Generation stats: {json.dumps(stats, indent=2)}")
                    task.usage = self._extract_usage_from_stats(stats)
            
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
    
    def _extract_usage_from_stats(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        """Extract usage information from provider stats."""
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
        
        return usage
    
    # Provider information methods for API endpoints
    
    def get_available_models(self) -> List[str]:
        """Get list of all available models."""
        return self.provider_registry.get_available_models()
    
    def search_models(self, query: str) -> List[str]:
        """Search for models matching a query."""
        return self.provider_registry.search_models(query)
    
    def get_reasoning_models(self) -> List[str]:
        """Get list of models that support reasoning."""
        return self.provider_registry.get_reasoning_models()
    
    def get_model_info(self, model: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model."""
        return self.provider_registry.get_model_info(model)
    
    def get_configured_providers(self) -> List[str]:
        """Get list of configured provider names."""
        return [provider_type.value for provider_type in self.provider_registry.get_available_providers()]
    
    def is_model_supported(self, model: str) -> bool:
        """Check if a model is supported by any provider."""
        return self.provider_registry.get_provider_for_model(model) is not None
