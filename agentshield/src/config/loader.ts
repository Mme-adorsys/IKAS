import { readFileSync } from 'fs';
import { resolve } from 'path';
import { load } from 'js-yaml';

import { AgentShieldConfigSchema, AgentShieldConfig } from '../types/config';

export class ConfigValidationError extends Error {
  constructor(message: string, public readonly issues: unknown) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export function loadConfig(configPath: string): AgentShieldConfig {
  const absolutePath = resolve(configPath);
  let raw: string;
  try {
    raw = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read config file at ${absolutePath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = load(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse YAML config at ${absolutePath}: ${message}`);
  }

  const result = AgentShieldConfigSchema.safeParse(parsed);
  if (!result.success) {
    const formatted = JSON.stringify(result.error.format(), null, 2);
    throw new ConfigValidationError(
      `Invalid config at ${absolutePath}:\n${formatted}`,
      result.error.issues,
    );
  }
  return result.data;
}
