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

import type {
  ExecutionStatus,
  InputSignal,
  KrakenErrorProjection,
  KrakenStreamEvent,
  WorkerStatus,
} from "@kraken/framework-runtime-api";
import {
  assertKrakenMessage,
  assertKrakenStreamEvent,
} from "@kraken/framework-runtime-api";
import {
  assertKernelRecord,
  KrakenRuntimeError,
} from "@kraken/shared-core-types";

export class AsyncEventQueue<T> implements AsyncIterable<T> {
  private closed = false;
  private readonly items: Array<{ value: T }> = [];
  private onClose?: () => void;
  private readonly waiters: Array<(value: IteratorResult<T>) => void> = [];

  constructor(onClose?: () => void) {
    this.onClose = onClose;
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ done: true, value: undefined });
    }

    this.onClose?.();
    this.onClose = undefined;
  }

  push(item: T): void {
    if (this.closed) {
      return;
    }

    const waiter = this.waiters.shift();

    if (waiter !== undefined) {
      waiter({ done: false, value: item });
      return;
    }

    this.items.push({
      value: item,
    });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: async (): Promise<IteratorResult<T>> => {
        if (this.items.length > 0) {
          const nextItem = this.items.shift();

          if (nextItem === undefined) {
            return {
              done: true,
              value: undefined,
            };
          }

          return {
            done: false,
            value: nextItem.value,
          };
        }

        if (this.closed) {
          return {
            done: true,
            value: undefined,
          };
        }

        return await new Promise<IteratorResult<T>>((resolve) => {
          this.waiters.push(resolve);
        });
      },
      return: (): Promise<IteratorResult<T>> => {
        this.close();
        return Promise.resolve({
          done: true,
          value: undefined,
        });
      },
    };
  }
}

export class EventFanout<T> {
  private closed = false;
  private readonly subscribers = new Set<AsyncEventQueue<T>>();

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    for (const subscriber of this.subscribers) {
      subscriber.close();
    }

    this.subscribers.clear();
  }

  emit(item: T): void {
    if (this.closed) {
      return;
    }

    for (const subscriber of this.subscribers) {
      subscriber.push(cloneValue(item));
    }
  }

  subscribe(): AsyncIterable<T> {
    let queue: AsyncEventQueue<T>;
    queue = new AsyncEventQueue<T>(() => {
      this.subscribers.delete(queue);
    });

    if (this.closed) {
      queue.close();
      return queue;
    }

    this.subscribers.add(queue);
    return queue;
  }
}

export function cloneExecutionStatus(status: ExecutionStatus): ExecutionStatus {
  return {
    activeAgent: status.activeAgent,
    approval: cloneValue(status.approval),
    iterationCount: status.iterationCount,
    manifest: cloneValue(status.manifest),
    pauseReason: status.pauseReason,
    phase: status.phase,
  };
}

export function cloneWorkerStatus(status: WorkerStatus): WorkerStatus {
  return {
    agent: status.agent,
    approval: cloneValue(status.approval),
    result: cloneValue(status.result),
    status: status.status,
    threadId: status.threadId,
    workerId: status.workerId,
  };
}

export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });

  return {
    promise,
    resolve(value: T) {
      resolveValue?.(value);
    },
  };
}

export function cloneValue<T>(value: T): T {
  return globalThis.structuredClone(value);
}

export function detachPromise(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function projectError(error: Error): KrakenErrorProjection {
  const errorRecord = isRecord(error) ? error : undefined;

  return {
    code:
      errorRecord !== undefined && typeof errorRecord.code === "string"
        ? errorRecord.code
        : undefined,
    details:
      errorRecord === undefined
        ? undefined
        : sanitizeErrorDetails(errorRecord.details),
    message: error.message,
  };
}

export function normalizeInputSignal(
  signal: InputSignal,
  label: string
): InputSignal {
  const candidateMessage: unknown = {
    parts: cloneValue(signal.parts),
    role: "user",
  };
  assertKrakenMessage(candidateMessage, label);

  if (candidateMessage.role !== "user") {
    throw new KrakenRuntimeError(
      "input signals must normalize to user messages",
      {
        code: "invalid_input_signal",
      }
    );
  }

  return {
    parts: candidateMessage.parts,
  };
}

function sanitizeErrorDetails(details: unknown): unknown {
  if (details === undefined) {
    return undefined;
  }

  try {
    assertKernelRecord(details, "error details");
    return cloneValue(details);
  } catch {
    return undefined;
  }
}

export function stripEventSource(event: KrakenStreamEvent): KrakenStreamEvent {
  if (event.source === undefined) {
    return event;
  }

  const { source: _source, ...rest } = event;
  assertKrakenStreamEvent(rest, "stream event without source");
  return rest;
}
