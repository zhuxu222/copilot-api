# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**copilot-api** is a wrapper around GitHub Copilot API that makes it OpenAI/Anthropic API compatible. It's built with Bun, Hono, and TypeScript.

---

## Build, Lint, and Test Commands

### Development

```bash
# Start development server with hot reload
bun run dev

# Type checking only (no emit)
bun run typecheck
```

### Building

```bash
# Production build (uses tsdown)
bun run build

# Start production server
bun run start
```

### Linting

```bash
# Lint files (with cache)
bun run lint

# Lint all files
bun run lint:all

# Lint and auto-fix staged files (pre-commit hook)
bunx lint-staged

# Find unused exports/dependencies
bun run knip
```

### Testing

```bash
# Run all tests
bun test

# Run a single test file
bun test tests/anthropic-request.test.ts

# Run tests matching a pattern
bun test --grep "translation"
```

### Release

```bash
# Bump version and publish
bun run release
```

---

## Code Style Guidelines

### Imports

- Use ESNext `import`/`export` syntax exclusively
- Prefer absolute imports via `~/*` alias for `src/*` paths
- Group imports: external deps first, then internal (`~/...`), then relative

```typescript
// Good
import { Hono } from "hono"
import { getConfig } from "~/lib/config"
import { translateToOpenAI } from "../messages/translation"

// Bad - avoid relative imports when absolute is cleaner
import { getConfig } from "../../lib/config"
```

### Formatting

- Uses Prettier via `@echristian/eslint-config`
- Includes `prettier-plugin-packagejson` for package.json formatting
- Run `bun run lint --fix` to auto-format

### Types

- Strict TypeScript (`strict: true` in tsconfig)
- **Never use `any`** - use explicit types, `unknown`, or generics
- Define interfaces for complex objects
- Use `type` for unions/intersections, `interface` for object shapes

```typescript
// Good
interface AppConfig {
  extraPrompts?: Record<string, string>
  smallModel?: string
}

// Good - use type imports
import type { Context } from "hono"
```

### Naming Conventions

| Element           | Convention    | Example                    |
| ----------------- | ------------- | -------------------------- |
| Variables         | camelCase     | `cachedConfig`             |
| Functions         | camelCase     | `getConfig()`              |
| Types/Interfaces  | PascalCase    | `AppConfig`, `HTTPError`   |
| Classes           | PascalCase    | `HTTPError`                |
| Constants         | SCREAMING_CASE| `PATHS.CONFIG_PATH`        |
| Files             | kebab-case    | `api-config.ts`            |

### Error Handling

- Use the `HTTPError` class from `~/lib/error` for HTTP errors
- Use `forwardError()` helper to properly format and forward errors
- Never silently swallow errors - always log with `consola`
- Use `tiny-invariant` for assertions

```typescript
import { HTTPError, forwardError } from "~/lib/error"
import consola from "consola"

// Throwing HTTP errors
if (!response.ok) {
  throw new HTTPError("Request failed", response)
}

// Handling errors in routes
try {
  // ...
} catch (error) {
  return forwardError(c, error)
}
```

### Validation

- Use Zod for runtime validation of external data
- Define schemas alongside types when needed

```typescript
import { z } from "zod"

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
})
```

### Modules & Exports

- Use ESNext modules exclusively, no CommonJS
- Use `verbatimModuleSyntax` - explicit `type` imports required
- Export types separately: `export type { MyType }`

### Testing

- Use Bun's built-in test runner
- Place tests in `tests/` directory
- Name test files as `*.test.ts`
- Use `describe`/`test`/`expect` from `bun:test`

```typescript
import { describe, test, expect } from "bun:test"

describe("Feature", () => {
  test("should do something", () => {
    expect(result).toBe(expected)
  })
})
```

---

## TypeScript Compiler Rules

From `tsconfig.json`:

- `noUnusedLocals: true` - Unused variables are errors
- `noUnusedParameters: true` - Unused parameters are errors
- `noFallthroughCasesInSwitch: true` - No switch fallthrough
- `noUncheckedSideEffectImports: true` - Side-effect imports checked
- `verbatimModuleSyntax: true` - Explicit type imports required

---

## Project Structure

```
src/
├── main.ts              # CLI entry point (citty)
├── server.ts            # Hono server setup
├── start.ts             # Server start command
├── auth.ts              # Auth command
├── lib/                 # Shared utilities
│   ├── error.ts         # Error classes and handlers
│   ├── config.ts        # App configuration
│   ├── token.ts         # Token management
│   └── ...
├── routes/              # API route handlers
│   ├── chat-completions/
│   ├── messages/        # Anthropic-style messages
│   ├── responses/
│   └── ...
└── services/            # External service integrations
    ├── copilot/         # GitHub Copilot API
    └── github/          # GitHub API
tests/
└── *.test.ts            # Test files
```

---

## Key Dependencies

- **hono** - Web framework
- **citty** - CLI framework
- **zod** - Schema validation
- **consola** - Logging
- **undici** - HTTP client
- **tiny-invariant** - Assertions

---

## Git Hooks

Pre-commit hook runs `bunx lint-staged` which lints and fixes staged files.

---

## Notes for Agents

1. Always run `bun run lint` before committing
2. Run `bun run typecheck` to catch type errors without building
3. Use path alias `~/` for imports from `src/`
4. Check `src/lib/error.ts` for error handling patterns
5. Follow existing patterns in `src/routes/` for new endpoints
