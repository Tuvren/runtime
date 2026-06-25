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
| **Tuvren** | The OS / framework / distribution. The product brand and host-facing surface. |
| **Kraken** | The **engine / executive** — the hexagon center that owns turn/run lifecycle, execution handles, durable-read, capability orchestration, and worker/handoff process management. |
| **kernel** | Mechanism only: syscalls, durable objects, TurnTrees, lineage, staging, reclamation, the narrow waist. Interprets no content. |
| **`spec/`** | The **standard** (Tuvren's POSIX). Authority packets are its normative sections; conformance is its certification suite. |
| **core** | The **ABI**: the shared vocabulary every layer speaks (messages/content, the event vocabulary, errors, execution-result types, schema shapes). Contract-only, no behavior. |
| **libc / SDK** | The host-facing surface applications link against. |
| **shell** | The reference REPL host. |
| **applications** | Downstream hosts embedding the SDK. |
| **IPC** | The gRPC projection of the kernel — used only when the kernel runs out-of-process. |
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
- **runners** — *execution models.* They define how a turn thinks and loops. ReAct is the first runner; pipeline / router / orchestrator-worker are future runners.
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
│   ├── interop/                # IPC: gRPC kernel projection
│   └── conformance/            # unified certification suite
│       └── (plans · fixtures · scenarios · shared-runner contract), organized by port
│
├── typescript/                 # reference implementation — idiomatic bun/Nx workspace, Bazel-native
│   ├── (engine · drivers · runners · extensions · host, organized idiomatically)
│   ├── contrib/                # community-grade adapters, clearly named
│   └── (generated bindings live here, never in spec/)
│
├── rust/                       # kernel-only today — idiomatic Cargo workspace
│   └── (grows toward the standard TS already certifies against; future epic)
│
│   (future) go/   python/      # new languages grow up to the same standard
│
├── tools/                      # build / enforcement / codegen tooling
├── .constitution/              # updated to track the refactor (not frozen)
├── docs/                       # timeless semantic authority (kernel/framework specs + rationale)
└── MODULE.bazel · BUILD …      # Bazel is the primary orchestrator
```

**Layout rules**

- `spec/` holds **only** language-neutral authority. **No** language-bearing code lives there — including generated bindings.
- Each language tree is organized **idiomatically**. There is no forced boundary skeleton; the boundary/port concept exists only as the organizing axis of `spec/` and conformance.
- Each language tree carries a **port → package map** so any contributor (or agent) can navigate it without assuming a shared shape.
- `boundaries/` and `implementations/` are **removed**.

---

## 6. Truth & cohesion

- `spec/` is **authoritative**. **TypeScript is the reference / lab implementation** — the rapid-iteration language used to build surface from the ground up — disciplined to never *become* the oracle. That discipline is exactly why `spec/` must exist.
- **Promotion loop:** new surface is prototyped in TypeScript → **promoted into `spec/`** (authority packet + conformance plan) → TypeScript and every future language certify against it. The reference informs the standard; the standard then outranks the reference.
- **Cohesion is semantic, not structural.** Every language certifies against the same standard and declares its port→package map. Package counts, names, and folders need not match across languages.
- **Ragged coverage is a valid, green, certified state.** A language certifies whatever ports it implements. Rust is kernel-only today and that is a clean certified state, not a gap to apologize for.

---

## 7. Build system

- **Bazel** is the primary orchestrator, adopted **ground-up**: the new structure is born Bazel-native, so there is no `(Nx, old layout) → (Nx, new layout) → (Bazel, new layout)` double migration — only a single `(old) → (Bazel, new)` transition.
- **De-risk with a tracer bullet** (M1): prove every seam — standard ↔ language-dir ↔ conformance ↔ Bazel — on one small vertical slice before mass movement.
- The **in-tree driver model** (§9) further justifies Bazel: in-tree driver trees are precisely where hermetic, cached, incremental builds earn their keep.
- **Nx** survives only as an optional transitional inner-loop convenience and is demoted at cutover.

---

## 8. Driver shipping model — in-tree (the Linux way)

All drivers — first-party **and** curated community — live in the monorepo, and all are **green-gated**.

- **Not green → not shipped, period.** A contribution that does not certify cannot land.
- Everything lives under one workspace, so AI agents and contributors reach the source directly rather than chasing other repos.
- Quality stays under the project's control.

The green conformance gate **is** the acceptance bar: the standard is the reviewer, which scales to an AI-agent-contributor world without a human gatekeeper per driver.

---

## 9. Scope

**In scope (restructure-only):**

- Move the full TypeScript implementation and the Rust kernel into the OS-shaped layout.
- Stand up `spec/`-as-standard, Bazel, OS naming, and the unified conformance gate.
- Prove the existing implementations still certify against the lifted standard.
- Ship the "how to add a language" and "how to add a driver" guides plus clean scaffolding.

**Explicit non-goals:**

- **No new framework or language coverage.** This effort does not bring Rust to framework parity and does not add Go or Python.
- Rust-to-parity (next in line) and Go / Python are **future, separate issues**. This effort must not silently override the staged gate that intentionally blocks Rust framework work.

---

## 10. Invariants (must hold at every milestone gate)

1. Relevant conformance certifies **green**; authority-guardrail checks pass.
2. `MIGRATION_INVENTORY.md` shows **100% coverage** with nothing unaccounted.
3. **Git history is preserved** for moved or transformed material.
4. **No content is deleted** without a proven successor or explicit equivalence evidence.
5. Everything migrated so far is **green and hermetic under Bazel**.

---

## 11. Execution model — reviewable milestone gates

- Work proceeds **one milestone at a time**. Each milestone is a **reviewable gate**: its Definition of Done must be met, green, and **reviewed/approved before the next milestone begins**.
- Within a milestone: capture baseline → migrate the vertical slice → re-certify → **commit only on green**.
- Prefer **small, fully verifiable increments**. Surface a blocking invariant immediately with the minimal next action to restore green.
- Sequencing is **vertical, port-by-port**, so the tree stays green at every step and each milestone is an independent checkpoint. (The alternative — lift the whole standard, then migrate all implementations — was rejected because it opens a long red valley where the standard exists but nothing certifies against it.)

---

## 12. Living artifacts

- **Status** lives in **this issue** (milestone checklist + running notes). There is no separate `EPIC_STATUS.md` — the issue *is* the status surface.
- **`MIGRATION_INVENTORY.md`** (machine-checkable) lives at repo root during the migration: the authoritative 100%-coverage ledger of every contract, driver, runner, hook, script, and implementation as `old path → new path → status → content hash`. It is **deleted at cutover** so it does not become durable cruft.

---

## 13. Milestones

Each milestone migrates a port's authority into `spec/`, its adapters into the relevant language tree, wires Bazel, and re-certifies. Milestones may merge or split as the inventory reveals true sizes; **the order and the gate model are the commitments.**

### M0 — Ground rules
**Objective:** Establish the immutable baseline and the rules of the migration.
**Definition of Done (gate):**
- `MIGRATION_INVENTORY.md` accounts for 100% of current content (paths + hashes).
- Full green conformance + authority-guardrail baseline captured.
- This epic and the old→new naming map authored and agreed.

### M1 — Tracer bullet (kernel)
**Objective:** Prove every seam end-to-end on one small vertical slice.
**Definition of Done (gate):**
- `spec/kernel` + `spec/conformance/kernel` exist and are authoritative.
- The Rust kernel and the TypeScript kernel adapter build and **certify under Bazel**.
- Old and new paths produce equivalent results; inventory updated.

### M2 — core (ABI)
**Objective:** Lift the shared vocabulary into the standard.
**Definition of Done (gate):**
- `spec/core` owns the canonical vocabulary; the existing `@tuvren/core` is split so the **port is pure ABI** and SDK ergonomics move to the libc tier.
- TypeScript certifies against `spec/core`; green; inventory updated.

### M3 — engine (Kraken) + libc
**Objective:** Migrate the executive and define the port contracts the rest plug into.
**Definition of Done (gate):**
- The engine (turn/run lifecycle, execution handles, durable-read, orchestration, capability orchestration) and the host-facing SDK surface live under `typescript/`, Bazel-native.
- Port contracts (providers, tools, runners, extensions, streaming, telemetry, host) are declared in `spec/`.
- Green; inventory updated.

### M4 — providers
**Objective:** Provider port + provider drivers.
**Definition of Done (gate):** `spec/providers` authoritative; the AI SDK bridge migrated as a provider driver and certifying; green; inventory updated.

### M5 — tools + capabilities + MCP
**Objective:** Tool port (including execution classes / binding / policy) + tool drivers.
**Definition of Done (gate):** `spec/tools` authoritative; tool drivers and **MCP (bus-driver)** migrated and certifying; green; inventory updated.

### M6 — runners
**Objective:** Runner port + ReAct. **The `driver → runner` rename lands here.**
**Definition of Done (gate):** `spec/runners` authoritative; ReAct migrated as a runner; the repo-wide rename (code, docs, glossary, conformance) complete and consistent; green; inventory updated.

### M7 — extensions
**Objective:** Hook/extension port + first-party extensions.
**Definition of Done (gate):** `spec/extensions` authoritative; first-party extensions migrated and certifying; green; inventory updated.

### M8 — streaming + telemetry
**Objective:** Output drivers.
**Definition of Done (gate):** `spec/streaming` + `spec/telemetry` authoritative; tty drivers (SSE/AG-UI) and the syslog driver (OTel) migrated and certifying; green; inventory updated.

### M9 — host (shell)
**Objective:** Host port + the reference REPL host.
**Definition of Done (gate):** `spec/host` authoritative; the reference shell migrated, consuming the SDK exclusively, and certifying; green; inventory updated.

### M10 — Cutover & teardown
**Objective:** Make the new structure the only path.
**Definition of Done (gate):**
- `boundaries/` and `implementations/` deleted after final equivalence proof.
- Bazel is the canonical CI path; Nx demoted to optional inner-loop convenience.
- `.constitution/` and `AGENTS.md` rewritten to the new world.
- The repo is renamed to `Tuvren/framework`.
- The "add a language" and "add a driver" guides ship; `MIGRATION_INVENTORY.md` deleted.
- *(Optional tail: extract repeated enforcement into Bazel rules/macros.)*

---

## 14. Naming migration & known risks

- **`driver` inverts meaning repo-wide.** Today every "driver" means ReAct-the-execution-strategy; after this work, "driver" means a resource adapter and ReAct is a **runner**. This is a sweeping, mechanical rename across code, docs, glossary, and conformance, and it lands at **M6** with real collision risk. It is a first-class tracked task, not a footnote.
- **`Thread` / `Branch` collide with OS threads.** In a strict OS metaphor, the domain `Thread` is really a long-lived session/job and `Branch` is a fork of it. Renaming reaches deep into the kernel spec, so it is **parked** and flagged for a future decision — not done here.
- **Conformance drift during reorganization** is the #1 risk. It is mitigated by the M1 tracer-bullet, the restructure-only scope, the per-milestone green gate, and the in-tree certification requirement.

---

## 15. Old → new naming map (starter)

| Today | New |
| --- | --- |
| `boundaries/<area>/implementations/<lang>/…` | `<lang>/…` (idiomatic tree) |
| boundary-owned `contracts/` | `spec/<port>/` (contract sources + authority packet) |
| boundary-owned `conformance/` | `spec/conformance/` (unified certification suite) |
| boundary-owned `interop/` (gRPC) | `spec/interop/` (IPC) |
| "driver" (ReAct and other strategies) | **runner** |
| backends / provider bridges / MCP / stream + telemetry adapters | **drivers** (resource adapters) |
| extensions | **extensions** (port) · **hooks** (mechanism) |
| third-party shareable adapters | **`contrib`**-marked, in-tree |
| `Tuvren/runtime` (repo) | `Tuvren/framework` |
| "runtime" (as the whole product) | **Tuvren** (the framework/OS) |
| engine internals | **Kraken** (the executive) |

---

## 16. Glossary (canonical terms)

- **Port** — a language-neutral contract in `spec/` (a single responsibility with a membership test).
- **Adapter** — an implementation of a port, living in a language tree. One of: driver, runner, or extension.
- **Driver** — a resource adapter (storage, provider, tool/MCP, output).
- **Runner** — an execution model (ReAct, …).
- **Extension** — a hook-bundle plug-in; **hook** is the per-attachment-point mechanism.
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
- Bazel rule/macro extraction — optional M10 tail, not a gate.
