/**
 * Copyright 2026 Oscar Yáñez Cisterna (@SkrOYC)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface AdapterControls {
  readonly cancelAfterEvent?: string;
  readonly signal?: AbortSignal;
}

export interface AdapterCapabilities {
  readonly adapterId: string;
  readonly packetId: string;
  readonly planVersion: string;
}

export interface OperationOutcome {
  readonly result?: unknown;
  readonly status: "completed" | "failed" | "paused";
}

export interface EvidenceRecord {
  readonly checkId: string;
  readonly key: string;
  readonly payload: unknown;
}

export interface ImplementationAdapter {
  dispatch(
    operation: string,
    input: unknown,
    controls: AdapterControls
  ): Promise<OperationOutcome>;
  emitEvidence(checkId: string, key: string, payload: unknown): Promise<void>;
  events(
    operation: string,
    input: unknown,
    controls: AdapterControls
  ): AsyncIterable<unknown>;
  initialize(
    packetId: string,
    planVersion: string
  ): Promise<AdapterCapabilities>;
  inspectState?(query: unknown): Promise<unknown | null>;
  shutdown(): Promise<void>;
}

export class ReferenceTypeScriptAdapter implements ImplementationAdapter {
  readonly evidence: EvidenceRecord[] = [];

  dispatch(
    operation: string,
    input: unknown,
    controls: AdapterControls
  ): Promise<OperationOutcome> {
    throwIfCancelled(controls);
    return Promise.resolve({
      result: { input, operation },
      status: "completed",
    });
  }

  emitEvidence(checkId: string, key: string, payload: unknown): Promise<void> {
    this.evidence.push({ checkId, key, payload });
    return Promise.resolve();
  }

  async *events(
    operation: string,
    input: unknown,
    controls: AdapterControls
  ): AsyncIterable<unknown> {
    await Promise.resolve();
    throwIfCancelled(controls);
    yield { input, operation, sequence: 0 };
  }

  initialize(
    packetId: string,
    planVersion: string
  ): Promise<AdapterCapabilities> {
    return Promise.resolve({
      adapterId: "reference-typescript-adapter",
      packetId,
      planVersion,
    });
  }

  inspectState(query: unknown): Promise<unknown | null> {
    return Promise.resolve({ query });
  }

  shutdown(): Promise<void> {
    this.evidence.length = 0;
    return Promise.resolve();
  }
}

function throwIfCancelled(controls: AdapterControls): void {
  // Cancellation is adapter mechanics. The plan still owns when cancellation
  // should be injected and what semantic outcome must be asserted.
  if (controls.signal?.aborted === true) {
    throw new Error("adapter operation cancelled");
  }
}
