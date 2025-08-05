import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/background-task-manager';

export const runtime = 'nodejs';

// GET /api/providers - Get available providers and models
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const capability = searchParams.get('capability'); // 'reasoning' | 'streaming'
    const query = searchParams.get('q'); // search query

    let models;
    
    if (query) {
      models = taskManager.searchModels(query);
    } else if (capability === 'reasoning') {
      models = taskManager.getReasoningModels();
    } else {
      models = taskManager.getAvailableModels();
    }

    const configuredProviders = taskManager.getConfiguredProviders();

    return NextResponse.json({
      models,
      configuredProviders,
      totalModels: models.length
    });

  } catch (error) {
    console.error('Error getting providers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}