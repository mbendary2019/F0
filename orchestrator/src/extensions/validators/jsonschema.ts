// orchestrator/src/extensions/validators/jsonschema.ts
// F0 Extension Manifest Validator using JSON Schema

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Extension provider types
 */
export type ExtensionProvider = 'firebase' | 'vercel' | 'stripe' | 'generic-http' | 'custom';

/**
 * Extension capabilities
 */
export type ExtensionCapability =
  | 'deploy'
  | 'provision'
  | 'billing'
  | 'storage'
  | 'secrets'
  | 'webhook-consumer'
  | 'webhook-producer';

/**
 * Input types for extension inputs
 */
export type InputType = 'string' | 'number' | 'boolean' | 'enum' | 'secret' | 'file' | 'json';

/**
 * Runner types
 */
export type RunnerType = 'http' | 'cli';

/**
 * Extension input definition
 */
export interface ExtensionInput {
  type: InputType;
  enum?: string[];
  required?: boolean;
  default?: unknown;
  description?: string;
}

/**
 * Extension runner configuration
 */
export interface ExtensionRunner {
  type: RunnerType;
  command?: string;
  args?: string[];
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
}

/**
 * Extension security configuration
 */
export interface ExtensionSecurity {
  scopes?: string[];
  whitelist?: string[];
  dangerous?: boolean;
}

/**
 * Validated extension manifest
 */
export interface ExtensionManifest {
  name: string;
  displayName?: string;
  version: string;
  provider: ExtensionProvider;
  description?: string;
  homepage?: string;
  capabilities: ExtensionCapability[];
  inputs?: Record<string, ExtensionInput>;
  runner: ExtensionRunner;
  security?: ExtensionSecurity;
}

/**
 * Validation error
 */
export class ManifestValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(`Invalid extension manifest: ${message}`);
    this.name = 'ManifestValidationError';
  }
}

/**
 * Input validation error
 */
export class InputValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * Validate extension name format
 */
function validateName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new ManifestValidationError('name must be a string', 'name');
  }
  if (!/^[a-z0-9-_.]{3,64}$/.test(name)) {
    throw new ManifestValidationError(
      'name must be 3-64 characters, lowercase alphanumeric with dashes, underscores, or dots',
      'name'
    );
  }
  return name;
}

/**
 * Validate semantic version
 */
function validateVersion(version: unknown): string {
  if (typeof version !== 'string') {
    throw new ManifestValidationError('version must be a string', 'version');
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$/.test(version)) {
    throw new ManifestValidationError(
      'version must be semantic version (e.g., 1.0.0)',
      'version'
    );
  }
  return version;
}

/**
 * Validate provider
 */
function validateProvider(provider: unknown): ExtensionProvider {
  const validProviders: ExtensionProvider[] = ['firebase', 'vercel', 'stripe', 'generic-http', 'custom'];
  if (typeof provider !== 'string' || !validProviders.includes(provider as ExtensionProvider)) {
    throw new ManifestValidationError(
      `provider must be one of: ${validProviders.join(', ')}`,
      'provider'
    );
  }
  return provider as ExtensionProvider;
}

/**
 * Validate capabilities array
 */
function validateCapabilities(capabilities: unknown): ExtensionCapability[] {
  const validCapabilities: ExtensionCapability[] = [
    'deploy',
    'provision',
    'billing',
    'storage',
    'secrets',
    'webhook-consumer',
    'webhook-producer',
  ];

  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new ManifestValidationError(
      'capabilities must be a non-empty array',
      'capabilities'
    );
  }

  for (const cap of capabilities) {
    if (!validCapabilities.includes(cap as ExtensionCapability)) {
      throw new ManifestValidationError(
        `invalid capability: ${cap}. Must be one of: ${validCapabilities.join(', ')}`,
        'capabilities'
      );
    }
  }

  return capabilities as ExtensionCapability[];
}

/**
 * Validate runner configuration
 */
function validateRunner(runner: unknown): ExtensionRunner {
  if (!runner || typeof runner !== 'object') {
    throw new ManifestValidationError('runner must be an object', 'runner');
  }

  const r = runner as Record<string, unknown>;

  if (r.type !== 'http' && r.type !== 'cli') {
    throw new ManifestValidationError(
      'runner.type must be "http" or "cli"',
      'runner.type'
    );
  }

  const result: ExtensionRunner = { type: r.type as RunnerType };

  if (r.type === 'cli') {
    if (typeof r.command !== 'string') {
      throw new ManifestValidationError(
        'cli runner requires command string',
        'runner.command'
      );
    }
    result.command = r.command;
    if (Array.isArray(r.args)) {
      result.args = r.args.map(String);
    }
  }

  if (r.type === 'http') {
    if (typeof r.url !== 'string') {
      throw new ManifestValidationError(
        'http runner requires url string',
        'runner.url'
      );
    }
    // Validate URL format
    try {
      new URL(r.url);
    } catch {
      throw new ManifestValidationError(
        'runner.url must match format "uri"',
        'runner.url'
      );
    }
    result.url = r.url;
    if (r.method) {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!validMethods.includes(r.method as string)) {
        throw new ManifestValidationError(
          `runner.method must be one of: ${validMethods.join(', ')}`,
          'runner.method'
        );
      }
      result.method = r.method as ExtensionRunner['method'];
    }
    if (r.headers && typeof r.headers === 'object') {
      result.headers = r.headers as Record<string, string>;
    }
  }

  return result;
}

/**
 * Validate inputs schema (internal function for manifest validation)
 */
function validateInputSchema(inputs: unknown): Record<string, ExtensionInput> | undefined {
  if (inputs === undefined) return undefined;

  if (!inputs || typeof inputs !== 'object') {
    throw new ManifestValidationError('inputs must be an object', 'inputs');
  }

  const validTypes: InputType[] = ['string', 'number', 'boolean', 'enum', 'secret', 'file', 'json'];
  const result: Record<string, ExtensionInput> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (!value || typeof value !== 'object') {
      throw new ManifestValidationError(
        `inputs.${key} must be an object`,
        `inputs.${key}`
      );
    }

    const input = value as Record<string, unknown>;

    if (!validTypes.includes(input.type as InputType)) {
      throw new ManifestValidationError(
        `inputs.${key}.type must be one of: ${validTypes.join(', ')}`,
        `inputs.${key}.type`
      );
    }

    result[key] = {
      type: input.type as InputType,
      enum: Array.isArray(input.enum) ? input.enum.map(String) : undefined,
      required: typeof input.required === 'boolean' ? input.required : undefined,
      default: input.default,
      description: typeof input.description === 'string' ? input.description : undefined,
    };
  }

  return result;
}

/**
 * Validate security configuration
 */
function validateSecurity(security: unknown): ExtensionSecurity | undefined {
  if (security === undefined) return undefined;

  if (!security || typeof security !== 'object') {
    throw new ManifestValidationError('security must be an object', 'security');
  }

  const s = security as Record<string, unknown>;
  const result: ExtensionSecurity = {};

  if (Array.isArray(s.scopes)) {
    result.scopes = s.scopes.map(String);
  }
  if (Array.isArray(s.whitelist)) {
    result.whitelist = s.whitelist.map(String);
  }
  if (typeof s.dangerous === 'boolean') {
    result.dangerous = s.dangerous;
  }

  return result;
}

/**
 * Validate an extension manifest JSON object
 *
 * @param json - The parsed JSON object to validate
 * @returns Validated ExtensionManifest
 * @throws ManifestValidationError if validation fails
 */
export function validateManifest(json: unknown): ExtensionManifest {
  if (!json || typeof json !== 'object') {
    throw new ManifestValidationError('manifest must be a JSON object');
  }

  const obj = json as Record<string, unknown>;

  // Required fields
  const name = validateName(obj.name);
  const version = validateVersion(obj.version);
  const provider = validateProvider(obj.provider);
  const capabilities = validateCapabilities(obj.capabilities);
  const runner = validateRunner(obj.runner);

  // Optional fields
  const inputs = validateInputSchema(obj.inputs);
  const security = validateSecurity(obj.security);

  const manifest: ExtensionManifest = {
    name,
    version,
    provider,
    capabilities,
    runner,
  };

  if (typeof obj.displayName === 'string') {
    manifest.displayName = obj.displayName;
  }
  if (typeof obj.description === 'string') {
    manifest.description = obj.description;
  }
  if (typeof obj.homepage === 'string') {
    manifest.homepage = obj.homepage;
  }
  if (inputs) {
    manifest.inputs = inputs;
  }
  if (security) {
    manifest.security = security;
  }

  return manifest;
}

/**
 * Load and validate a manifest from a file path
 */
export function loadManifest(filePath: string): ExtensionManifest {
  const content = readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);
  return validateManifest(json);
}

/**
 * Validate runtime inputs against a manifest's input definitions
 *
 * @param manifest - The validated manifest with input definitions
 * @param values - The runtime input values to validate
 * @throws InputValidationError if validation fails
 */
export function validateInputs(
  manifest: ExtensionManifest,
  values: Record<string, unknown>
): Record<string, unknown> {
  if (!manifest.inputs) {
    return values;
  }

  const result: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(manifest.inputs)) {
    const value = values[key];

    // Check required
    if (def.required && (value === undefined || value === null)) {
      throw new InputValidationError(
        `Required input missing: ${key}`,
        key
      );
    }

    // Use default if not provided
    if (value === undefined && def.default !== undefined) {
      result[key] = def.default;
      continue;
    }

    if (value === undefined) {
      continue;
    }

    // Type validation
    switch (def.type) {
      case 'string':
      case 'secret':
      case 'file':
        if (typeof value !== 'string') {
          throw new InputValidationError(
            `Input "${key}" must be a string`,
            key
          );
        }
        result[key] = value;
        break;

      case 'number':
        if (typeof value !== 'number') {
          throw new InputValidationError(
            `Input "${key}" must be a number`,
            key
          );
        }
        result[key] = value;
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new InputValidationError(
            `Input "${key}" must be a boolean`,
            key
          );
        }
        result[key] = value;
        break;

      case 'enum':
        if (def.enum && !def.enum.includes(String(value))) {
          throw new InputValidationError(
            `Input "${key}" must be one of: ${def.enum.join(', ')}`,
            key
          );
        }
        result[key] = value;
        break;

      case 'json':
        // JSON can be any type
        result[key] = value;
        break;

      default:
        result[key] = value;
    }
  }

  return result;
}

export default validateManifest;
