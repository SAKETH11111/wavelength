import { 
  AIProvider, 
  ProviderFactory, 
  ProviderType, 
  ModelInfo,
  ProviderError 
} from './types';
import { OpenRouterProvider } from './openrouter-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';
import { XAIProvider } from './xai-provider';

export class ProviderRegistry implements ProviderFactory {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private modelToProviderMap: Map<string, ProviderType> = new Map();

  constructor() {
    this.initializeProviders();
    this.buildModelMap();
  }

  private initializeProviders(): void {
    // Initialize all supported providers
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('google', new GoogleProvider());
    this.providers.set('xai', new XAIProvider());
  }

  private buildModelMap(): void {
    // Build a map from model IDs to their providers
    this.providers.forEach((provider, providerType) => {
      for (const model of provider.supportedModels) {
        this.modelToProviderMap.set(model.id, providerType);
        
        // For OpenRouter, also map the full provider/model format
        if (providerType === 'openrouter') {
          // OpenRouter models often have provider prefix (e.g., "openai/gpt-4")
          // Map both formats
          if (model.id.includes('/')) {
            const simpleName = model.id.split('/')[1];
            if (!this.modelToProviderMap.has(simpleName)) {
              this.modelToProviderMap.set(simpleName, providerType);
            }
          }
        }
      }
    });
  }

  createProvider(type: ProviderType): AIProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new ProviderError(
        `Provider type '${type}' is not supported`,
        'registry',
        400,
        undefined,
        false
      );
    }
    return provider;
  }

  getSupportedProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  getProviderForModel(model: string): ProviderType | undefined {
    // First try exact match
    let providerType = this.modelToProviderMap.get(model);
    if (providerType) return providerType;

    // For models with provider prefixes, route to OpenRouter (most compatible)
    if (model.includes('/')) {
      const prefix = model.split('/')[0];
      // OpenRouter supports models from all major providers
      if (['openai', 'anthropic', 'google', 'xai', 'mistralai', 'meta-llama', 'openrouter'].includes(prefix)) {
        return 'openrouter';
      }
    }

    // Try with provider prefixes for OpenRouter compatibility
    const openRouterFormats = [
      `openai/${model}`,
      `anthropic/${model}`,
      `google/${model}`,
      `xai/${model}`,
      `mistralai/${model}`
    ];

    for (const format of openRouterFormats) {
      providerType = this.modelToProviderMap.get(format);
      if (providerType) return providerType;
    }

    // Check if model matches common patterns and route to OpenRouter
    const modelLower = model.toLowerCase();
    if (modelLower.includes('gpt') ||
        modelLower.includes('claude') ||
        modelLower.includes('gemini') ||
        modelLower.includes('llama') ||
        modelLower.includes('mistral') ||
        modelLower.includes('grok') ||
        modelLower.includes('o1') ||
        modelLower.includes('o3')) {
      return 'openrouter';
    }

    // Default to OpenRouter for unknown models (best compatibility)
    return 'openrouter';
  }

  getAllModels(): ModelInfo[] {
    const allModels: ModelInfo[] = [];
    this.providers.forEach(provider => {
      allModels.push(...provider.supportedModels);
    });
    return allModels;
  }

  getModelsByProvider(providerType: ProviderType): ModelInfo[] {
    const provider = this.providers.get(providerType);
    return provider ? provider.supportedModels : [];
  }

  getModelInfo(model: string): ModelInfo | undefined {
    // Try to find the model in any provider
    let foundModel: ModelInfo | undefined;
    this.providers.forEach(provider => {
      if (!foundModel) {
        const modelInfo = provider.getModelInfo(model);
        if (modelInfo) foundModel = modelInfo;
      }
    });
    return foundModel;
  }

  validateModel(model: string): boolean {
    // Always true since we default to OpenRouter for unknown models
    // OpenRouter has the widest model support
    const providerType = this.getProviderForModel(model);
    if (!providerType) return false;
    
    const provider = this.providers.get(providerType);
    return provider ? provider.validateModel(model) : false;
  }

  // Provider availability checking
  isProviderAvailable(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  // Model search and filtering
  searchModels(query: string): ModelInfo[] {
    const allModels = this.getAllModels();
    const searchTerm = query.toLowerCase();
    
    return allModels.filter(model => 
      model.id.toLowerCase().includes(searchTerm) ||
      model.name.toLowerCase().includes(searchTerm) ||
      model.provider.toLowerCase().includes(searchTerm)
    );
  }

  getModelsByCapability(capability: 'reasoning' | 'streaming'): ModelInfo[] {
    const allModels = this.getAllModels();
    
    switch (capability) {
      case 'reasoning':
        return allModels.filter(model => model.supportsReasoning);
      case 'streaming':
        return allModels.filter(model => model.supportsStreaming);
      default:
        return [];
    }
  }

  // Cost estimation helpers
  estimateCost(model: string, inputTokens: number, outputTokens: number, reasoningTokens: number = 0): number {
    const modelInfo = this.getModelInfo(model);
    if (!modelInfo) return 0;

    const inputCost = (inputTokens / 1_000_000) * (modelInfo.inputCostPer1M ?? 0);
    const outputCost = (outputTokens / 1_000_000) * (modelInfo.outputCostPer1M ?? 0);
    const reasoningCost = (reasoningTokens / 1_000_000) * (modelInfo.reasoningCostPer1M ?? 0);

    return inputCost + outputCost + reasoningCost;
  }

  getCheapestModel(contextRequired: number = 0): ModelInfo | undefined {
    const allModels = this.getAllModels();
    const viableModels = contextRequired > 0 
      ? allModels.filter(model => model.contextLength >= contextRequired)
      : allModels;

    if (viableModels.length === 0) return undefined;

    return viableModels.reduce((cheapest, current) => {
      const cheapestCost = (cheapest.inputCostPer1M ?? 0) + (cheapest.outputCostPer1M ?? 0);
      const currentCost = (current.inputCostPer1M ?? 0) + (current.outputCostPer1M ?? 0);
      return currentCost < cheapestCost ? current : cheapest;
    });
  }

  getMostCapableModel(requireReasoning: boolean = false): ModelInfo | undefined {
    const allModels = this.getAllModels();
    const viableModels = requireReasoning 
      ? allModels.filter(model => model.supportsReasoning)
      : allModels;

    if (viableModels.length === 0) return undefined;

    // Sort by context length and cost (higher is more capable)
    return viableModels.reduce((best, current) => {
      if (current.contextLength > best.contextLength) return current;
      if (current.contextLength === best.contextLength) {
        const bestCost = (best.inputCostPer1M ?? 0) + (best.outputCostPer1M ?? 0);
        const currentCost = (current.inputCostPer1M ?? 0) + (current.outputCostPer1M ?? 0);
        return currentCost > bestCost ? current : best;
      }
      return best;
    });
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry();