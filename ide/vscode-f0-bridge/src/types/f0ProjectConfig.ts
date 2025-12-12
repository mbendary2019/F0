/**
 * F0 Project Configuration
 * Phase 84.6: Auto project detection via .f0/project.json
 */

export interface F0ProjectConfig {
  /**
   * Unique F0 project ID
   */
  projectId: string;

  /**
   * Human-readable project name
   */
  projectName: string;

  /**
   * Backend URL for this project
   * @example "https://from-zero.app"
   * @example "http://localhost:3030"
   */
  backendUrl: string;

  /**
   * Environment type
   */
  environment: 'prod' | 'dev' | 'staging';

  /**
   * Optional: Last synced timestamp
   */
  lastSync?: number;
}

/**
 * Validate F0 project config structure
 */
export function validateF0ProjectConfig(config: any): config is F0ProjectConfig {
  return (
    typeof config === 'object' &&
    typeof config.projectId === 'string' &&
    typeof config.projectName === 'string' &&
    typeof config.backendUrl === 'string' &&
    (config.environment === 'prod' || config.environment === 'dev' || config.environment === 'staging')
  );
}
