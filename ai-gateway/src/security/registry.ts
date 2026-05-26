import { CheckCategory } from './types';
import { SecurityCheck } from './checks/check.interface';
import { configChecks } from './checks/config-checks';
import { fraudChecks } from './checks/fraud-checks';
import { owaspChecks } from './checks/owasp-checks';
import { complianceChecks } from './checks/compliance-checks';
import { privilegeChecks } from './checks/privilege-checks';
import { identityChecks } from './checks/identity-checks';

/**
 * Single source of truth for all SecurityCheck instances. The engine resolves checks via
 * `resolveChecks(scope)`; pass 'all' to run every category.
 */

const ALL_CHECKS: SecurityCheck[] = [
  ...configChecks,
  ...fraudChecks,
  ...owaspChecks,
  ...complianceChecks,
  ...privilegeChecks,
  ...identityChecks
];

export function resolveChecks(scope: 'all' | CheckCategory): SecurityCheck[] {
  if (scope === 'all') return ALL_CHECKS;
  return ALL_CHECKS.filter(c => c.category === scope);
}

export function getAllChecks(): SecurityCheck[] {
  return ALL_CHECKS;
}
