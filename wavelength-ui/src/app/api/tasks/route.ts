import { NextResponse } from 'next/server';
import { taskManager } from '@/lib/background-task-manager';

export const runtime = 'nodejs';

function calculateCost(usage: any): number {
  if (!usage) return 0.0;
  
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const reasoningTokens = usage.reasoning_tokens || 0;
  
  // Example pricing (per 1K tokens)
  const inputCostPer1k = 0.015;
  const outputCostPer1k = 0.060;
  const reasoningCostPer1k = 0.060;
  
  const totalCost = (
    (inputTokens / 1000) * inputCostPer1k +
    (outputTokens / 1000) * outputCostPer1k +
    (reasoningTokens / 1000) * reasoningCostPer1k
  );
  
  return Math.round(totalCost * 10000) / 10000; // Round to 4 decimal places
}

export async function GET() {
  try {
    const allTasks = taskManager.getAllTasks();
    
    const tasks = allTasks.map(task => ({
      id: task.id,
      status: task.status,
      model: task.model,
      created_at: task.created_at,
      completed_at: task.completed_at,
      has_output: !!task.output_text,
      has_error: !!task.error,
      reasoning_tokens: task.usage?.reasoning_tokens || 0,
      total_tokens: task.usage?.total_tokens || 0,
      estimated_cost: calculateCost(task.usage)
    }));

    return NextResponse.json({ tasks });

  } catch (error) {
    console.error('Error listing tasks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}