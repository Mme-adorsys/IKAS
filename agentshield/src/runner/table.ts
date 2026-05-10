import Table from 'cli-table3';
import chalk from 'chalk';

import { ScanResult } from '../types/report';
import { SeverityLevel } from '../types/findings';

const SEVERITY_COLOR: Record<SeverityLevel, (s: string) => string> = {
  critical: chalk.bgRed.white.bold,
  high: chalk.red.bold,
  medium: chalk.yellow,
  low: chalk.cyan,
  info: chalk.gray,
};

export function renderTable(result: ScanResult): void {
  console.log(chalk.bold(`\nAgentShield Scan Results — ${result.target}`));
  console.log(chalk.gray(`Timestamp: ${result.timestamp}`));

  for (const stage of result.stages) {
    console.log(chalk.bold.underline(`\n${stage.stageName}`));
    if (stage.error) {
      console.log(chalk.red(`  Error: ${stage.error}`));
      continue;
    }
    if (stage.findings.length === 0) {
      console.log(chalk.green('  No findings.'));
      continue;
    }
    const table = new Table({
      head: ['Severity', 'Title', 'Component', 'Score'],
      colWidths: [12, 40, 25, 8],
    });
    for (const f of stage.findings) {
      const colorize = SEVERITY_COLOR[f.severity];
      table.push([colorize(f.severity.toUpperCase()), f.title, f.component, String(f.score)]);
    }
    console.log(table.toString());
  }
  console.log(chalk.bold(`\nComposite Score: ${result.compositeScore.value}`));
}
