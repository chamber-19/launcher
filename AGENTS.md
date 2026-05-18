# AGENTS.md

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for guidance applicable to all agents (Copilot, Claude Code, Aider, etc.).

For family-wide Chamber 19 rules, see [chamber-19/.github](https://github.com/chamber-19/.github).

## Role: bearer token issuer

The launcher binary is the **issuer** of bearer tokens for the tool family. `ACTIVATION_HMAC_SECRET` is compiled in at build time via `env!("ACTIVATION_HMAC_SECRET")` in the Rust shell — it is never a runtime env var in the launcher itself. Consumer backends receive the same secret as a runtime env var and use it to validate incoming bearer tokens.

## v2.7.0 — Dashboard (Ops tab)

The launcher ships a dashboard tab powered by `<DashboardOverview>` and `useFoundryDashboard()` from `@chamber-19/desktop-toolkit`. This tab is the primary surface for Foundry broker health and job queue visibility. Do not duplicate dashboard data in other launcher tabs.
