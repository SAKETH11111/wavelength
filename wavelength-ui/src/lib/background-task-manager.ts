import { randomUUID } from 'crypto';
import { 
  ProviderClient, 
  createProviderClientFromEnv,
  CompletionRequest,
  StreamChunk,
  ProviderError 
} from './providers';
import { UnifiedAPIGateway, createGatewayFromEnv, GatewayConfig } from './api-gateway';

export enum TaskStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface StreamEvent {
  sequence_number: number;
  data: {
    type?: string;
    task_id?: string;
    model?: string;
    content?: string;
    step?: number;
    total_steps?: number;
    message?: string;
    response?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      reasoning_tokens: number;
      cost?: number; // Cost from provider (e.g., OpenRouter credits)
    };
    choices?: Array<{
      delta?: {
        content?: string;
        reasoning?: string;
      };
    }>;
    id?: string;
  };
  timestamp: number;
}

export interface BackgroundTask {
  id: string;
  status: TaskStatus;
  model: string;
  input: Array<{ role: string; content: string; id?: string }>;
  reasoning?: { effort: string; summary: string };
  created_at: number;
  started_at?: number;
  completed_at?: number;
  output_text?: string;
  output?: Array<{ 
    id: string; 
    type: string; 
    status: string; 
    content: Array<{ type: string; text: string }> | string; 
    role?: string;
  }>;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens: number;
    cost?: number; // Cost from provider (e.g., OpenRouter credits)
  };
  provider?: string;
  cost?: number;
  stream_cursor: number;
  stream_events: StreamEvent[];
  reasoning_summary?: string;
}

export class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private queue: BackgroundTask[] = [];
  private isProcessing = false;
  private providerClient: ProviderClient;
  private gateway?: UnifiedAPIGateway;
  private useGateway: boolean;

  constructor(providerClient?: ProviderClient, gatewayConfig?: Partial<GatewayConfig>) {
    try {
      console.log('Initializing BackgroundTaskManager...');
      
      this.providerClient = providerClient || createProviderClientFromEnv();
      this.useGateway = Boolean(gatewayConfig);
      
      if (this.useGateway) {
        console.log('Gateway mode enabled, initializing gateway...');
        this.gateway = createGatewayFromEnv(gatewayConfig);
      }
      
      console.log('BackgroundTaskManager initialized successfully');
      
      // Start task processor in background without blocking
      setTimeout(() => this.startTaskProcessor(), 0);
    } catch (error) {
      console.error('Failed to initialize BackgroundTaskManager:', error);
      throw new Error(`BackgroundTaskManager initialization failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private async startTaskProcessor() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const processNextTask = async () => {
      if (!this.isProcessing) return;
      
      if (this.queue.length > 0) {
        const task = this.queue.shift()!;
        if (task.status !== TaskStatus.CANCELLED) {
          try {
            await this.executeTask(task);
          } catch (error) {
            console.error('Task execution failed:', error);
            task.status = TaskStatus.FAILED;
            task.error = error instanceof Error ? error.message : 'Unknown error';
            task.completed_at = Date.now();
          }
        }
      }
      
      // Schedule next iteration
      setTimeout(processNextTask, 100);
    };

    // Start processing
    processNextTask();
  }

  private async executeTask(task: BackgroundTask) {
    try {
      task.status = TaskStatus.IN_PROGRESS;
      task.started_at = Date.now();
      
      // Determine provider being used
      const modelInfo = this.providerClient.getModelInfo(task.model);
      task.provider = modelInfo?.provider || 'unknown';
      
      this.broadcastUpdate({
        type: 'reasoning_start',
        task_id: task.id,
        model: task.model
      });

      // Build completion request
      const request: CompletionRequest = {
        model: task.model,
        messages: task.input.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        })),
        stream: true,
        reasoning: task.reasoning as { effort: 'low' | 'medium' | 'high'; summary: string }
      };

      // Execute the completion using the gateway or provider system
      const streamIterator = this.gateway 
        ? await this.gateway.complete(request)
        : await this.providerClient.complete(request);
      await this.processProviderStream(task, streamIterator);

      // Only mark as completed if not cancelled during execution
      if (task.status === TaskStatus.IN_PROGRESS) {
        task.status = TaskStatus.COMPLETED;
        task.completed_at = Date.now();
        
        // Calculate cost using the gateway or provider system
        if (task.usage) {
          if (task.usage.cost !== undefined) {
            // Use cost from provider (e.g., OpenRouter native cost)
            task.cost = task.usage.cost;
          } else {
            // Fallback to provider cost calculation if no native cost available
            const costCalculation = this.gateway 
              ? { totalCost: task.cost || 0 } // Gateway already calculated cost
              : this.providerClient.calculateCost(task.usage, task.model);
            task.cost = costCalculation.totalCost;
          }
        }
        
        this.broadcastUpdate({
          type: 'reasoning_complete',
          task_id: task.id,
          response: task.output_text,
          usage: task.usage
        });
      }

    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      task.status = TaskStatus.FAILED;
      
      if (error instanceof ProviderError) {
        task.error = `${error.provider} Error: ${error.message}`;
      } else {
        task.error = error instanceof Error ? error.message : String(error);
      }
      
      task.completed_at = Date.now();
      
      this.broadcastUpdate({
        type: 'error',
        task_id: task.id,
        message: task.error
      });
    }
  }

  private async processProviderStream(
    task: BackgroundTask, 
    streamIterator: AsyncIterable<StreamChunk>
  ) {
    let contentBuffer = '';
    let reasoningBuffer = '';
    let sequenceNumber = 0;
    let finalUsage: BackgroundTask['usage'] | undefined;

    for await (const chunk of streamIterator) {
      if (task.status === TaskStatus.CANCELLED) break;

      // Process content from the chunk
      for (const choice of chunk.choices) {
        if (choice.delta?.content) {
          const contentDelta = choice.delta.content;
          contentBuffer += contentDelta;

          // Broadcast real-time update
          this.broadcastUpdate({
            type: 'reasoning_stream',
            task_id: task.id,
            content: contentDelta,
            step: sequenceNumber,
            total_steps: 0 // Unknown at this point
          });
        }

        if (choice.delta?.reasoning) {
          reasoningBuffer += choice.delta.reasoning;
        }
      }

      // Store usage information if available
      if (chunk.usage) {
        finalUsage = {
          prompt_tokens: chunk.usage.prompt_tokens,
          completion_tokens: chunk.usage.completion_tokens,
          total_tokens: chunk.usage.total_tokens,
          reasoning_tokens: chunk.usage.reasoning_tokens || 0,
          cost: chunk.usage.cost // Store cost from provider
        };
      }

      // Store streaming event
      const event: StreamEvent = {
        sequence_number: sequenceNumber++,
        data: {
          type: 'stream_chunk',
          task_id: task.id,
          model: chunk.model,
          choices: chunk.choices.map(choice => ({
            delta: choice.delta
          }))
        },
        timestamp: Date.now()
      };
      task.stream_events.push(event);
    }

    // Store final results
    task.output_text = contentBuffer;
    if (reasoningBuffer) {
      task.reasoning_summary = reasoningBuffer;
    }

    // Store usage information
    if (finalUsage) {
      task.usage = finalUsage;
    }

    // Build output structure
    task.output = [{
      id: `msg_${randomUUID().replace(/-/g, '_')}`,
      type: 'message',
      status: 'completed',
      content: [{
        type: 'output_text',
        text: task.output_text
      }],
      role: 'assistant'
    }];
  }

  private broadcastUpdate(message: {
    type: string;
    task_id?: string;
    model?: string;
    content?: string;
    step?: number;
    total_steps?: number;
    message?: string;
    response?: string;
    usage?: BackgroundTask['usage'];
  }) {
    // Store the broadcast message as a stream event for the corresponding task
    if (message.task_id) {
      const task = this.tasks.get(message.task_id);
      if (task) {
        const event: StreamEvent = {
          sequence_number: task.stream_events.length,
          data: message,
          timestamp: Date.now()
        };
        task.stream_events.push(event);
      }
    }
  }

  async createResponse(
    model: string,
    input: Array<{ role: string; content: string }>,
    background: boolean = true,
    reasoning?: { effort: string; summary: string }
  ): Promise<BackgroundTask> {
    // Validate model first
    if (!this.providerClient.validateModel(model)) {
      throw new Error(`Model ${model} is not supported by any configured provider`);
    }

    const taskId = `resp_${randomUUID().replace(/-/g, '_')}`;
    
    const task: BackgroundTask = {
      id: taskId,
      status: TaskStatus.QUEUED,
      model,
      input,
      reasoning: reasoning || { effort: 'high', summary: 'auto' },
      created_at: Date.now(),
      stream_cursor: 0,
      stream_events: []
    };

    this.tasks.set(taskId, task);

    if (background) {
      this.queue.push(task);
    } else {
      // Execute task asynchronously to avoid blocking the API response
      this.executeTask(task).catch(error => {
        console.error('Task execution failed:', error);
        task.status = TaskStatus.FAILED;
        task.error = error.message;
        task.completed_at = Date.now();
      });
    }

    return task;
  }

  async retrieveResponse(responseId: string): Promise<BackgroundTask | undefined> {
    return this.tasks.get(responseId);
  }

  async cancelResponse(responseId: string): Promise<BackgroundTask | undefined> {
    const task = this.tasks.get(responseId);
    if (task && [TaskStatus.QUEUED, TaskStatus.IN_PROGRESS].includes(task.status)) {
      task.status = TaskStatus.CANCELLED;
      task.completed_at = Date.now();
    }
    return task;
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  // Provider-specific methods
  updateProviderConfig(config: Record<string, unknown>) {
    // This would need to be implemented to update the provider client config
    // For now, we'll just log it
    console.log('Provider config update requested:', config);
  }

  getAvailableModels() {
    return this.providerClient.getAllModels();
  }

  getReasoningModels() {
    return this.providerClient.getReasoningModels();
  }

  getConfiguredProviders() {
    return this.providerClient.getConfiguredProviders();
  }

  searchModels(query: string) {
    return this.providerClient.searchModels(query);
  }

  getModelInfo(model: string) {
    return this.providerClient.getModelInfo(model);
  }

  // Gateway-specific methods
  getGatewayHealth() {
    return this.gateway?.getHealth();
  }

  getGatewayMetrics() {
    return this.gateway?.getMetrics();
  }

  getCircuitBreakerStates() {
    return this.gateway?.getCircuitBreakerStates();
  }

  updateGatewayConfig(config: Partial<GatewayConfig>) {
    this.gateway?.updateConfig(config);
  }

  clearGatewayCache() {
    this.gateway?.clearCache();
  }

  resetGatewayMetrics() {
    this.gateway?.resetMetrics();
  }

  isGatewayEnabled(): boolean {
    return this.useGateway && Boolean(this.gateway);
  }

  shutdown() {
    this.gateway?.shutdown();
  }
}

// Global instance with backward compatibility
declare global {
  var __taskManager: BackgroundTaskManager | undefined;
}

function initializeTaskManager(): BackgroundTaskManager {
  try {
    console.log('Initializing global task manager...');
    const manager = new BackgroundTaskManager();
    console.log('Global task manager initialized successfully');
    return manager;
  } catch (error) {
    console.error('Failed to initialize global task manager:', error);
    throw new Error(`Task manager initialization failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

export const taskManager = globalThis.__taskManager || 
  (globalThis.__taskManager = initializeTaskManager());