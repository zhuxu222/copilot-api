import type { ModelsResponse } from "~/services/copilot/get-models"

export interface State {
  githubToken?: string
  copilotToken?: string

  accountType: string
  /** HTTP(S) proxy URL for the active account, e.g. "http://10.62.216.80:8000" */
  proxy?: string
  models?: ModelsResponse
  vsCodeVersion?: string

  rateLimitWait: boolean
  showToken: boolean

  // Rate limiting configuration
  rateLimitSeconds?: number
  lastRequestTimestamp?: number
  verbose: boolean
}

export const state: State = {
  accountType: "individual",
  rateLimitWait: false,
  showToken: false,
  verbose: false,
}
