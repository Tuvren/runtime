# Epic Y Machine-Enforced Authority Closure Inventory

Epic Y is closed in current repo reality.

## Promoted Authority Packets

| Packet | Manifest | Authority sources | Verification |
| --- | --- | --- | --- |
| `tuvren.shared.core-types` | `boundaries/shared/contracts/core-types/spec/authority-packet.json` | TypeSpec core payload and error-envelope source | JSON Schema artifacts plus freshness declaration |
| `tuvren.framework.event-stream` | `boundaries/framework/contracts/event-stream/spec/authority-packet.json` | TypeSpec stream-event source and `event-stream-core` conformance plan | JSON Schema artifacts plus plan validation |
| `tuvren.framework.runtime-api` | `boundaries/framework/contracts/runtime-api/spec/authority-packet.json` | TypeSpec runtime operation source plus lifecycle/callable plans | JSON Schema artifacts plus plan validation |
| `tuvren.framework.driver-api` | `boundaries/framework/contracts/driver-api/spec/authority-packet.json` | TypeSpec driver operation source plus core/callable plans | JSON Schema artifacts plus plan validation |

## Binding Projections

- TypeScript packages remain public API projections: `@tuvren/core-types`,
  `@tuvren/event-stream`, `@tuvren/runtime-api`, and `@tuvren/driver-api`.
- `@tuvren/runtime-core` and `@tuvren/react-driver` are declared projection
  consumers for the runtime-api and driver-api packets.
- Binding appendices live under each promoted surface's `spec/bindings/`
  directory. Language-native `Promise`, `AsyncIterable`, `AbortSignal`,
  byte-buffer, class, and trait shapes belong there rather than in authority
  sources.

## Conformance and Guardrails

- Authority packet validation lives at
  `tools/scripts/authority-packet/validate-authority-packets.ts`.
- Conformance plan validation and generic assertion evaluation live under
  `tools/conformance/plan-compiler/`.
- The adapter protocol lives under `tools/conformance/adapter-protocol/`.
- Reference adapter scaffolds live at
  `boundaries/framework/implementations/typescript/conformance-runner/src/adapter-scaffold.ts`
  and
  `boundaries/kernel/implementations/rust/conformance-runner/src/adapter_scaffold.rs`.
- Machine authority guardrails live at
  `tools/scripts/authority-guardrails/authority-guardrails.ts` with regression
  fixtures for freshness drift, forbidden evidence citations, runner oracle
  markers, and forbidden implementation vocabulary.
- The framework TypeScript conformance runner consumes the event-stream plan for
  promoted event-sequence, terminal-event, and ordering assertions.

## Deferred Surfaces

- Kernel protocol packet hardening remains deferred because the kernel already
  has CDDL/proto/conformance assets from Epics S-T-U and is not one of the five
  named Epic Y surfaces.
- Provider API, tool contracts, host stream adapters, telemetry semconv,
  compatibility-ledger packets, AI SDK bridge packets, Rust framework work, new
  drivers, new backends, and new host protocols remain deferred to future
  TechSpec revisions.

## Activation Gates for Future Implementation Lines

- Read the relevant `spec/authority-packet.json` before implementing a promoted
  surface.
- Generate or inspect the packet's declared artifacts.
- Implement a language adapter against the §4.13 adapter protocol.
- Run the referenced conformance plans and emit measured evidence.
- Do not cite implementation source, runner source, or Markdown as
  cross-implementation authority.
