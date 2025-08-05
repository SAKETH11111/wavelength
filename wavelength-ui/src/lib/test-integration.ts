/**
 * Integration test utilities for backend/frontend communication
 */

import { backendClient } from './backend-client';
import { sendMessageToServer } from './api';

export interface IntegrationTestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export class IntegrationTester {
  private results: IntegrationTestResult[] = [];

  async runAllTests(): Promise<IntegrationTestResult[]> {
    this.results = [];
    
    console.log('Starting integration tests...');
    
    await this.testBackendConnection();
    await this.testProviderDetection();
    await this.testModeDetection();
    
    console.log('Integration tests completed:', this.results);
    return this.results;
  }

  private async testBackendConnection(): Promise<void> {
    try {
      const available = await backendClient.isBackendAvailable();
      const health = await backendClient.getHealth();
      
      this.results.push({
        test: 'Backend Connection',
        passed: true,
        details: {
          available,
          status: health.status,
          providers: health.providers?.length || 0
        }
      });
    } catch (error) {
      this.results.push({
        test: 'Backend Connection',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testProviderDetection(): Promise<void> {
    try {
      const available = await backendClient.isBackendAvailable();
      
      if (available) {
        const models = await backendClient.getAvailableModels();
        const providers = await backendClient.getConfiguredProviders();
        
        this.results.push({
          test: 'Provider Detection (Backend)',
          passed: true,
          details: {
            models: models.length,
            providers: providers.length,
            providersList: providers
          }
        });
      } else {
        // Test frontend provider system
        const response = await fetch('/api/providers');
        const data = await response.json();
        
        this.results.push({
          test: 'Provider Detection (Frontend)',
          passed: response.ok,
          details: {
            models: data.models?.length || 0,
            providers: data.configuredProviders?.length || 0
          }
        });
      }
    } catch (error) {
      this.results.push({
        test: 'Provider Detection',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testModeDetection(): Promise<void> {
    try {
      // Test backend detection logic
      const backendAvailable = await backendClient.isBackendAvailable();
      
      // Test API endpoint detection
      const testResponse = await fetch('/api/backend/test');
      const apiWorking = testResponse.ok;
      
      this.results.push({
        test: 'Mode Detection',
        passed: true,
        details: {
          backendAvailable,
          apiEndpointWorking: apiWorking,
          recommendedMode: backendAvailable ? 'auto' : 'standalone'
        }
      });
    } catch (error) {
      this.results.push({
        test: 'Mode Detection',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getPassedTests(): number {
    return this.results.filter(r => r.passed).length;
  }

  getTotalTests(): number {
    return this.results.length;
  }

  getFailedTests(): IntegrationTestResult[] {
    return this.results.filter(r => !r.passed);
  }
}

// Global tester instance
export const integrationTester = new IntegrationTester();