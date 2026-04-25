# Engineering Execution Plan

## 0. Version History & Changelog
- v0.7.0 - Activated sequential Epics N-Q for the post-ReAct implementation line: `LanguageModelV3` AI SDK provider bridge, host stream protocol adapters, playground host harness, and testkit/release hardening.
- v0.6.2 - Closed Epic M against brownfield repo reality, added the explicit tool-and-approval inventory artifact, and archived Epics K-M so the next planning pass can start from Epic N.
- v0.6.1 - Reframed Epic L as a brownfield closure and Epic M readiness pass, adding an explicit parity inventory artifact and handoff-focused acceptance criteria while preserving the existing epic IDs and dependency order.
- v0.6.0 - Selected bounded active Epics K, L, and M for ReAct loop completion, streaming/provider semantics, and tool/approval integration while deferring AI SDK bridge and host protocol work as next-focus topics.
- ... [Older history truncated, refer to git logs]

## 1. Executive Summary & Active Critical Path
- **Total Active Story Points:** 79
- **Critical Path:** KRT-N001 -> KRT-N002 -> KRT-N003 -> KRT-N004 -> KRT-N005 -> KRT-N006 -> KRT-N007 -> KRT-O001 -> KRT-O002 -> KRT-O003 -> KRT-O004 -> KRT-O005 -> KRT-O006 -> KRT-P001 -> KRT-P002 -> KRT-P003 -> KRT-P004 -> KRT-P005 -> KRT-P006 -> KRT-Q001 -> KRT-Q002 -> KRT-Q003 -> KRT-Q004 -> KRT-Q005 -> KRT-Q006
- **Planning Assumptions:** Epics A-M are closed in current repo reality. TechSpec v0.5.0 locks the baseline AI SDK bridge to `LanguageModelV3` / `ProviderV3` from `@ai-sdk/provider@3.0.8`. Epics N-Q are intentionally sequential: provider bridge first, stream adapters second, playground host third, hardening fourth.

### Brownfield Continuity Note
- The current codebase already contains the workspace scaffold, shared core types, kernel protocol package, memory backend, SQLite backend, kernel testkit, shared framework contract packages, provider contract package, `runtime-core`, and the ReAct Driver foundation package.
- Current repository reality includes closed Epic K, L, and M behavior with explicit closure artifacts in `constitution/spikes/epic-k-react-loop-cancellation-inventory.md`, `constitution/spikes/epic-l-parity-inventory.md`, and `constitution/spikes/epic-m-tool-approval-gap-inventory.md`.
- The missing active target packages are `@tuvren/provider-bridge-ai-sdk`, `@tuvren/stream-core`, `@tuvren/stream-sse`, `@tuvren/stream-agui`, the testkit packages under `boundaries/framework/testkit` and `boundaries/providers/testkit`, the local playground host harness, and release/verification scripts named in TechSpec.
- Planning verification confirmed `ai@6.0.142` and `@ai-sdk/provider@3.0.8` are available and that `@ai-sdk/provider@3.0.8` exports `LanguageModelV3`, `ProviderV3`, `LanguageModelV3CallOptions`, `LanguageModelV3GenerateResult`, and `LanguageModelV3StreamPart`.
- `bun run typecheck` passed before this planning update; this plan changes constitution artifacts only.

### Sequential Scope Rule
- Epic O must not begin until Epic N closes.
- Epic P must not begin until Epic O closes.
- Epic Q must not begin until Epic P closes.
- Inside each epic, ticket dependencies are linear unless a future planning revision explicitly changes this file and the TechSpec together.

### Planning Heuristic
- Prefer epic slices that look likely to land comfortably below roughly `5,000` lines of new code and treat roughly `10,000` lines as a warning threshold.
- This is a scoping heuristic for planning clarity, not an execution cap or a substitute for code review judgment.

## 2. Project Phasing & Iteration Strategy
### Delivery Cadence Posture
- No sprint or release-train cadence is assumed in this plan.
- This section uses "iteration strategy" only because the planning framework requires that heading; the content below is dependency phasing and scope partitioning, not a commitment to Scrum-style iterations.

### Current Active Scope
- Epic N implements the AI SDK provider bridge baseline using `LanguageModelV3` / `ProviderV3` only.
- Epic O implements host stream protocol adapters over canonical `TuvrenStreamEvent` output.
- Epic P implements the local TypeScript playground host harness after the adapter path exists.
- Epic Q extracts testkits and hardens release, package export, and Bun/Node portability checks.

### Future / Deferred Scope
- `LanguageModelV2` / `ProviderV2` compatibility is deferred.
- AI SDK agent loops, AI SDK UI message protocols, AI SDK transport helpers, LangChain bridges, provider-native tool support, and first-class Tuvren provider packages are deferred.
- ACP or any additional host protocol beyond SSE and AG-UI is deferred until a future TechSpec revision names it.
- Future concrete drivers beyond ReAct and official peer backends beyond memory/SQLite are deferred beyond Epic Q.
- Deno portability checks are deferred until public package surfaces stabilize enough to avoid testing scaffolding churn.

### Archived or Already Completed Scope
- Epic A delivered the root workspace scaffold and boundary-first monorepo structure.
- Epic B delivered the shared primitive package plus deterministic identity spike validation.
- Epic C delivered the kernel protocol contracts, deterministic CBOR/SHA helpers, and semantic fixtures.
- Epic D delivered the semantic reference memory backend.
- Epic E delivered the reusable kernel backend conformance, invariant, and recovery harness and closed the memory backend against it.
- Epic F delivered the SQLite backend, migrations, repository logic, and conformance closure.
- Epic G delivered the shared framework contract partition across runtime, driver, event, tool, and provider surfaces.
- Epic H delivered the docs-first shared framework foundations, including the minimal shared-core contract realignment and `runtime-core`.
- Epic I delivered the first focused ReAct Driver foundation slice.
- Epic J delivered Runtime Foundation Hardening: SQLite hot-path characterization, localized transaction validation, backend-local lineage metadata and indexes, explicit diagnostic validation, Run liveness spec deltas, and retention topology proof.
- Epic K delivered ReAct loop completion, cancellation boundaries, and the loop-closure inventory artifact.
- Epic L delivered streaming/provider parity closure and the parity inventory artifact.
- Epic M delivered ReAct tool continuation, approval pause/resume, edited and rejected approval handling, partial batch durability, and the tool-and-approval inventory artifact.

## 3. Build Order (Mermaid)
```mermaid
flowchart LR
  KRTN001[KRT-N001 LanguageModelV3 Bridge Contract Lock] --> KRTN002[KRT-N002 Bridge Package Scaffold and Dependency Wiring]
  KRTN002 --> KRTN003[KRT-N003 Tuvren-to-LanguageModelV3 Prompt Mapping]
  KRTN003 --> KRTN004[KRT-N004 LanguageModelV3 Generate Result Mapping]
  KRTN004 --> KRTN005[KRT-N005 LanguageModelV3 Stream Mapping]
  KRTN005 --> KRTN006[KRT-N006 ReAct Integration and Bridge Fixture Coverage]
  KRTN006 --> KRTN007[KRT-N007 Provider Bridge Closure Inventory]
  KRTN007 --> KRTO001[KRT-O001 Stream Adapter Protocol Inventory]
  KRTO001 --> KRTO002[KRT-O002 Stream-Core Adapter Utilities]
  KRTO002 --> KRTO003[KRT-O003 SSE Adapter Baseline]
  KRTO003 --> KRTO004[KRT-O004 AG-UI Adapter Baseline]
  KRTO004 --> KRTO005[KRT-O005 Runtime Stream Adapter Integration Coverage]
  KRTO005 --> KRTO006[KRT-O006 Stream Adapter Closure Inventory]
  KRTO006 --> KRTP001[KRT-P001 Playground Host Scope Inventory]
  KRTP001 --> KRTP002[KRT-P002 Playground Package Scaffold]
  KRTP002 --> KRTP003[KRT-P003 Thread Turn and Backend Host Flows]
  KRTP003 --> KRTP004[KRT-P004 Streaming Controls and Approval Host Flows]
  KRTP004 --> KRTP005[KRT-P005 Persistent Scenario Matrix]
  KRTP005 --> KRTP006[KRT-P006 Playground Closure Inventory]
  KRTP006 --> KRTQ001[KRT-Q001 Hardening Gap Inventory]
  KRTQ001 --> KRTQ002[KRT-Q002 Provider Bridge Testkit Extraction]
  KRTQ002 --> KRTQ003[KRT-Q003 Framework Adapter Testkit Extraction]
  KRTQ003 --> KRTQ004[KRT-Q004 Release and Verify Tooling]
  KRTQ004 --> KRTQ005[KRT-Q005 Bun and Node Portability Matrix]
  KRTQ005 --> KRTQ006[KRT-Q006 Post-ReAct Implementation Line Closure]
```

## 4. Ticket List
### Epic N - AI SDK Provider Bridge Baseline (APB)

**KRT-N001 LanguageModelV3 Bridge Contract Lock**
- **Type:** Spike
- **Effort:** 2
- **Dependencies:** None
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-030`, `CAP-P1-021`; Architecture `2`, `5`; TechSpec `4.4`, `5.4`, `5.4.1`; Framework Spec `3`, `6`
- **Description:** Lock the exact bridge surface around `LanguageModelV3` / `ProviderV3`, including accepted call settings, prompt/message mappings, stream-part mappings, finish/usage mappings, metadata preservation, and explicit exclusions for `LanguageModelV2`, provider-native tools, AI SDK loops, UI messages, and transport helpers.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given TechSpec v0.5.0 selects the AI SDK provider bridge baseline
When the bridge contract inventory is completed
Then the repository records the public factory surface, LanguageModelV3 prompt and result mappings, supported settings, metadata preservation rules, error codes, fixture matrix, and all deferred AI SDK surfaces that must not leak into shared runtime packages
```

**KRT-N002 Bridge Package Scaffold and Dependency Wiring**
- **Type:** Chore
- **Effort:** 3
- **Dependencies:** KRT-N001
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-030`; Architecture `5`; TechSpec `1`, `4.4`, `5.1`, `5.4`
- **Description:** Create `boundaries/providers/implementations/typescript/bridge-ai-sdk` as `@tuvren/provider-bridge-ai-sdk`, wire Nx/package/tsconfig/build/test exports, and declare the pinned `ai@6.0.142` and `@ai-sdk/provider@3.0.8` dependencies through the repository package-management workflow.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the bridge contract is locked
When the bridge package is scaffolded
Then the workspace exposes a buildable and testable provider bridge package with explicit ESM exports, pinned AI SDK dependencies, no CommonJS entrypoints, and no AI SDK imports from shared runtime or provider contract packages
```

**KRT-N003 Tuvren-to-LanguageModelV3 Prompt Mapping**
- **Type:** Feature
- **Effort:** 5
- **Dependencies:** KRT-N002
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-013`, `CAP-P0-030`; Architecture `2`, `5`; TechSpec `4.3`, `4.4`; Framework Spec `3.2`, `3.3`
- **Description:** Implement Tuvren prompt, message, tool, structured-output, and config translation into `LanguageModelV3CallOptions`, including validation for recognized settings and rejection of malformed bridge configuration as `invalid_ai_sdk_bridge_config`.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a Tuvren prompt contains system, user, assistant, tool, file, reasoning, tool-call, tool-result, structured-output, and model configuration inputs
When the AI SDK bridge prepares a LanguageModelV3 call
Then it emits valid LanguageModelV3CallOptions, maps only supported Tuvren tool definitions to LanguageModelV3FunctionTool, preserves providerOptions and headers, and rejects malformed or unsupported bridge settings with a typed provider error
```

**KRT-N004 LanguageModelV3 Generate Result Mapping**
- **Type:** Feature
- **Effort:** 5
- **Dependencies:** KRT-N003
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-020`, `CAP-P0-030`; Architecture `2`, `5`; TechSpec `4.4`, `4.5`; Framework Spec `3.5`, `6`
- **Description:** Implement non-streaming `doGenerate` result conversion into `TuvrenModelResponse`, including text, reasoning, file, tool-call, tool-result, finish reason, usage, warnings, response metadata, provider metadata, and normalized error behavior.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a LanguageModelV3 model returns a generate result
When the AI SDK bridge maps the result into the Tuvren provider contract
Then canonical content parts, finish reason, usage totals, provider metadata, warnings, and response metadata are preserved according to TechSpec, while unmapped AI SDK-specific fields remain opaque metadata rather than new Tuvren content variants
```

**KRT-N005 LanguageModelV3 Stream Mapping**
- **Type:** Feature
- **Effort:** 5
- **Dependencies:** KRT-N004
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-020`, `CAP-P0-030`; Architecture `2`, `5`; TechSpec `4.4`, `4.5`; Framework Spec `3.3`, `6.3`
- **Description:** Implement `ReadableStream<LanguageModelV3StreamPart>` consumption and conversion into `ProviderStreamChunk`, covering text, reasoning, structured output, tool input, complete tool calls, tool results, files, finish, raw metadata, cancellation, and error propagation.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a LanguageModelV3 model streams text, reasoning, structured output, tool input, complete tool calls, tool results, files, metadata, finish, and errors
When the AI SDK bridge exposes the stream as Tuvren provider chunks
Then the stream preserves ordering, cancellation behavior, provider metadata, final usage, and typed error normalization while producing only the ProviderStreamChunk variants allowed by the Tuvren provider contract
```

**KRT-N006 ReAct Integration and Bridge Fixture Coverage**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-N005
- **Capability / Contract Mapping:** PRD `CAP-P0-004`, `CAP-P0-012`, `CAP-P0-013`, `CAP-P0-020`; Architecture `4.1`, `5`; TechSpec `4.4`, `4.6`; Framework Spec `4`, `6`
- **Description:** Prove that the bridge behaves as a normal `TuvrenProvider` in the ReAct/runtime-core path for generated and streamed responses, structured output, tool calls, provider failures, metadata, and cancellation.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given runtime-core executes the ReAct driver with an AI SDK bridge provider
When generated and streamed fixture turns cover text, reasoning, structured output, tools, metadata, cancellation, and provider errors
Then the runtime emits canonical events, stores durable assistant/tool context, preserves provider metadata, and does not require ReAct or runtime-core to import AI SDK types
```

**KRT-N007 Provider Bridge Closure Inventory**
- **Type:** Chore
- **Effort:** 2
- **Dependencies:** KRT-N006
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-030`; Architecture `5`; TechSpec `4.4`, `5.3`, `5.4.1`
- **Description:** Record Epic N closure evidence, fixture coverage, public exports, dependency pins, known limitations, and downstream assumptions in `constitution/spikes/epic-n-ai-sdk-bridge-inventory.md`.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the AI SDK provider bridge implementation and tests are complete
When Epic N is closed
Then the closure inventory records implemented mappings, test coverage, dependency versions, deferred surfaces, downstream assumptions for Epic O, and any required TechSpec or Tasks status updates
```

### Epic O - Host Stream Protocol Adapters (HSA)

**KRT-O001 Stream Adapter Protocol Inventory**
- **Type:** Spike
- **Effort:** 2
- **Dependencies:** KRT-N007
- **Capability / Contract Mapping:** PRD `CAP-P0-020`, `CAP-P0-023`, `CAP-P1-024`; Architecture `5`; TechSpec `4.5`, `4.7`, `5.4.1`; Framework Spec `6`, `9`
- **Description:** Inventory the canonical `TuvrenStreamEvent` surface against SSE and AG-UI translation needs, lock the exact AG-UI package or protocol revision, identify lossy mappings and warning cases, and confirm ACP remains out of scope for this plan.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given Epic N has proven canonical provider-backed runtime events
When stream adapter protocol inventory is completed
Then the repository records the selected AG-UI revision, SSE framing rules, event mapping matrix, lossy translation warnings, fixture coverage plan, and explicit exclusion of ACP or additional host protocols
```

**KRT-O002 Stream-Core Adapter Utilities**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-O001
- **Capability / Contract Mapping:** PRD `CAP-P0-020`, `CAP-P1-024`; Architecture `5`; TechSpec `4.5`, `4.7`, `5.1`; Framework Spec `6`
- **Description:** Implement `@tuvren/stream-core` with shared adapter types, event cloning/projection helpers, warning callbacks, fixture helpers, and transform utilities that do not alter runtime semantics.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given canonical TuvrenStreamEvent fixtures
When stream-core transforms or projects events for adapter packages
Then it preserves event order and meaning, reports adapter-local warnings through the configured callback, avoids mutating source events, and remains free of protocol-specific output dependencies
```

**KRT-O003 SSE Adapter Baseline**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-O002
- **Capability / Contract Mapping:** PRD `CAP-P0-020`, `CAP-P1-024`; Architecture `5`; TechSpec `4.5`, `4.7`; Framework Spec `6`, `9`
- **Description:** Implement `@tuvren/stream-sse` with EventSource-compatible frame generation and `Response` helper support over canonical `TuvrenStreamEvent` streams.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a host passes canonical TuvrenStreamEvent output into the SSE adapter
When the adapter emits SSE frames or a Response
Then each frame uses the source event type as the event name, serializes the complete canonical event as JSON data, preserves ordering and terminal errors, and respects stream cancellation/backpressure behavior
```

**KRT-O004 AG-UI Adapter Baseline**
- **Type:** Feature
- **Effort:** 5
- **Dependencies:** KRT-O003
- **Capability / Contract Mapping:** PRD `CAP-P0-020`, `CAP-P0-023`, `CAP-P1-024`; Architecture `5`; TechSpec `4.5`, `4.7`; Framework Spec `6`, `9`
- **Description:** Implement `@tuvren/stream-agui` using the selected AG-UI revision, mapping lifecycle, message, text, reasoning, structured output, tool call, tool result, approval, state, custom, and error events as far as the protocol allows.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a canonical runtime event stream contains lifecycle, assistant, tool, approval, state, custom, and error events
When the AG-UI adapter translates the stream
Then it emits AG-UI-compatible events for supported cases, preserves Tuvren source attribution where possible, reports documented warnings for lossy or unsupported mappings, and never invents runtime state that was not present in the canonical event stream
```

**KRT-O005 Runtime Stream Adapter Integration Coverage**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-O004
- **Capability / Contract Mapping:** PRD `CAP-P0-005`, `CAP-P0-020`, `CAP-P1-024`; Architecture `4.1`, `5`; TechSpec `4.1`, `4.5`, `4.7`; Framework Spec `6`, `8`, `9`
- **Description:** Prove stream adapters against real `ExecutionHandle.events()` flows, including single-consumer behavior, cancellation, approval pause/resume, steering incorporation, tool execution, and provider-backed completion.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given runtime-core produces ExecutionHandle event streams for normal, cancelled, paused, resumed, steered, and failed turns
When those streams are consumed through SSE and AG-UI adapters
Then adapter output remains ordered, terminal status is visible, cancellation propagates, approval and steering events are represented, and adapters do not consume or replay streams in a way that violates the runtime contract
```

**KRT-O006 Stream Adapter Closure Inventory**
- **Type:** Chore
- **Effort:** 2
- **Dependencies:** KRT-O005
- **Capability / Contract Mapping:** PRD `CAP-P0-020`, `CAP-P1-024`; Architecture `5`; TechSpec `4.7`, `5.3`, `5.4.1`
- **Description:** Record Epic O closure evidence, selected AG-UI revision, mapping matrix, package exports, fixture coverage, limitations, and downstream assumptions in `constitution/spikes/epic-o-stream-adapter-inventory.md`.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the stream adapter packages and integration coverage are complete
When Epic O is closed
Then the closure inventory records implemented mappings, lossy cases, warnings, selected protocol versions, test coverage, downstream assumptions for Epic P, and any required TechSpec or Tasks status updates
```

### Epic P - Playground Host Harness (PHH)

**KRT-P001 Playground Host Scope Inventory**
- **Type:** Spike
- **Effort:** 2
- **Dependencies:** KRT-O006
- **Capability / Contract Mapping:** PRD `CAP-P0-001`, `CAP-P0-005`, `CAP-P0-020`, `CAP-P0-023`; Architecture `1.4`, `4.1`, `5`; TechSpec `4.1`, `4.7`, `5.1`; Framework Spec `7`, `8`, `9`
- **Description:** Define the local playground host harness scope, scenarios, environment variables, provider bridge configuration, backend choices, stream adapters, controls, and fixture mode boundaries without turning the harness into a production web app.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given Epic O has proven stream adapters
When playground host scope inventory is completed
Then the repository records supported runtime flows, provider configuration modes, backend matrix, stream adapter outputs, controls, fixture scenarios, non-goals, and host-owned authentication assumptions
```

**KRT-P002 Playground Package Scaffold**
- **Type:** Chore
- **Effort:** 3
- **Dependencies:** KRT-P001
- **Capability / Contract Mapping:** PRD `CAP-P0-001`, `CAP-P0-020`; Architecture `1.4`, `5`; TechSpec `4.7`, `5.1`
- **Description:** Create `boundaries/hosts/implementations/typescript/playground` with package/Nx/tsconfig wiring, local scripts, fixtures, environment handling, and imports through public package surfaces.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the playground scope is documented
When the playground host harness is scaffolded
Then it builds and runs through workspace tooling, reads provider/backend configuration from host-owned environment inputs, imports only public package surfaces, and includes deterministic fixture mode for local validation without provider credentials
```

**KRT-P003 Thread Turn and Backend Host Flows**
- **Type:** Feature
- **Effort:** 5
- **Dependencies:** KRT-P002
- **Capability / Contract Mapping:** PRD `CAP-P0-001`, `CAP-P0-004`, `CAP-P0-006`, `CAP-P0-019`; Architecture `1.2`, `4.1`; TechSpec `4.1`, `4.2`, `4.7`; Framework Spec `7`
- **Description:** Implement playground flows for creating/getting threads, creating branches, executing turns, selecting memory or SQLite backends, and inspecting durable status and branch/head state.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a developer runs the playground host harness with memory or SQLite backend configuration
When they create a thread, create a branch, execute a turn, and inspect status
Then the host path uses public runtime APIs, durable branch/head state is visible, backend-specific configuration stays outside runtime contracts, and fixture mode produces deterministic output
```

**KRT-P004 Streaming Controls and Approval Host Flows**
- **Type:** Feature
- **Effort:** 5
- **Dependencies:** KRT-P003
- **Capability / Contract Mapping:** PRD `CAP-P0-005`, `CAP-P0-013`, `CAP-P0-016`, `CAP-P0-017`, `CAP-P0-020`; Architecture `4.1`, `4.2`, `5`; TechSpec `4.1`, `4.3`, `4.5`, `4.7`; Framework Spec `6`, `8`, `9`
- **Description:** Add host flows for consuming SSE and AG-UI adapter output, cancelling active turns, steering input into a run, resolving approvals, inspecting paused/completed/failed status, and verifying tool execution continuity.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given a playground turn streams assistant output and reaches host-controlled states
When the host cancels, steers, resolves approvals, or observes completion/failure
Then the harness shows canonical status transitions, adapter output, approval decisions, tool results, and durable continuation behavior without embedding authentication or provider-specific policy in runtime packages
```

**KRT-P005 Persistent Scenario Matrix**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-P004
- **Capability / Contract Mapping:** PRD `CAP-P0-006`, `CAP-P0-019`, `CAP-P0-020`, `CAP-P0-023`; Architecture `1.2`, `4.1`, `5`; TechSpec `3.4`, `3.5`, `4.7`; Framework Spec `7`, `8`
- **Description:** Add scenario coverage for structured output, tool calls, provider metadata, approval pause/resume, SQLite reload, branch inspection, and fixture-provider operation.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the playground supports memory and SQLite backends
When persistent scenarios run for structured output, tools, metadata, approval resume, reload, and branch inspection
Then the same public runtime behavior is observable after SQLite reload, fixture-provider scenarios stay deterministic, and provider-backed scenarios remain optional host configuration
```

**KRT-P006 Playground Closure Inventory**
- **Type:** Chore
- **Effort:** 2
- **Dependencies:** KRT-P005
- **Capability / Contract Mapping:** PRD `CAP-P0-001`, `CAP-P0-005`, `CAP-P0-020`; Architecture `1.4`, `5`; TechSpec `4.7`, `5.3`, `5.4.1`
- **Description:** Record Epic P closure evidence, host flows, scenario matrix, known limitations, provider/backend setup notes, and downstream assumptions in `constitution/spikes/epic-p-playground-host-inventory.md`.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the playground host harness and scenarios are complete
When Epic P is closed
Then the closure inventory records implemented host flows, deterministic fixture paths, optional provider-backed paths, backend reload behavior, limitations, downstream assumptions for Epic Q, and any required TechSpec or Tasks status updates
```

### Epic Q - Testkit, Portability, and Release Hardening (TPR)

**KRT-Q001 Hardening Gap Inventory**
- **Type:** Spike
- **Effort:** 2
- **Dependencies:** KRT-P006
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-020`, `CAP-P0-030`, `CAP-P1-032`; Architecture `5`; TechSpec `5.1`, `5.2`, `5.3`, `5.4.1`
- **Description:** Inventory provider bridge fixtures, stream adapter fixtures, playground scenarios, package export smoke tests, release checks, and runtime portability gaps that must be closed before the post-ReAct line can be treated as implementation-ready.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given Epics N, O, and P are closed
When the hardening gap inventory is completed
Then the repository records the testkit extraction targets, release-check targets, portability matrix, package export smoke tests, deferred Deno work, and any remaining gaps that must close inside Epic Q
```

**KRT-Q002 Provider Bridge Testkit Extraction**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-Q001
- **Capability / Contract Mapping:** PRD `CAP-P0-012`, `CAP-P0-030`; Architecture `5`; TechSpec `4.4`, `5.1`, `5.2`; Framework Spec `3`, `6`
- **Description:** Extract reusable provider bridge fixtures and conformance helpers under `boundaries/providers/testkit`, focused on `LanguageModelV3` generate/stream behavior, mappings, errors, metadata, and cancellation.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the AI SDK bridge has package-local fixture coverage
When provider testkit extraction is complete
Then reusable testkit helpers can verify LanguageModelV3 generate and stream mappings, metadata preservation, errors, cancellation, and tool/structured-output behavior without requiring runtime-core to know about AI SDK types
```

**KRT-Q003 Framework Adapter Testkit Extraction**
- **Type:** Feature
- **Effort:** 3
- **Dependencies:** KRT-Q002
- **Capability / Contract Mapping:** PRD `CAP-P0-020`, `CAP-P1-024`; Architecture `5`; TechSpec `4.5`, `4.7`, `5.1`, `5.2`; Framework Spec `6`, `9`
- **Description:** Extract reusable framework adapter and host-flow fixtures under `boundaries/framework/testkit`, covering canonical event streams, stream adapters, runtime controls, approvals, and playground scenario reuse.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given stream adapters and the playground have local scenario coverage
When framework testkit extraction is complete
Then reusable fixtures can verify canonical event ordering, SSE output, AG-UI output, cancellation, steering, approval, error, and terminal-status behavior without depending on playground internals
```

**KRT-Q004 Release and Verify Tooling**
- **Type:** Chore
- **Effort:** 3
- **Dependencies:** KRT-Q003
- **Capability / Contract Mapping:** PRD `CAP-P1-032`; Architecture `5`; TechSpec `5.1`, `5.2`, `5.3`
- **Description:** Add or refresh release/verification tooling under `tools/scripts`, including workspace verification, package export smoke tests, build/typecheck/test orchestration, and release-check reporting.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given provider, framework, stream, and playground packages are present
When the release and verification scripts run
Then they build and typecheck the relevant packages, run package export smoke tests, execute targeted test suites, report failures clearly, and avoid relying on untracked local state or provider credentials
```

**KRT-Q005 Bun and Node Portability Matrix**
- **Type:** Chore
- **Effort:** 3
- **Dependencies:** KRT-Q004
- **Capability / Contract Mapping:** PRD `CAP-P0-030`, `CAP-P1-032`; Architecture `5`; TechSpec `1`, `3.5`, `5.2`
- **Description:** Validate the core non-native packages across Bun and Node.js, explicitly documenting narrower runtime support for native or dependency-constrained packages such as SQLite and provider bridges.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given the post-ReAct packages are wired into verification tooling
When Bun and Node portability checks run
Then portable core packages pass in both runtimes, narrower packages document their supported runtime constraints, native SQLite behavior is not misrepresented as edge/serverless support, and Deno remains explicitly deferred
```

**KRT-Q006 Post-ReAct Implementation Line Closure**
- **Type:** Chore
- **Effort:** 2
- **Dependencies:** KRT-Q005
- **Capability / Contract Mapping:** PRD `CAP-P0-001`, `CAP-P0-012`, `CAP-P0-020`, `CAP-P0-030`, `CAP-P1-032`; Architecture `5`; TechSpec `5.3`, `5.4.1`
- **Description:** Record Epic Q closure evidence, package matrix, verification commands, portability status, residual risks, and release-readiness conclusions in `constitution/spikes/epic-q-release-hardening-inventory.md`.
- **Acceptance Criteria (Gherkin):**
```gherkin
Given Epics N-Q are complete and verified
When the post-ReAct implementation line is closed
Then the closure inventory records implemented packages, testkits, release tooling, portability results, residual risks, deferred scopes, and the TechSpec and Tasks status language needed for the next planning pass
```
