/**
 * F0 SDK - Autonomous Ops Client SDK
 * Real implementation for desktop/mobile/web
 */

export interface F0Config {
  apiUrl: string;
  projectId?: string;
  apiKey?: string;
}

export interface ExecuteResult {
  success: boolean;
  command: string;
  args: string[];
  output?: string;
  error?: string;
  timestamp: number;
  duration?: number;
}

export interface TelemetryStats {
  cpu: number;
  memory: number;
  uptime: number;
  platform: string;
  arch: string;
  nodeVersion?: string;
  timestamp: number;
}

export class F0SDK {
  private config: F0Config;
  private baseUrl: string;

  constructor(config: F0Config) {
    this.config = config;
    this.baseUrl = config.apiUrl || process.env.F0_API_URL || 'http://localhost:8080/api';
  }

  /**
   * Execute command via orchestrator
   */
  async execute(cmd: string, args: string[] = [], options?: { cwd?: string }): Promise<ExecuteResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/commands/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          command: cmd,
          args: args,
          cwd: options?.cwd
        })
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      return {
        success: response.ok,
        command: cmd,
        args: args,
        output: data.output || data.result,
        error: data.error,
        timestamp: Date.now(),
        duration
      };
    } catch (error) {
      return {
        success: false,
        command: cmd,
        args: args,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get telemetry stats
   */
  async getTelemetry(): Promise<TelemetryStats> {
    try {
      const response = await fetch(`${this.baseUrl}/telemetry`, {
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Telemetry API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        cpu: data.cpu || 0,
        memory: data.memory || 0,
        uptime: data.uptime || 0,
        platform: data.platform || process.platform,
        arch: data.arch || process.arch,
        nodeVersion: data.nodeVersion || process.version,
        timestamp: Date.now()
      };
    } catch (error) {
      // Fallback to local stats if API unavailable
      return this.getLocalTelemetry();
    }
  }

  /**
   * Get local telemetry (fallback)
   */
  private getLocalTelemetry(): TelemetryStats {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    return {
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to ms
      memory: memUsage.heapUsed / 1024 / 1024, // Convert to MB
      uptime: process.uptime(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      timestamp: Date.now()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      return {
        status: data.status || (response.ok ? 'healthy' : 'unhealthy'),
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unreachable',
        timestamp: Date.now()
      };
    }
  }
}

// Export singleton instance
let sdkInstance: F0SDK | null = null;

export function initF0SDK(config: F0Config): F0SDK {
  sdkInstance = new F0SDK(config);
  return sdkInstance;
}

export function getF0SDK(): F0SDK {
  if (!sdkInstance) {
    throw new Error('F0 SDK not initialized. Call initF0SDK() first.');
  }
  return sdkInstance;
}

// Export default instance creator
export default {
  init: initF0SDK,
  get: getF0SDK
};


