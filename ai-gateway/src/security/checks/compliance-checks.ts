import { CheckContext, RawFinding, SecurityCheck } from './check.interface';

/**
 * GDPR / DSGVO + general security best-practices checks.
 * These are mostly advisory — severities default to warning/info.
 */

const gdprAuditLogging: SecurityCheck = {
  id: 'compliance.gdpr.audit-logging',
  category: 'compliance',
  title: 'DSGVO Art. 30 — Verzeichnis von Verarbeitungstätigkeiten',
  async run(ctx) {
    const ec = (await ctx.keycloak.callTool('get-events-config', { realm: ctx.realm })).data;
    if (ec?.adminEventsEnabled && ec?.eventsEnabled) return [];
    return [{
      checkId: 'compliance.gdpr.audit-logging',
      category: 'compliance',
      severity: 'warning',
      realm: ctx.realm,
      rule: 'GDPR_NO_AUDIT_TRAIL',
      title: 'Kein vollständiger Audit-Trail (Art. 30 DSGVO)',
      references: ['GDPR-Art.30', 'GDPR-Art.32'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: ec
    }];
  }
};

const gdprDataRetention: SecurityCheck = {
  id: 'compliance.gdpr.data-retention',
  category: 'compliance',
  title: 'DSGVO Art. 5(1)(e) — Speicherbegrenzung',
  async run(ctx) {
    const ec = (await ctx.keycloak.callTool('get-events-config', { realm: ctx.realm })).data;
    const expiry = ec?.eventsExpiration ?? 0;
    if (expiry > 0 && expiry < 31536000) return [];     // < 1 year and configured
    return [{
      checkId: 'compliance.gdpr.data-retention',
      category: 'compliance',
      severity: 'warning',
      realm: ctx.realm,
      rule: 'GDPR_RETENTION_UNDEFINED',
      title: expiry === 0
        ? 'Event-Aufbewahrungsfrist nicht definiert'
        : `Event-Aufbewahrung ist ${Math.round(expiry / 86400)} Tage — DSGVO-Vereinbarkeit prüfen`,
      references: ['GDPR-Art.5'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { eventsExpiration: expiry }
    }];
  }
};

const gdprTlsEnforced: SecurityCheck = {
  id: 'compliance.gdpr.tls',
  category: 'compliance',
  title: 'DSGVO Art. 32 — Vertraulichkeit der Übertragung',
  async run(ctx) {
    const cfg = (await ctx.keycloak.callTool('get-realm-config', { realm: ctx.realm })).data;
    if (cfg?.sslRequired === 'all') return [];
    return [{
      checkId: 'compliance.gdpr.tls',
      category: 'compliance',
      severity: cfg?.sslRequired === 'none' ? 'error' : 'warning',
      realm: ctx.realm,
      rule: 'GDPR_TLS_NOT_ENFORCED',
      title: `TLS ist nicht zwingend erforderlich (sslRequired=${cfg?.sslRequired})`,
      references: ['GDPR-Art.32'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { sslRequired: cfg?.sslRequired }
    }];
  }
};

const bestPracticeEmailVerification: SecurityCheck = {
  id: 'compliance.best-practice.email-verification',
  category: 'compliance',
  title: 'Best Practice — E-Mail-Verifikation bei Selbstregistrierung',
  async run(ctx) {
    const cfg = (await ctx.keycloak.callTool('get-realm-config', { realm: ctx.realm })).data;
    if (!cfg?.registrationAllowed) return [];
    if (cfg.verifyEmail) return [];
    return [{
      checkId: 'compliance.best-practice.email-verification',
      category: 'compliance',
      severity: 'warning',
      realm: ctx.realm,
      rule: 'BEST_PRACTICE_NO_VERIFY_EMAIL',
      title: 'Selbstregistrierung ohne E-Mail-Verifikation',
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { registrationAllowed: cfg.registrationAllowed, verifyEmail: cfg.verifyEmail }
    }];
  }
};

const bestPracticeRememberMeBounded: SecurityCheck = {
  id: 'compliance.best-practice.session-bounded',
  category: 'compliance',
  title: 'Best Practice — Session-Lebenszeit begrenzt',
  async run(ctx) {
    const cfg = (await ctx.keycloak.callTool('get-realm-config', { realm: ctx.realm })).data;
    const max = cfg?.ssoSessionMaxLifespan ?? 0;
    if (max > 0 && max <= 86400) return [];             // ≤ 24h is fine
    return [{
      checkId: 'compliance.best-practice.session-bounded',
      category: 'compliance',
      severity: 'info',
      realm: ctx.realm,
      rule: 'BEST_PRACTICE_LONG_SSO_SESSION',
      title: `SSO-Session-Lebenszeit ist ${max} Sekunden (> 24h)`,
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { ssoSessionMaxLifespan: max }
    }];
  }
};

export const complianceChecks: SecurityCheck[] = [
  gdprAuditLogging,
  gdprDataRetention,
  gdprTlsEnforced,
  bestPracticeEmailVerification,
  bestPracticeRememberMeBounded
];
