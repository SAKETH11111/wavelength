import { BaseAIProvider } from './base-provider';
import { 
  CompletionRequest, 
  CompletionResponse,
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ModelInfo,
  CostCalculation 
} from './types';

export class OpenRouterProvider extends BaseAIProvider {
  readonly name = 'OpenRouter';
  
  // Dynamic model support - OpenRouter supports many models, we'll validate at runtime
  readonly supportedModels: ModelInfo[] = [];
  
  // Cache for model info fetched from OpenRouter API
  private modelCache: Map<string, ModelInfo> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Fetch models from OpenRouter API
  private async fetchModelInfo(apiKey: string): Promise<ModelInfo[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      
      if (!response.ok) {
        console.warn(`OpenRouter models API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }
      
      return data.data.map((model: {
        id: string;
        name?: string;
        context_length?: number;
        pricing?: {
          prompt?: string;
          completion?: string;
        };
      }): ModelInfo => {
        let providerName = 'OpenRouter';
        if (model.id.startsWith('openai/')) providerName = 'OpenAI';
        else if (model.id.startsWith('anthropic/')) providerName = 'Anthropic';
        else if (model.id.startsWith('google/')) providerName = 'Google';
        else if (model.id.startsWith('xai/')) providerName = 'XAI';
        else if (model.id.startsWith('mistralai/')) providerName = 'Mistral';
        else if (model.id.startsWith('meta-llama/')) providerName = 'Meta';
        
        return {
          id: model.id,
          name: model.name || model.id.split('/').pop() || model.id,
          provider: providerName,
          contextLength: model.context_length || 4096,
          inputCostPer1M: model.pricing?.prompt ? parseFloat(model.pricing.prompt) * 1000000 : 0,
          outputCostPer1M: model.pricing?.completion ? parseFloat(model.pricing.completion) * 1000000 : 0,
          supportsReasoning: model.id.includes('o1') || model.id.includes('o3') || model.id.includes('reasoning'),
          supportsStreaming: true,
        };
      }).filter((model: ModelInfo) => {
        // Filter to text models only
        const modelId = model.id.toLowerCase();
        return !modelId.includes('dall-e') && 
               !modelId.includes('midjourney') && 
               !modelId.includes('stable-diffusion') &&
               !modelId.includes('imagen') &&
               !modelId.includes('video') &&
               !modelId.includes('whisper') &&
               !modelId.includes('tts') &&
               !modelId.includes('embedding') &&
               !modelId.includes('moderation');
      });
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [];
    }
  }

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      ...super.getDefaultConfig(),
      baseUrl: 'https://openrouter.ai/api/v1'
    };
  }
  
  // Override model validation to be more permissive for OpenRouter
  validateModel(model: string): boolean {
    // OpenRouter supports many models dynamically, so we'll be permissive
    // Most models follow the pattern: provider/model-name
    return model.includes('/') || 
           model.startsWith('gpt') ||
           model.startsWith('claude') ||
           model.startsWith('gemini') ||
           model.startsWith('llama') ||
           model.startsWith('mistral') ||
           model.startsWith('grok') ||
           model.includes('o1') ||
           model.includes('o3');
  }
  
  // Override getModelInfo to fetch from API if needed
  getModelInfo(model: string): ModelInfo | undefined {
    // Check cache first
    if (this.modelCache.has(model) && Date.now() < this.cacheExpiry) {
      return this.modelCache.get(model);
    }
    
    // For unknown models, provide sensible defaults
    // This ensures compatibility with all OpenRouter models
    const defaultInfo: ModelInfo = {
      id: model,
      name: model.split('/').pop() || model,
      provider: model.startsWith('openai/') ? 'OpenAI' :
                model.startsWith('anthropic/') ? 'Anthropic' :
                model.startsWith('google/') ? 'Google' :
                model.startsWith('xai/') ? 'XAI' :
                model.startsWith('mistralai/') ? 'Mistral' :
                model.startsWith('meta-llama/') ? 'Meta' : 'OpenRouter',
      contextLength: model.includes('o1') || model.includes('o3') ? 128000 :
                     model.includes('claude') ? 200000 :
                     model.includes('gemini') ? 1000000 : 128000,
      inputCostPer1M: model.includes('o3') ? 15 :
                      model.includes('o1') ? 15 :
                      model.includes('gpt-4') ? 10 :
                      model.includes('claude-3.5-sonnet') ? 3 :
                      model.includes('claude') ? 0.8 :
                      model.includes('gemini') ? 1.25 : 2,
      outputCostPer1M: model.includes('o3') ? 60 :
                       model.includes('o1') ? 60 :
                       model.includes('gpt-4') ? 30 :
                       model.includes('claude-3.5-sonnet') ? 15 :
                       model.includes('claude') ? 4 :
                       model.includes('gemini') ? 5 : 10,
      supportsReasoning: model.includes('o1') || model.includes('o3') || model.includes('reasoning'),
      supportsStreaming: true,
    };
    
    // Cache the default info
    this.modelCache.set(model, defaultInfo);
    this.cacheExpiry = Date.now() + this.CACHE_TTL;
    
    return defaultInfo;
  }

  protected async makeRequest(request: CompletionRequest, config: ProviderConfig): Promise<Response> {
    const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    const timeout = config.timeout || 120000;

    // Add reasoning prompt for models that support it
    const modelInfo = this.getModelInfo(request.model);
    const enhancedRequest = modelInfo?.supportsReasoning 
      ? this.addReasoningPrompt(request)
      : request;

    const payload = {
      model: enhancedRequest.model, // Send model ID as-is to OpenRouter
      messages: enhancedRequest.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true,
      temperature: enhancedRequest.temperature,
      max_tokens: enhancedRequest.max_tokens,
      top_p: enhancedRequest.top_p,
      frequency_penalty: enhancedRequest.frequency_penalty,
      presence_penalty: enhancedRequest.presence_penalty,
      stop: enhancedRequest.stop,
      // Request usage information from OpenRouter
      usage: {
        include: true
      }
    };

    console.log(`OpenRouter request: ${request.model} to ${baseUrl}/chat/completions`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://wavelength.chat', // OpenRouter prefers this
          'X-Title': 'Wavelength Chat', // OpenRouter app identification
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      console.log(`OpenRouter response: ${response.status} for model ${request.model}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API error for model ${request.model}:`, errorText);
        throw new ProviderError(
          `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`,
          this.name,
          response.status,
          undefined,
          response.status >= 500 || response.status === 429
        );
      }

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
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        0,
        error instanceof Error ? error : undefined,
        true
      );
    }
  }

  protected parseStreamChunk(line: string): StreamChunk | null {
    if (!line.trim()) return null;
    
    // Skip OpenRouter comment lines (used to prevent connection timeouts)
    if (line.startsWith(': ')) return null;
    
    // Only process data lines
    if (!line.startsWith('data: ')) return null;

    const dataStr = line.substring(6);
    if (dataStr === '[DONE]') return null;

    try {
      const data = JSON.parse(dataStr);
      
      // Convert OpenRouter format to our standardized format
      interface OpenRouterChoice {
        index?: number;
        delta?: {
          content?: string;
          reasoning?: string;
        };
        finish_reason?: string;
      }
      
      interface OpenRouterUsage {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        reasoning_tokens?: number;
        completion_tokens_details?: {
          reasoning_tokens?: number;
        };
        cost?: number; // OpenRouter returns cost in credits
        cost_details?: {
          upstream_inference_cost?: number;
        };
      }
      
      interface OpenRouterData {
        id?: string;
        model?: string;
        choices?: OpenRouterChoice[];
        usage?: OpenRouterUsage;
      }
      
      const openRouterData = data as OpenRouterData;
      
      const parsedUsage = openRouterData.usage ? {
        prompt_tokens: openRouterData.usage.prompt_tokens || 0,
        completion_tokens: openRouterData.usage.completion_tokens || 0,
        total_tokens: openRouterData.usage.total_tokens || 0,
        reasoning_tokens: openRouterData.usage.completion_tokens_details?.reasoning_tokens || 
                         openRouterData.usage.reasoning_tokens || 0,
        cost: openRouterData.usage.cost // OpenRouter cost in credits
      } : undefined;
      
      return {
        id: openRouterData.id || '',
        model: openRouterData.model || '',
        choices: openRouterData.choices?.map((choice) => ({
          index: choice.index || 0,
          delta: {
            content: choice.delta?.content || undefined,
            reasoning: choice.delta?.reasoning || undefined
          },
          finish_reason: choice.finish_reason || undefined
        })) || [],
        usage: parsedUsage
      };
    } catch (parseError) {
      console.warn('Failed to parse OpenRouter stream chunk:', dataStr, parseError);
      return null;
    }
  }

  // Override cost calculation to use OpenRouter's native cost when available
  calculateCost(usage: CompletionResponse['usage'], model: string): CostCalculation {
    if (!usage) {
      return { inputCost: 0, outputCost: 0, reasoningCost: 0, totalCost: 0 };
    }

    // If OpenRouter provided native cost, use it
    if (usage.cost !== undefined) {
      return {
        inputCost: 0, // OpenRouter doesn't break down costs
        outputCost: 0,
        reasoningCost: 0,
        totalCost: usage.cost
      };
    }

    // Fallback to estimated calculation using model info
    return super.calculateCost(usage, model);
  }

  async pollGenerationStats(generationId: string, config: ProviderConfig): Promise<unknown> {
    const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    
    try {
      const response = await fetch(`${baseUrl}/generation?id=${generationId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error polling OpenRouter generation stats:', error);
    }
    
    return null;
  }
}