import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/providers/provider-registry';
import { ProviderType } from '@/lib/providers/types';

export const runtime = 'nodejs';

// POST /api/providers/test - Test provider connection
export async function POST(req: NextRequest) {
  try {
    const { provider } = await req.json();
    
    if (!provider || !['openrouter', 'openai', 'anthropic', 'google', 'xai'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider specified' },
        { status: 400 }
      );
    }

    // Get environment variable for the provider
    const envKeyMap: Record<ProviderType, string> = {
      openrouter: process.env.OPENROUTER_API_KEY || '',
      openai: process.env.OPENAI_API_KEY || '',
      anthropic: process.env.ANTHROPIC_API_KEY || '',
      google: process.env.GOOGLE_API_KEY || '',
      xai: process.env.XAI_API_KEY || '',
    };

    const apiKey = envKeyMap[provider as ProviderType];
    
    if (!apiKey) {
      return NextResponse.json({
        connected: false,
        error: `No API key configured for ${provider}`,
      });
    }

    try {
      // Get the provider instance
      const providerInstance = providerRegistry.createProvider(provider as ProviderType);
      
      // Test the configuration
      const config = {
        apiKey,
        ...providerInstance.getDefaultConfig(),
      };
      
      // Validate the configuration
      providerInstance.validateConfig(config);
      
      // For now, just return success if validation passes
      // In a real implementation, you might want to make a small test request
      return NextResponse.json({
        connected: true,
        provider,
        models: providerInstance.supportedModels.length,
      });
      
    } catch (error) {
      return NextResponse.json({
        connected: false,
        error: error instanceof Error ? error.message : 'Provider validation failed',
      });
    }

  } catch (error) {
    console.error('Error testing provider:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}