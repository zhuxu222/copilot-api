import { describe, expect, test } from "bun:test"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { sanitizeOrphanToolResults } from "../src/routes/messages/handler"

describe("sanitizeOrphanToolResults", () => {
  test("keeps tool_result when matching previous tool_use exists", () => {
    const payload: AnthropicMessagesPayload = {
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_1",
              name: "test_tool",
              input: { q: "hello" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: "tool output",
            },
          ],
        },
      ],
    }

    sanitizeOrphanToolResults(payload)

    const userMessage = payload.messages[1]
    if (userMessage.role !== "user" || !Array.isArray(userMessage.content)) {
      throw new Error("expected user content array")
    }

    const firstBlock = userMessage.content[0]
    expect(firstBlock.type).toBe("tool_result")
    if (firstBlock.type === "tool_result") {
      expect(firstBlock.tool_use_id).toBe("toolu_1")
      expect(firstBlock.content).toBe("tool output")
    }
  })

  test("converts orphan tool_result to text", () => {
    const payload: AnthropicMessagesPayload = {
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "no tool use here" }],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_missing",
              content: "Launching skill: remote-control",
            },
          ],
        },
      ],
    }

    sanitizeOrphanToolResults(payload)

    const userMessage = payload.messages[1]
    if (userMessage.role !== "user" || !Array.isArray(userMessage.content)) {
      throw new Error("expected user content array")
    }

    const firstBlock = userMessage.content[0]
    expect(firstBlock.type).toBe("text")
    if (firstBlock.type === "text") {
      expect(firstBlock.text).toBe("Launching skill: remote-control")
    }
  })
})
