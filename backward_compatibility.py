"""
Backward compatibility layer for existing code that uses OpenRouterBackgroundTaskManager.
"""

from background_task_manager import BackgroundTaskManager
from providers import OpenRouterProvider


class OpenRouterBackgroundTaskManager(BackgroundTaskManager):
    """
    Backward compatibility wrapper for the old OpenRouterBackgroundTaskManager class.
    This allows existing code to continue working without changes.
    """
    
    def __init__(self, api_key: str, base_url: str = None):
        """Initialize with the old API signature for backward compatibility.
        
        Args:
            api_key: OpenRouter API key
            base_url: Base URL for OpenRouter API (default: https://openrouter.ai/api/v1)
        """
        provider = OpenRouterProvider(api_key, base_url or "https://openrouter.ai/api/v1")
        super().__init__(provider)
        
        # Store the original parameters for compatibility
        self.api_key = api_key
        self.base_url = base_url or "https://openrouter.ai/api/v1"