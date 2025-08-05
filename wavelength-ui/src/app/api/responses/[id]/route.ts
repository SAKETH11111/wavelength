import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/background-task-manager';

export const runtime = 'nodejs';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await taskManager.retrieveResponse(id);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Response not found' },
        { status: 404 }
      );
    }

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
    console.error('Error retrieving response:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}