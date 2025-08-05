import { BaseAIProvider } from './base-provider';
import { 
  CompletionRequest, 
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ModelInfo 
} from './types';

export class XAIProvider extends BaseAIProvider {
  readonly name = 'XAI';
  
  readonly supportedModels: ModelInfo[] = [
    {
      id: 'grok-beta',
      name: 'Grok Beta',
      provider: 'xai',
      contextLength: 131072,
      inputCostPer1M: 5.0,
      outputCostPer1M: 15.0,
      supportsReasoning: true,
      supportsStreaming: true
    },
    {
      id: 'grok-2-1212',
      name: 'Grok 2 (1212)',
      provider: 'xai',
      contextLength: 131072,
      inputCostPer1M: 2.0,
      outputCostPer1M: 10.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'grok-2-vision-1212',
      name: 'Grok 2 Vision (1212)',
      provider: 'xai',
      contextLength: 131072,
      inputCostPer1M: 2.0,
      outputCostPer1M: 10.0,
      supportsReasoning: false,
      supportsStreaming: true
    }
  ];

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      ...super.getDefaultConfig(),
      baseUrl: 'https://api.x.ai/v1'
    };
  }

  protected async makeRequest(request: CompletionRequest, config: ProviderConfig): Promise<Response> {
    const baseUrl = config.baseUrl || 'https://api.x.ai/v1';
    const timeout = config.timeout || 120000;

    // Add reasoning prompt for models that support it
    const modelInfo = this.getModelInfo(request.model);
    const enhancedRequest = modelInfo?.supportsReasoning 
      ? this.addReasoningPrompt(request)
      : request;

    // Prepare payload with XAI-specific format (OpenAI-compatible)
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
          `Request timeout after ${timeout}ms - Grok models take time to process`,
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
    
    // XAI uses 'data: ' prefix (OpenAI-compatible)
    if (!line.startsWith('data: ')) return null;

    const dataStr = line.substring(6);
    if (dataStr === '[DONE]') return null;

    try {
      const data = JSON.parse(dataStr);
      
      // Convert XAI format to our standardized format (should be OpenAI-compatible)
      interface XAIChoice {
        index?: number;
        delta?: {
          content?: string;
          reasoning?: string;
        };
        finish_reason?: string;
      }
      
      interface XAIUsage {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: {
          reasoning_tokens?: number;
        };
      }
      
      interface XAIData {
        id?: string;
        model?: string;
        choices?: XAIChoice[];
        usage?: XAIUsage;
      }
      
      const xaiData = data as XAIData;
      
      return {
        id: xaiData.id || '',
        model: xaiData.model || '',
        choices: xaiData.choices?.map((choice) => ({
          index: choice.index || 0,
          delta: {
            content: choice.delta?.content || undefined,
            reasoning: choice.delta?.reasoning || undefined
          },
          finish_reason: choice.finish_reason || undefined
        })) || [],
        usage: xaiData.usage ? {
          prompt_tokens: xaiData.usage.prompt_tokens || 0,
          completion_tokens: xaiData.usage.completion_tokens || 0,
          total_tokens: xaiData.usage.total_tokens || 0,
          reasoning_tokens: xaiData.usage.completion_tokens_details?.reasoning_tokens || 0
        } : undefined
      };
    } catch (parseError) {
      console.warn('Failed to parse XAI stream chunk:', dataStr, parseError);
      return null;
    }
  }

  validateConfig(config: ProviderConfig): void {
    super.validateConfig(config);
    
    if (!config.apiKey.startsWith('xai-')) {
      throw new ProviderError(
        'XAI API key must start with "xai-"',
        this.name,
        401,
        undefined,
        false
      );
    }
  }

  protected getReasoningPrompt(model: string, effort: string = 'high'): string {
    // Enhanced reasoning prompt specifically for Grok models
    const basePrompt = super.getReasoningPrompt(model, effort);
    
    if (model.toLowerCase().includes('grok')) {
      return `${basePrompt}

For this Grok model, please leverage your unique perspective and reasoning capabilities to explore the problem from multiple creative angles. Consider unconventional approaches while maintaining rigorous logical analysis. Take time to examine the problem space comprehensively, bringing both analytical depth and creative insight to your reasoning process.`;
    }

    return basePrompt;
  }
}