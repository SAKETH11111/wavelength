import { BaseAIProvider } from './base-provider';
import { 
  CompletionRequest, 
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ModelInfo 
} from './types';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'OpenAI';
  
  readonly supportedModels: ModelInfo[] = [
    {
      id: 'o3',
      name: 'o3',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 60.0,
      outputCostPer1M: 60.0,
      reasoningCostPer1M: 200.0,
      supportsReasoning: true,
      supportsStreaming: true
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 3.0,
      outputCostPer1M: 12.0,
      reasoningCostPer1M: 12.0,
      supportsReasoning: true,
      supportsStreaming: true
    },
    {
      id: 'o1',
      name: 'o1',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 15.0,
      outputCostPer1M: 60.0,
      reasoningCostPer1M: 60.0,
      supportsReasoning: true,
      supportsStreaming: true
    },
    {
      id: 'o1-mini',
      name: 'o1-mini',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 3.0,
      outputCostPer1M: 12.0,
      reasoningCostPer1M: 12.0,
      supportsReasoning: true,
      supportsStreaming: true
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 2.5,
      outputCostPer1M: 10.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.6,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      contextLength: 128000,
      inputCostPer1M: 10.0,
      outputCostPer1M: 30.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextLength: 16385,
      inputCostPer1M: 0.5,
      outputCostPer1M: 1.5,
      supportsReasoning: false,
      supportsStreaming: true
    }
  ];

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      ...super.getDefaultConfig(),
      baseUrl: 'https://api.openai.com/v1'
    };
  }

  protected async makeRequest(request: CompletionRequest, config: ProviderConfig): Promise<Response> {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const timeout = config.timeout || 120000;

    // Add reasoning prompt for models that support it
    const modelInfo = this.getModelInfo(request.model);
    const enhancedRequest = modelInfo?.supportsReasoning 
      ? this.addReasoningPrompt(request)
      : request;

    // Prepare payload with OpenAI-specific handling
    const payload: Record<string, unknown> = {
      model: enhancedRequest.model,
      messages: enhancedRequest.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true
    };

    // Add optional parameters if provided
    if (enhancedRequest.temperature !== undefined) payload.temperature = enhancedRequest.temperature;
    if (enhancedRequest.max_tokens !== undefined) payload.max_tokens = enhancedRequest.max_tokens;
    if (enhancedRequest.top_p !== undefined) payload.top_p = enhancedRequest.top_p;
    if (enhancedRequest.frequency_penalty !== undefined) payload.frequency_penalty = enhancedRequest.frequency_penalty;
    if (enhancedRequest.presence_penalty !== undefined) payload.presence_penalty = enhancedRequest.presence_penalty;
    if (enhancedRequest.stop !== undefined) payload.stop = enhancedRequest.stop;

    // Add reasoning-specific parameters for o1/o3 models
    if (modelInfo?.supportsReasoning && enhancedRequest.reasoning) {
      if (enhancedRequest.reasoning.effort === 'low') {
        payload.reasoning_effort = 'low';
      } else if (enhancedRequest.reasoning.effort === 'medium') {
        payload.reasoning_effort = 'medium';
      } else {
        payload.reasoning_effort = 'high';
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Wavelength/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError(
          `Request timeout after ${timeout}ms - ${request.model} takes time to process`,
          this.name,
          408,
          error,
          true
        );
      }
      throw error;
    }
  }

  protected parseStreamChunk(line: string): StreamChunk | null {
    if (!line.trim()) return null;
    
    // OpenAI uses 'data: ' prefix
    if (!line.startsWith('data: ')) return null;

    const dataStr = line.substring(6);
    if (dataStr === '[DONE]') return null;

    try {
      const data = JSON.parse(dataStr);
      
      // Convert OpenAI format to our standardized format
      interface OpenAIChoice {
        index?: number;
        delta?: {
          content?: string;
          reasoning?: string;
        };
        finish_reason?: string;
      }
      
      interface OpenAIUsage {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: {
          reasoning_tokens?: number;
        };
      }
      
      interface OpenAIData {
        id?: string;
        model?: string;
        choices?: OpenAIChoice[];
        usage?: OpenAIUsage;
      }
      
      const openAIData = data as OpenAIData;
      
      return {
        id: openAIData.id || '',
        model: openAIData.model || '',
        choices: openAIData.choices?.map((choice) => ({
          index: choice.index || 0,
          delta: {
            content: choice.delta?.content || undefined,
            reasoning: choice.delta?.reasoning || undefined
          },
          finish_reason: choice.finish_reason || undefined
        })) || [],
        usage: openAIData.usage ? {
          prompt_tokens: openAIData.usage.prompt_tokens || 0,
          completion_tokens: openAIData.usage.completion_tokens || 0,
          total_tokens: openAIData.usage.total_tokens || 0,
          reasoning_tokens: openAIData.usage.completion_tokens_details?.reasoning_tokens || 0
        } : undefined
      };
    } catch (parseError) {
      console.warn('Failed to parse OpenAI stream chunk:', dataStr, parseError);
      return null;
    }
  }

  validateConfig(config: ProviderConfig): void {
    super.validateConfig(config);
    
    if (!config.apiKey.startsWith('sk-')) {
      throw new ProviderError(
        'OpenAI API key must start with "sk-"',
        this.name,
        401,
        undefined,
        false
      );
    }
  }
}