import { randomUUID } from 'crypto';
import {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ProviderConfig,
  ProviderError,
  ProviderType,
  ModelInfo,
  CostCalculation
} from './providers/types';
import { ProviderClient, ProviderClientConfig } from './providers/provider-client';
import { providerRegistry } from './providers/provider-registry';

// Gateway-specific types
export interface GatewayConfig {
  // Provider selection strategy
  providerSelectionStrategy: 'explicit' | 'automatic' | 'cost-optimized' | 'load-balanced';
  
  // Fallback configuration
  enableFallback: boolean;
  maxFallbackAttempts: number;
  fallbackDelay: number;
  
  // Rate limiting
  enableRateLimiting: boolean;
  rateLimitPerProvider: { [key in ProviderType]?: number }; // requests per minute
  rateLimitWindow: number; // window size in ms
  
  // Caching
  enableCaching: boolean;
  cacheMaxSize: number;
  cacheTTL: number; // milliseconds
  
  // Circuit breaker
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number; // failures before opening
  circuitBreakerTimeout: number; // ms before trying again
  
  // Cost management
  enableCostTracking: boolean;
  maxCostPerRequest: number; // in dollars
  budgetAlert: number; // total budget threshold
  
  // Health monitoring
  enableHealthMonitoring: boolean;
  healthCheckInterval: number; // ms
  unhealthyThreshold: number; // consecutive failures
  
  // Request validation
  enableRequestValidation: boolean;
  enableResponseSanitization: boolean;
  
  // Logging and telemetry
  enableDetailedLogging: boolean;
  enableMetrics: boolean;
  enableTracing: boolean;
}

export interface ProviderHealth {
  providerType: ProviderType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheckTime: number;
  consecutiveFailures: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
}

export interface RateLimitState {
  providerType: ProviderType;
  requests: number[];
  lastReset: number;
}

export interface CacheEntry {
  key: string;
  response: StreamChunk[];
  timestamp: number;
  cost: number;
  usage: CompletionResponse['usage'];
}

export interface CircuitBreakerState {
  providerType: ProviderType;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number;
  nextAttempt: number;
}

export interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  totalCost: number;
  requestsByProvider: { [key in ProviderType]?: number };
  errorsByProvider: { [key in ProviderType]?: number };
  cacheHitRate: number;
  fallbackUsage: number;
}

export interface RequestContext {
  requestId: string;
  model: string;
  providerType: ProviderType;
  startTime: number;
  cacheKey?: string;
  fallbackAttempts: number;
  cost: number;
  usage?: CompletionResponse['usage'];
  error?: string;
}

export interface GatewayLogger {
  info(message: string, context?: RequestContext): void;
  warn(message: string, context?: RequestContext): void;
  error(message: string, error: Error, context?: RequestContext): void;
  debug(message: string, context?: RequestContext): void;
}

export class DefaultGatewayLogger implements GatewayLogger {
  private enableDetailedLogging: boolean;

  constructor(enableDetailedLogging: boolean = false) {
    this.enableDetailedLogging = enableDetailedLogging;
  }

  info(message: string, context?: RequestContext): void {
    if (this.enableDetailedLogging) {
      console.log(`[Gateway] ${message}`, context ? { requestId: context.requestId, model: context.model, provider: context.providerType } : {});
    }
  }

  warn(message: string, context?: RequestContext): void {
    console.warn(`[Gateway] ${message}`, context ? { requestId: context.requestId, model: context.model, provider: context.providerType } : {});
  }

  error(message: string, error: Error, context?: RequestContext): void {
    console.error(`[Gateway] ${message}`, error, context ? { requestId: context.requestId, model: context.model, provider: context.providerType } : {});
  }

  debug(message: string, context?: RequestContext): void {
    if (this.enableDetailedLogging) {
      console.debug(`[Gateway] ${message}`, context ? { requestId: context.requestId, model: context.model, provider: context.providerType } : {});
    }
  }
}

export class UnifiedAPIGateway {
  private config: GatewayConfig;
  private providerClient: ProviderClient;
  private logger: GatewayLogger;
  
  private providerHealth: Map<ProviderType, ProviderHealth> = new Map();
  private rateLimitStates: Map<ProviderType, RateLimitState> = new Map();
  private circuitBreakers: Map<ProviderType, CircuitBreakerState> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: GatewayMetrics;
  
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    providerClientConfig: ProviderClientConfig,
    gatewayConfig: Partial<GatewayConfig> = {},
    logger?: GatewayLogger
  ) {
    this.config = {
      providerSelectionStrategy: 'automatic',
      enableFallback: true,
      maxFallbackAttempts: 2,
      fallbackDelay: 1000,
      enableRateLimiting: true,
      rateLimitPerProvider: {
        openai: 3000,
        anthropic: 1000,
        google: 1500,
        xai: 500,
        openrouter: 5000
      },
      rateLimitWindow: 60000,
      enableCaching: true,
      cacheMaxSize: 1000,
      cacheTTL: 300000, // 5 minutes
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 30000,
      enableCostTracking: true,
      maxCostPerRequest: 10.0,
      budgetAlert: 100.0,
      enableHealthMonitoring: true,
      healthCheckInterval: 30000,
      unhealthyThreshold: 3,
      enableRequestValidation: true,
      enableResponseSanitization: true,
      enableDetailedLogging: false,
      enableMetrics: true,
      enableTracing: true,
      ...gatewayConfig
    };

    this.providerClient = new ProviderClient(providerClientConfig);
    this.logger = logger || new DefaultGatewayLogger(this.config.enableDetailedLogging);
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalCost: 0,
      requestsByProvider: {},
      errorsByProvider: {},
      cacheHitRate: 0,
      fallbackUsage: 0
    };

    this.initializeProviderStates();
    this.startHealthMonitoring();
  }

  private initializeProviderStates(): void {
    const supportedProviders = providerRegistry.getSupportedProviders();
    
    for (const providerType of supportedProviders) {
      // Initialize health state
      this.providerHealth.set(providerType, {
        providerType,
        status: 'healthy',
        lastCheckTime: Date.now(),
        consecutiveFailures: 0,
        averageLatency: 0,
        successRate: 1.0,
        errorRate: 0.0
      });

      // Initialize rate limit state
      this.rateLimitStates.set(providerType, {
        providerType,
        requests: [],
        lastReset: Date.now()
      });

      // Initialize circuit breaker state
      this.circuitBreakers.set(providerType, {
        providerType,
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        nextAttempt: 0
      });
    }
  }

  private startHealthMonitoring(): void {
    if (!this.config.enableHealthMonitoring) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private performHealthChecks(): void {
    // Health checks are performed based on actual request patterns
    // This is a placeholder for scheduled health monitoring
    this.logger.debug('Performing health checks for all providers');
  }

  async complete(request: CompletionRequest): Promise<AsyncIterable<StreamChunk>> {
    const requestId = randomUUID();
    const context: RequestContext = {
      requestId,
      model: request.model,
      providerType: this.selectProvider(request.model),
      startTime: Date.now(),
      fallbackAttempts: 0,
      cost: 0
    };

    this.logger.info(`Starting completion request for model: ${request.model}`, context);
    this.metrics.totalRequests++;

    try {
      // Validate request
      if (this.config.enableRequestValidation) {
        this.validateRequest(request);
      }

      // Check cache first
      if (this.config.enableCaching) {
        const cachedResponse = this.getCachedResponse(request);
        if (cachedResponse) {
          this.logger.info('Cache hit - returning cached response', context);
          context.cost = cachedResponse.cost;
          context.usage = cachedResponse.usage;
          this.updateMetrics(context, true);
          return this.createAsyncIterableFromArray(cachedResponse.response);
        }
      }

      // Execute with fallback
      const result = await this.executeWithFallback(request, context);
      
      // Cache the result if enabled
      if (this.config.enableCaching && result) {
        this.cacheResponse(request, result, context);
      }

      this.updateMetrics(context, true);
      this.logger.info(`Completion request successful`, context);

      return result;

    } catch (error) {
      context.error = error instanceof Error ? error.message : String(error);
      this.updateMetrics(context, false);
      this.logger.error('Completion request failed', error as Error, context);
      throw error;
    }
  }

  private selectProvider(model: string): ProviderType {
    const preferredProvider = providerRegistry.getProviderForModel(model);
    if (!preferredProvider) {
      throw new ProviderError('No provider found for model', 'gateway', 400, undefined, false);
    }

    switch (this.config.providerSelectionStrategy) {
      case 'explicit':
        return preferredProvider;
      
      case 'automatic':
        return this.selectHealthyProvider(preferredProvider);
      
      case 'cost-optimized':
        return this.selectCostOptimalProvider(model);
      
      case 'load-balanced':
        return this.selectLoadBalancedProvider(model);
      
      default:
        return preferredProvider;
    }
  }

  private selectHealthyProvider(preferredProvider: ProviderType): ProviderType {
    const health = this.providerHealth.get(preferredProvider);
    const circuitBreaker = this.circuitBreakers.get(preferredProvider);
    
    if (health?.status === 'healthy' && circuitBreaker?.state === 'closed') {
      return preferredProvider;
    }

    // Find alternative healthy provider
    for (const [providerType, providerHealth] of this.providerHealth.entries()) {
      const cb = this.circuitBreakers.get(providerType);
      if (providerHealth.status === 'healthy' && cb?.state === 'closed') {
        this.logger.warn(`Switching from ${preferredProvider} to ${providerType} due to health issues`);
        return providerType;
      }
    }

    return preferredProvider; // fallback to preferred even if unhealthy
  }

  private selectCostOptimalProvider(model: string): ProviderType {
    const modelInfo = providerRegistry.getModelInfo(model);
    if (!modelInfo) return providerRegistry.getProviderForModel(model)!;

    // For cost optimization, we would need to compare equivalent models across providers
    // This is a simplified implementation
    return providerRegistry.getProviderForModel(model)!;
  }

  private selectLoadBalancedProvider(model: string): ProviderType {
    const preferredProvider = providerRegistry.getProviderForModel(model);
    if (!preferredProvider) return 'openrouter';

    // Simple round-robin based on current request counts
    const providers = Array.from(this.providerHealth.keys()).filter(p => 
      this.providerHealth.get(p)?.status === 'healthy'
    );

    const requestCounts = providers.map(p => this.metrics.requestsByProvider[p] || 0);
    const minIndex = requestCounts.indexOf(Math.min(...requestCounts));
    
    return providers[minIndex] || preferredProvider;
  }

  private async executeWithFallback(
    request: CompletionRequest, 
    context: RequestContext
  ): Promise<AsyncIterable<StreamChunk>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxFallbackAttempts; attempt++) {
      try {
        // Check rate limiting
        if (this.config.enableRateLimiting && !this.checkRateLimit(context.providerType)) {
          throw new ProviderError(
            `Rate limit exceeded for provider ${context.providerType}`,
            context.providerType,
            429,
            undefined,
            true
          );
        }

        // Check circuit breaker
        if (this.config.enableCircuitBreaker && !this.checkCircuitBreaker(context.providerType)) {
          throw new ProviderError(
            `Circuit breaker open for provider ${context.providerType}`,
            context.providerType,
            503,
            undefined,
            true
          );
        }

        // Execute the request
        const result = await this.executeRequest(request, context);
        
        // Update provider health on success
        this.updateProviderHealth(context.providerType, true, Date.now() - context.startTime);
        this.closeCircuitBreaker(context.providerType);

        return result;

      } catch (error) {
        lastError = error as Error;
        context.fallbackAttempts = attempt;
        
        // Update provider health on failure
        this.updateProviderHealth(context.providerType, false, Date.now() - context.startTime);
        this.updateCircuitBreaker(context.providerType);

        if (attempt < this.config.maxFallbackAttempts && this.config.enableFallback) {
          this.logger.warn(`Request failed, attempting fallback (attempt ${attempt + 1})`, context);
          
          // Select fallback provider
          context.providerType = this.selectFallbackProvider(context.providerType, request.model);
          
          // Add fallback delay
          if (this.config.fallbackDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.config.fallbackDelay));
          }
          
          this.metrics.fallbackUsage++;
        } else {
          break;
        }
      }
    }

    throw lastError || new Error('All fallback attempts failed');
  }

  private selectFallbackProvider(failedProvider: ProviderType, model: string): ProviderType {
    // Select a different healthy provider
    const availableProviders = Array.from(this.providerHealth.keys())
      .filter(p => p !== failedProvider && this.providerHealth.get(p)?.status === 'healthy');
    
    if (availableProviders.length > 0) {
      return availableProviders[0];
    }

    // If no healthy providers, fallback to OpenRouter (most compatible)
    return 'openrouter';
  }

  private async executeRequest(
    request: CompletionRequest, 
    context: RequestContext
  ): Promise<AsyncIterable<StreamChunk>> {
    // Cost estimation before execution
    if (this.config.enableCostTracking) {
      const estimatedCost = this.estimateRequestCost(request);
      if (estimatedCost > this.config.maxCostPerRequest) {
        throw new ProviderError(
          `Estimated cost (${estimatedCost.toFixed(4)}) exceeds maximum allowed (${this.config.maxCostPerRequest})`,
          context.providerType,
          400,
          undefined,
          false
        );
      }
    }

    // Execute using the provider client
    const result = await this.providerClient.complete(request);
    
    // Wrap the result to track usage and cost
    return this.wrapStreamWithTracking(result, context);
  }

  private async *wrapStreamWithTracking(
    stream: AsyncIterable<StreamChunk>,
    context: RequestContext
  ): AsyncIterable<StreamChunk> {
    const chunks: StreamChunk[] = [];
    let finalUsage: CompletionResponse['usage'] | undefined;

    for await (const chunk of stream) {
      chunks.push(chunk);
      
      // Track usage from the final chunk
      if (chunk.usage) {
        finalUsage = chunk.usage;
      }

      yield chunk;
    }

    // Calculate final cost
    if (finalUsage) {
      const costCalculation = this.providerClient.calculateCost(finalUsage, context.model);
      context.cost = costCalculation.totalCost;
      context.usage = finalUsage;
      this.metrics.totalCost += context.cost;

      // Check budget alert
      if (this.config.enableCostTracking && this.metrics.totalCost > this.config.budgetAlert) {
        this.logger.warn(`Budget alert: Total cost (${this.metrics.totalCost.toFixed(2)}) exceeds threshold (${this.config.budgetAlert})`);
      }
    }
  }

  private validateRequest(request: CompletionRequest): void {
    if (!request.model || !request.messages || request.messages.length === 0) {
      throw new ProviderError('Invalid request: model and messages are required', 'gateway', 400, undefined, false);
    }

    // Validate message content
    for (const message of request.messages) {
      if (!message.role || !message.content) {
        throw new ProviderError('Invalid message: role and content are required', 'gateway', 400, undefined, false);
      }
      
      // Basic content sanitization
      if (typeof message.content === 'string' && message.content.length > 100000) {
        throw new ProviderError('Message content too long', 'gateway', 400, undefined, false);
      }
    }
  }

  private getCachedResponse(request: CompletionRequest): CacheEntry | null {
    const cacheKey = this.generateCacheKey(request);
    const entry = this.cache.get(cacheKey);
    
    if (entry && Date.now() - entry.timestamp < this.config.cacheTTL) {
      return entry;
    }

    // Clean up expired entry
    if (entry) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  private cacheResponse(request: CompletionRequest, response: AsyncIterable<StreamChunk>, context: RequestContext): void {
    // For caching, we need to consume the stream first - this is a simplified implementation
    // In practice, you'd want to cache only specific types of requests
  }

  private generateCacheKey(request: CompletionRequest): string {
    // Generate a hash-based key from the request
    const keyData = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens
    };
    return btoa(JSON.stringify(keyData)).replace(/[^a-zA-Z0-9]/g, '');
  }

  private checkRateLimit(providerType: ProviderType): boolean {
    const state = this.rateLimitStates.get(providerType);
    const limit = this.config.rateLimitPerProvider[providerType];
    
    if (!state || !limit) return true;

    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindow;
    
    // Clean old requests
    state.requests = state.requests.filter(time => time > windowStart);
    
    // Check if under limit
    if (state.requests.length < limit) {
      state.requests.push(now);
      return true;
    }

    return false;
  }

  private checkCircuitBreaker(providerType: ProviderType): boolean {
    const state = this.circuitBreakers.get(providerType);
    if (!state) return true;

    const now = Date.now();

    switch (state.state) {
      case 'closed':
        return true;
      
      case 'open':
        if (now >= state.nextAttempt) {
          state.state = 'half-open';
          return true;
        }
        return false;
      
      case 'half-open':
        return true;
      
      default:
        return true;
    }
  }

  private updateCircuitBreaker(providerType: ProviderType): void {
    const state = this.circuitBreakers.get(providerType);
    if (!state) return;

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.config.circuitBreakerThreshold) {
      state.state = 'open';
      state.nextAttempt = Date.now() + this.config.circuitBreakerTimeout;
      this.logger.warn(`Circuit breaker opened for provider ${providerType}`);
    }
  }

  private closeCircuitBreaker(providerType: ProviderType): void {
    const state = this.circuitBreakers.get(providerType);
    if (!state) return;

    if (state.state === 'half-open') {
      state.state = 'closed';
      state.failures = 0;
      this.logger.info(`Circuit breaker closed for provider ${providerType}`);
    }
  }

  private updateProviderHealth(providerType: ProviderType, success: boolean, latency: number): void {
    const health = this.providerHealth.get(providerType);
    if (!health) return;

    health.lastCheckTime = Date.now();
    health.averageLatency = (health.averageLatency + latency) / 2;

    if (success) {
      health.consecutiveFailures = 0;
      health.successRate = Math.min(1.0, health.successRate + 0.1);
      health.errorRate = Math.max(0.0, health.errorRate - 0.1);
      health.status = 'healthy';
    } else {
      health.consecutiveFailures++;
      health.successRate = Math.max(0.0, health.successRate - 0.1);
      health.errorRate = Math.min(1.0, health.errorRate + 0.1);
      
      if (health.consecutiveFailures >= this.config.unhealthyThreshold) {
        health.status = 'unhealthy';
      } else if (health.errorRate > 0.5) {
        health.status = 'degraded';
      }
    }
  }

  private updateMetrics(context: RequestContext, success: boolean): void {
    if (!this.config.enableMetrics) return;

    const latency = Date.now() - context.startTime;
    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.errorsByProvider[context.providerType] = 
        (this.metrics.errorsByProvider[context.providerType] || 0) + 1;
    }

    this.metrics.requestsByProvider[context.providerType] = 
      (this.metrics.requestsByProvider[context.providerType] || 0) + 1;
  }

  private estimateRequestCost(request: CompletionRequest): number {
    const modelInfo = providerRegistry.getModelInfo(request.model);
    if (!modelInfo) return 0;

    // Rough token estimation (4 chars = 1 token)
    const inputTokens = request.messages.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    const outputTokens = request.max_tokens || 1000; // estimate
    
    return providerRegistry.estimateCost(request.model, inputTokens, outputTokens);
  }

  private async *createAsyncIterableFromArray(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  // Public API methods
  getHealth(): { [key in ProviderType]?: ProviderHealth } {
    const health: { [key in ProviderType]?: ProviderHealth } = {};
    for (const [providerType, providerHealth] of this.providerHealth.entries()) {
      health[providerType] = { ...providerHealth };
    }
    return health;
  }

  getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  getCircuitBreakerStates(): { [key in ProviderType]?: CircuitBreakerState } {
    const states: { [key in ProviderType]?: CircuitBreakerState } = {};
    for (const [providerType, state] of this.circuitBreakers.entries()) {
      states[providerType] = { ...state };
    }
    return states;
  }

  updateConfig(newConfig: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Gateway configuration updated');
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalCost: 0,
      requestsByProvider: {},
      errorsByProvider: {},
      cacheHitRate: 0,
      fallbackUsage: 0
    };
    this.logger.info('Metrics reset');
  }

  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.logger.info('Gateway shutdown completed');
  }
}

// Factory function for creating gateway from environment
export function createGatewayFromEnv(gatewayConfig: Partial<GatewayConfig> = {}): UnifiedAPIGateway {
  const providerConfig = {
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
  };

  return new UnifiedAPIGateway(providerConfig, gatewayConfig);
}