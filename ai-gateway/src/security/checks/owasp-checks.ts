import { CheckContext, RawFinding, SecurityCheck } from './check.interface';

/**
 * OWASP Top 10 mapped to concrete Keycloak signals.
 *
 * These checks deliberately re-use the same underlying realm/client data as `config-checks`
 * but tag findings with the OWASP category — the AI explainer + UI use these tags to group
 * Top-10 findings together.
 */

const a01BrokenAccessControl: SecurityCheck = {
  id: 'owasp.a01.broken-access-control',
  category: 'owasp',
  title: 'A01 Broken Access Control — riskante Client-Flow-Kombinationen',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-client-protocols-summary', { realm: ctx.realm });
    const clients = (res.data as any[]) || [];
    const findings: RawFinding[] = [];
    for (const c of clients) {
      if (c.enabled && c.publicClient && c.directAccessGrantsEnabled) {
        findings.push({
          checkId: 'owasp.a01.broken-access-control',
          category: 'owasp',
          severity: 'error',
          realm: ctx.realm,
          rule: 'OWASP_A01_DIRECT_GRANTS_PUBLIC',
          title: `Public Client '${c.clientId}' erlaubt Direct Access Grants`,
          references: ['OWASP:A01', 'OAuth-BCP'],
          affected: [{ type: 'client', id: c.id, name: c.clientId }],
          evidence: { clientId: c.clientId, publicClient: c.publicClient, directAccessGrantsEnabled: c.directAccessGrantsEnabled }
        });
      }
    }
    return findings;
  }
};

const a02CryptoFailures: SecurityCheck = {
  id: 'owasp.a02.crypto-failures',
  category: 'owasp',
  title: 'A02 Cryptographic Failures — SSL/TLS-Konfiguration',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-realm-config', { realm: ctx.realm });
    const cfg = res.data;
    if (cfg?.sslRequired === 'all') return [];
    return [{
      checkId: 'owasp.a02.crypto-failures',
      category: 'owasp',
      severity: cfg?.sslRequired === 'none' ? 'critical' : 'error',
      realm: ctx.realm,
      rule: 'OWASP_A02_SSL_WEAK',
      title: 'SSL-Anforderung nicht auf "all" gesetzt',
      references: ['OWASP:A02', 'CWE-319'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { sslRequired: cfg?.sslRequired }
    }];
  }
};

const a05Misconfiguration: SecurityCheck = {
  id: 'owasp.a05.misconfiguration',
  category: 'owasp',
  title: 'A05 Security Misconfiguration — Default-Werte',
  async run(ctx) {
    const cfg = (await ctx.keycloak.callTool('get-realm-config', { realm: ctx.realm })).data;
    const findings: RawFinding[] = [];
    if (cfg?.rememberMe && (cfg?.ssoSessionMaxLifespan ?? 0) > 30 * 86400) {
      findings.push({
        checkId: 'owasp.a05.misconfiguration',
        category: 'owasp',
        severity: 'warning',
        realm: ctx.realm,
        rule: 'OWASP_A05_LONG_REMEMBER_ME',
        title: '"Remember me" + sehr lange SSO-Session-Lebensdauer',
        references: ['OWASP:A05'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: { rememberMe: cfg.rememberMe, ssoSessionMaxLifespan: cfg.ssoSessionMaxLifespan }
      });
    }
    if (cfg?.duplicateEmailsAllowed) {
      findings.push({
        checkId: 'owasp.a05.misconfiguration',
        category: 'owasp',
        severity: 'warning',
        realm: ctx.realm,
        rule: 'OWASP_A05_DUPLICATE_EMAILS',
        title: 'Doppelte E-Mail-Adressen sind erlaubt',
        references: ['OWASP:A05'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: { duplicateEmailsAllowed: cfg.duplicateEmailsAllowed }
      });
    }
    return findings;
  }
};

const a07AuthFailures: SecurityCheck = {
  id: 'owasp.a07.auth-failures',
  category: 'owasp',
  title: 'A07 Identification and Authentication Failures',
  async run(ctx) {
    const findings: RawFinding[] = [];
    const bf = (await ctx.keycloak.callTool('get-brute-force-detection', { realm: ctx.realm })).data;
    if (!bf?.bruteForceProtected) {
      findings.push({
        checkId: 'owasp.a07.auth-failures',
        category: 'owasp',
        severity: 'critical',
        realm: ctx.realm,
        rule: 'OWASP_A07_NO_BRUTE_FORCE',
        title: 'Kein Brute-Force-Schutz aktiv',
        references: ['OWASP:A07', 'CWE-307'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: bf
      });
    }
    const otp = (await ctx.keycloak.callTool('get-otp-policy', { realm: ctx.realm })).data;
    if (!otp?.otpPolicyType) {
      findings.push({
        checkId: 'owasp.a07.auth-failures',
        category: 'owasp',
        severity: 'warning',
        realm: ctx.realm,
        rule: 'OWASP_A07_NO_MFA',
        title: 'Keine MFA-Richtlinie definiert',
        references: ['OWASP:A07', 'NIST-800-63B'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: otp
      });
    }
    return findings;
  }
};

const a09LoggingFailures: SecurityCheck = {
  id: 'owasp.a09.logging-failures',
  category: 'owasp',
  title: 'A09 Security Logging and Monitoring Failures',
  async run(ctx) {
    const ec = (await ctx.keycloak.callTool('get-events-config', { realm: ctx.realm })).data;
    const findings: RawFinding[] = [];
    if (!ec?.eventsEnabled || !ec?.adminEventsEnabled) {
      findings.push({
        checkId: 'owasp.a09.logging-failures',
        category: 'owasp',
        severity: 'error',
        realm: ctx.realm,
        rule: 'OWASP_A09_EVENTS_OFF',
        title: `Events sind teilweise deaktiviert (user=${ec?.eventsEnabled}, admin=${ec?.adminEventsEnabled})`,
        references: ['OWASP:A09', 'GDPR-Art.30'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: ec
      });
    }
    if (ec?.eventsEnabled && (ec?.eventsExpiration ?? 0) === 0) {
      findings.push({
        checkId: 'owasp.a09.logging-failures',
        category: 'owasp',
        severity: 'warning',
        realm: ctx.realm,
        rule: 'OWASP_A09_EVENTS_NO_RETENTION',
        title: 'Event-Retention nicht konfiguriert',
        references: ['OWASP:A09'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: { eventsExpiration: ec?.eventsExpiration }
      });
    }
    return findings;
  }
};

export const owaspChecks: SecurityCheck[] = [
  a01BrokenAccessControl,
  a02CryptoFailures,
  a05Misconfiguration,
  a07AuthFailures,
  a09LoggingFailures
];
