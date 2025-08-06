import { NextRequest, NextResponse } from 'next/server';
import { ModelInfo } from '@/lib/providers/types';

// Fallback model data for when providers are not available
// Updated to include recently added OpenRouter models
const fallbackModels: ModelInfo[] = [
  // OpenAI o3 series
  {
    id: 'openai/o3',
    name: 'OpenAI o3',
    provider: 'OpenAI',
    contextLength: 200000,
    inputCostPer1M: 15,
    outputCostPer1M: 60,
    reasoningCostPer1M: 60,
    supportsReasoning: true,
    supportsStreaming: true,
  },
  {
    id: 'openai/o3-mini',
    name: 'OpenAI o3-mini',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    reasoningCostPer1M: 0.6,
    supportsReasoning: true,
    supportsStreaming: true,
  },
  // GPT-4o series (including extended and newer models)
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'openai/gpt-4o:extended',
    name: 'GPT-4o (Extended)',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'openai/gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'openai/chatgpt-4o-latest',
    name: 'ChatGPT-4o Latest',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 5,
    outputCostPer1M: 15,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  // GPT OSS series (newly released models)
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 1,
    outputCostPer1M: 3,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'OpenAI',
    contextLength: 128000,
    inputCostPer1M: 5,
    outputCostPer1M: 15,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  // Claude series
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextLength: 200000,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    contextLength: 200000,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    provider: 'Anthropic',
    contextLength: 200000,
    inputCostPer1M: 15,
    outputCostPer1M: 75,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  // Gemini series
  {
    id: 'google/gemini-2.5-flash-exp',
    name: 'Gemini 2.5 Flash Experimental',
    provider: 'Google',
    contextLength: 1048576,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    contextLength: 2097152,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  // Grok series
  {
    id: 'xai/grok-2-1212',
    name: 'Grok 2 (December 12)',
    provider: 'XAI',
    contextLength: 131072,
    inputCostPer1M: 2,
    outputCostPer1M: 10,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  {
    id: 'xai/grok-2-vision-1212',
    name: 'Grok 2 Vision (December 12)',
    provider: 'XAI',
    contextLength: 131072,
    inputCostPer1M: 2,
    outputCostPer1M: 10,
    supportsReasoning: false,
    supportsStreaming: true,
  },
  // OpenRouter native models
  {
    id: 'openrouter/horizon-beta',
    name: 'Horizon Beta',
    provider: 'OpenRouter',
    contextLength: 128000,
    inputCostPer1M: 1,
    outputCostPer1M: 5,
    supportsReasoning: false,
    supportsStreaming: true,
  },
];

// OpenRouter models fetcher with better error handling
async function fetchOpenRouterModels(): Promise<ModelInfo[]> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('No OpenRouter API key found, using fallback models');
      return [];
    }

    console.log('Fetching models from OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('OpenRouter error response:', errorText);
      return [];
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Invalid OpenRouter API response format');
      return [];
    }

    console.log(`Successfully fetched ${data.data.length} models from OpenRouter`);
    
    const models = data.data.map((model: any): ModelInfo => {
      // Determine provider from model ID
      let providerName = 'OpenRouter';
      if (model.id.startsWith('openai/')) providerName = 'OpenAI';
      else if (model.id.startsWith('anthropic/')) providerName = 'Anthropic';
      else if (model.id.startsWith('google/')) providerName = 'Google';
      else if (model.id.startsWith('xai/')) providerName = 'XAI';
      else if (model.id.startsWith('mistralai/')) providerName = 'Mistral';
      else if (model.id.startsWith('meta-llama/')) providerName = 'Meta';
      
      // Map known model IDs to correct names per user feedback
      let modelId = model.id;
      let modelName = model.name || model.id.split('/').pop() || model.id;
      
      // Update incorrect model names to correct ones
      if (model.id.includes('gemini-2.0-flash-exp')) {
        modelId = modelId.replace('gemini-2.0-flash-exp', 'gemini-2.5-flash-exp');
        modelName = modelName.replace('2.0', '2.5');
      }
      if (model.id.includes('gpt-4o-mini')) {
        modelId = modelId.replace('gpt-4o-mini', 'gpt-4.1-mini');
        modelName = modelName.replace('4o', '4.1');
      }
      
      return {
        id: modelId,
        name: modelName,
        provider: providerName,
        contextLength: model.context_length || 4096,
        inputCostPer1M: model.pricing?.prompt ? parseFloat(model.pricing.prompt) * 1000000 : 0,
        outputCostPer1M: model.pricing?.completion ? parseFloat(model.pricing.completion) * 1000000 : 0,
        supportsReasoning: model.id.includes('o1') || model.id.includes('o3') || model.id.includes('reasoning'),
        supportsStreaming: true,
      };
    }).filter((model: ModelInfo) => {
      // Filter to only include LLM models (exclude image/video generation)
      const modelId = model.id.toLowerCase();
      const isTextModel = !modelId.includes('dall-e') && 
                         !modelId.includes('midjourney') && 
                         !modelId.includes('stable-diffusion') &&
                         !modelId.includes('imagen') &&
                         !modelId.includes('video') &&
                         !modelId.includes('whisper') &&
                         !modelId.includes('tts') &&
                         !modelId.includes('embedding') &&
                         !modelId.includes('vision-preview') &&
                         !modelId.includes('moderation');
      
      // Additional filtering for quality models
      const isRelevantModel = modelId.includes('gpt') ||
                             modelId.includes('claude') ||
                             modelId.includes('gemini') ||
                             modelId.includes('llama') ||
                             modelId.includes('mistral') ||
                             modelId.includes('grok') ||
                             modelId.includes('o1') ||
                             modelId.includes('o3') ||
                             modelId.includes('opus') ||
                             modelId.includes('sonnet') ||
                             modelId.includes('haiku') ||
                             modelId.includes('horizon');
      
      return isTextModel && isRelevantModel;
    });
    
    console.log(`Filtered to ${models.length} relevant LLM models`);
    return models;
    
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    let models: ModelInfo[] = [];

    // Fetch models from specific provider or all providers
    if (!provider || provider === 'openrouter') {
      const openRouterModels = await fetchOpenRouterModels();
      models = [...models, ...openRouterModels];
    }

    // If no models fetched from providers, use fallback models
    if (models.length === 0) {
      console.warn('No models fetched from OpenRouter, using fallback models');
      models = fallbackModels;
    } else {
      console.log(`Successfully loaded ${models.length} models from OpenRouter`);
    }

    // Sort models by provider and then by name
    models.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
      cached: models === fallbackModels,
      source: models === fallbackModels ? 'fallback' : 'openrouter'
    });

  } catch (error) {
    console.error('Error in models API:', error);
    
    // Return fallback models on error
    return NextResponse.json({
      success: true,
      models: fallbackModels,
      count: fallbackModels.length,
      cached: true,
      error: 'Failed to fetch from providers, using fallback models',
    });
  }
}