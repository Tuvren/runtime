# Epic — Restructure into a Sovereign Polyglot Framework

**Shape:** A large GitHub issue in epic form (not a `.constitution/` epic).
**Status:** Planning artifact — agreed foundation, ready to execute milestone-by-milestone.
**Execution:** Sole contributor + agent swarm, operating through reviewable milestone gates.
**Non-negotiables:** `spec/` is the sovereign standard; conformance is the only cross-language coupling; nothing ships unless it certifies green.

---

## 1. Summary

Restructure the monorepo so that **truth, sovereignty, and idiomatic expression become structural properties of the repository, not matters of discipline.**

- A single language-neutral **standard** (`spec/`) is the sovereign source of truth for the full model.
- Each language expresses that standard inside its own **idiomatic** top-level tree.
- **Conformance** is the only coupling and the objective proof mechanism.
- **Bazel** orchestrates a hermetic polyglot build from the ground up.
- All drivers live **in-tree** and are gated green by the standard's certification suite.

This is a **restructure of what exists today**, not a new-language buildout. The end state is a codebase where future contributors — expert and AI-agent alike — can contribute in a healthy, low-surprise environment, because the architecture makes the desired properties enforced rather than aspirational.

Nothing in the current tree is sacred where it embeds a code smell or an architectural "don't." The current `docs/` and `.constitution/` carry the semantic context that survives; the physical and naming structure is rebuilt.

---

## 2. Why this restructure (principles)

1. **The standard outranks every implementation.** Cross-language meaning lives in machine-readable authority and executable evidence — never in an implementation language, a runner's source, or prose.
2. **Idiom is sovereign inside each language.** The current `boundaries/` design forced one directory shape onto every language; that was the mistake. Each ecosystem organizes itself the way it wants.
3. **Cohesion is semantic, not structural.** Languages do not match folder-for-folder or package-for-package. They cohere by certifying against the *same* standard and by declaring a per-language map from ports to packages.
4. **A serious OS metaphor buys a decades-stable mental model for free.** Every term gets a membership test an engineer already knows.
5. **Green is the gate.** "Not green" is not shippable. The certification suite is the reviewer.

---

## 3. The mental model — a serious OS metaphor

The metaphor is the spine, applied faithfully (not as flavor).

| Term | Meaning |
| --- | --- |
| **Tuvren** | The OS / framework / distribution; the host-facing surface. *(Precision: the constitution today defines **Tuvren = the company brand**, **Tuvren Runtime = the runtime product**, **Kraken = the engine** — `vision.md` §1.1. Using "Tuvren" for the framework therefore **repurposes an existing brand term**; that ubiquitous-language change is handled in M10 — see §14.)* |
| **Kraken** | The **engine / executive** — the hexagon center that owns turn/run lifecycle, execution handles, durable-read, capability orchestration, and worker/handoff process management. |
| **kernel** | Mechanism only: syscalls, durable objects, TurnTrees, lineage, staging, reclamation, the narrow waist. Interprets no content. |
| **`spec/`** | The **standard** (Tuvren's POSIX). Authority packets are its normative sections; conformance is its certification suite. |
| **core** | The **ABI**: the shared vocabulary every layer speaks (messages/content, the event vocabulary, errors, execution-result types, schema shapes). Contract-only, no behavior. *(Executable helpers currently bundled in the TypeScript `@tuvren/core` — schema-authoring, payload codecs — are not ABI and land in the libc/SDK tier; see M2.)* |
| **libc / SDK** | The host-facing surface applications link against. |
| **shell** | The reference REPL host. |
| **applications** | Downstream hosts embedding the SDK. *(Out of scope for this restructure — only the reference shell is migrated; see §9.)* |
| **IPC** | The gRPC projection of the kernel's **syscall surface** — a transport contract, used only when the kernel runs out-of-process. Distinct from *cross-language interop conformance* (e.g. the TS-framework ↔ Rust-kernel suite), which is certification, not transport — see §5/§15. |
| **tty** | Streaming adapters (canonical event stream → SSE / AG-UI). |
| **syslog** | Telemetry adapters (semconv vocabulary → OTel export). |
| **syscall** | The kernel contract (`store.put`, `run.complete`, …). |

---

## 4. Boundary taxonomy — ports vs adapters

Every area splits into a **contract (port)** that lives in `spec/`, and **implementations (adapters)** that live in language trees. This *is* the `spec/`-vs-language-dir split, drawn once at the boundary level because no single language's packaging mechanism (TS subpaths, Rust modules, Go packages, Python namespaces) generalizes to the others.

Adapters come in exactly **three kinds**:

- **drivers** — *resource adapters.* They make an external resource speak the engine's uniform interface and carry no agent logic:
  - storage drivers (backends: memory / sqlite / postgres),
  - provider drivers (the AI SDK bridge; future native clients),
  - tool drivers (community tools such as Exa / Slack; **MCP is a bus-driver** — one driver that hot-plugs many external tool-devices via a discovery protocol),
  - output drivers (tty: SSE / AG-UI; syslog: OTel).
- **runners** — *execution models.* They define how a turn thinks and loops. ReAct is the first runner; pipeline / router / orchestrator-worker are future runners. *(Note: "runner" is currently overloaded in the repo — see §14 — and must be reserved for execution models.)*
- **extensions** — *hook-bundle plug-ins.* They observe, wrap, short-circuit, or contribute to execution. A **hook** is the mechanism; an **extension** is the plug-in that bundles hooks (context compaction, system-reminder injection — LangChain-middleware-shaped).

Adapters carry two **grades**, both in-tree:

- **first-party** — reference adapters Tuvren ships and certifies (the reference backends, MCP, the AI SDK bridge, ReAct). Core scope.
- **community** — shareable third-party adapters so hosts don't rebuild them. Marked **`contrib`** in each language's idiomatic naming/location.

---

## 5. Target architecture

```
Tuvren/framework
├── spec/                       # THE STANDARD — language-neutral truth, organized by port
│   ├── kernel/                 # syscall contract, CDDL grammar, proto, authority-packet
│   ├── core/                   # ABI: shared vocabulary contracts
│   ├── providers/              # provider port contract + authority-packet
│   ├── tools/                  # tool + capability contract (execution classes, binding, policy)
│   ├── runners/                # execution-model port contract
│   ├── extensions/             # hook/extension port contract
│   ├── streaming/              # canonical event-stream contract
│   ├── telemetry/              # semconv vocabulary
│   ├── host/                   # host-facing surface contract
│   ├── interop/                # IPC: the gRPC kernel transport contract (proto/grammar only)
│   └── conformance/            # unified certification suite
│       ├── (plans · fixtures · scenarios · shared-harness contract), organized by port
│       └── interop/            # cross-language interop suites (e.g. TS-framework ↔ Rust-kernel)
│
├── typescript/                 # reference implementation — idiomatic bun/Nx workspace, Bazel-native
│   ├── (engine · drivers · runners · extensions · host, organized idiomatically)
│   ├── contrib/                # community-grade adapters, clearly named
│   └── (generated bindings live here, never in spec/)
│
├── rust/                       # certifies the kernel only today (framework adapter is a not-implemented stub)
│   └── (grows toward the standard TS already certifies against; future epic)
│
│   (future) go/   python/      # new languages grow up to the same standard
│
├── tools/                      # build / enforcement / codegen tooling; the certification harness is the renamed tools/conformance/runner/ (other tools/* unchanged)
├── .constitution/              # updated to track the refactor (not frozen)
├── docs/                       # timeless semantic authority (kernel/framework specs + rationale)
└── MODULE.bazel · BUILD …      # Bazel is the primary orchestrator (NEW — no Bazel files exist today)
```

**Layout rules**

- `spec/` holds **only** language-neutral authority. **No** language-bearing code lives there — including generated bindings.
- **There is exactly one `spec/`, at the root.** Today, authority sources live in scattered per-contract `spec/` subdirs (e.g. `boundaries/kernel/contracts/protocol/spec/`, `boundaries/shared/contracts/core/spec/`, `boundaries/telemetry/semconv/spec/`). The new root `spec/` is the **consolidation** of all of those into one standard; those nested `spec/` dirs are relocated into `spec/<port>/` — not duplicated, and not left as homonyms.
- Each language tree is organized **idiomatically**. There is no forced boundary skeleton; the boundary/port concept exists only as the organizing axis of `spec/` and conformance.
- Each language tree carries a **port → package map** so any contributor (or agent) can navigate it without assuming a shared shape.
- `boundaries/` and `implementations/` are **removed**.

---

## 6. Truth & cohesion

- `spec/` is **authoritative**. **TypeScript is the reference / lab implementation** — the rapid-iteration language used to build surface from the ground up — disciplined to never *become* the oracle. That discipline is exactly why `spec/` must exist.
- **Promotion loop:** new surface is prototyped in TypeScript → **promoted into `spec/`** (authority packet + conformance plan) → TypeScript and every future language certify against it. The reference informs the standard; the standard then outranks the reference.
- **Cohesion is semantic, not structural.** Every language certifies against the same standard and declares its port→package map. Package counts, names, and folders need not match across languages.
- **Ragged coverage is a valid, green, certified state.** A language certifies whatever ports it implements. Today **Rust certifies the kernel only**; a Rust *framework* adapter exists in the workspace but is an explicit not-implemented stub (it returns `rust_framework_operation_not_implemented` with `capabilities: []`; it is the only such partial-coverage adapter today). That partial coverage is a clean certified state, not a gap to apologize for — though see §8's caveat on what "green" actually proves today.

---

## 7. Build system

- **Bazel** is the primary orchestrator, adopted **ground-up**: the new structure is born Bazel-native, so there is no `(Nx, old layout) → (Nx, new layout) → (Bazel, new layout)` double migration — only a single `(old) → (Bazel, new)` transition. (No Bazel files exist today; this is greenfield tooling work.)
- **De-risk with a tracer bullet** (M1): prove every seam — standard ↔ language-dir ↔ conformance ↔ Bazel — on one small vertical slice before mass movement.
- The **in-tree driver model** (§9) further justifies Bazel: in-tree driver trees are precisely where hermetic, cached, incremental builds earn their keep.
- **Nx** survives only as an optional transitional inner-loop convenience and is demoted at cutover.

---

## 8. Driver shipping model — in-tree (the Linux way)

All drivers — first-party **and** curated community — live in the monorepo, and all are **green-gated**. *(This is the target taxonomy; the in-tree "driver" set is populated as the `driver→runner` rename and per-port migrations land — today the only execution adapter present is the ReAct runner.)*

- **Not green → not shipped, period.** A contribution that does not certify cannot land.
- Everything lives under one workspace, so AI agents and contributors reach the source directly rather than chasing other repos.
- Quality stays under the project's control.

The green conformance gate **is** the acceptance bar: the standard is the reviewer, which scales to an AI-agent-contributor world without a human gatekeeper per driver.

> **Caveat (today's reality):** certification currently runs from an **explicit project list** (the `conformance` script in `package.json` + `tools/conformance/runner/`), not from discovery, and a stub adapter can report `not_implemented` rather than being absent. So until coverage is discovery-enforced (a desirable M10 tail), "green" proves the *listed* subset passed, not that coverage is complete. The `MIGRATION_INVENTORY.md` (§12) is the backstop that makes coverage real in the interim, and every milestone DoD includes updating the conformance list (§11).

---

## 9. Scope

**In scope (restructure-only):**

- Move the full TypeScript implementation and the Rust kernel into the OS-shaped layout.
- Stand up `spec/`-as-standard, Bazel, OS naming, and the unified conformance gate.
- Prove the existing implementations still certify against the lifted standard.
- Ship the "how to add a language" and "how to add a driver" guides plus clean scaffolding.

**Explicit non-goals:**

- **No new framework or language coverage.** This effort does not bring Rust to framework parity and does not add Go or Python.
- **No downstream/third-party host migration.** Only the first-party reference shell is migrated.
- Rust-to-parity (next in line) and Go / Python are **future, separate issues**. This effort must not silently override the staged gate that intentionally blocks Rust framework work.

---

## 10. Invariants (must hold at every milestone gate)

1. Relevant conformance certifies **green**; authority-guardrail checks pass.
2. `MIGRATION_INVENTORY.md` shows **100% coverage** with nothing unaccounted.
3. **Git history is preserved** for moved or transformed material.
4. **No content is deleted** without a proven successor or explicit equivalence evidence.
5. Everything migrated so far is **green and hermetic under Bazel** — with the single allowed exception of the PostgreSQL lane, which may run **Nx-driven transitionally** (outside the hermetic graph) until M1's hermeticity decision lands (§13 M1).

---

## 11. Execution model — reviewable milestone gates

- Work proceeds **one milestone at a time**. Each milestone is a **reviewable gate**: its Definition of Done must be met, green, and **reviewed/approved before the next milestone begins**.
- Within a milestone: capture baseline → migrate the vertical slice → re-certify → **commit only on green**.
- Today's certification is driven by a **hardcoded project list** (the `conformance` script in `package.json` plus the shared engine under `tools/conformance/runner/`), not by discovery. Every milestone DoD therefore includes **updating that list** so moved projects are actually exercised — otherwise "green" silently skips them. Making certification discovery-based (so the standard truly self-enforces coverage) is a desirable M10 tail.
- Prefer **small, fully verifiable increments**. Surface a blocking invariant immediately with the minimal next action to restore green.
- Sequencing is **vertical, port-by-port**, so the tree stays green at every step and each milestone is an independent checkpoint. (The alternative — lift the whole standard, then migrate all implementations — was rejected because it opens a long red valley where the standard exists but nothing certifies against it.)

---

## 12. Living artifacts

- **Status** lives in **this issue** (milestone checklist + running notes). There is no separate `EPIC_STATUS.md` — the issue *is* the status surface.
- **`MIGRATION_INVENTORY.md`** (machine-checkable) lives at repo root during the migration: the authoritative 100%-coverage ledger of every contract, driver, runner, hook, script, and implementation as `old path → new path → status → content hash`. It must explicitly enumerate the **known multi-home / ambiguous cases** before the milestones that touch them — at minimum: every `@tuvren/core/*` subpath **plus the sibling `@tuvren/core-types` package and the deprecated compatibility shims (`@tuvren/runtime-api`, `@tuvren/driver-api`, `@tuvren/event-stream`, `@tuvren/tool-contracts`, `@tuvren/runtime-core`)** and their destination tiers (M2/M3); the streaming contracts `event-stream` **and** `event-stream-sse`, plus the impl packages `@tuvren/stream-core` / `stream-sse` / `stream-agui` (M8); the two interop trees (M1/M8); the **drifted generated-bindings layout** — telemetry's Nx `outputs` config names `runtime-core/src/lib/generated/`, but `runtime-core` is a deprecated `index.ts`-only shim, the materialized telemetry binding is in `@tuvren/runtime` (`runtime/src/lib/generated/`), and the kernel-interop bindings are build-generated, not checked in; the inventory must baseline the **actual on-disk** layout, not the stale config targets (M1/M3/M8); telemetry's three current homes (M8); the `reports/compatibility/` **generated** evidence tree — it stays a top-level `reports/` tree, **not** `spec/` (which is authority-only); the certification harness writes into it (M8/M10); and the plural `boundaries/hosts/` vs singular `spec/host` (M9). It is **deleted at cutover** so it does not become durable cruft.

---

## 13. Milestones

Each milestone migrates a port's authority into `spec/`, its adapters into the relevant language tree, wires Bazel, and re-certifies. Milestones may merge or split as the inventory reveals true sizes; **the order and the gate model are the commitments.**

### M0 — Ground rules
**Objective:** Establish the immutable baseline and the rules of the migration.
**Definition of Done (gate):**
- `MIGRATION_INVENTORY.md` accounts for 100% of current content (paths + hashes), including the multi-home cases listed in §12.
- Full green conformance + authority-guardrail baseline captured.
- This epic and the old→new naming map authored and agreed.

### M1 — Tracer bullet (kernel)
**Objective:** Prove every seam end-to-end on one small vertical slice.
**Definition of Done (gate):**
- `spec/kernel` + `spec/conformance/kernel` exist and are authoritative.
- The Rust kernel (`tuvren-kernel-rust`) and the TypeScript kernel line (`@tuvren/kernel-protocol` contract + `@tuvren/kernel-runtime` adapter) build and **certify under Bazel**.
- The IPC (gRPC) kernel transport from `boundaries/kernel/interop/grpc/` is mapped to `spec/interop/`; the **generated** TypeScript kernel-interop bindings relocate to the `typescript/` generated area. ⚠️ The generated layout is **drifted and must be baselined first**: telemetry's Nx `outputs` config (`telemetry/project.json`) still names the deprecated `@tuvren/runtime-core` shim (which on disk holds only `index.ts`), while the materialized telemetry binding actually lives in `@tuvren/runtime` (`runtime/src/lib/generated/`), and the kernel-interop bindings are build-generated (only `runtime/tsconfig.kernel-interop.generated.json` is checked in), not materialized. M1 reconciles config targets vs. on-disk artifacts vs. import sites before moving anything. The conformance list is updated to exercise the moved projects.
- **Decide how the stateful PostgreSQL conformance lane (devenv-managed, non-idempotent) reconciles with Bazel's hermeticity** — the kernel's postgres certification is the first place this tension bites. Resolve it within M1; an acceptable fallback is keeping the postgres lane **Nx-driven transitionally** (outside the hermetic graph) so an unresolved hermeticity answer does not block the tracer bullet.
- Old and new paths produce equivalent results; inventory updated.

### M2 — core (ABI)
**Objective:** Lift the shared vocabulary into the standard and sort the reference package's contents by tier.
**Definition of Done (gate):**
- `spec/core` owns the canonical, behavior-free vocabulary (messages/content, events, errors, execution-result types, schema shapes).
- The existing TypeScript `@tuvren/core` (the consolidated shared-primitive package, with 11 named subpaths plus root — incl. `./tools`, `./capabilities`, `./telemetry`, and lifecycle/extension/provider type surfaces) is **sorted**, not merely "split": pure data/types → `spec/core` (as neutral contracts); executable helpers (`defineTool` schema-authoring, payload codecs) → the TypeScript **libc/SDK tier**, never `spec/core`. (The batteries-included `createTuvren` already lives in `@tuvren/runtime`, not `@tuvren/core`.)
- The inventory enumerates **every `@tuvren/core/*` subpath — plus the sibling `@tuvren/core-types` package and the deprecated `@tuvren/{runtime-api,driver-api,event-stream,tool-contracts}` shims — → destination tier** before this milestone starts (this is a wide cut consumed across every package — see §12).
- TypeScript certifies against `spec/core`; conformance list updated; green; inventory updated.

### M3 — engine (Kraken) + libc
**Objective:** Migrate the executive and the host-facing SDK surface.
**Definition of Done (gate):**
- The engine (turn/run lifecycle, execution handles, durable-read, orchestration, capability orchestration) and the host-facing SDK surface (libc) live under `typescript/`, Bazel-native. The concrete TypeScript engine package today is `@tuvren/runtime`; the deprecated `@tuvren/runtime-core` shim is retired in this milestone.
- Only the **engine↔port interface seams** the engine must compile against are declared in `spec/` (as minimal stubs); each port's *full* authority is lifted in its own later milestone (M4–M9). M3 does **not** front-load all port contracts — that would violate the vertical, no-long-red-valley principle (§11).
- Conformance list updated; green; inventory updated.

### M4 — providers
**Objective:** Provider port + provider drivers.
**Definition of Done (gate):** `spec/providers` authoritative; the AI SDK bridge migrated as a provider driver and certifying; conformance list updated; green; inventory updated. **Note:** MCP lives under the providers boundary today (`boundaries/providers/contracts/mcp/`, `@tuvren/mcp-client`) but is **not** migrated here — it is deliberately re-categorized as a *tool bus-driver* and migrates in **M5**.

### M5 — tools + capabilities + MCP
**Objective:** Tool port (including execution classes / binding / policy) + the MCP driver.
**Definition of Done (gate):** `spec/tools` **consolidates the existing tool-contracts / capability authority** (today split across the `@tuvren/core` tool/capability subpaths and logic inside `@tuvren/runtime`) into a port; **MCP** (`@tuvren/mcp-client`, the bus-driver) migrated and certifying — **this is a cross-port move**: MCP leaves the providers boundary for the tools port, because execution class is decided by who invokes the server, not by the protocol. Note: **no standalone tool-driver packages exist today** — `drivers/` contains only the ReAct runner (`@tuvren/driver-react`) — so Exa/Slack-style tool drivers (§4) are *illustrative future* adapters, not part of this move. Conformance list updated; green; inventory updated.

### M6 — runners
**Objective:** Runner port + ReAct. **The `driver → runner` rename lands here** (and "runner" is reserved for execution models — see §14).
**Definition of Done (gate):** `spec/runners` **consolidates today's split execution-model authority** — both `boundaries/framework/contracts/driver-api/` (the neutral execution-model contract) and `boundaries/framework/contracts/react-driver/` (the ReAct-specific plans) fold into it. The ReAct implementation (today `@tuvren/driver-react`, under `drivers/react`) migrates as a runner; the repo-wide `driver→runner` rename (code, docs, glossary, conformance) is complete and consistent; the conformance machinery is renamed off "runner" to avoid collision (§14). Conformance list updated; green; inventory updated.

### M7 — extensions
**Objective:** Extract the existing extension surface into a port — **no new behavioral coverage** (that would exceed §9 scope).
**Definition of Done (gate):** `spec/extensions` is authored by **extracting what exists today**: the extension type-surface (`@tuvren/core/extensions`), the runtime facade (`runtime/src/lib/extension-runtime.ts`), and the REPL proof shim (`repl/src/lib/proof-extension.ts`). There is no standalone extension package, authority-packet, or conformance plan today, so this milestone *authors the port from existing material* and lifts only the coverage those artifacts already imply — it does **not** invent new extension behavior or new conformance. Conformance list updated; green; inventory updated.

### M8 — streaming + telemetry
**Objective:** Output drivers.
**Definition of Done (gate):** `spec/streaming` + `spec/telemetry` authoritative; the tty drivers (`@tuvren/stream-core` shared streaming impl, plus `@tuvren/stream-sse` and `@tuvren/stream-agui`) and the syslog driver (OTel) migrated and certifying. **Telemetry today has three homes the inventory must reconcile into one port + driver:** the top-level `telemetry/` semconv project (whose Nx `outputs` stale-target `…/runtime-core/src/lib/generated/` but whose materialized TS output is actually in `@tuvren/runtime` at `runtime/src/lib/generated/`, plus a Rust helper under the kernel tree), `boundaries/telemetry/semconv/spec/authority-packet.json` (the vocabulary authority), and `boundaries/framework/implementations/typescript/telemetry-otel` (the OTel syslog driver). M8 relocates the generated-telemetry sink into the new TypeScript telemetry layout and corrects the stale codegen target. The `boundaries/framework/interop/rust-kernel/` cross-language interop suite moves to `spec/conformance/interop/` (it is conformance, not transport). Conformance list updated; green; inventory updated.

### M9 — host (shell)
**Objective:** Host port + the reference REPL host.
**Definition of Done (gate):** `spec/host` (singular port; today the boundary is `boundaries/hosts/`, plural) authoritative; the reference shell (`@tuvren/repl-host`) migrated, consuming the SDK exclusively, and certifying. Only the reference shell is migrated — downstream/third-party application hosts are out of scope (§9). Conformance list updated; green; inventory updated.

### M10 — Cutover & teardown
**Objective:** Make the new structure the only path.
**Definition of Done (gate):**
- `boundaries/` and `implementations/` deleted after final equivalence proof.
- Bazel is the canonical CI path; Nx demoted to optional inner-loop convenience.
- `.constitution/` and `AGENTS.md` rewritten to the new world — including the ubiquitous-language change re-centering the product name on **Tuvren** away from "Tuvren Runtime" (§14).
- The repo is renamed to `Tuvren/framework`.
- The "add a language" and "add a driver" guides ship; `MIGRATION_INVENTORY.md` deleted.
- *(Optional tail: extract repeated enforcement into Bazel rules/macros; make certification discovery-based so coverage self-enforces — §8.)*

---

## 14. Naming migration & known risks

- **`driver` inverts meaning repo-wide.** Today every "driver" means ReAct-the-execution-strategy; after this work, "driver" means a resource adapter and ReAct is a **runner**. This is a sweeping, mechanical rename across code, docs, glossary, and conformance, and it lands at **M6** with real collision risk. It is a first-class tracked task, not a footnote.
- **`runner` is already a loaded term — reserve it.** The repo already uses "runner" pervasively for the **conformance** machinery — **eight** runner-named directories (**five** named exactly `conformance-runner` — kernel/framework/providers across TS and Rust — plus the `…-batteries-included`, `…-sqlite`, and `…-postgres` variants), matching the eight project IDs in the `conformance` script, plus the shared engine `tools/conformance/runner/`. (The eight script IDs and the eight runner-named directories are *independent* sets that each happen to total eight — they need not stay equal.) Once `driver→runner` (M6) makes "runner" *also* mean execution model, the word is ambiguous. Resolution: **reserve "runner" for execution models**, and rename the conformance machinery to the **certification harness** ("the harness" / "generic harness"). This rename is tracked alongside the M6 sweep.
- **`spec/` is already a directory name *inside* the repo.** Every contract/interop area currently has its own nested `spec/` authority dir. The new root `spec/` **subsumes** these — they relocate into `spec/<port>/`, leaving exactly one `spec/`. Called out so the central term is held to the same discipline as `driver`/`runner` (resolution in §5/§15).
- **`Thread` / `Branch` collide with OS threads.** In a strict OS metaphor, the domain `Thread` is really a long-lived session/job and `Branch` is a fork of it. Renaming reaches deep into the kernel spec, so it is **parked** and flagged for a future decision — not done here.
- **Renaming "Tuvren Runtime" is a constitutional change, not just a repo rename.** Today `.constitution/prd/vision.md` §1.1 defines **Tuvren = the company brand**, **Tuvren Runtime = the runtime product**, **Kraken = the engine**. Using "Tuvren" for the framework therefore does two things at once: it drops "Runtime" *and* repurposes the company-brand term — a real ubiquitous-language collision, not a trim. It is handled in M10's `.constitution/` rewrite, not as a side effect of the `Tuvren/runtime → Tuvren/framework` repo rename.
- **Conformance drift during reorganization** is the #1 risk. It is mitigated by the M1 tracer-bullet, the restructure-only scope, the per-milestone green gate (incl. updating the conformance list), and the in-tree certification requirement.

---

## 15. Old → new naming map (starter)

| Today | New |
| --- | --- |
| `boundaries/<area>/implementations/<lang>/…` | `<lang>/…` (idiomatic tree) |
| boundary-owned `contracts/` (incl. their nested `spec/` authority dirs) | `spec/<port>/` (the single root `spec/` consolidates all nested `spec/` dirs — no homonym) |
| boundary-owned `conformance/` | `spec/conformance/` (unified certification suite) |
| `boundaries/kernel/interop/grpc/` | `spec/interop/` (IPC — gRPC kernel transport contract) |
| `boundaries/framework/interop/rust-kernel/` (cross-language interop **conformance** suite) | `spec/conformance/interop/` |
| `reports/compatibility/` (generated compatibility matrix + evidence) | stays a **top-level `reports/`** generated-evidence tree — **not** `spec/` (authority-only) |
| "driver" (ReAct and other strategies) | **runner** |
| backends / provider bridges / MCP / stream + telemetry adapters | **drivers** (resource adapters) |
| `conformance-runner` / `tools/conformance/runner/` (the conformance machinery) | **certification harness** (reserve "runner" for execution models) |
| extensions | **extensions** (port) · **hooks** (mechanism) |
| third-party shareable adapters | **`contrib`**-marked, in-tree |
| `Tuvren/runtime` (repo) | `Tuvren/framework` |
| "Tuvren Runtime" (product name) | **Tuvren** (constitutional ubiquitous-language change — M10) |
| engine internals | **Kraken** (the executive) |

---

## 16. Glossary (canonical terms)

- **Port** — a language-neutral contract in `spec/` (a single responsibility with a membership test).
- **Adapter** — an implementation of a port, living in a language tree. One of: driver, runner, or extension.
- **Driver** — a resource adapter (storage, provider, tool/MCP, output).
- **Runner** — an execution model (ReAct, …). Reserved word; not the conformance machinery.
- **Certification harness** — the implementation-agnostic conformance engine (today's `tools/conformance/runner/`), renamed off "runner."
- **Extension** — a hook-bundle plug-in; **hook** is the per-attachment-point mechanism.
- **core / ABI** — the shared, behavior-free vocabulary port; executable helpers never live here.
- **Standard** — `spec/`, the sovereign source of truth.
- **Certification** — passing a port's conformance plan against the standard. The merge gate.
- **First-party / community (`contrib`)** — adapter grades; both in-tree, both green-gated.
- **Reference implementation** — TypeScript: the lab where surface is prototyped, never the oracle.
- **Promotion** — moving prototyped surface into the standard so all languages must certify against it.
- **Ragged coverage** — a language certifying only the ports it implements; a valid green state.

---

## 17. Open / parked items (intentionally not blocking)

- `Thread` / `Branch` domain-term rename — parked (deep in the kernel spec).
- Final bikeshed on a few term spellings (e.g. `runner` wording) — concept slots are locked even if wording is revisited.
- Discovery-based certification (so coverage self-enforces instead of relying on an explicit project list). Coverage enforcement currently rests on contributor discipline (the hand-maintained `conformance` list + the inventory) — the very "matter of discipline" §1 aims to abolish — so consider pulling this **earlier** than the M10 tail. Not a gate, but the residual discipline-dependency to watch.
- Bazel rule/macro extraction — optional M10 tail, not a gate.
