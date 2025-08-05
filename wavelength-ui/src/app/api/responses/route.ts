import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/background-task-manager';
import { UnifiedAPIGateway, createGatewayFromEnv } from '@/lib/api-gateway';

export const runtime = 'nodejs';

// Global gateway instance for enhanced requests
let gatewayInstance: UnifiedAPIGateway | null = null;

function getGateway(): UnifiedAPIGateway {
  if (!gatewayInstance) {
    gatewayInstance = createGatewayFromEnv({
      enableDetailedLogging: process.env.NODE_ENV === 'development',
      enableCaching: true,
      enableFallback: true,
      enableRateLimiting: true,
      enableCircuitBreaker: true,
      enableCostTracking: true,
      enableHealthMonitoring: true
    });
  }
  return gatewayInstance;
}

// Legacy configuration function removed - now handled by provider system

// Interface matching your Python CreateResponseRequest
interface CreateResponseRequest {
  model?: string;
  input: Array<{ role: string; content: string }>;
  background?: boolean;
  stream?: boolean;
  reasoning?: { effort: string; summary: string };
  apiKey?: string;
  baseUrl?: string;
}

// Interface matching your Python ResponseStatus
interface ResponseStatus {
  id: string;
  status: string;
  model: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  output_text?: string;
  output?: Array<{ id: string; type: string; status: string; content: Array<{ type: string; text: string }> | string; role?: string }>;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens: number;
  };
  reasoning_summary?: string;
}

export async function POST(req: NextRequest) {
  try {
    const data: CreateResponseRequest = await req.json();
    
    // Check if gateway mode is requested via headers or query params
    const useGateway = req.headers.get('x-use-gateway') === 'true' || 
                      new URL(req.url).searchParams.get('gateway') === 'true';
    
    // Check if backend delegation is requested
    const useBackend = req.headers.get('x-use-backend') === 'true' || 
                      new URL(req.url).searchParams.get('backend') === 'true';
    
    // Validate required fields
    if (!data.input || !Array.isArray(data.input)) {
      return NextResponse.json(
        { error: 'Missing or invalid input array' },
        { status: 400 }
      );
    }

    // Basic validation
    if (!process.env.OPENROUTER_API_KEY && !data.apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Please add your API key in settings.' },
        { status: 401 }
      );
    }

    // Default values matching Python version
    const model = data.model || 'openai/o3';
    const background = data.background !== false; // Default to true
    const reasoning = data.reasoning || { effort: 'high', summary: 'auto' };

    console.log('Creating background task with:', { model, background, inputLength: data.input.length, useGateway, useBackend });
    
    // Try backend delegation if requested (would need backend client integration)
    if (useBackend) {
      console.log('Backend delegation requested but not implemented in this route');
      // This would delegate to the FastAPI backend
      // For now, we'll fall through to the existing logic
    }
    
    // Create background task using gateway or provider system
    let task;
    if (useGateway) {
      // Use enhanced task manager with gateway
      const gatewayConfig = {
        enableDetailedLogging: process.env.NODE_ENV === 'development',
        enableCaching: data.stream !== true, // Only cache non-streaming requests
        enableFallback: true,
        maxFallbackAttempts: 2,
        enableRateLimiting: true,
        enableCircuitBreaker: true,
        enableCostTracking: true,
        enableHealthMonitoring: true,
        providerSelectionStrategy: 'automatic' as const
      };
      
      // Create a new task manager instance with gateway for this request
      const { BackgroundTaskManager } = await import('@/lib/background-task-manager');
      const enhancedTaskManager = new BackgroundTaskManager(undefined, gatewayConfig);
      task = await enhancedTaskManager.createResponse(model, data.input, background, reasoning);
    } else {
      // Use existing task manager for backward compatibility
      task = await taskManager.createResponse(model, data.input, background, reasoning);
    }

    // Return response status matching Python format
    const responseStatus: ResponseStatus = {
      id: task.id,
      status: task.status,
      model: task.model,
      created_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
      output_text: task.output_text,
      output: task.output,
      error: task.error,
      usage: task.usage,
      reasoning_summary: task.reasoning_summary
    };

    return NextResponse.json(responseStatus);

  } catch (error) {
    console.error('Error creating response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}