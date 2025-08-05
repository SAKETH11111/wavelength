import { NextRequest, NextResponse } from 'next/server';
import { createGatewayFromEnv, GatewayConfig } from '@/lib/api-gateway';

export const runtime = 'nodejs';

let gatewayInstance: ReturnType<typeof createGatewayFromEnv> | null = null;

function getGateway() {
  if (!gatewayInstance) {
    gatewayInstance = createGatewayFromEnv();
  }
  return gatewayInstance;
}

export async function GET(req: NextRequest) {
  try {
    // Return current gateway configuration (without sensitive data)
    const config = {
      providerSelectionStrategy: 'automatic',
      enableFallback: true,
      maxFallbackAttempts: 2,
      fallbackDelay: 1000,
      enableRateLimiting: true,
      rateLimitWindow: 60000,
      enableCaching: true,
      cacheMaxSize: 1000,
      cacheTTL: 300000,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 30000,
      enableCostTracking: true,
      maxCostPerRequest: 10.0,
      budgetAlert: 100.0,
      enableHealthMonitoring: true,
      healthCheckInterval: 30000,
      unhealthyThreshold: 3,
      enableRequestValidation: true,
      enableResponseSanitization: true,
      enableDetailedLogging: false,
      enableMetrics: true,
      enableTracing: true
    };

    return NextResponse.json({
      config,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error getting gateway config:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const gateway = getGateway();
    const newConfig: Partial<GatewayConfig> = await req.json();
    
    // Validate configuration
    const validKeys = [
      'providerSelectionStrategy',
      'enableFallback',
      'maxFallbackAttempts',
      'fallbackDelay',
      'enableRateLimiting',
      'rateLimitWindow',
      'enableCaching',
      'cacheMaxSize',
      'cacheTTL',
      'enableCircuitBreaker',
      'circuitBreakerThreshold',
      'circuitBreakerTimeout',
      'enableCostTracking',
      'maxCostPerRequest',
      'budgetAlert',
      'enableHealthMonitoring',
      'healthCheckInterval',
      'unhealthyThreshold',
      'enableRequestValidation',
      'enableResponseSanitization',
      'enableDetailedLogging',
      'enableMetrics',
      'enableTracing'
    ];

    const filteredConfig: Partial<GatewayConfig> = {};
    for (const [key, value] of Object.entries(newConfig)) {
      if (validKeys.includes(key)) {
        (filteredConfig as any)[key] = value;
      }
    }

    // Update gateway configuration
    gateway.updateConfig(filteredConfig);

    return NextResponse.json({
      message: 'Gateway configuration updated successfully',
      updatedKeys: Object.keys(filteredConfig),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error updating gateway config:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}