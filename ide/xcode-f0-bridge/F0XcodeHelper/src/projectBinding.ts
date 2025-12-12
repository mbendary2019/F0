/**
 * Project Binding for Xcode Helper
 * Phase 84.8.2: Manages project configuration
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), '.f0', 'config.json');

export const projectBinding = {
  async ensureProjectBound(): Promise<void> {
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error(
        'No F0 project linked. Please create .f0/config.json with projectId'
      );
    }

    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(data);

      if (!config.projectId) {
        throw new Error('No projectId found in .f0/config.json');
      }

      // Set environment variables for other modules
      process.env.F0_PROJECT_ID = config.projectId;

      if (config.apiBase) {
        process.env.F0_BACKEND_URL = config.apiBase;
      }
    } catch (err: any) {
      throw new Error(`Failed to read project config: ${err.message}`);
    }
  },
};
