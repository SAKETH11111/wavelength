import { NextRequest, NextResponse } from 'next/server';
import { createGatewayFromEnv } from '@/lib/api-gateway';

export const runtime = 'nodejs';

let gatewayInstance: ReturnType<typeof createGatewayFromEnv> | null = null;

function getGateway() {
  if (!gatewayInstance) {
    gatewayInstance = createGatewayFromEnv({
      enableHealthMonitoring: true,
      enableMetrics: true
    });
  }
  return gatewayInstance;
}

export async function GET(req: NextRequest) {
  try {
    const gateway = getGateway();
    const health = gateway.getHealth();
    
    // Determine overall system health
    const healthValues = Object.values(health);
    const overallStatus = healthValues.some(h => h.status === 'unhealthy') ? 'unhealthy' :
                         healthValues.some(h => h.status === 'degraded') ? 'degraded' : 'healthy';
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: Date.now(),
      providers: health,
      summary: {
        total: healthValues.length,
        healthy: healthValues.filter(h => h.status === 'healthy').length,
        degraded: healthValues.filter(h => h.status === 'degraded').length,
        unhealthy: healthValues.filter(h => h.status === 'unhealthy').length
      }
    });

  } catch (error) {
    console.error('Error getting gateway health:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}