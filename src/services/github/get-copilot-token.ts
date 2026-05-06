import { GITHUB_API_BASE_URL, githubHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { resolveProxyDispatcher } from "~/lib/proxy"
import { state } from "~/lib/state"

export const getCopilotToken = async () => {
  const dispatcher = resolveProxyDispatcher(
    state.proxy,
    process.env.PROXY_ENV === "true",
  )

  const response = await fetch(
    `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`,
    {
      headers: githubHeaders(state),
      ...(dispatcher && { dispatcher }),
    },
  )

  if (!response.ok) throw new HTTPError("Failed to get Copilot token", response)

  return (await response.json()) as GetCopilotTokenResponse
}

// Trimmed for the sake of simplicity
interface GetCopilotTokenResponse {
  expires_at: number
  refresh_in: number
  token: string
}
