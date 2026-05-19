import { resolve } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

import { loadConfig, ConfigValidationError } from '../src/config/loader';
import { STAGE_IDS } from '../src/types/config';

const VALID = resolve(__dirname, 'fixtures', 'valid-config.yaml');
const INVALID = resolve(__dirname, 'fixtures', 'invalid-config.yaml');

describe('loadConfig', () => {
  it('loads and validates a complete YAML config', () => {
    const config = loadConfig(VALID);
    expect(config.target).toBe('http://localhost:8001');
    expect(config.allowedServers).toHaveLength(2);
    expect(config.stages).toHaveLength(5);
    expect(config.auth?.apiKey).toBe('test-api-key-literal');
  });

  it('throws ConfigValidationError when target is missing', () => {
    expect(() => loadConfig(INVALID)).toThrow(ConfigValidationError);
    try {
      loadConfig(INVALID);
    } catch (error) {
      expect((error as Error).message).toMatch(/target/);
    }
  });

  it('rejects unknown stage IDs', () => {
    const dir = mkdirSync(resolve(tmpdir(), `agentshield-test-${Date.now()}`), { recursive: true });
    const path = resolve(dir as string, 'bad-stages.yaml');
    writeFileSync(path, 'target: http://localhost:8001\nstages:\n  - foo\n', 'utf8');
    try {
      expect(() => loadConfig(path)).toThrow(ConfigValidationError);
    } finally {
      rmSync(dir as string, { recursive: true, force: true });
    }
  });

  it('applies defaults for outputDir and stages when omitted', () => {
    const dir = mkdirSync(resolve(tmpdir(), `agentshield-test-${Date.now()}-min`), { recursive: true });
    const path = resolve(dir as string, 'minimal.yaml');
    writeFileSync(path, 'target: http://localhost:8001\n', 'utf8');
    try {
      const config = loadConfig(path);
      expect(config.outputDir).toBe('./agentshield-output');
      expect(config.stages).toEqual([...STAGE_IDS]);
      expect(config.allowedServers).toEqual([]);
    } finally {
      rmSync(dir as string, { recursive: true, force: true });
    }
  });

  it('reads auth values literally without env substitution', () => {
    const config = loadConfig(VALID);
    expect(config.auth?.apiKey).toBe('test-api-key-literal');
    expect(config.auth?.apiKey).not.toMatch(/\$\{/);
  });
});
