import { Hono } from "hono"

import {
  addAccount,
  getAccounts,
  getActiveAccount,
  removeAccount,
  setActiveAccount,
  type Account,
} from "~/lib/accounts"
import { getConfig, saveConfig, type ModelOverride } from "~/lib/config"
import { copilotTokenManager } from "~/lib/copilot-token-manager"
import { state } from "~/lib/state"
import { getDeviceCode } from "~/services/github/get-device-code"
import { getGitHubUser } from "~/services/github/get-user"
import { pollAccessTokenOnce } from "~/services/github/poll-access-token"

import { adminHtml } from "./html"
import { localOnlyMiddleware } from "./middleware"

export const adminRoutes = new Hono()

// Apply localhost-only middleware to all admin routes
adminRoutes.use("*", localOnlyMiddleware)

// Get all accounts
adminRoutes.get("/api/accounts", async (c) => {
  const data = await getAccounts()

  // Return accounts without tokens for security
  const safeAccounts = data.accounts.map((account) => ({
    id: account.id,
    login: account.login,
    avatarUrl: account.avatarUrl,
    accountType: account.accountType,
    createdAt: account.createdAt,
    isActive: account.id === data.activeAccountId,
  }))

  return c.json({
    activeAccountId: data.activeAccountId,
    accounts: safeAccounts,
  })
})

// Get current active account
adminRoutes.get("/api/accounts/active", async (c) => {
  const account = await getActiveAccount()

  if (!account) {
    return c.json({ account: null })
  }

  return c.json({
    account: {
      id: account.id,
      login: account.login,
      avatarUrl: account.avatarUrl,
      accountType: account.accountType,
      createdAt: account.createdAt,
    },
  })
})

// Switch to a different account
adminRoutes.post("/api/accounts/:id/activate", async (c) => {
  const accountId = c.req.param("id")

  const account = await setActiveAccount(accountId)

  if (!account) {
    return c.json(
      {
        error: {
          message: "Account not found",
          type: "not_found",
        },
      },
      404,
    )
  }

  // Update state with new token
  state.githubToken = account.token
  state.accountType = account.accountType

  // Refresh Copilot token with new account
  try {
    copilotTokenManager.clear()
    await copilotTokenManager.getToken()
  } catch {
    return c.json(
      {
        error: {
          message: "Failed to refresh Copilot token after account switch",
          type: "token_error",
        },
      },
      500,
    )
  }

  return c.json({
    success: true,
    account: {
      id: account.id,
      login: account.login,
      avatarUrl: account.avatarUrl,
      accountType: account.accountType,
    },
  })
})

// Delete an account
adminRoutes.delete("/api/accounts/:id", async (c) => {
  const accountId = c.req.param("id")

  const removed = await removeAccount(accountId)

  if (!removed) {
    return c.json(
      {
        error: {
          message: "Account not found",
          type: "not_found",
        },
      },
      404,
    )
  }

  // If we removed the current account, update state
  const activeAccount = await getActiveAccount()
  if (activeAccount) {
    state.githubToken = activeAccount.token
    state.accountType = activeAccount.accountType

    // Refresh Copilot token
    try {
      copilotTokenManager.clear()
      await copilotTokenManager.getToken()
    } catch {
      // Ignore refresh errors on delete
    }
  } else {
    state.githubToken = undefined
    copilotTokenManager.clear()
  }

  return c.json({ success: true })
})

// Initiate device code flow for adding new account
adminRoutes.post("/api/auth/device-code", async (c) => {
  try {
    const response = await getDeviceCode()

    return c.json({
      deviceCode: response.device_code,
      userCode: response.user_code,
      verificationUri: response.verification_uri,
      expiresIn: response.expires_in,
      interval: response.interval,
    })
  } catch {
    return c.json(
      {
        error: {
          message: "Failed to get device code",
          type: "auth_error",
        },
      },
      500,
    )
  }
})

interface PollRequestBody {
  deviceCode: string
  interval: number
  accountType?: string
}

type CreateAccountResult =
  | { success: true; account: Account }
  | { success: false; error: string }

/**
 * Create and save account after successful authorization
 */
/* eslint-disable require-atomic-updates */
async function createAccountFromToken(
  token: string,
  accountType: string,
): Promise<CreateAccountResult> {
  const previousToken = state.githubToken
  state.githubToken = token

  let user
  try {
    user = await getGitHubUser()
  } catch {
    state.githubToken = previousToken
    return { success: false, error: "Failed to get user info" }
  }

  const resolvedAccountType =
    accountType === "business" || accountType === "enterprise" ?
      accountType
    : "individual"

  const account: Account = {
    id: user.id.toString(),
    login: user.login,
    avatarUrl: user.avatar_url,
    token,
    accountType: resolvedAccountType,
    createdAt: new Date().toISOString(),
  }

  await addAccount(account)

  state.githubToken = token
  state.accountType = account.accountType

  try {
    copilotTokenManager.clear()
    await copilotTokenManager.getToken()
  } catch {
    // Continue even if Copilot token fails
  }

  return { success: true, account }
}
/* eslint-enable require-atomic-updates */

// Poll for access token after user authorizes

adminRoutes.post("/api/auth/poll", async (c) => {
  const body = await c.req.json<PollRequestBody>()

  if (!body.deviceCode) {
    return c.json(
      {
        error: { message: "deviceCode is required", type: "validation_error" },
      },
      400,
    )
  }

  const result = await pollAccessTokenOnce(body.deviceCode)

  if (result.status === "pending") {
    return c.json({ pending: true, message: "Waiting for user authorization" })
  }

  if (result.status === "slow_down") {
    return c.json({
      pending: true,
      slowDown: true,
      interval: result.interval,
      message: "Rate limited, please slow down",
    })
  }

  if (result.status === "expired") {
    return c.json(
      {
        error: {
          message: "Device code expired. Please start over.",
          type: "expired",
        },
      },
      400,
    )
  }

  if (result.status === "denied") {
    return c.json(
      {
        error: { message: "Authorization was denied by user.", type: "denied" },
      },
      400,
    )
  }

  if (result.status === "error") {
    return c.json({ error: { message: result.error, type: "auth_error" } }, 500)
  }

  const accountResult = await createAccountFromToken(
    result.token,
    body.accountType ?? "individual",
  )

  if (!accountResult.success) {
    return c.json(
      { error: { message: accountResult.error, type: "auth_error" } },
      500,
    )
  }

  return c.json({
    success: true,
    account: {
      id: accountResult.account.id,
      login: accountResult.account.login,
      avatarUrl: accountResult.account.avatarUrl,
      accountType: accountResult.account.accountType,
    },
  })
})

// Get current auth status
adminRoutes.get("/api/auth/status", async (c) => {
  const activeAccount = await getActiveAccount()

  return c.json({
    authenticated:
      Boolean(state.githubToken) && copilotTokenManager.hasValidToken(),
    hasAccounts: Boolean(activeAccount),
    activeAccount:
      activeAccount ?
        {
          id: activeAccount.id,
          login: activeAccount.login,
          avatarUrl: activeAccount.avatarUrl,
          accountType: activeAccount.accountType,
        }
      : null,
  })
})

// Serve static HTML for admin UI
adminRoutes.get("/", (c) => {
  return c.html(adminHtml)
})

// ============ Model Overrides API ============

// GET /admin/api/model-overrides - 获取所有转发规则
adminRoutes.get("/api/model-overrides", (c) => {
  const config = getConfig()
  const overrides = config.modelOverrides ?? {}

  // 脱敏 API Key
  const safeOverrides = Object.fromEntries(
    Object.entries(overrides).map(([model, override]) => [
      model,
      { ...override, apiKey: override.apiKey ? "***" : undefined },
    ]),
  )
  return c.json({ overrides: safeOverrides })
})

// PUT /admin/api/model-overrides/:model - 添加/更新规则
adminRoutes.put("/api/model-overrides/:model", async (c) => {
  const model = c.req.param("model")
  const body = await c.req.json<ModelOverride>()

  if (!body.targetUrl) {
    return c.json(
      { error: { message: "targetUrl is required", type: "validation_error" } },
      400,
    )
  }

  const config = getConfig()
  config.modelOverrides = { ...config.modelOverrides, [model]: body }
  await saveConfig(config)

  return c.json({ success: true })
})

// DELETE /admin/api/model-overrides/:model - 删除规则
adminRoutes.delete("/api/model-overrides/:model", async (c) => {
  const model = c.req.param("model")

  const config = getConfig()
  if (config.modelOverrides && Object.hasOwn(config.modelOverrides, model)) {
    const { [model]: _, ...rest } = config.modelOverrides
    config.modelOverrides = rest
    await saveConfig(config)
  }

  return c.json({ success: true })
})
