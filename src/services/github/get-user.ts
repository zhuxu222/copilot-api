import { GITHUB_API_BASE_URL, standardHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { resolveProxyDispatcher } from "~/lib/proxy"
import { state } from "~/lib/state"

export async function getGitHubUser() {
  const dispatcher = resolveProxyDispatcher(
    state.proxy,
    process.env.PROXY_ENV === "true",
  )

  const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
    headers: {
      authorization: `token ${state.githubToken}`,
      ...standardHeaders(),
    },
    ...(dispatcher && { dispatcher }),
  })

  if (!response.ok) throw new HTTPError("Failed to get GitHub user", response)

  return (await response.json()) as GithubUserResponse
}

// Trimmed for the sake of simplicity
export interface GithubUserResponse {
  id: number
  login: string
  avatar_url: string
}
