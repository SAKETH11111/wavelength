import { NextRequest, NextResponse } from 'next/server';
import { taskManager, TaskStatus } from '@/lib/background-task-manager';

export const runtime = 'nodejs';

// Configure the task manager with environment variables
function configureTaskManager() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.CUSTOM_BASE_URL || 'https://openrouter.ai/api/v1';
  
  // Set global configuration for task manager
  (globalThis as any).OPENROUTER_API_KEY = apiKey;
  (globalThis as any).CUSTOM_BASE_URL = baseUrl;
}

// Interface matching your Python CreateResponseRequest
interface CreateResponseRequest {
  model?: string;
  input: Array<{ role: string; content: string }>;
  background?: boolean;
  stream?: boolean;
  reasoning?: { effort: string; summary: string };
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
  output?: Array<any>;
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
    // Configure task manager with environment variables
    configureTaskManager();
    
    const data: CreateResponseRequest = await req.json();
    
    // Validate required fields
    if (!data.input || !Array.isArray(data.input)) {
      return NextResponse.json(
        { error: 'Missing or invalid input array' },
        { status: 400 }
      );
    }

    // Check API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Default values matching Python version
    const model = data.model || 'openai/o3-pro';
    const background = data.background !== false; // Default to true
    const reasoning = data.reasoning || { effort: 'high', summary: 'auto' };

    // Create background task
    const task = await taskManager.createResponse(
      model,
      data.input,
      background,
      reasoning
    );

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}