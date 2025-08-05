import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/background-task-manager';

export const runtime = 'nodejs';

// GET /api/models/[model] - Get information about a specific model
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model } = await params;
    const decodedModel = decodeURIComponent(model);
    
    const modelInfo = taskManager.getModelInfo(decodedModel);
    
    if (!modelInfo) {
      return NextResponse.json(
        { error: `Model ${decodedModel} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      model: modelInfo,
      supported: true
    });

  } catch (error) {
    console.error('Error getting model info:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}