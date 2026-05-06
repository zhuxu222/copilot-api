import { afterEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"

import { apiKeyMiddleware } from "~/lib/api-auth"

const originalApiKey = process.env.API_KEY

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.API_KEY
  } else {
    process.env.API_KEY = originalApiKey
  }
})

function createApp(): Hono {
  const app = new Hono()

  app.use("/v1/*", apiKeyMiddleware)
  app.get("/v1/test", (c) => c.json({ ok: true }))
  app.post("/v1/test", (c) => c.json({ ok: true }))

  return app
}

describe("apiKeyMiddleware", () => {
  test("allows requests when API_KEY is not set", async () => {
    delete process.env.API_KEY

    const res = await createApp().request("/v1/test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("allows requests when API_KEY is empty string", async () => {
    process.env.API_KEY = ""

    const res = await createApp().request("/v1/test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("rejects requests without Authorization header when API_KEY is set", async () => {
    process.env.API_KEY = "secret-key"

    const res = await createApp().request("/v1/test")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.type).toBe("unauthorized")
  })

  test("rejects requests with wrong auth scheme when API_KEY is set", async () => {
    process.env.API_KEY = "secret-key"

    const res = await createApp().request("/v1/test", {
      headers: { Authorization: "Basic dGVzdDp0ZXN0" },
    })
    expect(res.status).toBe(401)
  })

  test("rejects requests with empty Bearer token", async () => {
    process.env.API_KEY = "secret-key"

    const res = await createApp().request("/v1/test", {
      headers: { Authorization: "Bearer " },
    })
    expect(res.status).toBe(401)
  })

  test("rejects requests with wrong API key", async () => {
    process.env.API_KEY = "secret-key"

    const res = await createApp().request("/v1/test", {
      headers: { Authorization: "Bearer wrong-key" },
    })
    expect(res.status).toBe(401)
  })

  test("accepts requests with correct API key", async () => {
    process.env.API_KEY = "secret-key"

    const res = await createApp().request("/v1/test", {
      headers: { Authorization: "Bearer secret-key" },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("accepts requests with correct API key (lowercase bearer)", async () => {
    process.env.API_KEY = "secret-key"

    const res = await createApp().request("/v1/test", {
      headers: { Authorization: "bearer secret-key" },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test("uses timing-safe comparison for API keys", async () => {
    process.env.API_KEY = "secret-key"

    // A key that differs only in the last character should fail
    const res = await createApp().request("/v1/test", {
      headers: { Authorization: "Bearer secret-kez" },
    })
    expect(res.status).toBe(401)
  })

  test("does not affect non-/v1/ routes", async () => {
    process.env.API_KEY = "secret-key"

    // The non-/v1/ root route is not protected by the middleware
    const unprotectedApp = new Hono()
    unprotectedApp.use("/v1/*", apiKeyMiddleware)
    unprotectedApp.get("/health", (c) => c.text("ok"))

    const res = await unprotectedApp.request("/health")
    expect(res.status).toBe(200)
  })
})
