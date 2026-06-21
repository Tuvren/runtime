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

/**
 * KRT-BG003 — side-effect-once idempotency envelope (ADR-052).
 *
 * These tests prove the idempotency identity is a deterministic function of
 * the (runId, callId, fencingToken) triple and that the Tuvren-server tool
 * execution context carries it. Carriage on the Client Endpoint Boundary
 * dispatch envelope is covered in client-endpoint-boundary.test.ts.
 */

import { describe, expect, test } from "bun:test";
import type { ToolCallPart } from "@tuvren/core/messages";
import type { TuvrenToolDefinition } from "@tuvren/core/tools";
import { deriveIdempotencyKey } from "../src/lib/idempotency-identity.ts";
import type { ToolBatchEnvironment } from "../src/lib/tool-execution.ts";
import { createToolExecutionContext } from "../src/lib/tool-execution-helpers.ts";

function makeToolCall(callId: string): ToolCallPart {
  return { callId, input: {}, name: "side.effect", type: "tool_call" };
}

const TOOL: TuvrenToolDefinition = {
  description: "a side-effecting capability",
  execute: () => Promise.resolve(undefined),
  inputSchema: { type: "object" },
  name: "side.effect",
};

function makeEnvironment(
  runId: string,
  fencingToken: string | undefined
): ToolBatchEnvironment {
  return {
    fencingToken,
    publishCustom: () => undefined,
    publishEvent: () => undefined,
    runId,
    signal: undefined,
  } as unknown as ToolBatchEnvironment;
}

describe("deriveIdempotencyKey (ADR-052 / KRT-BG003)", () => {
  test("is a deterministic function of the triple", () => {
    expect(deriveIdempotencyKey("run-1", "call-1", "fence-1")).toBe(
      deriveIdempotencyKey("run-1", "call-1", "fence-1")
    );
  });

  test("distinct triples produce distinct identities", () => {
    const base = deriveIdempotencyKey("run-1", "call-1", "fence-1");
    expect(deriveIdempotencyKey("run-2", "call-1", "fence-1")).not.toBe(base);
    expect(deriveIdempotencyKey("run-1", "call-2", "fence-1")).not.toBe(base);
    expect(deriveIdempotencyKey("run-1", "call-1", "fence-2")).not.toBe(base);
  });

  test("an absent fencing token cannot collide with an empty-string token", () => {
    expect(deriveIdempotencyKey("run-1", "call-1")).not.toBe(
      deriveIdempotencyKey("run-1", "call-1", "")
    );
  });

  test("the canonical encoding is injective across field boundaries", () => {
    // A naive join on ':' would fold ("a:b","c") and ("a","b:c") together.
    expect(deriveIdempotencyKey("a:b", "c", "fence")).not.toBe(
      deriveIdempotencyKey("a", "b:c", "fence")
    );
  });
});

describe("createToolExecutionContext idempotency identity (KRT-BG003)", () => {
  test("carries the identity derived from runId, callId, and fencingToken", () => {
    const environment = makeEnvironment("run-alpha", "fence-alpha");
    const context = createToolExecutionContext(
      makeToolCall("call-alpha"),
      TOOL,
      environment,
      undefined
    );

    expect(context.idempotencyKey).toBe(
      deriveIdempotencyKey("run-alpha", "call-alpha", "fence-alpha")
    );
  });

  test("the same logical call re-dispatched after recovery presents the same identity", () => {
    // A recovery that re-presents the same (runId, callId, fencingToken) — the
    // identifiers durably bound to the logical call — must reproduce the same
    // identity so the external system deduplicates the effect.
    const firstDispatch = createToolExecutionContext(
      makeToolCall("call-beta"),
      TOOL,
      makeEnvironment("run-beta", "fence-beta"),
      undefined
    );
    const reDispatch = createToolExecutionContext(
      makeToolCall("call-beta"),
      TOOL,
      makeEnvironment("run-beta", "fence-beta"),
      undefined
    );

    expect(reDispatch.idempotencyKey).toBe(firstDispatch.idempotencyKey);
  });

  test("derives an identity even when no run lease (fencing token) is held", () => {
    const context = createToolExecutionContext(
      makeToolCall("call-gamma"),
      TOOL,
      makeEnvironment("run-gamma", undefined),
      undefined
    );

    expect(context.idempotencyKey).toBe(
      deriveIdempotencyKey("run-gamma", "call-gamma", undefined)
    );
  });
});
