// Simple test file to verify provider system integration
// This is for development/testing purposes only

import { providerRegistry, createProviderClientFromEnv } from './index';

export async function testProviderSystem() {
  console.log('=== Testing Provider System ===');
  
  try {
    // Test provider registry
    console.log('Available providers:', providerRegistry.getSupportedProviders());
    console.log('Total models:', providerRegistry.getAllModels().length);
    
    // Test model lookup
    const testModels = ['openai/o3', 'gpt-4o', 'claude-3.5-sonnet', 'gemini-pro-1.5', 'grok-beta'];
    for (const model of testModels) {
      const provider = providerRegistry.getProviderForModel(model);
      const modelInfo = providerRegistry.getModelInfo(model);
      console.log(`Model ${model}: provider=${provider}, info=${!!modelInfo}`);
    }
    
    // Test reasoning models
    const reasoningModels = providerRegistry.getModelsByCapability('reasoning');
    console.log('Reasoning models:', reasoningModels.map(m => m.id));
    
    // Test cost estimation
    const cost = providerRegistry.estimateCost('openai/o3', 1000, 500, 2000);
    console.log('Estimated cost for o3 (1k input, 500 output, 2k reasoning):', cost);
    
    // Test client creation
    const client = createProviderClientFromEnv();
    console.log('Client created successfully');
    console.log('Configured providers:', client.getConfiguredProviders());
    
    console.log('=== Provider System Tests Passed ===');
    return true;
    
  } catch (error) {
    console.error('Provider system test failed:', error);
    return false;
  }
}

// Test individual provider instantiation
export function testProviderInstantiation() {
  console.log('=== Testing Provider Instantiation ===');
  
  try {
    const providers = ['openrouter', 'openai', 'anthropic', 'google', 'xai'] as const;
    
    for (const type of providers) {
      const provider = providerRegistry.createProvider(type);
      console.log(`${type}: ${provider.name}, models: ${provider.supportedModels.length}`);
    }
    
    console.log('=== Provider Instantiation Tests Passed ===');
    return true;
    
  } catch (error) {
    console.error('Provider instantiation test failed:', error);
    return false;
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  testProviderSystem().then(success => {
    if (success) {
      testProviderInstantiation();
    }
  });
}