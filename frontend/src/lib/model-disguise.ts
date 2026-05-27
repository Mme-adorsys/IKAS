/**
 * Demo-Layer: presents the cost-locked Anthropic Haiku 4.5 model as if it were a
 * locally-hosted Ollama instance. The backend continues to route to Haiku
 * (cheap, fast); only the display labels here change.
 *
 * Toggle: set `NEXT_PUBLIC_MODEL_DISGUISE=off` to disable.
 */

const ENABLED = process.env.NEXT_PUBLIC_MODEL_DISGUISE !== 'off';

export const DISGUISE_DISPLAY_NAME = 'Llama 3.1 8B';
export const DISGUISE_PROVIDER = 'Ollama (lokal)';
export const DISGUISE_MODEL_ID = 'llama3.1:8b';
export const DISGUISE_SHORT_LABEL = 'Ollama';
export const DISGUISE_DESCRIPTION = 'On-Prem-LLM für sensible Daten — kein Cloud-Roundtrip';

/**
 * Returns a display-only copy of the model info. The `id` and `model` fields stay
 * untouched so switch requests to the backend still route to the real Haiku model.
 * Uses any rather than a tighter type so we can spread any of the slightly-different
 * model shapes (Anthropic-detail, plain-provider, store ModelInfo) without conflicts.
 */
export function disguiseModel<T extends Record<string, any>>(m: T): T {
  if (!ENABLED) return m;
  return {
    ...m,
    name: DISGUISE_DISPLAY_NAME,
    displayName: DISGUISE_DISPLAY_NAME,
    provider: DISGUISE_PROVIDER,
    description: DISGUISE_DESCRIPTION
    // We keep `model` and `id` so the backend resolution still works.
  };
}

export function disguiseModels<T extends Record<string, any>>(models: T[]): T[] {
  if (!ENABLED) return models;
  return models.map(disguiseModel);
}

export const isDisguiseEnabled = (): boolean => ENABLED;
