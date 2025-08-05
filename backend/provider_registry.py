"""
Provider registry for managing AI service providers.
"""

import os
import logging
from typing import Dict, Optional, List, Any
from enum import Enum

from .providers import BaseProvider, OpenRouterProvider, OpenAIProvider, AnthropicProvider

logger = logging.getLogger(__name__)


class ProviderType(Enum):
    OPENROUTER = "openrouter"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    XAI = "xai"


class ProviderRegistry:
    """Registry for managing and creating AI providers."""
    
    def __init__(self):
        self._providers: Dict[ProviderType, BaseProvider] = {}
        self._model_to_provider_map: Dict[str, ProviderType] = {}
        self._initialize_providers()
        self._build_model_map()
    
    def _initialize_providers(self):
        """Initialize providers based on available API keys."""
        # OpenRouter
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        openrouter_base_url = os.getenv("CUSTOM_BASE_URL", "https://openrouter.ai/api/v1")
        if openrouter_key:
            self._providers[ProviderType.OPENROUTER] = OpenRouterProvider(openrouter_key, openrouter_base_url)
            logger.info("Initialized OpenRouter provider")
        
        # OpenAI
        openai_key = os.getenv("OPENAI_API_KEY")
        openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        if openai_key:
            self._providers[ProviderType.OPENAI] = OpenAIProvider(openai_key, openai_base_url)
            logger.info("Initialized OpenAI provider")
        
        # Anthropic
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        anthropic_base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")
        if anthropic_key:
            self._providers[ProviderType.ANTHROPIC] = AnthropicProvider(anthropic_key, anthropic_base_url)
            logger.info("Initialized Anthropic provider")
        
        # Log which providers are available
        available_providers = list(self._providers.keys())
        logger.info(f"Available providers: {[p.value for p in available_providers]}")
    
    def _build_model_map(self):
        """Build mapping from model names to providers."""
        # OpenRouter models (can handle most models via proxy)
        openrouter_models = [
            # OpenAI models via OpenRouter
            "openai/o3", "openai/o3-pro", "openai/o3-mini",
            "openai/o1", "openai/o1-mini", "openai/o1-preview",
            "openai/gpt-4o", "openai/gpt-4o-mini", "openai/gpt-4-turbo",
            "openai/gpt-3.5-turbo",
            # Anthropic models via OpenRouter
            "anthropic/claude-3.5-sonnet", "anthropic/claude-3.5-haiku",
            "anthropic/claude-3-opus", "anthropic/claude-3-sonnet", "anthropic/claude-3-haiku",
            # Google models via OpenRouter
            "google/gemini-pro-1.5", "google/gemini-flash-1.5",
            # XAI models via OpenRouter
            "xai/grok-beta", "xai/grok-2-1212",
            # Other popular models
            "meta-llama/llama-3.2-90b-vision-instruct",
            "microsoft/wizardlm-2-8x22b",
            "mistralai/mistral-large"
        ]
        
        # Direct OpenAI models
        openai_models = [
            "o3", "o3-pro", "o3-mini",
            "o1", "o1-mini", "o1-preview",
            "gpt-4o", "gpt-4o-mini", "gpt-4-turbo",
            "gpt-3.5-turbo"
        ]
        
        # Direct Anthropic models
        anthropic_models = [
            "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"
        ]
        
        # Map models to providers
        for model in openrouter_models:
            self._model_to_provider_map[model] = ProviderType.OPENROUTER
        
        for model in openai_models:
            # Prefer direct OpenAI if available, otherwise use OpenRouter
            if ProviderType.OPENAI in self._providers:
                self._model_to_provider_map[model] = ProviderType.OPENAI
            else:
                self._model_to_provider_map[f"openai/{model}"] = ProviderType.OPENROUTER
        
        for model in anthropic_models:
            # Prefer direct Anthropic if available, otherwise use OpenRouter
            if ProviderType.ANTHROPIC in self._providers:
                self._model_to_provider_map[model] = ProviderType.ANTHROPIC
            else:
                # Map to OpenRouter format
                simple_name = model.split('-20')[0]  # Remove date suffix
                self._model_to_provider_map[f"anthropic/{simple_name}"] = ProviderType.OPENROUTER
    
    def get_provider(self, provider_type: ProviderType) -> Optional[BaseProvider]:
        """Get a provider by type."""
        return self._providers.get(provider_type)
    
    def get_provider_for_model(self, model: str) -> Optional[BaseProvider]:
        """Get the appropriate provider for a model."""
        # Direct lookup
        provider_type = self._model_to_provider_map.get(model)
        if provider_type and provider_type in self._providers:
            return self._providers[provider_type]
        
        # Try with provider prefixes for OpenRouter compatibility
        for prefix in ['openai/', 'anthropic/', 'google/', 'xai/']:
            prefixed_model = f"{prefix}{model}"
            provider_type = self._model_to_provider_map.get(prefixed_model)
            if provider_type and provider_type in self._providers:
                return self._providers[provider_type]
        
        # Default to OpenRouter if available (most compatible)
        if ProviderType.OPENROUTER in self._providers:
            return self._providers[ProviderType.OPENROUTER]
        
        return None
    
    def get_available_providers(self) -> List[ProviderType]:
        """Get list of available provider types."""
        return list(self._providers.keys())
    
    def is_provider_available(self, provider_type: ProviderType) -> bool:
        """Check if a provider is available."""
        return provider_type in self._providers
    
    def get_model_info(self, model: str) -> Optional[Dict[str, Any]]:
        """Get information about a model."""
        # This would typically return model capabilities, pricing, etc.
        # For now, return basic info based on model name
        provider = self.get_provider_for_model(model)
        if not provider:
            return None
        
        # Basic model info (would be expanded with real model metadata)
        supports_reasoning = any(reasoning_model in model.lower() 
                               for reasoning_model in ['o1', 'o3', 'grok'])
        
        return {
            'id': model,
            'provider': provider.__class__.__name__.replace('Provider', '').lower(),
            'supports_reasoning': supports_reasoning,
            'supports_streaming': True,  # Most models support streaming
            'context_length': 128000 if 'o3' in model.lower() or 'o1' in model.lower() else 4096
        }
    
    def get_available_models(self) -> List[str]:
        """Get list of all available models."""
        return list(self._model_to_provider_map.keys())
    
    def search_models(self, query: str) -> List[str]:
        """Search for models matching a query."""
        query_lower = query.lower()
        return [model for model in self._model_to_provider_map.keys() 
                if query_lower in model.lower()]
    
    def get_reasoning_models(self) -> List[str]:
        """Get list of models that support reasoning."""
        reasoning_models = []
        for model in self._model_to_provider_map.keys():
            if any(reasoning_keyword in model.lower() 
                   for reasoning_keyword in ['o1', 'o3', 'grok']):
                reasoning_models.append(model)
        return reasoning_models
    
    async def start_all(self):
        """Start all providers."""
        for provider in self._providers.values():
            if hasattr(provider, 'start'):
                await provider.start()
        logger.info("Started all providers")
    
    async def stop_all(self):
        """Stop all providers."""
        for provider in self._providers.values():
            if hasattr(provider, 'stop'):
                await provider.stop()
        logger.info("Stopped all providers")


# Global provider registry instance
provider_registry = ProviderRegistry()
