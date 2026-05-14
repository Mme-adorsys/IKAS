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

function renderDynamicTestingMetadata(metadata: Record<string, unknown>): void {
  const asr = metadata['asrByAttackType'] as Record<string, unknown> | null | undefined;
  const totalAttempts = metadata['totalAttempts'] as number | undefined;
  if (!asr) return;
  console.log(chalk.gray(`  Attack Success Rate (${totalAttempts ?? '?'} total attempts):`));
  if (typeof asr['toolShadowing'] === 'string') {
    console.log(chalk.gray(`    Tool Shadowing:      ${asr['toolShadowing']}`));
  }
  const rade = asr['rade'] as Record<string, string> | string | undefined;
  if (typeof rade === 'object' && rade !== null) {
    console.log(chalk.gray(`    RADE Role-Takeover:  ${rade['roleTakeover'] ?? '-'}`));
    console.log(chalk.gray(`    RADE Data-Exfil:     ${rade['dataExfiltration'] ?? '-'}`));
    console.log(chalk.gray(`    RADE Priv-Escalation:${rade['privilegeEscalation'] ?? '-'}`));
  } else if (typeof rade === 'string') {
    console.log(chalk.gray(`    RADE:                ${rade}`));
  }
  if (typeof asr['escalationChain'] === 'string') {
    console.log(chalk.gray(`    Escalation Chain:    ${asr['escalationChain']}`));
  }
}

export function renderTable(result: ScanResult): void {
  console.log(chalk.bold(`\nAgentShield Scan Results — ${result.target}`));
  console.log(chalk.gray(`Timestamp: ${result.timestamp}`));

  for (const stage of result.stages) {
    console.log(chalk.bold.underline(`\n${stage.stageName}`));
    if (stage.error) {
      console.log(chalk.red(`  Error: ${stage.error}`));
      if (stage.stageId === 'dynamicTesting' && stage.metadata) {
        renderDynamicTestingMetadata(stage.metadata);
      }
      continue;
    }
    if (stage.findings.length === 0) {
      if (stage.stageId === 'dynamicTesting' && stage.metadata) {
        renderDynamicTestingMetadata(stage.metadata);
      } else {
        console.log(chalk.green('  No findings.'));
      }
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
    if (stage.stageId === 'dynamicTesting' && stage.metadata) {
      renderDynamicTestingMetadata(stage.metadata);
    }
  }
  console.log(chalk.bold(`\nComposite Score: ${result.compositeScore.value}`));
}
