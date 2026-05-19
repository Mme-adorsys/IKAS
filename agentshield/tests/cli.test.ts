import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI = resolve(__dirname, '..', 'src', 'cli.ts');
const TSX = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');

function runCli(args: string): { stdout: string; status: number } {
  try {
    const stdout = execSync(`${TSX} ${CLI} ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { stdout, status: 0 };
  } catch (error) {
    const err = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      stdout: (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? ''),
      status: err.status ?? 1,
    };
  }
}

describe('agentshield CLI', () => {
  it('prints scan --help with target argument and --config option', () => {
    const { stdout, status } = runCli('scan --help');
    expect(status).toBe(0);
    expect(stdout).toContain('Usage: agentshield scan');
    expect(stdout).toContain('<target>');
    expect(stdout).toContain('-c, --config');
  });

  it('prints version 0.1.0', () => {
    const { stdout, status } = runCli('--version');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('0.1.0');
  });

  it('exits non-zero when scan is called without a target', () => {
    const { status } = runCli('scan');
    expect(status).not.toBe(0);
  });
});
