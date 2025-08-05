import { NextRequest, NextResponse } from 'next/server';
import { createGatewayFromEnv } from '@/lib/api-gateway';

export const runtime = 'nodejs';

let gatewayInstance: ReturnType<typeof createGatewayFromEnv> | null = null;

function getGateway() {
  if (!gatewayInstance) {
    gatewayInstance = createGatewayFromEnv({
      enableCircuitBreaker: true,
      enableHealthMonitoring: true
    });
  }
  return gatewayInstance;
}

export async function GET(req: NextRequest) {
  try {
    const gateway = getGateway();
    const circuitBreakers = gateway.getCircuitBreakerStates();
    
    // Add summary information
    const states = Object.values(circuitBreakers);
    const summary = {
      total: states.length,
      closed: states.filter(s => s.state === 'closed').length,
      open: states.filter(s => s.state === 'open').length,
      halfOpen: states.filter(s => s.state === 'half-open').length
    };

    return NextResponse.json({
      circuitBreakers,
      summary,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error getting circuit breaker states:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}