import { existsSync, readFileSync, rmSync, mkdtempSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

import { ScanRunner } from '../src/runner/runner';
import { AgentShieldConfig, STAGE_IDS } from '../src/types/config';

function makeConfig(overrides: Partial<AgentShieldConfig> = {}): AgentShieldConfig {
  const outDir = mkdtempSync(resolve(tmpdir(), 'agentshield-runner-'));
  return {
    target: 'http://localhost:8001',
    allowedServers: [],
    outputDir: outDir,
    stages: [...STAGE_IDS],
    ...overrides,
  };
}

describe('ScanRunner', () => {
  it('runs all 5 stages sequentially and returns a ScanResult', async () => {
    const config = makeConfig();
    const runner = new ScanRunner(config);
    const result = await runner.run('http://localhost:8001');
    expect(result.target).toBe('http://localhost:8001');
    expect(result.stages).toHaveLength(5);
    expect(result.stages.map((s) => s.stageId)).toEqual([...STAGE_IDS]);
    rmSync(config.outputDir, { recursive: true, force: true });
  });

  it('writes agentshield-report.json to outputDir', async () => {
    const config = makeConfig();
    const runner = new ScanRunner(config);
    await runner.run('http://localhost:8001');
    const reportPath = resolve(config.outputDir, 'agentshield-report.json');
    expect(existsSync(reportPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(parsed).toHaveProperty('target');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('stages');
    expect(parsed).toHaveProperty('compositeScore');
    expect(parsed.stages).toHaveLength(5);
    rmSync(config.outputDir, { recursive: true, force: true });
  });

  it('honors stages filter — only runs configured stages', async () => {
    const config = makeConfig({ stages: ['discovery', 'report'] });
    const runner = new ScanRunner(config);
    const result = await runner.run('http://localhost:8001');
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0].stageId).toBe('discovery');
    expect(result.stages[1].stageId).toBe('report');
    rmSync(config.outputDir, { recursive: true, force: true });
  });

  it('creates outputDir recursively when it does not exist', async () => {
    const base = mkdtempSync(resolve(tmpdir(), 'agentshield-mkdir-'));
    const nested = resolve(base, 'a', 'b', 'c');
    const config = makeConfig({ outputDir: nested });
    const runner = new ScanRunner(config);
    await runner.run('http://localhost:8001');
    expect(existsSync(resolve(nested, 'agentshield-report.json'))).toBe(true);
    rmSync(base, { recursive: true, force: true });
  });

  it('CLI smoke: tsx src/cli.ts scan <url> --config <fixture> exits 0', () => {
    const cli = resolve(__dirname, '..', 'src', 'cli.ts');
    const tsx = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
    const fixture = resolve(__dirname, 'fixtures', 'runner-config.yaml');
    const outDir = resolve(__dirname, 'fixtures', 'runner-output');
    rmSync(outDir, { recursive: true, force: true });
    const result = execSync(
      `${tsx} ${cli} scan http://localhost:8001 --config ${fixture}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    expect(result).toContain('Report written to');
    expect(existsSync(resolve(outDir, 'agentshield-report.json'))).toBe(true);
    rmSync(outDir, { recursive: true, force: true });
  });

  it('CLI exits non-zero on invalid config path', () => {
    const cli = resolve(__dirname, '..', 'src', 'cli.ts');
    const tsx = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
    let exitCode = 0;
    try {
      execSync(`${tsx} ${cli} scan http://localhost:8001 --config /nonexistent/path.yaml`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      exitCode = (error as { status: number }).status;
    }
    expect(exitCode).not.toBe(0);
  });
});
