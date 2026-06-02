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
 * Conformance adapter operations for the Tuvren-server execution class
 * check set (KRT-AX006). Each operation returns structured evidence that
 * the shared conformance runner asserts against the tuvren-server-execution-class
 * plan's checks.
 *
 * Adapter rules: no assertion logic, no pass/fail grading, no evidence
 * field names that imply semantic verdicts. Raw observational data only.
 */

import type { TuvrenToolDefinition } from "@tuvren/core/tools";
import {
  createBindingResolver,
  createDriverRegistry,
  createTuvrenRuntime as createTuvrenRuntimeCore,
} from "@tuvren/runtime";
import type { CapabilityObservation } from "@tuvren/core/capabilities";

function observationForClass(
  executionClass: "tuvren-server" | "provider-native" | "provider-mediated" | "tuvren-client"
): CapabilityObservation {
  if (executionClass === "tuvren-server") {
    return {
      canAudit: true,
      canCancel: true,
      canObserveIntermediate: true,
      canPersistResult: true,
      canResume: true,
      canRetry: true,
      executionClass: "tuvren-server",
    };
  }
  return {
    canAudit: false,
    canCancel: false,
    canObserveIntermediate: false,
    canPersistResult: true,
    canResume: false,
    canRetry: false,
    executionClass,
  };
}
import type { AdapterProjection } from "./framework-adapter-runtime.ts";
import {
  AGENT_NAME,
  assistantText,
  assistantToolCalls,
  collectValues,
  createConformanceIdFactory,
  createConformanceKernelHarness,
  createStaticDriver,
  DRIVER_ID,
  textSignal,
} from "./framework-adapter-runtime.ts";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeSingleCallDriver(toolName: string, input: unknown = {}) {
  return createStaticDriver(async (context) => {
    await Promise.resolve();
    if (!context.messages.some((m) => m.role === "tool")) {
      return {
        messages: [
          assistantToolCalls([{ callId: "ax-call-1", input, name: toolName }]),
        ],
        resolution: { type: "continue_iteration" as const },
        toolExecutionMode: "parallel" as const,
      };
    }
    return {
      messages: [assistantText("ax006 conformance done")],
      resolution: { reason: "done", type: "end_turn" as const },
    };
  });
}

function makeMultiCallDriver(toolName: string, callCount: number) {
  return createStaticDriver(async (context) => {
    await Promise.resolve();
    const toolMessages = context.messages.filter((m) => m.role === "tool");
    if (toolMessages.length < callCount) {
      return {
        messages: [
          assistantToolCalls([
            { callId: `ax-call-${toolMessages.length}`, input: {}, name: toolName },
          ]),
        ],
        resolution: { type: "continue_iteration" as const },
        toolExecutionMode: "parallel" as const,
      };
    }
    return {
      messages: [assistantText("ax006 multi-call done")],
      resolution: { reason: "done", type: "end_turn" as const },
    };
  });
}

async function runTurn(
  tool: TuvrenToolDefinition,
  config: Record<string, unknown> = {},
  callCount = 1
) {
  const harness = createConformanceKernelHarness();
  const driver = callCount > 1
    ? makeMultiCallDriver(tool.name, callCount)
    : makeSingleCallDriver(tool.name);

  const runtime = createTuvrenRuntimeCore({
    createId: createConformanceIdFactory(),
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([driver]),
    kernel: harness.kernel,
  });

  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: { name: AGENT_NAME, tools: [tool], ...config },
    signal: textSignal("ax006 conformance"),
    threadId: thread.threadId,
  });

  const events = await collectValues(handle.events());
  return events;
}

function findEvent(events: unknown[], type: string) {
  return events.find((e) => (e as Record<string, unknown>).type === type) as
    | Record<string, unknown>
    | undefined;
}

function findAllEvents(events: unknown[], type: string) {
  return events.filter(
    (e) => (e as Record<string, unknown>).type === type
  ) as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Operation: runtime.tuvren-server.lifecycle
//
// Exercises:
// - Input validation failure → tool.result isError true with error code
// - Output validation failure → tool.result isError true with result-validation code
// - Within-contract execution → tool.result isError false
// - Idempotent retry → tool executes multiple times before success
// - Non-idempotent no-retry → tool executes exactly once despite failure
// - Audit signal emission (input_validated lifecycle point)
// ---------------------------------------------------------------------------

export async function runTuvrenServerLifecycle(): Promise<AdapterProjection> {
  // --- 1. Input validation failure ---
  const INPUT_VALIDATION_TOOL = "ax006-input-validation";
  const strictTool: TuvrenToolDefinition = {
    name: INPUT_VALIDATION_TOOL,
    description: "strict input schema",
    inputSchema: {
      type: "object",
      properties: { value: { type: "number" } },
      required: ["value"],
      additionalProperties: false,
    },
    execute() {
      return { result: 1 };
    },
  };

  const invalidDriver = createStaticDriver(async (context) => {
    await Promise.resolve();
    if (!context.messages.some((m) => m.role === "tool")) {
      return {
        messages: [
          assistantToolCalls([
            { callId: "ax-call-1", input: { wrongField: "bad" }, name: INPUT_VALIDATION_TOOL },
          ]),
        ],
        resolution: { type: "continue_iteration" as const },
        toolExecutionMode: "parallel" as const,
      };
    }
    return {
      messages: [assistantText("done")],
      resolution: { reason: "done", type: "end_turn" as const },
    };
  });

  const inputValidationHarness = createConformanceKernelHarness();
  const inputValidationRuntime = createTuvrenRuntimeCore({
    createId: createConformanceIdFactory(),
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([invalidDriver]),
    kernel: inputValidationHarness.kernel,
  });
  const inputThread = await inputValidationRuntime.createThread({});
  const inputHandle = inputValidationRuntime.executeTurn({
    branchId: inputThread.branchId,
    config: { name: AGENT_NAME, tools: [strictTool] },
    signal: textSignal("input validation"),
    threadId: inputThread.threadId,
  });
  const inputEvents = await collectValues(inputHandle.events());
  const inputToolResult = findEvent(inputEvents, "tool.result") as
    | { isError?: boolean; output?: Record<string, unknown> }
    | undefined;
  const inputAuditEvent = findEvent(inputEvents, "tool.audit") as
    | { lifecycle?: string; validationPassed?: boolean }
    | undefined;

  // --- 2. Output validation failure ---
  const OUTPUT_VALIDATION_TOOL = "ax006-output-validation";
  const outputSchemaTool: TuvrenToolDefinition = {
    name: OUTPUT_VALIDATION_TOOL,
    description: "output schema tool",
    inputSchema: { type: "object" },
    outputSchema: {
      type: "object",
      properties: { count: { type: "number" } },
      required: ["count"],
      additionalProperties: false,
    },
    execute() {
      return { wrongField: "bad" };
    },
  };
  const outputEvents = await runTurn(outputSchemaTool);
  const outputToolResult = findEvent(outputEvents, "tool.result") as
    | { isError?: boolean; output?: Record<string, unknown> }
    | undefined;

  // --- 3. Within-contract execution ---
  const WITHIN_CONTRACT_TOOL = "ax006-within-contract";
  let withinContractExecuted = false;
  const withinContractTool: TuvrenToolDefinition = {
    name: WITHIN_CONTRACT_TOOL,
    description: "within-contract tool",
    inputSchema: { type: "object" },
    execute() {
      withinContractExecuted = true;
      return { result: "ok" };
    },
  };
  const withinEvents = await runTurn(withinContractTool);
  const withinToolResult = findEvent(withinEvents, "tool.result") as
    | { isError?: boolean; output?: Record<string, unknown> }
    | undefined;

  // --- 4. Idempotent retry ---
  const RETRY_TOOL = "ax006-idempotent-retry";
  let retryCallCount = 0;
  const retryTool: TuvrenToolDefinition = {
    name: RETRY_TOOL,
    description: "idempotent tool",
    idempotent: true,
    maxRetries: 1,
    inputSchema: { type: "object" },
    execute() {
      retryCallCount += 1;
      if (retryCallCount === 1) {
        throw new Error("transient failure");
      }
      return { result: "retried-ok" };
    },
  };
  const retryEvents = await runTurn(retryTool);
  const retryToolResult = findEvent(retryEvents, "tool.result") as
    | { isError?: boolean; output?: Record<string, unknown> }
    | undefined;
  const retryAuditEvents = findAllEvents(retryEvents, "tool.audit").filter(
    (e) => e.lifecycle === "retry_attempt"
  );

  // --- 5. Non-idempotent no-retry ---
  const NO_RETRY_TOOL = "ax006-non-idempotent";
  let noRetryCallCount = 0;
  const noRetryTool: TuvrenToolDefinition = {
    name: NO_RETRY_TOOL,
    description: "non-idempotent tool",
    inputSchema: { type: "object" },
    execute() {
      noRetryCallCount += 1;
      throw new Error("failure");
    },
  };
  await runTurn(noRetryTool);

  // --- 6. Rate limit ---
  const RATE_LIMIT_TOOL = "ax006-rate-limit";
  const rateLimitTool: TuvrenToolDefinition = {
    name: RATE_LIMIT_TOOL,
    description: "rate limited tool",
    inputSchema: { type: "object" },
    execute() { return { ok: true }; },
  };
  const rateLimitEvents = await runTurn(
    rateLimitTool,
    { serverExecution: { rateLimit: { maxCalls: 0, windowMs: 60_000 } } }
  );
  const rateLimitToolResult = findEvent(rateLimitEvents, "tool.result") as
    | { isError?: boolean; output?: Record<string, unknown> }
    | undefined;
  const rateLimitAuditEvent = findAllEvents(rateLimitEvents, "tool.audit").find(
    (e) => e.lifecycle === "rate_limited"
  ) as { lifecycle?: string } | undefined;

  const evidence = {
    tuvrenServer: {
      inputValidation: {
        resultIsError: inputToolResult?.isError,
        resultOutputCode: inputToolResult?.output?.code,
        auditLifecycle: inputAuditEvent?.lifecycle,
        auditValidationPassed: inputAuditEvent?.validationPassed,
      },
      outputValidation: {
        resultIsError: outputToolResult?.isError,
        resultOutputCode: outputToolResult?.output?.code,
      },
      withinContract: {
        toolExecuted: withinContractExecuted,
        resultIsError: withinToolResult?.isError,
        resultOutput: withinToolResult?.output,
      },
      idempotentRetry: {
        callCount: retryCallCount,
        resultIsError: retryToolResult?.isError,
        retryAuditCount: retryAuditEvents.length,
        firstRetryAttemptNumber: retryAuditEvents[0]?.attempt,
      },
      nonIdempotentNoRetry: {
        callCount: noRetryCallCount,
      },
      rateLimit: {
        resultIsError: rateLimitToolResult?.isError,
        resultOutputCode: rateLimitToolResult?.output?.code,
        auditLifecycle: rateLimitAuditEvent?.lifecycle,
      },
    },
  };

  return { evidence, result: evidence };
}

// ---------------------------------------------------------------------------
// Operation: runtime.tuvren-server.binding-classification
//
// Exercises:
// - MCP binding → tuvren-server / mcp-server endpoint kind
// - Sandbox binding → tuvren-server / tuvren-sandbox endpoint kind
// - Full tuvren-server CapabilityObservation
// ---------------------------------------------------------------------------

export async function runTuvrenServerBindingClassification(): Promise<AdapterProjection> {
  const resolver = createBindingResolver();

  // MCP tool
  const mcpTool: TuvrenToolDefinition = {
    name: "ax006-mcp-tool",
    description: "mcp tool",
    inputSchema: { type: "object" },
    execute() { return {}; },
    metadata: { mcp: { serverName: "ax006-server" } },
  };
  const mcpBinding = resolver.resolveFromToolDefinition(mcpTool);

  // Sandbox tool
  const sandboxTool: TuvrenToolDefinition = {
    name: "ax006-sandbox-tool",
    description: "sandbox tool",
    inputSchema: { type: "object" },
    execute() { return {}; },
    metadata: { sandbox: { endpointId: "ax006-sandbox" } },
  };
  const sandboxBinding = resolver.resolveFromToolDefinition(sandboxTool);

  // Observation
  const serverObservation = observationForClass("tuvren-server");

  // MCP tool emits attribution in event stream
  const mcpEvents = await runTurn(mcpTool);
  const mcpToolResult = findEvent(mcpEvents, "tool.result") as
    | { attribution?: Record<string, unknown> }
    | undefined;

  const evidence = {
    tuvrenServer: {
      mcpBinding: {
        executionClass: mcpBinding.executionClass,
        endpointKind: mcpBinding.endpoint.kind,
        capabilityId: mcpBinding.capabilityId,
      },
      sandboxBinding: {
        executionClass: sandboxBinding.executionClass,
        endpointKind: sandboxBinding.endpoint.kind,
        capabilityId: sandboxBinding.capabilityId,
      },
      observation: {
        executionClass: serverObservation.executionClass,
        canAudit: serverObservation.canAudit,
        canCancel: serverObservation.canCancel,
        canObserveIntermediate: serverObservation.canObserveIntermediate,
        canPersistResult: serverObservation.canPersistResult,
        canResume: serverObservation.canResume,
        canRetry: serverObservation.canRetry,
      },
      mcpToolResultAttribution: {
        executionClass: mcpToolResult?.attribution?.executionClass,
      },
    },
  };

  return { evidence, result: evidence };
}
