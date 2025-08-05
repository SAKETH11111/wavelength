import { NextRequest, NextResponse } from 'next/server';
import { createGatewayFromEnv } from '@/lib/api-gateway';

export const runtime = 'nodejs';

let gatewayInstance: ReturnType<typeof createGatewayFromEnv> | null = null;

function getGateway() {
  if (!gatewayInstance) {
    gatewayInstance = createGatewayFromEnv({
      enableMetrics: true,
      enableCostTracking: true
    });
  }
  return gatewayInstance;
}

export async function GET(req: NextRequest) {
  try {
    const gateway = getGateway();
    const metrics = gateway.getMetrics();
    
    // Calculate additional derived metrics
    const successRate = metrics.totalRequests > 0 
      ? (metrics.successfulRequests / metrics.totalRequests) * 100 
      : 0;
    
    const errorRate = metrics.totalRequests > 0 
      ? (metrics.failedRequests / metrics.totalRequests) * 100 
      : 0;

    const averageCostPerRequest = metrics.successfulRequests > 0 
      ? metrics.totalCost / metrics.successfulRequests 
      : 0;

    return NextResponse.json({
      ...metrics,
      derived: {
        successRate: Number(successRate.toFixed(2)),
        errorRate: Number(errorRate.toFixed(2)),
        averageCostPerRequest: Number(averageCostPerRequest.toFixed(6)),
        uptime: Date.now() // This would be more accurate with actual start time tracking
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error getting gateway metrics:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gateway = getGateway();
    gateway.resetMetrics();
    
    return NextResponse.json({
      message: 'Metrics reset successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error resetting metrics:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}