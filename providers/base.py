"""
Base provider abstract class for AI service integrations.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, AsyncGenerator, TYPE_CHECKING

if TYPE_CHECKING:
    from background_task_manager import BackgroundTask


class BaseProvider(ABC):
    """Abstract base class for AI service providers."""
    
    def __init__(self, api_key: str, base_url: str):
        """Initialize the provider with API credentials.
        
        Args:
            api_key: API key for the service
            base_url: Base URL for the API endpoints
        """
        self.api_key = api_key
        self.base_url = base_url
    
    @abstractmethod
    async def create_completion(self, task: "BackgroundTask", payload: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
        """Create a streaming completion for the given task.
        
        Args:
            task: The background task containing request details
            payload: The request payload to send to the API
            
        Yields:
            Dict[str, Any]: Streaming response data chunks
            
        Raises:
            Exception: If the API request fails
        """
        pass
    
    @abstractmethod
    async def get_generation_stats(self, generation_id: str) -> Optional[Dict[str, Any]]:
        """Fetch usage statistics for a completed generation.
        
        Args:
            generation_id: The ID of the generation to get stats for
            
        Returns:
            Optional[Dict[str, Any]]: Generation statistics or None if not found
            
        Raises:
            Exception: If the stats request fails
        """
        pass