# Repository Guidelines

## Project Structure & Module Organization

This is an architecture-first TypeScript monorepo. Runtime code lives under `boundaries/`:

- `boundaries/framework/` for shared runtime contracts and implementations
- `boundaries/kernel/` for kernel contracts, backends, and `testkit`
- `boundaries/providers/` for provider-facing contracts
- `boundaries/shared/` for truly cross-boundary primitives

Working plans live in `constitution/`. Engine-level specs live in `docs/`. Shared fixtures and scenario assets live in `tests/`. Tooling scripts live in `tools/`.

## Source of Truth

Align behavior changes with `docs/` and implementation changes with `constitution/`.

- Read `docs/KrakenKernelSpecification.md` before changing kernel behavior
- Read `docs/KrakenFrameworkSpecification.md` before changing framework behavior
- Use `constitution/TechSpec.md` and `constitution/Tasks.md` to keep implementation and active scope aligned
- When a constitution-scoped epic is fully closed in repo reality, update the matching `constitution/Tasks.md` and `constitution/TechSpec.md` status language in the same change and add or refresh any closure inventory under `constitution/spikes/` that future epics depend on
- When a shared contract adds a host-owned control or policy seam (for example `loopPolicy` or handoff helpers), either wire it through the baseline ReAct/runtime path in the same change or explicitly document the limitation in `docs/` and `constitution/`

Do not invent behavior, contracts, or scope that conflict with those sources.

## Build, Test, and Development Commands

- `bun run lint` checks formatting and lint rules with Biome
- `bun run format` applies Biome fixes
- `bun run typecheck` runs Nx typechecks across the workspace
- `bun run nx run <project>:test` runs a package test target, for example `bun run nx run framework-runtime-api:test`
- `bun run nx graph` opens the Nx project graph

Use `bun` for package management and runtime entry points. Use Nx targets for package-scoped work instead of ad hoc inner-package scripts.

## Coding Style & Naming Conventions

Formatting and linting are owned by Biome. Keep package entrypoints small and explicit, and prefer Nx target wiring over package-local script sprawl.

Name boundaries matter:

- `Tuvren` is the product and host-developer surface: package names, imports, public runtime APIs, and examples
- `Kraken` marks engine internals and subsystem wrappers, while public contract symbols should use `Tuvren*` or neutral runtime names such as `RuntimeKernel` and `RuntimeDriver`

If a change makes ordinary library consumers type `Kraken*`, treat that as a boundary check.

## Testing Guidelines

Tests use Bun (`bun test`) and, for some Node-bound targets, package-specific Nx commands. Keep test files near the package they verify under `test/`, and run the narrowest relevant target first before broadening to workspace checks.

## Pull Request Follow-Up

When review feedback changes behavior, validation scope, docs, or follow-up context, update the PR body before merge so it reflects the final branch rather than the initial submission.

## Review-Learned Guardrails

- When an epic claims a scenario matrix, every named scenario needs an automated check path that asserts all report checks, not just a few representative examples.
- For reload, branching, approval resume, steering, and metadata claims, validate the specific public behavior and durable state being claimed; do not treat object existence or generic turn completion as sufficient evidence.
- If review exposes a mismatch between specs, framework tests, backend invariants, and package behavior, step back and align the contract, implementation, tests, docs, and constitution together instead of patching only the visible symptom.
- When a smoke target persists state, prefer disposable inputs or explicit cleanup so repeated validation cannot inherit stale state.
- Keep review-fix comments short and intentional: explain non-obvious validation boundaries, such as why memory reload checks intentionally fail or why a scenario is Node-backed.
