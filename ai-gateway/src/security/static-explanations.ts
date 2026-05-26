/**
 * Static description + remediation templates for every known SecurityCheck rule.
 *
 * The engine consults this table BEFORE calling the LLM. If a rule has a template here, the
 * finding is enriched for free — zero LLM cost. The LLM is only invoked when:
 *   (a) SECURITY_ENRICHMENT_MODE=batch (legacy path), OR
 *   (b) A specific finding is opened via GET /api/security/findings/:id/enrich (on-demand)
 *
 * Templates may contain `${evidence.foo}` placeholders. The engine substitutes evidence
 * values at finding-stamp time.
 */

export interface RuleExplanation {
  description: string;
  remediation: string;
}

const E: Record<string, RuleExplanation> = {
  // ─── Konfiguration ─────────────────────────────────────────────────────────

  SSL_REQUIRED_WEAK: {
    description:
      'Der Realm verlangt keine TLS-Verbindung für alle Endpunkte (sslRequired = "${evidence.sslRequired}"). Login-Daten, Tokens und Admin-Aufrufe können unverschlüsselt übertragen werden.',
    remediation:
      'Setze in der Keycloak Admin Console unter Realm Settings → General die Option "Require SSL" auf "all requests".'
  },

  BRUTE_FORCE_DISABLED: {
    description:
      'Der Brute-Force-Schutz ist im Realm deaktiviert. Angreifer können beliebig viele Login-Versuche durchführen ohne Sperre.',
    remediation:
      'Aktiviere unter Realm Settings → Security Defenses → Brute Force Detection den Schutz und konfiguriere "Max Login Failures" auf z.B. 5 sowie "Wait Increment Seconds" auf 60.'
  },

  PASSWORD_POLICY_MISSING: {
    description:
      'Es ist keine Passwortrichtlinie konfiguriert. Benutzer können beliebig schwache Passwörter wählen.',
    remediation:
      'Definiere unter Authentication → Policies → Password Policy mindestens "length(12)", "specialChars(1)", "digits(1)", "notUsername".'
  },

  PASSWORD_POLICY_WEAK_LENGTH: {
    description:
      'Die konfigurierte Mindestpasswortlänge ist mit ${evidence.rules.length} Zeichen unter der empfohlenen Mindestlänge von 12.',
    remediation:
      'Erhöhe in Authentication → Policies → Password Policy den Parameter "length" auf mindestens 12.'
  },

  OPEN_REGISTRATION_NO_VERIFY: {
    description:
      'Selbstregistrierung ist aktiv, aber E-Mail-Verifikation ist nicht erforderlich. Angreifer können beliebig viele Konten mit nicht-existierenden Adressen anlegen.',
    remediation:
      'Aktiviere unter Realm Settings → Login → "Verify Email" und/oder deaktiviere die offene Selbstregistrierung.'
  },

  CLIENT_IMPLICIT_FLOW: {
    description:
      'Der Client "${evidence.clientId}" hat den Implicit Flow aktiviert. Dieser ist gemäß OAuth 2.0 Security Best Current Practice (RFC 9700) nicht mehr empfohlen, da Tokens direkt im URL-Fragment übertragen werden.',
    remediation:
      'Deaktiviere "Implicit Flow Enabled" in den Client-Einstellungen und nutze stattdessen Authorization Code Flow mit PKCE.'
  },

  ADMIN_EVENTS_DISABLED: {
    description:
      'Admin-Events werden nicht aufgezeichnet. Konfigurations­änderungen sind nicht nachvollziehbar, was eine Anforderung an einen revisionssicheren Audit-Trail verletzt.',
    remediation:
      'Aktiviere unter Realm Settings → Events → Admin Events "Save Events" und setze "Expiration" auf mindestens 90 Tage.'
  },

  USER_EVENTS_DISABLED: {
    description:
      'User-Events (Login, Logout, etc.) werden nicht aufgezeichnet. Erkennungen von Brute-Force, ungewöhnlichen Logins oder Account-Übernahmen sind nicht möglich.',
    remediation:
      'Aktiviere unter Realm Settings → Events → User Events Settings "Save Events" und wähle mindestens LOGIN, LOGIN_ERROR, LOGOUT, REGISTER aus.'
  },

  ACCESS_TOKEN_LIFESPAN_LONG: {
    description:
      'Access-Tokens haben eine Lebenszeit von ${evidence.accessTokenLifespan} Sekunden. Lange Tokens vergrößern das Zeitfenster, in dem ein gestohlenes Token missbraucht werden kann.',
    remediation:
      'Reduziere unter Realm Settings → Tokens → Access Token Lifespan auf 5–15 Minuten und setze stattdessen "Refresh Token Lifespan" länger.'
  },

  NO_MFA_POLICY: {
    description:
      'Es ist keine OTP-/MFA-Richtlinie konfiguriert. Selbst kompromittierte Passwörter führen ohne zweiten Faktor zu erfolgreichen Logins.',
    remediation:
      'Konfiguriere unter Authentication → OTP Policy einen Algorithmus (z.B. TOTP, SHA-256, 6 Digits) und aktiviere OTP als Required Action für sensitive Rollen.'
  },

  // ─── Verdächtiges Verhalten ───────────────────────────────────────────────

  USER_BRUTE_FORCE_TARGET: {
    description:
      '${evidence.failedLogins} fehlgeschlagene Login-Versuche für einen Benutzer in den letzten ${evidence.lookbackHours} Stunden, verteilt auf ${evidence.uniqueIps} IP-Adresse(n). Klassisches Brute-Force-Muster.',
    remediation:
      'Sperre den betroffenen Account vorübergehend, erzwinge einen Passwortwechsel und prüfe, ob Brute-Force-Detection im Realm aktiv ist. Untersuche, ob das Konto bereits kompromittiert wurde.'
  },

  USER_MANY_IPS: {
    description:
      'Der Benutzer hat sich in den letzten Stunden von ${evidence.distinctIps} unterschiedlichen IP-Adressen angemeldet. Dies kann auf einen gestohlenen Token, ein Session-Hijack oder ein VPN-Hopping hindeuten.',
    remediation:
      'Prüfe die Session-Liste des Benutzers, vergleiche IP-Geolokationen, kontaktiere den Account-Inhaber und erzwinge ggf. eine Re-Authentifizierung.'
  },

  OFF_HOURS_LOGIN: {
    description:
      '${evidence.count} Logins außerhalb üblicher Geschäftszeiten (05–22 UTC) für diesen Benutzer. Kann legitim sein (Schichtdienst, Reise) oder auf eine kompromittierte Identität hindeuten.',
    remediation:
      'Verifiziere die Aktivität mit dem Account-Inhaber. Erwäge, eine zusätzliche MFA-Anforderung für ungewöhnliche Login-Zeiten zu konfigurieren.'
  },

  NEW_USER_ADMIN_ESCALATION: {
    description:
      'Ein Benutzer wurde angelegt und innerhalb von 5 Minuten mit einer Rolle ausgestattet. Bei Admin-Rollen besonders kritisch — kann auf einen kompromittierten Admin-Account oder ein Insider-Threat-Muster hindeuten.',
    remediation:
      'Prüfe das Admin-Event-Log, wer den Benutzer erstellt und ihm Rollen zugewiesen hat. Entferne unnötige Rollen, dokumentiere die Berechtigung.'
  },

  DORMANT_REACTIVATION: {
    description:
      'Ein älteres Konto (älter als 90 Tage) hat ${evidence.recentLogins} kürzliche Logins nach längerer Inaktivität. Mögliche Account-Übernahme oder reaktivierter Mitarbeiter.',
    remediation:
      'Bestätige mit dem Account-Inhaber, dass die Reaktivierung legitim ist, oder deaktiviere den Account, falls keine Bestätigung erfolgt.'
  },

  SERVICE_ACCOUNT_MISCONFIG: {
    description:
      'Der Benutzer "${evidence.username}" hat einen Service-Account-typischen Namen (svc-/bot-/service-), ist aber als regulärer Benutzer angelegt und nicht als Service-Account einem Client zugeordnet.',
    remediation:
      'Lege stattdessen einen dedizierten Client mit "Service Accounts Enabled" an und nutze dessen Service-Account. Lösche den regulären Benutzer nach der Migration.'
  },

  // ─── OWASP Top 10 ────────────────────────────────────────────────────────

  OWASP_A01_DIRECT_GRANTS_PUBLIC: {
    description:
      'Der öffentliche Client "${evidence.clientId}" erlaubt Direct Access Grants (Resource Owner Password Credentials). Public Clients können kein Geheimnis schützen, daher ist diese Kombination ein klassischer Broken-Access-Control-Pfad.',
    remediation:
      'Deaktiviere "Direct Access Grants" für public Clients. Browser-Clients sollten Authorization Code Flow mit PKCE verwenden.'
  },

  OWASP_A02_SSL_WEAK: {
    description:
      'Die TLS-Anforderung ist nicht auf "all" gesetzt (aktuell: "${evidence.sslRequired}"). Authentifizierungsdaten können unverschlüsselt übertragen werden.',
    remediation:
      'Setze unter Realm Settings → General "Require SSL" auf "all requests" und stelle sicher, dass alle Clients/Reverse-Proxies TLS durchgängig nutzen.'
  },

  OWASP_A05_LONG_REMEMBER_ME: {
    description:
      '"Remember Me" ist aktiv und die SSO-Session-Lebensdauer ist sehr lang (${evidence.ssoSessionMaxLifespan}s). Sessions können über sehr lange Zeiträume aktiv bleiben — Angreifer mit Session-Cookies bleiben langfristig autorisiert.',
    remediation:
      'Reduziere die SSO-Session-Lebenszeit auf maximal 30 Tage oder deaktiviere "Remember Me" für sensitive Realms.'
  },

  OWASP_A05_DUPLICATE_EMAILS: {
    description:
      'Mehrere Benutzer dürfen die gleiche E-Mail-Adresse haben. Dies erschwert Account Recovery, Audit-Trails und kann zu Identitätsverwechslung führen.',
    remediation:
      'Deaktiviere unter Realm Settings → Login "Duplicate Emails" und konsolidiere bestehende Duplikate.'
  },

  OWASP_A07_NO_BRUTE_FORCE: {
    description:
      'Kein Brute-Force-Schutz im Realm aktiv. Angreifer können unbegrenzt Login-Versuche durchführen.',
    remediation:
      'Aktiviere Brute Force Detection und konfiguriere konservative Lockout-Schwellen (z.B. 5 Fehlversuche → 60 s Wartezeit, exponentielle Steigerung).'
  },

  OWASP_A07_NO_MFA: {
    description:
      'Keine OTP/MFA-Richtlinie definiert. Single-Factor-Authentication ist gegen Credential-Stuffing und Phishing unzureichend.',
    remediation:
      'Konfiguriere unter Authentication → OTP Policy und mache OTP für privilegierte Rollen über "Required Actions" verpflichtend.'
  },

  OWASP_A09_EVENTS_OFF: {
    description:
      'User- und/oder Admin-Events sind deaktiviert (user=${evidence.eventsEnabled}, admin=${evidence.adminEventsEnabled}). Sicherheitsvorfälle bleiben unentdeckt.',
    remediation:
      'Aktiviere beide Event-Typen unter Realm Settings → Events und konfiguriere eine Retention von mindestens 90 Tagen.'
  },

  OWASP_A09_EVENTS_NO_RETENTION: {
    description:
      'Events werden aufgezeichnet, aber es ist keine Aufbewahrungsfrist definiert. Events können je nach Backend dauerhaft oder gar nicht gespeichert werden.',
    remediation:
      'Setze unter Realm Settings → Events "Expiration" auf einen klaren Wert (90–365 Tage je nach Compliance-Anforderung).'
  },

  // ─── Compliance / GDPR ───────────────────────────────────────────────────

  GDPR_NO_AUDIT_TRAIL: {
    description:
      'Kein durchgängiger Audit-Trail (User- und Admin-Events). Verletzt potenziell Art. 30 DSGVO (Verzeichnis von Verarbeitungstätigkeiten) und Art. 32 (geeignete technische Maßnahmen).',
    remediation:
      'Aktiviere beide Event-Kategorien, konfiguriere Aufbewahrung gemäß deiner internen Datenschutz-Policy und stelle den Export für DSGVO-Auskunfts­anfragen sicher.'
  },

  GDPR_RETENTION_UNDEFINED: {
    description:
      'Event-Aufbewahrungsfrist nicht oder unklar definiert. Art. 5(1)(e) DSGVO verlangt Speicherbegrenzung.',
    remediation:
      'Definiere eine konkrete Aufbewahrungsfrist (typisch 90 Tage für operative Events, 365 Tage für Sicherheits-Events) und dokumentiere sie im Verzeichnis von Verarbeitungstätigkeiten.'
  },

  GDPR_TLS_NOT_ENFORCED: {
    description:
      'TLS ist nicht für alle Anfragen erforderlich (sslRequired="${evidence.sslRequired}"). Art. 32 DSGVO fordert Vertraulichkeit der Datenübertragung.',
    remediation:
      'Setze "Require SSL" auf "all requests" und stelle sicher, dass keine Klartext-HTTP-Verbindungen mehr möglich sind.'
  },

  BEST_PRACTICE_NO_VERIFY_EMAIL: {
    description:
      'Selbstregistrierung ohne E-Mail-Verifikation. Bots können beliebig viele unbestätigte Konten anlegen.',
    remediation:
      'Aktiviere "Verify Email" unter Realm Settings → Login oder schalte die offene Selbstregistrierung ab.'
  },

  BEST_PRACTICE_LONG_SSO_SESSION: {
    description:
      'SSO-Session-Lebenszeit ist ${evidence.ssoSessionMaxLifespan}s (> 24 h). Lange Sessions vergrößern das Risiko bei Token- oder Cookie-Diebstahl.',
    remediation:
      'Reduziere "SSO Session Max" auf 8–24 Stunden je nach Sicherheitsanforderung.'
  }
};

export function lookupExplanation(rule: string): RuleExplanation | undefined {
  return E[rule];
}

/**
 * Substitute `${evidence.x}` placeholders in a template string with values from evidence.
 * Returns the original string if evidence is undefined or a placeholder is missing.
 */
export function substituteTemplate(template: string, evidence: Record<string, any> | undefined): string {
  if (!evidence) return template;
  return template.replace(/\$\{evidence\.([\w.]+)\}/g, (_, path) => {
    const value = path.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), evidence);
    return value == null ? '' : String(value);
  });
}
