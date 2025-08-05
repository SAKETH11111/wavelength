import { BaseAIProvider } from './base-provider';
import { 
  CompletionRequest, 
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ModelInfo,
  CompletionMessage 
} from './types';

interface AnthropicMessage {
  role: string;
  content: Array<{ type: string; text: string }>;
}

export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'Anthropic';
  
  readonly supportedModels: ModelInfo[] = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextLength: 200000,
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      contextLength: 200000,
      inputCostPer1M: 0.8,
      outputCostPer1M: 4.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      contextLength: 200000,
      inputCostPer1M: 15.0,
      outputCostPer1M: 75.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      contextLength: 200000,
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
      supportsReasoning: false,
      supportsStreaming: true
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextLength: 200000,
      inputCostPer1M: 0.25,
      outputCostPer1M: 1.25,
      supportsReasoning: false,
      supportsStreaming: true
    }
  ];

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      ...super.getDefaultConfig(),
      baseUrl: 'https://api.anthropic.com/v1'
    };
  }

  protected async makeRequest(request: CompletionRequest, config: ProviderConfig): Promise<Response> {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    const timeout = config.timeout || 120000;

    // Convert OpenAI-style conversation to Anthropic format
    const { system, messages } = this.convertMessages(request.messages);

    // Prepare payload with Anthropic-specific format
    const payload: Record<string, unknown> = {
      model: request.model,
      messages: messages,
      stream: true,
      max_tokens: request.max_tokens || 4096
    };

    // Add system message if present
    if (system) {
      payload.system = system;
    }

    // Add optional parameters if provided
    if (request.temperature !== undefined) payload.temperature = request.temperature;
    if (request.top_p !== undefined) payload.top_p = request.top_p;
    if (request.stop !== undefined) payload.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
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
    
    // Anthropic uses 'data: ' prefix
    if (!line.startsWith('data: ')) return null;

    const dataStr = line.substring(6);
    if (dataStr === '[DONE]') return null;

    try {
      const data = JSON.parse(dataStr);
      
      // Handle different Anthropic stream event types
      if (data.type === 'message_start') {
        return {
          id: data.message?.id || '',
          model: data.message?.model || '',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: undefined
          }],
          usage: data.message?.usage ? {
            prompt_tokens: data.message.usage.input_tokens || 0,
            completion_tokens: data.message.usage.output_tokens || 0,
            total_tokens: (data.message.usage.input_tokens || 0) + (data.message.usage.output_tokens || 0),
            reasoning_tokens: 0
          } : undefined
        };
      } else if (data.type === 'content_block_delta') {
        return {
          id: '',
          model: '',
          choices: [{
            index: 0,
            delta: {
              content: data.delta?.text || undefined
            },
            finish_reason: undefined
          }]
        };
      } else if (data.type === 'message_delta') {
        return {
          id: '',
          model: '',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: data.delta?.stop_reason || undefined
          }],
          usage: data.usage ? {
            prompt_tokens: 0,
            completion_tokens: data.usage.output_tokens || 0,
            total_tokens: data.usage.output_tokens || 0,
            reasoning_tokens: 0
          } : undefined
        };
      }
      
      return null;
    } catch (parseError) {
      console.warn('Failed to parse Anthropic stream chunk:', dataStr, parseError);
      return null;
    }
  }

  private convertMessages(messages: CompletionMessage[]): { system?: string; messages: AnthropicMessage[] } {
    let system: string | undefined;
    const convertedMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Anthropic handles system messages separately
        if (system) {
          system += '\n\n' + message.content;
        } else {
          system = message.content;
        }
      } else {
        // Convert user/assistant messages
        convertedMessages.push({
          role: message.role,
          content: [{
            type: 'text',
            text: message.content
          }]
        });
      }
    }

    // Anthropic requires alternating user/assistant messages
    // and must start with user message
    const validatedMessages = this.validateMessageSequence(convertedMessages);

    return { system, messages: validatedMessages };
  }

  private validateMessageSequence(messages: AnthropicMessage[]): AnthropicMessage[] {
    if (messages.length === 0) return messages;

    const validated: AnthropicMessage[] = [];
    let lastRole: string | null = null;

    for (const message of messages) {
      // Skip consecutive messages with the same role
      if (message.role === lastRole) {
        // Merge content with previous message
        if (validated.length > 0) {
          const lastMessage = validated[validated.length - 1];
          lastMessage.content[0].text += '\n\n' + message.content[0].text;
        }
        continue;
      }

      validated.push(message);
      lastRole = message.role;
    }

    // Ensure first message is from user
    if (validated.length > 0 && validated[0].role !== 'user') {
      validated.unshift({
        role: 'user',
        content: [{
          type: 'text',
          text: 'Please respond to the following:'
        }]
      });
    }

    return validated;
  }

  validateConfig(config: ProviderConfig): void {
    super.validateConfig(config);
    
    if (!config.apiKey.startsWith('sk-ant-')) {
      throw new ProviderError(
        'Anthropic API key must start with "sk-ant-"',
        this.name,
        401,
        undefined,
        false
      );
    }
  }
}