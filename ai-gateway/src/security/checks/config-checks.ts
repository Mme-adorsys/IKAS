import { CheckContext, RawFinding, SecurityCheck } from './check.interface';

/**
 * Keycloak configuration audit. Each check is independent so the registry can run them in
 * parallel; all read-only against the Keycloak admin API via MCP.
 */

async function fetchRealmConfig(ctx: CheckContext): Promise<any> {
  const res = await ctx.keycloak.callTool('get-realm-config', { realm: ctx.realm });
  return res.data;
}

const sslRequired: SecurityCheck = {
  id: 'config.ssl-required',
  category: 'config',
  title: 'SSL erforderlich für alle Anfragen',
  async run(ctx) {
    const cfg = await fetchRealmConfig(ctx);
    if (cfg?.sslRequired === 'all') return [];
    return [{
      checkId: 'config.ssl-required',
      category: 'config',
      severity: cfg?.sslRequired === 'none' ? 'critical' : 'error',
      realm: ctx.realm,
      rule: 'SSL_REQUIRED_WEAK',
      title: `SSL ist auf '${cfg?.sslRequired ?? 'unbekannt'}' gesetzt`,
      references: ['OWASP:A02', 'CWE-319'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { sslRequired: cfg?.sslRequired }
    }];
  }
};

const bruteForce: SecurityCheck = {
  id: 'config.brute-force',
  category: 'config',
  title: 'Brute-Force-Schutz aktiv',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-brute-force-detection', { realm: ctx.realm });
    const bf = res.data;
    if (bf?.bruteForceProtected) return [];
    return [{
      checkId: 'config.brute-force',
      category: 'config',
      severity: 'critical',
      realm: ctx.realm,
      rule: 'BRUTE_FORCE_DISABLED',
      title: 'Brute-Force-Schutz ist deaktiviert',
      references: ['OWASP:A07', 'CWE-307'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: bf
    }];
  }
};

const passwordPolicy: SecurityCheck = {
  id: 'config.password-policy',
  category: 'config',
  title: 'Passwortrichtlinie definiert',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-password-policy', { realm: ctx.realm });
    const pp = res.data;
    if (!pp?.configured) {
      return [{
        checkId: 'config.password-policy',
        category: 'config',
        severity: 'error',
        realm: ctx.realm,
        rule: 'PASSWORD_POLICY_MISSING',
        title: 'Keine Passwortrichtlinie konfiguriert',
        references: ['OWASP:A07', 'CWE-521'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: pp
      }];
    }
    const length = parseInt(pp.rules?.length ?? '0', 10);
    if (length < 12) {
      return [{
        checkId: 'config.password-policy',
        category: 'config',
        severity: 'warning',
        realm: ctx.realm,
        rule: 'PASSWORD_POLICY_WEAK_LENGTH',
        title: `Mindestlänge nur ${length || 'undefiniert'} Zeichen`,
        references: ['OWASP:A07', 'CWE-521'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: pp
      }];
    }
    return [];
  }
};

const selfRegistration: SecurityCheck = {
  id: 'config.self-registration',
  category: 'config',
  title: 'Selbstregistrierung mit E-Mail-Verifikation',
  async run(ctx) {
    const cfg = await fetchRealmConfig(ctx);
    if (cfg?.registrationAllowed && !cfg?.verifyEmail) {
      return [{
        checkId: 'config.self-registration',
        category: 'config',
        severity: 'error',
        realm: ctx.realm,
        rule: 'OPEN_REGISTRATION_NO_VERIFY',
        title: 'Selbstregistrierung ohne E-Mail-Verifikation aktiv',
        references: ['OWASP:A07'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: { registrationAllowed: cfg.registrationAllowed, verifyEmail: cfg.verifyEmail }
      }];
    }
    return [];
  }
};

const implicitFlowClients: SecurityCheck = {
  id: 'config.implicit-flow-clients',
  category: 'config',
  title: 'Keine Clients mit Implicit Flow',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-client-protocols-summary', { realm: ctx.realm });
    const risky = (res.data as any[]).filter(c => c.implicitFlowEnabled && c.enabled);
    return risky.map(c => ({
      checkId: 'config.implicit-flow-clients',
      category: 'config' as const,
      severity: 'error' as const,
      realm: ctx.realm,
      rule: 'CLIENT_IMPLICIT_FLOW',
      title: `Client '${c.clientId}' nutzt Implicit Flow`,
      references: ['OWASP:A02', 'OAuth-BCP'],
      affected: [{ type: 'client' as const, id: c.id, name: c.clientId }],
      evidence: { clientId: c.clientId, publicClient: c.publicClient }
    }));
  }
};

const adminEventsDisabled: SecurityCheck = {
  id: 'config.admin-events',
  category: 'config',
  title: 'Admin-Events aktiviert',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-events-config', { realm: ctx.realm });
    const ec = res.data;
    if (ec?.adminEventsEnabled) return [];
    return [{
      checkId: 'config.admin-events',
      category: 'config',
      severity: 'warning',
      realm: ctx.realm,
      rule: 'ADMIN_EVENTS_DISABLED',
      title: 'Admin-Events sind deaktiviert (kein Audit-Trail)',
      references: ['OWASP:A09', 'GDPR-Art.30'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: ec
    }];
  }
};

const userEventsDisabled: SecurityCheck = {
  id: 'config.user-events',
  category: 'config',
  title: 'User-Events aktiviert',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-events-config', { realm: ctx.realm });
    const ec = res.data;
    if (ec?.eventsEnabled) return [];
    return [{
      checkId: 'config.user-events',
      category: 'config',
      severity: 'warning',
      realm: ctx.realm,
      rule: 'USER_EVENTS_DISABLED',
      title: 'User-Events sind deaktiviert',
      references: ['OWASP:A09'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: ec
    }];
  }
};

const tokenLifetime: SecurityCheck = {
  id: 'config.token-lifetime',
  category: 'config',
  title: 'Access-Token-Lebenszeit moderat',
  async run(ctx) {
    const cfg = await fetchRealmConfig(ctx);
    const lifetime = cfg?.accessTokenLifespan ?? 0;
    if (lifetime <= 3600) return [];                   // ≤ 1h is fine
    return [{
      checkId: 'config.token-lifetime',
      category: 'config',
      severity: lifetime > 28800 ? 'warning' : 'info',
      realm: ctx.realm,
      rule: 'ACCESS_TOKEN_LIFESPAN_LONG',
      title: `Access-Token-Lebenszeit ist ${lifetime} Sekunden`,
      references: ['OAuth-BCP'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: { accessTokenLifespan: lifetime }
    }];
  }
};

const mfaPolicy: SecurityCheck = {
  id: 'config.mfa-policy',
  category: 'config',
  title: 'MFA/OTP-Richtlinie konfiguriert',
  async run(ctx) {
    const res = await ctx.keycloak.callTool('get-otp-policy', { realm: ctx.realm });
    const otp = res.data;
    if (otp?.otpPolicyType) return [];
    return [{
      checkId: 'config.mfa-policy',
      category: 'config',
      severity: 'warning',
      realm: ctx.realm,
      rule: 'NO_MFA_POLICY',
      title: 'Keine MFA/OTP-Richtlinie definiert',
      references: ['OWASP:A07', 'NIST-800-63B'],
      affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
      evidence: otp
    }];
  }
};

export const configChecks: SecurityCheck[] = [
  sslRequired,
  bruteForce,
  passwordPolicy,
  selfRegistration,
  implicitFlowClients,
  adminEventsDisabled,
  userEventsDisabled,
  tokenLifetime,
  mfaPolicy
];
