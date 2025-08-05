import { 
  CompletionRequest, 
  CompletionResponse,
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ProviderType,
  CostCalculation,
  ModelInfo
} from './types';
import { providerRegistry } from './provider-registry';

export interface ProviderClientConfig {
  // API Keys for different providers
  openRouterApiKey?: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  xaiApiKey?: string;

  // Base URLs (optional overrides)
  openRouterBaseUrl?: string;
  openAiBaseUrl?: string;
  anthropicBaseUrl?: string;
  googleBaseUrl?: string;
  xaiBaseUrl?: string;

  // Global settings
  defaultTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class ProviderClient {
  private config: ProviderClientConfig;

  constructor(config: ProviderClientConfig) {
    this.config = config;
  }

  async complete(request: CompletionRequest): Promise<AsyncIterable<StreamChunk>> {
    // Determine which provider to use
    const providerType = providerRegistry.getProviderForModel(request.model);
    if (!providerType) {
      throw new ProviderError(
        `No provider found for model: ${request.model}`,
        'client',
        400,
        undefined,
        false
      );
    }

    // Get the provider instance
    const provider = providerRegistry.createProvider(providerType);

    // Build provider-specific config
    const providerConfig = this.buildProviderConfig(providerType);

    // Execute the completion
    return provider.complete(request, providerConfig);
  }

  calculateCost(
    usage: CompletionResponse['usage'], 
    model: string
  ): CostCalculation {
    const providerType = providerRegistry.getProviderForModel(model);
    if (!providerType) {
      return { inputCost: 0, outputCost: 0, reasoningCost: 0, totalCost: 0 };
    }

    const provider = providerRegistry.createProvider(providerType);
    return provider.calculateCost(usage, model);
  }

  getModelInfo(model: string): ModelInfo | undefined {
    return providerRegistry.getModelInfo(model);
  }

  getAllModels(): ModelInfo[] {
    return providerRegistry.getAllModels();
  }

  getModelsByProvider(providerType: ProviderType): ModelInfo[] {
    return providerRegistry.getModelsByProvider(providerType);
  }

  searchModels(query: string): ModelInfo[] {
    return providerRegistry.searchModels(query);
  }

  getReasoningModels(): ModelInfo[] {
    return providerRegistry.getModelsByCapability('reasoning');
  }

  validateModel(model: string): boolean {
    return providerRegistry.validateModel(model);
  }

  updateConfig(newConfig: Partial<ProviderClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ProviderClientConfig {
    return { ...this.config };
  }

  // Check if a provider is properly configured
  isProviderConfigured(providerType: ProviderType): boolean {
    const config = this.buildProviderConfig(providerType);
    return !!config.apiKey;
  }

  // Get list of configured providers
  getConfiguredProviders(): ProviderType[] {
    return providerRegistry.getSupportedProviders().filter(type => 
      this.isProviderConfigured(type)
    );
  }

  private buildProviderConfig(providerType: ProviderType): ProviderConfig {
    let apiKey = '';
    let baseUrl: string | undefined;

    switch (providerType) {
      case 'openrouter':
        apiKey = this.config.openRouterApiKey || '';
        baseUrl = this.config.openRouterBaseUrl;
        break;
      case 'openai':
        apiKey = this.config.openAiApiKey || '';
        baseUrl = this.config.openAiBaseUrl;
        break;
      case 'anthropic':
        apiKey = this.config.anthropicApiKey || '';
        baseUrl = this.config.anthropicBaseUrl;
        break;
      case 'google':
        apiKey = this.config.googleApiKey || '';
        baseUrl = this.config.googleBaseUrl;
        break;
      case 'xai':
        apiKey = this.config.xaiApiKey || '';
        baseUrl = this.config.xaiBaseUrl;
        break;
      default:
        throw new ProviderError(
          `Unknown provider type: ${providerType}`,
          'client',
          400,
          undefined,
          false
        );
    }

    return {
      apiKey,
      baseUrl,
      timeout: this.config.defaultTimeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    };
  }
}

// Utility function to create a client from environment variables
export function createProviderClientFromEnv(): ProviderClient {
  return new ProviderClient({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openAiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    xaiApiKey: process.env.XAI_API_KEY,
    
    openRouterBaseUrl: process.env.CUSTOM_BASE_URL || process.env.OPENROUTER_BASE_URL,
    openAiBaseUrl: process.env.OPENAI_BASE_URL,
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
    googleBaseUrl: process.env.GOOGLE_BASE_URL,
    xaiBaseUrl: process.env.XAI_BASE_URL,

    defaultTimeout: 120000,
    maxRetries: 3,
    retryDelay: 1000
  });
}