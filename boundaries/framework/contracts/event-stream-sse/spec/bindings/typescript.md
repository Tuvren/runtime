# TypeScript binding appendix for `tuvren.framework.event-stream-sse`

This appendix records how the TypeScript stream-sse package realizes the
`tuvren.framework.event-stream-sse` authority packet. The packet itself is the
cross-implementation authority; this document describes implementation-specific
projection details that future TypeScript maintainers need but that are not
part of the cross-language contract.

## Binding root

- Package: `@tuvren/stream-sse`
- Implementation root: `boundaries/framework/implementations/typescript/stream-sse`
- Bundler: `tsup` per the existing package convention

## Projection rules

- The generated `DecodedSseEvent` JSON Schema under `artifacts/json-schema/` is
  the canonical shape. The TypeScript package re-exports the equivalent type
  via its own `index.ts`; the re-export must remain structurally compatible
  with the generated schema.
- Byte traces in `boundaries/framework/conformance/fixtures/event-stream-sse-traces.json`
  use native JSON string escapes for non-printable characters (`\r`, `\n`,
  `﻿`). The TypeScript SSE decoder consumes these traces as UTF-8 bytes
  without additional processing.
- The TypeScript implementation uses `ReadableStream<Uint8Array>` for incoming
  byte traces and emits `DecodedSseEvent` objects. The `ReadableStream` choice
  is implementation-specific and not part of the cross-language contract; a
  Rust implementation may use any equivalent byte-source abstraction.

## Conformance adapter status

The shared conformance runner dispatches `event-stream-sse.decode-trace` and
`event-stream-sse.report-wire-compliance` operations against any adapter that
declares the `framework.event-stream-sse` capability. The current TypeScript
framework adapter at `boundaries/framework/implementations/typescript/conformance-adapter/`
does NOT yet declare this capability; until it does, every check in
`event-stream-sse.json` runs as non-applicable on the TypeScript framework
lane.

The pending adapter work is a follow-up: the adapter must implement the two
neutral operations against the existing `@tuvren/stream-sse` package, declare
the new capability, and refresh compatibility evidence to flip the SSE plan
from `unsupported` to `pass` on the TypeScript lane.
