import { Router } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Aggregates Keycloak users across the demo realms by talking directly to the Keycloak
 * Admin REST API. We bypass keycloak-mcp here because its `list-users` tool has been
 * returning 500s in the demo container.
 *
 * Cached for 30 seconds to keep the Benutzer panel snappy when it auto-refreshes.
 */
export const usersRouter = Router();

interface UserRecord {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  realm: string;
}

interface UsersResponse {
  users: UserRecord[];
  realms: string[];
  counts: {
    total: number;
    active: number;
    disabled: number;
    realms: number;
  };
  fetchedAt: string;
}

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';
const KEYCLOAK_ADMIN = process.env.KEYCLOAK_ADMIN || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const DEMO_REALMS = ['corporate', 'customers', 'partners'];

let cache: { value: UsersResponse; expiresAt: number } | null = null;
const CACHE_MS = 30_000;

// Token cache — Keycloak admin tokens are valid ~60s. Refresh proactively.
let tokenCache: { value: string; expiresAt: number } | null = null;

async function getAdminToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  const params = new URLSearchParams({
    client_id: 'admin-cli',
    username: KEYCLOAK_ADMIN,
    password: KEYCLOAK_ADMIN_PASSWORD,
    grant_type: 'password'
  });
  const res = await axios.post(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
  );
  const token: string = res.data.access_token;
  const ttl = (res.data.expires_in ?? 60) * 1000;
  tokenCache = { value: token, expiresAt: Date.now() + ttl - 5000 }; // refresh 5s before expiry
  return token;
}

usersRouter.get('/', async (_req, res): Promise<any> => {
  try {
    if (cache && cache.expiresAt > Date.now()) {
      return res.json(cache.value);
    }

    const token = await getAdminToken();
    const headers = { Authorization: `Bearer ${token}` };

    const usersPerRealm = await Promise.all(DEMO_REALMS.map(async (realm) => {
      try {
        const r = await axios.get(`${KEYCLOAK_URL}/admin/realms/${encodeURIComponent(realm)}/users`, {
          headers,
          params: { max: 200 },
          timeout: 5000
        });
        const rows = Array.isArray(r.data) ? r.data : [];
        return rows.map((u: any): UserRecord => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          emailVerified: u.emailVerified,
          enabled: u.enabled,
          realm
        }));
      } catch (err) {
        logger.warn('users-aggregate: list failed for realm', {
          realm,
          error: err instanceof Error ? err.message : String(err)
        });
        return [] as UserRecord[];
      }
    }));

    const users = usersPerRealm.flat();
    const active = users.filter(u => u.enabled !== false).length;
    const disabled = users.length - active;

    const payload: UsersResponse = {
      users,
      realms: DEMO_REALMS,
      counts: {
        total: users.length,
        active,
        disabled,
        realms: DEMO_REALMS.length
      },
      fetchedAt: new Date().toISOString()
    };

    cache = { value: payload, expiresAt: Date.now() + CACHE_MS };
    res.json(payload);
  } catch (err) {
    logger.error('users-aggregate failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// PUT /api/users/:realm/:id — update a user's editable fields (firstName/lastName/email/etc.)
usersRouter.put('/:realm/:id', async (req, res): Promise<any> => {
  try {
    const { realm, id } = req.params;
    const allowed = ['firstName', 'lastName', 'email', 'emailVerified', 'enabled'] as const;
    const body: Record<string, any> = {};
    for (const k of allowed) {
      if (k in req.body) body[k] = req.body[k];
    }
    if (Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'No editable fields supplied' });
    }
    const token = await getAdminToken();
    await axios.put(
      `${KEYCLOAK_URL}/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(id)}`,
      body,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    cache = null;
    res.json({ ok: true, id, realm, applied: body });
  } catch (err: any) {
    logger.error('user-update failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// PATCH /api/users/:realm/:id/enabled — convenience toggle endpoint used by the table action.
usersRouter.patch('/:realm/:id/enabled', async (req, res): Promise<any> => {
  try {
    const { realm, id } = req.params;
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Body must be { enabled: boolean }' });
    }
    const token = await getAdminToken();
    await axios.put(
      `${KEYCLOAK_URL}/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(id)}`,
      { enabled },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    cache = null;
    res.json({ ok: true, id, realm, enabled });
  } catch (err: any) {
    logger.error('user-enabled-toggle failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
