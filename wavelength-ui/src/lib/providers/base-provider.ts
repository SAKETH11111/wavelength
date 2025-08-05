import { 
  AIProvider, 
  CompletionRequest, 
  CompletionResponse,
  StreamChunk, 
  ProviderConfig, 
  ProviderError, 
  ModelInfo,
  CostCalculation 
} from './types';

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly supportedModels: ModelInfo[];

  protected abstract makeRequest(
    request: CompletionRequest, 
    config: ProviderConfig
  ): Promise<Response>;

  protected abstract parseStreamChunk(line: string): StreamChunk | null;

  async complete(
    request: CompletionRequest, 
    config: ProviderConfig
  ): Promise<AsyncIterable<StreamChunk>> {
    this.validateConfig(config);
    
    if (!this.validateModel(request.model)) {
      throw new ProviderError(
        `Model ${request.model} is not supported by ${this.name}`,
        this.name,
        400,
        undefined,
        false
      );
    }

    const response = await this.makeRequestWithRetry(request, config);
    
    if (!response.ok) {
      throw ProviderError.fromResponse(response, this.name);
    }

    return this.createStreamIterator(response);
  }

  protected async makeRequestWithRetry(
    request: CompletionRequest, 
    config: ProviderConfig,
    attempt: number = 1
  ): Promise<Response> {
    const maxRetries = config.maxRetries ?? 3;
    const retryDelay = config.retryDelay ?? 1000;

    try {
      return await this.makeRequest(request, config);
    } catch (error) {
      const providerError = error instanceof ProviderError 
        ? error 
        : ProviderError.fromError(error as Error, this.name);

      if (attempt < maxRetries && providerError.retryable) {
        console.warn(`${this.name} request failed (attempt ${attempt}/${maxRetries}):`, providerError.message);
        await this.delay(retryDelay * attempt);
        return this.makeRequestWithRetry(request, config, attempt + 1);
      }

      throw providerError;
    }
  }

  protected async *createStreamIterator(response: Response): AsyncIterable<StreamChunk> {
    if (!response.body) {
      throw new ProviderError('No response stream available', this.name);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          const chunk = this.parseStreamChunk(line);
          if (chunk) {
            yield chunk;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  validateModel(model: string): boolean {
    return this.supportedModels.some(m => m.id === model);
  }

  getModelInfo(model: string): ModelInfo | undefined {
    return this.supportedModels.find(m => m.id === model);
  }

  calculateCost(usage: CompletionResponse['usage'], model: string): CostCalculation {
    const modelInfo = this.getModelInfo(model);
    if (!modelInfo || !usage) {
      return { inputCost: 0, outputCost: 0, reasoningCost: 0, totalCost: 0 };
    }

    const inputCost = (usage.prompt_tokens / 1_000_000) * (modelInfo.inputCostPer1M ?? 0);
    const outputCost = (usage.completion_tokens / 1_000_000) * (modelInfo.outputCostPer1M ?? 0);
    const reasoningCost = ((usage.reasoning_tokens ?? 0) / 1_000_000) * (modelInfo.reasoningCostPer1M ?? 0);
    
    return {
      inputCost,
      outputCost,
      reasoningCost,
      totalCost: inputCost + outputCost + reasoningCost
    };
  }

  validateConfig(config: ProviderConfig): void {
    if (!config.apiKey) {
      throw new ProviderError(
        `API key is required for ${this.name}`,
        this.name,
        401,
        undefined,
        false
      );
    }
  }

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      timeout: 120000, // 2 minutes
      maxRetries: 3,
      retryDelay: 1000
    };
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected addReasoningPrompt(request: CompletionRequest): CompletionRequest {
    const reasoningPrompt = this.getReasoningPrompt(request.model, request.reasoning?.effort);
    const messages = [...request.messages];
    
    const hasSystemMessage = messages.some(msg => msg.role === 'system');
    
    if (!hasSystemMessage) {
      messages.unshift({
        role: 'system',
        content: reasoningPrompt
      });
    } else {
      const systemMsg = messages.find(msg => msg.role === 'system');
      if (systemMsg) {
        systemMsg.content = `${reasoningPrompt}\n\n${systemMsg.content}`;
      }
    }

    return { ...request, messages };
  }

  protected getReasoningPrompt(model: string, effort: string = 'high'): string {
    // Base reasoning prompt varies by effort level
    const intensityText = effort === 'low' ? 'efficiently' : effort === 'medium' ? 'carefully' : 'as thoroughly as possible';
    
    const basePrompt = `Take your time and think ${intensityText} about the problem. Spend the necessary time to analyze every aspect, consider all possible approaches, and reason through the implications step by step.

Please think deeply about:
- All possible interpretations and edge cases
- Multiple solution strategies and their trade-offs
- Potential risks, limitations, and assumptions
- How different components interact and influence each other
- Alternative perspectives and counterarguments
- Long-term implications and consequences

Feel free to explore tangential but relevant considerations that might impact the solution. The goal is comprehensive understanding and the most thoughtful, well-reasoned response possible.`;

    if (model.toLowerCase().includes('o3')) {
      return `${basePrompt}

For this o3 model, please engage your full reasoning capabilities. Break down complex problems into logical components, systematically evaluate each part, and synthesize insights across different levels of abstraction. Take time to validate your reasoning at each step.`;
    } else if (model.toLowerCase().includes('grok')) {
      return `${basePrompt}

For this Grok model, please leverage your reasoning capabilities to explore the problem from multiple creative angles. Consider unconventional approaches while maintaining rigorous logical analysis. Take time to examine the problem space comprehensively.`;
    } else if (model.toLowerCase().includes('o1')) {
      return `${basePrompt}

For this o1 model, please engage in deliberate, methodical reasoning. Work through the problem systematically, considering all relevant factors and their interactions. Take whatever time is needed for thorough analysis.`;
    }

    return basePrompt;
  }
}