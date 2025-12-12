/**
 * Project Binding Configuration for Cursor Bridge
 * Phase 84.8: Manages project-specific F0 configuration
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectBinding {
  projectId: string;
  apiBase: string;
  sessionId?: string;
}

/**
 * Get project binding from .f0/config.json in current directory
 */
export function getProjectBinding(cwd: string = process.cwd()): ProjectBinding | null {
  const configPath = path.join(cwd, '.f0', 'config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    return config as ProjectBinding;
  } catch (err) {
    console.warn('[ProjectBinding] Failed to load config:', err);
    return null;
  }
}

/**
 * Save project binding to .f0/config.json in current directory
 */
export function saveProjectBinding(binding: ProjectBinding, cwd: string = process.cwd()): void {
  const configDir = path.join(cwd, '.f0');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(binding, null, 2), 'utf8');
  console.log('[ProjectBinding] Saved config to', configPath);
}

/**
 * Update session ID in project binding
 */
export function updateSessionId(sessionId: string, cwd: string = process.cwd()): void {
  const binding = getProjectBinding(cwd);
  if (!binding) {
    throw new Error('No project binding found. Please run "f0 init" first.');
  }

  binding.sessionId = sessionId;
  saveProjectBinding(binding, cwd);
}
