# TypeScript Adapter Binding

The TypeScript binding projects the neutral adapter protocol into TypeScript
without making TypeScript the semantic authority.

```ts
export interface ImplementationAdapter {
  initialize(packetId: string, planVersion: string): Promise<AdapterCapabilities>;
  shutdown(): Promise<void>;
  dispatch(
    operation: string,
    input: unknown,
    controls: AdapterControls
  ): Promise<OperationOutcome>;
  events(
    operation: string,
    input: unknown,
    controls: AdapterControls
  ): AsyncIterable<unknown>;
  inspectState?(query: unknown): Promise<unknown | null>;
  emitEvidence(checkId: string, key: string, payload: unknown): Promise<void>;
}
```

`AbortSignal`, `Promise`, and `AsyncIterable` are TypeScript binding details.
Conformance plans name neutral operations and assertion kinds.

Reference scaffold:
`boundaries/framework/implementations/typescript/conformance-runner/src/adapter-scaffold.ts`.
