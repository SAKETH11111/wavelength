// Test script to validate model routing fixes
// Run with: npx tsx src/app/api/models/test-models.ts

import { providerRegistry } from '@/lib/providers/provider-registry';

const testModels = [
  'openai/gpt-4o:extended',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'openai/chatgpt-4o-latest',
  'anthropic/claude-opus-4.1',
  'openrouter/horizon-beta',
  'google/gemini-2.0-flash-exp',
  'xai/grok-2-1212'
];

console.log('Testing model routing fixes...\n');

for (const model of testModels) {
  const provider = providerRegistry.getProviderForModel(model);
  const isValid = providerRegistry.validateModel(model);
  const modelInfo = providerRegistry.getModelInfo(model);
  
  console.log(`Model: ${model}`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Valid: ${isValid}`);
  console.log(`  Info: ${modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : 'Not found'}`);
  console.log('');
}

console.log('✅ Model routing test completed!');