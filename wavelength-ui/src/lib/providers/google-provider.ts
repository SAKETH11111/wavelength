import { BaseAIProvider } from './base-provider';
import { 
  CompletionRequest, 
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ModelInfo,
  CompletionMessage 
} from './types';

interface GoogleContent {
  role: string;
  parts: Array<{ text: string }>;
}

export class GoogleProvider extends BaseAIProvider {
  readonly name = 'Google';
  
  readonly supportedModels: ModelInfo[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      contextLength: 1000000,
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      contextLength: 1000000,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.3,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'gemini-1.5-flash-8b',
      name: 'Gemini 1.5 Flash 8B',
      provider: 'google',
      contextLength: 1000000,
      inputCostPer1M: 0.0375,
      outputCostPer1M: 0.15,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash (Experimental)',
      provider: 'google',
      contextLength: 1000000,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.3,
      supportsReasoning: false,
      supportsStreaming: true
    }
  ];

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      ...super.getDefaultConfig(),
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
    };
  }

  protected async makeRequest(request: CompletionRequest, config: ProviderConfig): Promise<Response> {
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const timeout = config.timeout || 120000;

    // Convert messages to Gemini format
    const contents = this.convertMessages(request.messages);

    // Prepare payload with Google-specific format
    const generationConfig = {
      temperature: request.temperature,
      topP: request.top_p,
      maxOutputTokens: request.max_tokens || 8192,
      stopSequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined,
      candidateCount: 1
    };

    // Remove undefined values
    Object.keys(generationConfig).forEach((key) => {
      const typedKey = key as keyof typeof generationConfig;
      if (generationConfig[typedKey] === undefined) {
        delete generationConfig[typedKey];
      }
    });

    const payload = {
      contents: contents,
      generationConfig: generationConfig
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/models/${request.model}:streamGenerateContent?key=${config.apiKey}`, {
        method: 'POST',
        headers: {
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
          `Request timeout after ${timeout}ms`,
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
    
    // Google uses JSON objects separated by newlines, not SSE format
    try {
      const data = JSON.parse(line);
      
      if (!data.candidates || data.candidates.length === 0) {
        return null;
      }

      const candidate = data.candidates[0];
      let content = '';

      // Extract text content from the candidate
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            content += part.text;
          }
        }
      }

      return {
        id: '', // Google doesn't provide a stream ID
        model: '',
        choices: [{
          index: 0,
          delta: {
            content: content || undefined
          },
          finish_reason: candidate.finishReason ? this.mapFinishReason(candidate.finishReason) : undefined
        }],
        usage: data.usageMetadata ? {
          prompt_tokens: data.usageMetadata.promptTokenCount || 0,
          completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata.totalTokenCount || 0,
          reasoning_tokens: 0
        } : undefined
      };
    } catch (parseError) {
      console.warn('Failed to parse Google stream chunk:', line, parseError);
      return null;
    }
  }

  private convertMessages(messages: CompletionMessage[]): GoogleContent[] {
    const contents: GoogleContent[] = [];
    let systemInstruction = '';

    for (const message of messages) {
      if (message.role === 'system') {
        // Google handles system messages as systemInstruction
        systemInstruction += (systemInstruction ? '\n\n' : '') + message.content;
      } else {
        // Map roles: user -> user, assistant -> model
        const role = message.role === 'assistant' ? 'model' : 'user';
        
        contents.push({
          role: role,
          parts: [{
            text: message.content
          }]
        });
      }
    }

    // Add system instruction as the first user message if present
    if (systemInstruction) {
      contents.unshift({
        role: 'user',
        parts: [{
          text: `System Instructions: ${systemInstruction}\n\nNow please respond to the following:`
        }]
      });
    }

    return contents;
  }

  private mapFinishReason(googleReason: string): string {
    switch (googleReason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      case 'OTHER':
        return 'stop';
      default:
        return 'stop';
    }
  }

  validateConfig(config: ProviderConfig): void {
    super.validateConfig(config);
    
    // Google uses API keys that typically start with 'AIza'
    if (!config.apiKey.startsWith('AIza')) {
      console.warn('Google API key should typically start with "AIza"');
    }
  }
}