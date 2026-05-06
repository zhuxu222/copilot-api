import consola from "consola"
import { getProxyForUrl } from "proxy-from-env"
import { Agent, ProxyAgent, type Dispatcher } from "undici"

const proxyAgentCache = new Map<string, ProxyAgent>()
const directAgent = new Agent()

let envProxyInitialized = false

/**
 * Parse a proxy URL string. Returns a valid URL string or undefined.
 * Supports formats: "http://host:port", "http://user:pass@host:port"
 */
function normalizeProxyUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined

  try {
    const url = new URL(trimmed)
    return url.toString()
  } catch {
    consola.warn(`Invalid proxy URL ignored: ${trimmed}`)
    return undefined
  }
}

/**
 * Get a ProxyAgent for the given proxy URL, cached by URL string.
 * Returns undefined for direct connection (no proxy).
 */
export function getDispatcher(
  proxyUrl: string | undefined,
): Dispatcher | undefined {
  if (!proxyUrl) return undefined

  const normalized = normalizeProxyUrl(proxyUrl)
  if (!normalized) return undefined

  let agent = proxyAgentCache.get(normalized)
  if (!agent) {
    agent = new ProxyAgent(normalized)
    proxyAgentCache.set(normalized, agent)
    consola.debug(`Proxy agent created: ${normalized}`)
  }

  return agent as unknown as Dispatcher
}

/**
 * Check whether a proxy URL is configured (truthy and non-empty after trim).
 */
export function hasProxyConfigured(proxyUrl: string | undefined): boolean {
  return normalizeProxyUrl(proxyUrl) !== undefined
}

/**
 * Resolve the effective proxy dispatcher for outbound requests.
 *
 * Priority:
 * 1. Per-account proxy from state (set when an account has `proxy` configured)
 * 2. Environment-based global proxy (when PROXY_ENV=true, uses HTTP_PROXY/HTTPS_PROXY)
 * 3. Direct connection (returns undefined)
 */
export function resolveProxyDispatcher(
  accountProxy: string | undefined,
  useEnvProxy: boolean,
): Dispatcher | undefined {
  const dispatcher = getDispatcher(accountProxy)
  if (dispatcher) return dispatcher

  if (useEnvProxy) {
    const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    return getDispatcher(envProxy)
  }

  return undefined
}

// ── Legacy: global proxy from environment (PROXY_ENV) ────────────────────────

/**
 * Initialize a fallback global proxy dispatcher from HTTP_PROXY / HTTPS_PROXY
 * environment variables. Only used when an account has no proxy configured.
 *
 * In Bun, the global dispatcher API is not supported (Bun has its own HTTP
 * stack), so this is a no-op. On Node.js, it sets a per-URL-aware dispatcher
 * that routes matching origins through the proxy and bypasses everything else.
 */
export function initProxyFromEnv(): void {
  if (typeof Bun !== "undefined") return
  if (envProxyInitialized) return
  envProxyInitialized = true

  try {
    const proxies = new Map<string, ProxyAgent>()

    const dispatcher = {
      dispatch(
        options: Dispatcher.DispatchOptions,
        handler: Dispatcher.DispatchHandler,
      ) {
        try {
          const origin =
            typeof options.origin === "string" ?
              new URL(options.origin)
            : (options.origin as URL)
          const get = getProxyForUrl as unknown as (
            u: string,
          ) => string | undefined
          const raw = get(origin.toString())
          const proxyUrl = raw && raw.length > 0 ? raw : undefined
          if (!proxyUrl) {
            return (directAgent as unknown as Dispatcher).dispatch(
              options,
              handler,
            )
          }
          let agent = proxies.get(proxyUrl)
          if (!agent) {
            agent = new ProxyAgent(proxyUrl)
            proxies.set(proxyUrl, agent)
          }
          return (agent as unknown as Dispatcher).dispatch(options, handler)
        } catch {
          return (directAgent as unknown as Dispatcher).dispatch(options, handler)
        }
      },
      close() {
        return directAgent.close()
      },
      destroy() {
        return directAgent.destroy()
      },
    }

    ;(globalThis as Record<string, unknown>).setGlobalDispatcher?.(
      dispatcher as Dispatcher,
    )
    consola.debug("HTTP proxy configured from environment (per-URL)")
  } catch (err) {
    consola.debug("Proxy setup skipped:", err)
  }
}
