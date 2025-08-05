// Core types and interfaces for the provider abstraction system

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  id?: string;
}

export interface CompletionRequest {
  model: string;
  messages: CompletionMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  reasoning?: {
    effort: 'low' | 'medium' | 'high';
    summary: string;
  };
}

export interface CompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
      reasoning?: string;
    };
    delta?: {
      content?: string;
      reasoning?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
    cost?: number; // Cost in credits/dollars
  };
  created: number;
}

export interface StreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      reasoning?: string;
    };
    finish_reason?: string;
  }>;
  usage?: CompletionResponse['usage'];
}

export interface StreamEvent {
  sequence_number: number;
  data: {
    type: string;
    task_id?: string;
    model?: string;
    content?: string;
    step?: number;
    total_steps?: number;
    message?: string;
    response?: string;
    usage?: CompletionResponse['usage'];
    choices?: StreamChunk['choices'];
    id?: string;
  };
  timestamp: number;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  reasoningCostPer1M?: number;
  supportsReasoning?: boolean;
  supportsStreaming?: boolean;
}

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly statusCode?: number;
  public readonly originalError?: Error;
  public readonly retryable: boolean;

  constructor(
    message: string,
    provider: string,
    statusCode?: number,
    originalError?: Error,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.retryable = retryable;
  }

  static fromResponse(response: Response, provider: string): ProviderError {
    const retryable = response.status >= 500 || response.status === 429;
    return new ProviderError(
      `API Error ${response.status}: ${response.statusText}`,
      provider,
      response.status,
      undefined,
      retryable
    );
  }

  static fromError(error: Error, provider: string): ProviderError {
    const retryable = error.message.includes('timeout') || 
                     error.message.includes('network') ||
                     error.message.includes('ECONNRESET');
    
    return new ProviderError(
      error.message,
      provider,
      undefined,
      error,
      retryable
    );
  }
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  reasoningCost: number;
  totalCost: number;
}

// Abstract base interface for all AI providers
export interface AIProvider {
  readonly name: string;
  readonly supportedModels: ModelInfo[];
    
  // Core completion method
  complete(request: CompletionRequest, config: ProviderConfig): Promise<AsyncIterable<StreamChunk>>;
  
  // Utility methods
  validateModel(model: string): boolean;
  getModelInfo(model: string): ModelInfo | undefined;
  calculateCost(usage: CompletionResponse['usage'], model: string): CostCalculation;
  
  // Provider-specific configuration
  getDefaultConfig(): Partial<ProviderConfig>;
  validateConfig(config: ProviderConfig): void;
}

export type ProviderType = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'xai';

export interface ProviderFactory {
  createProvider(type: ProviderType): AIProvider;
  getSupportedProviders(): ProviderType[];
  getProviderForModel(model: string): ProviderType | undefined;
}