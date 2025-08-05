/**
 * Backend client for communicating with the FastAPI backend.
 * Provides seamless fallback to standalone mode when backend is unavailable.
 */

import { CreateResponseRequest, ResponseStatus } from './api';

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unavailable';
  providers?: Array<{
    id: string;
    status: string;
    enabled: boolean;
    models: number;
  }>;
  timestamp?: number;
}

export interface BackendProviderTest {
  connected: boolean;
  provider?: string;
  models?: number;
  error?: string;
}

export class BackendClient {
  private baseUrl: string;
  private isAvailable: boolean | null = null;
  private lastHealthCheck: number = 0;
  private healthCheckInterval = 30000; // 30 seconds

  constructor(baseUrl: string = 'http://localhost:8000/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the backend is available
   */
  async isBackendAvailable(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached result if recent
    if (this.isAvailable !== null && now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isAvailable;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      this.isAvailable = response.ok;
      this.lastHealthCheck = now;
      
      console.log(`Backend availability check: ${this.isAvailable ? 'available' : 'unavailable'}`);
      return this.isAvailable;
    } catch (error) {
      console.log('Backend unavailable:', error instanceof Error ? error.message : 'unknown error');
      this.isAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Get backend health status
   */
  async getHealth(): Promise<BackendHealth> {
    try {
      const available = await this.isBackendAvailable();
      if (!available) {
        return { status: 'unavailable' };
      }

      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        return { status: 'unhealthy' };
      }

      const data = await response.json();
      return {
        status: data.status || 'healthy',
        providers: data.providers ? Object.entries(data.providers).map(([id, info]: [string, any]) => ({
          id,
          status: info.status,
          enabled: info.enabled,
          models: info.models?.length || 0
        })) : [],
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('Failed to get backend health:', error);
      return { status: 'unavailable' };
    }
  }

  /**
   * Create a response using the backend
   */
  async createResponse(request: CreateResponseRequest): Promise<ResponseStatus> {
    const available = await this.isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available');
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get response status from backend
   */
  async getResponseStatus(responseId: string): Promise<ResponseStatus> {
    const available = await this.isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available');
    }

    const response = await fetch(`${this.baseUrl}/responses/${responseId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Response not found');
      }
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Stream response from backend
   */
  async streamResponse(responseId: string): Promise<ReadableStream<Uint8Array> | null> {
    const available = await this.isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available');
    }

    const response = await fetch(`${this.baseUrl}/responses/${responseId}/stream`);
    
    if (!response.ok) {
      throw new Error(`Backend stream error: ${response.status}`);
    }

    return response.body;
  }

  /**
   * Test provider connection via backend
   */
  async testProvider(provider: string): Promise<BackendProviderTest> {
    const available = await this.isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available');
    }

    const response = await fetch(`${this.baseUrl}/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        connected: false,
        error: `Backend error: ${response.status} ${errorText}`
      };
    }

    return response.json();
  }

  /**
   * Get available models from backend
   */
  async getAvailableModels(): Promise<any[]> {
    const available = await this.isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available');
    }

    const response = await fetch(`${this.baseUrl}/models`);
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  }

  /**
   * Get configured providers from backend
   */
  async getConfiguredProviders(): Promise<string[]> {
    const available = await this.isBackendAvailable();
    if (!available) {
      throw new Error('Backend is not available');
    }

    const response = await fetch(`${this.baseUrl}/providers`);
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    return data.configuredProviders || [];
  }

  /**
   * Force refresh backend availability check
   */
  forceHealthCheck(): void {
    this.isAvailable = null;
    this.lastHealthCheck = 0;
  }
}

// Global backend client instance
export const backendClient = new BackendClient();