import { afterEach, describe, expect, test } from "bun:test"

import { getDispatcher, hasProxyConfigured, resolveProxyDispatcher } from "~/lib/proxy"

const originalProxyEnv = process.env.PROXY_ENV
const originalHttpProxy = process.env.HTTP_PROXY
const originalHttpsProxy = process.env.HTTPS_PROXY

afterEach(() => {
  if (originalProxyEnv === undefined) {
    delete process.env.PROXY_ENV
  } else {
    process.env.PROXY_ENV = originalProxyEnv
  }

  if (originalHttpProxy === undefined) {
    delete process.env.HTTP_PROXY
  } else {
    process.env.HTTP_PROXY = originalHttpProxy
  }

  if (originalHttpsProxy === undefined) {
    delete process.env.HTTPS_PROXY
  } else {
    process.env.HTTPS_PROXY = originalHttpsProxy
  }
})

describe("getDispatcher", () => {
  test("returns undefined when no proxy URL is provided", () => {
    expect(getDispatcher(undefined)).toBeUndefined()
    expect(getDispatcher("")).toBeUndefined()
  })

  test("returns a ProxyAgent when a valid proxy URL is provided", () => {
    const dispatcher = getDispatcher("http://proxy.example.com:8080")
    expect(dispatcher).toBeDefined()
  })

  test("caches ProxyAgent instances for the same proxy URL", () => {
    const d1 = getDispatcher("http://proxy.example.com:8080")
    const d2 = getDispatcher("http://proxy.example.com:8080")
    expect(d1).toBe(d2)
  })

  test("returns undefined for invalid proxy URLs", () => {
    expect(getDispatcher("not-a-valid-url")).toBeUndefined()
  })
})

describe("hasProxyConfigured", () => {
  test("returns false for undefined or empty proxy URL", () => {
    expect(hasProxyConfigured(undefined)).toBe(false)
    expect(hasProxyConfigured("")).toBe(false)
  })

  test("returns false for invalid proxy URL", () => {
    expect(hasProxyConfigured("not-a-valid-url")).toBe(false)
  })

  test("returns true for valid proxy URL", () => {
    expect(hasProxyConfigured("http://proxy.example.com:8080")).toBe(true)
  })
})

describe("resolveProxyDispatcher", () => {
  test("returns undefined when no proxy is configured at all", () => {
    delete process.env.PROXY_ENV
    delete process.env.HTTP_PROXY
    delete process.env.HTTPS_PROXY

    expect(resolveProxyDispatcher(undefined, false)).toBeUndefined()
  })

  test("returns account proxy dispatcher when account proxy is set", () => {
    const dispatcher = resolveProxyDispatcher("http://account-proxy:8080", false)
    expect(dispatcher).toBeDefined()
  })

  test("falls back to env proxy when account proxy is not set and PROXY_ENV is true", () => {
    delete process.env.PROXY_ENV
    process.env.HTTP_PROXY = "http://env-proxy:3128"

    const dispatcher = resolveProxyDispatcher(undefined, true)
    expect(dispatcher).toBeDefined()
  })

  test("prefers account proxy over env proxy", () => {
    process.env.HTTP_PROXY = "http://env-proxy:3128"

    const d1 = resolveProxyDispatcher("http://account-proxy:8080", true)
    const d2 = resolveProxyDispatcher(undefined, true)

    // Account proxy should be used when available
    expect(d1).toBeDefined()
    // Env proxy should be used as fallback
    expect(d2).toBeDefined()
    // They should be different dispatchers
    expect(d1).not.toBe(d2)
  })

  test("returns undefined when PROXY_ENV is false even with env vars set", () => {
    delete process.env.PROXY_ENV
    process.env.HTTP_PROXY = "http://env-proxy:3128"

    expect(resolveProxyDispatcher(undefined, false)).toBeUndefined()
  })
})
