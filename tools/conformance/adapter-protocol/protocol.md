# Implementation Adapter Protocol

The Implementation Adapter Protocol is the neutral seam between a Generic
Conformance Runner and one implementation under test. It is not a public host
API and it is not authority for product semantics; operation names and expected
behavior come from the authority packet and its conformance plans.

```text
initialize(packetId, planVersion) -> AdapterCapabilities
shutdown() -> void

dispatch(operation, input, controls) -> OperationOutcome
  OperationOutcome ::=
    | { kind: "result", value }
    | { kind: "error", error: ErrorEnvelope }

events(operation, input, controls) -> OrderedEventChannel
  OrderedEventChannel yields neutral JSON events in order.
  OrderedEventChannel terminates with completed, paused, or failed.
  OrderedEventChannel honors cancel(reason) and deadlineMs controls.

inspectState(query) -> StateView | null
emitEvidence(checkId, key, payload) -> void

ErrorEnvelope ::= { code: string, message: string, details?: JsonValue, cause?: ErrorEnvelope }
```

Adapters bridge to language-native functions, promises, async iterables,
tokens, byte buffers, and errors internally. Those binding shapes belong only in
declared binding appendices.
