import { NextRequest, NextResponse } from 'next/server';
import { backendClient } from '@/lib/backend-client';

export const runtime = 'nodejs';

// GET /api/backend/test - Test backend connectivity
export async function GET(req: NextRequest) {
  try {
    const health = await backendClient.getHealth();
    
    return NextResponse.json({
      available: health.status !== 'unavailable',
      status: health.status,
      providers: health.providers?.length || 0,
      timestamp: health.timestamp || Date.now()
    });

  } catch (error) {
    console.error('Backend test failed:', error);
    return NextResponse.json(
      { 
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 503 }
    );
  }
}

// POST /api/backend/test - Force backend health check
export async function POST(req: NextRequest) {
  try {
    // Force a fresh backend check
    backendClient.forceHealthCheck();
    const health = await backendClient.getHealth();
    
    return NextResponse.json({
      available: health.status !== 'unavailable',
      status: health.status,
      providers: health.providers || [],
      timestamp: health.timestamp || Date.now(),
      forced: true
    });

  } catch (error) {
    console.error('Forced backend test failed:', error);
    return NextResponse.json(
      { 
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        forced: true
      },
      { status: 503 }
    );
  }
}