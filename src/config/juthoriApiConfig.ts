/**
 * Centralized Juthori Lineage Engine API Configuration (Port 8090 / Tunnel)
 * Single source of truth for both browser client (Vite) and Express server (`server.ts`).
 */

const FALLBACK_JUTHORI_ENGINE_BASE_URL =
  'https://yes-poems-tennessee-condo.trycloudflare.com';

/**
 * Normalizes any raw API URL (whether base URL or full `/api/v1/juthori/...` endpoint)
 * into a clean base URL without trailing slashes.
 */
export function resolveJuthoriEngineBaseUrl(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return FALLBACK_JUTHORI_ENGINE_BASE_URL;
  const cleaned = trimmed
    .replace(/\/api\/v1\/juthori\/.*$/i, '')
    .replace(/\/api\/juthori\/.*$/i, '')
    .replace(/\/+$/, '');
  return cleaned || FALLBACK_JUTHORI_ENGINE_BASE_URL;
}

function readConfiguredEnvUrl(): string {
  // 1. Browser / Vite environment variable (`VITE_JUTHORI_API_URL`)
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv?.VITE_JUTHORI_API_URL) {
      return metaEnv.VITE_JUTHORI_API_URL;
    }
  } catch {
    // Ignore when running outside Vite
  }

  // 2. Node / Express server environment variable (`VITE_JUTHORI_API_URL`)
  try {
    if (typeof process !== 'undefined' && process?.env) {
      return process.env.VITE_JUTHORI_API_URL || '';
    }
  } catch {
    // Ignore in strict browser sandboxes
  }

  return '';
}

export const JUTHORI_ENGINE_BASE_URL: string = resolveJuthoriEngineBaseUrl(
  readConfiguredEnvUrl()
);

/**
 * Safe network timeout (12 seconds) for upstream lineage engine requests
 * so UI buttons never freeze or hang indefinitely on slow/unreachable connections.
 */
export const JUTHORI_API_TIMEOUT_MS = 12000;

export const JUTHORI_LINEAGE_SEARCH_URL = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/lineage-search`;
export const JUTHORI_PROXY_LINEAGE_SEARCH_URL = '/api/juthori/lineage-search';
export const JUTHORI_CLOSE_TICKET_URL = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/researcher/close-enrichment-ticket`;

/**
 * Executes a `fetch` request protected by an `AbortController` timeout (default 12s)
 * and optional external `AbortSignal`. Never throws unhandled abort exceptions if `swallowErrors` is used.
 */
export async function fetchJuthoriWithTimeout(
  url: string,
  options: RequestInit & {
    timeoutMs?: number;
    externalSignal?: AbortSignal;
  } = {}
): Promise<Response> {
  const {
    timeoutMs = JUTHORI_API_TIMEOUT_MS,
    externalSignal,
    ...fetchInit
  } = options;

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
