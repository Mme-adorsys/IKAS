import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { sync as globSync } from 'glob';
import { load as yamlLoad } from 'js-yaml';
import { AgentShieldConfig } from '../../types/config';
import { Finding } from '../../types/findings';

const DEFAULT_GLOB = '**/{*.env,.env.*,docker-compose*.yml,*.yaml,*.json}';
const GLOB_IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'];

const CREDENTIAL_KEY_PATTERN = /PASSWORD|SECRET|API_KEY|TOKEN|PRIVATE_KEY|CREDENTIAL/i;
const ENV_VAR_REF = /^\$\{.+\}$/;
const PLACEHOLDER_REF = /^<[^>]+>$/;
const HTTP_URL_PATTERN = /\bhttp:\/\/(?!localhost|127\.0\.0\.1)[^\s"'`]+/i;

const ENTROPY_THRESHOLD = 3.5;
const CRED_SCORE = 8.5;
const TRANSPORT_SCORE = 5.5;

function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function checkCredential(key: string, val: string, filePath: string, findings: Finding[]): void {
  if (!CREDENTIAL_KEY_PATTERN.test(key)) return;
  if (ENV_VAR_REF.test(val) || PLACEHOLDER_REF.test(val)) return;
  if (shannonEntropy(val) <= ENTROPY_THRESHOLD) return;
  findings.push({
    id: randomUUID(),
    title: `Hardcoded credential: ${key}`,
    description:
      `Key "${key}" in ${filePath} has a high-entropy value (Shannon entropy > ${ENTROPY_THRESHOLD} bits/char), ` +
      `indicating a real credential stored in plain text. The credential value itself is intentionally not echoed in this report. ` +
      `(D-11 two-factor match: credential keyword + entropy)`,
    severity: 'high',
    component: filePath,
    score: CRED_SCORE,
    owaspCategory: 'MCP07:2025',
    remediation:
      'Move the secret to a secrets manager (Vault, AWS Secrets Manager, 1Password CLI) or environment variables ' +
      'injected at runtime from a non-committed source. Rotate the leaked credential immediately.',
  });
}

function checkInsecureTransport(key: string, val: string, filePath: string, findings: Finding[]): void {
  if (typeof val !== 'string') return;
  if (!HTTP_URL_PATTERN.test(val)) return;
  findings.push({
    id: randomUUID(),
    title: `Insecure transport: ${key} uses http://`,
    description:
      `Key "${key}" in ${filePath} contains an http:// URL targeting a non-localhost host. ` +
      `Unencrypted transport exposes credentials and request payloads to network observers. (D-12)`,
    severity: 'medium',
    component: filePath,
    score: TRANSPORT_SCORE,
    owaspCategory: 'MCP07:2025',
    remediation: 'Replace http:// with https:// for all external service URLs.',
  });
}

function parseEnvFile(content: string, filePath: string, findings: Finding[]): void {
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    checkCredential(key, val, filePath, findings);
    checkInsecureTransport(key, val, filePath, findings);
  }
}

function walkYamlNode(node: unknown, parentKey: string, filePath: string, findings: Finding[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    checkCredential(parentKey, node, filePath, findings);
    checkInsecureTransport(parentKey, node, filePath, findings);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      walkYamlNode(item, parentKey, filePath, findings);
    }
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walkYamlNode(v, k, filePath, findings);
    }
  }
}

function parseYamlFile(content: string, filePath: string, findings: Finding[]): void {
  let doc: unknown;
  try {
    doc = yamlLoad(content);
  } catch {
    return;
  }
  if (!doc || typeof doc !== 'object') return;

  // Single unified walk — covers docker-compose services.*.environment and all other YAML keys.
  // The previous docker-compose-specific block was removed because walkYamlNode already recurses
  // into services.*.environment nodes, causing every credential finding to be emitted twice (CR-01).
  walkYamlNode(doc, '', filePath, findings);
}

function walkJsonNode(node: unknown, parentKey: string, filePath: string, findings: Finding[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    checkCredential(parentKey, node, filePath, findings);
    checkInsecureTransport(parentKey, node, filePath, findings);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      walkJsonNode(item, parentKey, filePath, findings);
    }
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walkJsonNode(v, k, filePath, findings);
    }
  }
}

function parseJsonFile(content: string, filePath: string, findings: Finding[]): void {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return;
  }
  walkJsonNode(doc, '', filePath, findings);
}

/**
 * Audit project configuration files for hardcoded credentials and insecure transport URLs.
 *
 * Uses two-factor matching per D-11: credential keyword in key name + Shannon entropy > 3.5.
 * Scans .env, docker-compose*.yml, *.yaml, *.json files.
 *
 * @param config - AgentShieldConfig; uses configPaths when set (D-10), otherwise default glob from cwd (D-09).
 * @returns Array of Finding objects — never throws.
 */
export function auditConfigFiles(config: AgentShieldConfig): Finding[] {
  const findings: Finding[] = [];

  const patterns: string[] =
    config.configPaths && config.configPaths.length > 0
      ? config.configPaths
      : [DEFAULT_GLOB];

  const files = new Set<string>();
  for (const pattern of patterns) {
    try {
      const matched = globSync(pattern, {
        cwd: process.cwd(),
        absolute: true,
        ignore: GLOB_IGNORE,
        dot: true,
        nodir: true,
      });
      for (const f of matched) {
        files.add(f);
      }
    } catch {
      // skip invalid glob — never throw out of this function
    }
  }

  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    if (filePath.endsWith('.json')) {
      parseJsonFile(content, filePath, findings);
    } else if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      parseYamlFile(content, filePath, findings);
    } else {
      // .env, .env.*, anything else: treat as KEY=VALUE lines
      parseEnvFile(content, filePath, findings);
    }
  }

  return findings;
}
