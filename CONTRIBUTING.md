# Contributing to open-sub-auth

Thank you for your interest in contributing! This document covers the development workflow and guidelines.

## Development Setup

**Requirements:** Node.js ≥ 18.17.0, pnpm ≥ 9

```bash
git clone https://github.com/open-vibe-lab/open-sub-auth.git
cd open-sub-auth
pnpm install
```

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all unit tests |
| `pnpm typecheck` | TypeScript type checking (no emit) |
| `pnpm build` | Build ESM + CJS + `.d.ts` bundles |
| `pnpm lint` | Lint and auto-fix with Biome |

## Project Structure

```
src/
  cli/          CLI entry point and commands
  core/         OAuth flow engines (PKCE, Device Code, proxy)
  errors.ts     Custom error classes
  index.ts      Public API exports
  providers/    Provider implementations (claude, openai-codex, github-copilot)
  storage/      Token storage (keychain, encrypted file)
  token/        TokenManager and JWT utilities
  types.ts      Shared TypeScript interfaces
tests/unit/     Unit tests (mirrors src/ structure)
docs/           TASKS.md and other project docs
```

## Adding a New Provider

1. Create `src/providers/<name>.ts` implementing the `Provider` interface from `src/types.ts`
2. Call `registerProvider('<name>', () => new YourProvider())` at the bottom
3. Export the class from `src/index.ts`
4. Add at least 10 unit tests in `tests/unit/providers/<name>.test.ts`
5. Import the provider in `src/cli/commands/login.ts` and `token.ts` so the CLI registers it

Key methods to implement:
- `login(options?)` — run the full OAuth flow and return a `TokenSet`
- `refresh(refreshToken)` — exchange a refresh token for a new `TokenSet`
- `getAuthHeaders(accessToken)` — return the headers needed for API calls
- `getAccountId(tokenSet)` — return a stable, unique string per account
- `getAccountLabel?(tokenSet)` — optional human-readable account name

## Security Guidelines

- **Never include token values in error messages.** Error messages may appear in logs or crash reports. Use HTTP status codes only (e.g. `"Token request failed (HTTP 401)"`).
- **No shell injection.** Use `execFile` instead of `exec` for external commands. Use `URLSearchParams` or JSON for request bodies — never string interpolation.
- **Input validation at boundaries only.** Validate user-supplied input (CLI args, environment variables, HTTP responses). Trust internal interfaces.
- Review the [OWASP Top 10](https://owasp.org/www-project-top-ten/) before submitting.

## Testing

- All new code must have unit tests. Target 100% branch coverage for core logic.
- Tests use `vite-plus/test` (vitest-compatible API).
- Mock constructors must use `function` syntax, not arrow functions (vitest requirement for `new`-able mocks).
- Do not mock the `node:crypto` module — crypto operations are fast and deterministic.
- Integration tests against live OAuth endpoints are not part of the test suite (they require real accounts and network access).

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Run `pnpm test && pnpm typecheck && pnpm build` — all must pass
3. Keep commits focused; one logical change per commit
4. Update `CHANGELOG.md` under `[Unreleased]` with a brief description of your change
5. Open a PR against `main`; the CI matrix will run automatically

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **Patch** (`0.1.x`): Bug fixes, security patches, test improvements
- **Minor** (`0.x.0`): New providers, new CLI commands, new public API exports
- **Major** (`x.0.0`): Breaking changes to the `Provider` interface, `TokenSet`, or `TokenStore`

## Legal

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).

Provider implementations rely on undocumented OAuth endpoints from third-party services. Contributors are responsible for ensuring their contributions do not violate the terms of service of the relevant providers. See the ToS disclaimer in [README.md](README.md).
