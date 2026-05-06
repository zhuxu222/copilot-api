import type { Context, Next } from "hono"

import { timingSafeEqual } from "node:crypto"

/**
 * API Key authentication middleware for /v1/* endpoints.
 *
 * When the API_KEY environment variable is set, all requests to API endpoints
 * must include "Authorization: Bearer <API_KEY>". When API_KEY is empty or not
 * set, authentication is skipped (compatible with existing setups).
 */
export function apiKeyMiddleware(c: Context, next: Next): Promise<Response | undefined> | Response | undefined {
  const requiredKey = process.env.API_KEY?.trim()

  if (!requiredKey) {
    return next()
  }

  const authorization = c.req.header("authorization")

  if (!authorization) {
    return c.json(
      {
        error: {
          message:
            "Unauthorized: Missing Authorization header. Provide 'Authorization: Bearer <API_KEY>'",
          type: "unauthorized",
        },
      },
      401,
    )
  }

  const separatorIndex = authorization.indexOf(" ")
  if (separatorIndex === -1) {
    return c.json(
      {
        error: {
          message:
            "Unauthorized: Invalid Authorization header format. Expected 'Bearer <API_KEY>'",
          type: "unauthorized",
        },
      },
      401,
    )
  }

  const scheme = authorization.slice(0, separatorIndex)
  if (scheme.toLowerCase() !== "bearer") {
    return c.json(
      {
        error: {
          message:
            "Unauthorized: Invalid authentication scheme. Expected 'Bearer'",
          type: "unauthorized",
        },
      },
      401,
    )
  }

  const providedKey = authorization.slice(separatorIndex + 1).trim()
  if (providedKey.length === 0) {
    return c.json(
      {
        error: {
          message: "Unauthorized: Empty API key",
          type: "unauthorized",
        },
      },
      401,
    )
  }

  const requiredBuffer = Buffer.from(requiredKey)
  const providedBuffer = Buffer.from(providedKey)

  if (
    requiredBuffer.length !== providedBuffer.length
    || !timingSafeEqual(requiredBuffer, providedBuffer)
  ) {
    return c.json(
      {
        error: {
          message: "Unauthorized: Invalid API key",
          type: "unauthorized",
        },
      },
      401,
    )
  }

  return next()
}
