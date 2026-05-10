import { Command } from 'commander';

import { loadConfig, ConfigValidationError } from './config/loader';
import { ScanRunner } from './runner/runner';

const program = new Command();

program
  .name('agentshield')
  .description('MCP security scanner for agentic AI systems')
  .version('0.1.0');

program
  .command('scan')
  .description('Run a security scan against a target MCP server')
  .argument('<target>', 'Target MCP server URL')
  .option('-c, --config <path>', 'Path to agentshield.config.yaml', 'agentshield.config.yaml')
  .option('-o, --output-dir <dir>', 'Override output directory for report files')
  .action(async (target: string, options: { config: string; outputDir?: string }) => {
    try {
      const config = loadConfig(options.config);
      if (options.outputDir) {
        config.outputDir = options.outputDir;
      }
      const runner = new ScanRunner(config);
      await runner.run(target);
      process.exit(0); // D-08: exit 0 on successful scan completion
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error('Invalid configuration:', error.message);
      } else {
        console.error('Scan failed:', error instanceof Error ? error.message : 'Unknown error');
      }
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error('Fatal:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
