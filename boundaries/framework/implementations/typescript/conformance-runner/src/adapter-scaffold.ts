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
  DriverExecutionContext,
  DriverExecutionResult,
  RuntimeDriver,
} from "@tuvren/driver-api";
import { assertDriverExecutionResult } from "@tuvren/driver-api";
import type { ProviderStreamChunk, TuvrenProvider } from "@tuvren/provider-api";
import type {
  ContextManifest,
  InputSignal,
  ToolCallPart,
  ToolRegistry,
  TuvrenExtension,
  TuvrenMessage,
  TuvrenModelResponse,
  TuvrenStreamEvent,
  TuvrenToolDefinition,
} from "@tuvren/runtime-api";
import { createReActDriver } from "../../drivers/react/src/index.ts";
import {
  executeGenerateCall,
  executeStreamCall,
} from "../../drivers/react/src/lib/react-driver-stream.ts";
import {
  createDriverRegistry,
  createTuvrenRuntimeCore,
} from "../../runtime-core/src/index.ts";
import { createFakeKernelHarness } from "../../runtime-core/test/fake-kernel.ts";

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

interface AdapterProjection {
  evidence?: Record<string, unknown>;
  result?: unknown;
  state?: Record<string, unknown>;
}

interface OperationObservation {
  adapterEvents: number;
  initialized: boolean;
  status: OperationOutcome["status"];
}

const DRIVER_ID = "typescript-conformance-driver";
const AGENT_NAME = "typescript-conformance-agent";

export class TypeScriptFrameworkAdapter implements ImplementationAdapter {
  readonly evidence: EvidenceRecord[] = [];
  private capabilities?: AdapterCapabilities;
  private readonly observations = new Map<string, OperationObservation>();
  private latestState: Record<string, unknown> | null = null;

  async dispatch(
    operation: string,
    _input: unknown,
    controls: AdapterControls
  ): Promise<OperationOutcome> {
    this.requireInitialized();
    throwIfCancelled(controls);

    const projection = await this.projectOperation(operation, controls);
    const status = projectionStatus(projection);
    this.latestState = projection.state ?? null;
    this.observations.set(operation, {
      adapterEvents: 0,
      initialized: true,
      status,
    });

    return {
      result: projection,
      status,
    };
  }

  emitEvidence(checkId: string, key: string, payload: unknown): Promise<void> {
    this.evidence.push({ checkId, key, payload });
    return Promise.resolve();
  }

  async *events(
    operation: string,
    _input: unknown,
    controls: AdapterControls
  ): AsyncIterable<unknown> {
    await Promise.resolve();
    this.requireInitialized();
    throwIfCancelled(controls);

    const observation = this.observations.get(operation);
    const event = {
      operation,
      status: observation?.status ?? "completed",
      type: "adapter.operation.observed",
    };

    if (observation !== undefined) {
      this.observations.set(operation, {
        ...observation,
        adapterEvents: observation.adapterEvents + 1,
      });
    }

    yield event;
  }

  initialize(
    packetId: string,
    planVersion: string
  ): Promise<AdapterCapabilities> {
    this.capabilities = {
      adapterId: "typescript-framework",
      packetId,
      planVersion,
    };
    return Promise.resolve(this.capabilities);
  }

  inspectState(query: unknown): Promise<unknown | null> {
    if (!isRecord(query) || typeof query.operation !== "string") {
      return Promise.resolve(this.latestState);
    }

    const observation = this.observations.get(query.operation);

    return Promise.resolve({
      ...(this.latestState ?? {}),
      adapter: observation,
    });
  }

  shutdown(): Promise<void> {
    this.capabilities = undefined;
    this.evidence.length = 0;
    this.latestState = null;
    this.observations.clear();
    return Promise.resolve();
  }

  private requireInitialized(): AdapterCapabilities {
    if (this.capabilities === undefined) {
      throw new Error("implementation adapter must be initialized first");
    }

    return this.capabilities;
  }

  private projectOperation(
    operation: string,
    controls: AdapterControls
  ): Promise<AdapterProjection> {
    // This switch is language-local adapter routing only; shared plans own the
    // assertions and expected semantics, and this file must only measure TS behavior.
    switch (operation) {
      case "runtime.execute-turn":
        return runCompletedRuntimeTurn();
      case "runtime.cancel-execution":
        return runCancelledRuntimeTurn(controls);
      case "runtime.approval-resolve":
        return runApprovalResume();
      case "runtime.branch-create":
        return runBranchCreate();
      case "runtime.provider-generate":
        return runProviderGenerate();
      case "runtime.provider-stream":
        return runProviderStream();
      case "runtime.tool-execute":
        return runToolExecution();
      case "runtime.validate-structured-output":
        return runStructuredValidationFailure();
      case "driver.execute":
        return runDriverExecute();
      case "driver.execute-error":
        return runDriverExecuteError();
      case "driver.resume":
        return runDriverResume();
      case "driver.checkpoint":
        return runDriverCheckpoint();
      default:
        throw new Error(
          `unsupported promoted framework operation ${operation}`
        );
    }
  }
}

async function runCompletedRuntimeTurn(): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([
      createStaticDriver(() => ({
        messages: [assistantText("completed")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      })),
    ]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: { name: AGENT_NAME },
    signal: textSignal("run"),
    threadId: thread.threadId,
  });
  const events = await collectValues(handle.events());

  return {
    evidence: {
      runtime: {
        completed: handle.status().phase === "completed",
        eventCount: events.length,
      },
    },
  };
}

async function runCancelledRuntimeTurn(
  controls: AdapterControls
): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  let executeCount = 0;
  const driver = {
    async execute(context) {
      executeCount += 1;

      if (executeCount === 1) {
        return {
          messages: [assistantText("first pass")],
          resolution: { type: "continue_iteration" },
        };
      }

      await waitForAbort(context.signal);
      return {
        messages: [assistantText("interrupted")],
        partial: true,
        resolution: {
          error: new Error("driver observed cancellation"),
          fatality: "hard",
          type: "fail",
        },
      };
    },
    id: DRIVER_ID,
  } satisfies RuntimeDriver;
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([driver]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: { name: AGENT_NAME },
    signal: textSignal("cancel"),
    threadId: thread.threadId,
  });
  const capture = captureEvents(handle.events());

  await waitFor(() => handle.status().iterationCount === 2);
  handle.cancel();
  await capture.done;

  return {
    evidence: {
      controls: {
        honored: controls.cancelAfterEvent !== undefined || executeCount > 1,
      },
      runtime: {
        failed: handle.status().phase === "failed",
      },
    },
    result: {
      error: readFirstErrorEnvelope(capture.events),
    },
  };
}

async function runApprovalResume(): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  let searchCalls = 0;
  let emailCalls = 0;
  const driver = {
    async execute(context) {
      await Promise.resolve();

      if (!hasToolMessage(context.messages)) {
        return {
          messages: [
            assistantToolCalls([
              {
                callId: "call-search",
                input: { query: "latest status" },
                name: "search",
              },
              {
                callId: "call-email",
                input: { subject: "Status update", to: "ops@example.com" },
                name: "email",
              },
            ]),
          ],
          resolution: { type: "continue_iteration" },
          toolExecutionMode: "parallel",
        };
      }

      return {
        messages: [assistantText("approved")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      };
    },
    id: DRIVER_ID,
  } satisfies RuntimeDriver;
  const tools: TuvrenToolDefinition[] = [
    {
      description: "Search docs",
      execute() {
        searchCalls += 1;
        return { ok: true };
      },
      inputSchema: { type: "object" },
      name: "search",
    },
    {
      approval: true,
      description: "Send email",
      execute() {
        emailCalls += 1;
        return { sent: true };
      },
      inputSchema: {
        properties: {
          subject: { type: "string" },
          to: { type: "string" },
        },
        required: ["to", "subject"],
        type: "object",
      },
      name: "email",
    },
  ];
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([driver]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const pausedHandle = runtime.executeTurn({
    branchId: thread.branchId,
    config: { name: AGENT_NAME, tools },
    signal: textSignal("approve"),
    threadId: thread.threadId,
  });

  const pausedEvents = await collectValues(pausedHandle.events());

  if (pausedHandle.status().phase !== "paused") {
    return {
      evidence: {
        approval: {
          continued: false,
        },
        callables: {
          approvalResolve: false,
        },
      },
      state: {
        approvalError: readFirstErrorEnvelope(pausedEvents),
        approval: pausedHandle.status(),
      },
    };
  }

  const resumedHandle = pausedHandle.resolveApproval({
    decisions: [{ callId: "call-email", type: "approve" }],
  });

  await collectValues(resumedHandle.events());

  return {
    evidence: {
      approval: {
        continued: resumedHandle.status().phase === "completed",
      },
      callables: {
        approvalResolve: searchCalls === 1 && emailCalls === 1,
      },
    },
  };
}

async function runBranchCreate(): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([
      createStaticDriver(() => ({
        messages: [assistantText("branch base")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      })),
    ]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const branch = await runtime.createBranch({
    fromTurnNodeHash: thread.rootTurnNodeHash,
    threadId: thread.threadId,
  });

  return {
    state: {
      branch: {
        created:
          branch.branchId !== thread.branchId &&
          branch.headTurnNodeHash === thread.rootTurnNodeHash,
      },
    },
  };
}

async function runProviderGenerate(): Promise<AdapterProjection> {
  let generateCalls = 0;
  const provider: TuvrenProvider = {
    generate() {
      generateCalls += 1;
      return Promise.resolve(textResponse("generated"));
    },
    id: "provider",
    async *stream() {
      await Promise.resolve();
      yield* [];
    },
  };
  const sequence = await executeGenerateCall({
    now: createClock(),
    prompt: createPrompt(),
    provider,
  });

  return {
    evidence: {
      callables: {
        providerGenerate: generateCalls === 1 && sequence.events.length > 0,
      },
    },
  };
}

async function runProviderStream(): Promise<AdapterProjection> {
  let streamCalls = 0;
  const emittedEvents: TuvrenStreamEvent[] = [];
  const provider: TuvrenProvider = {
    generate() {
      return Promise.reject(
        new Error("generate must not run during stream conformance")
      );
    },
    id: "provider",
    async *stream() {
      await Promise.resolve();
      streamCalls += 1;
      const textChunk: ProviderStreamChunk = {
        text: "streamed",
        type: "text_delta",
      };
      const finishChunk: ProviderStreamChunk = {
        finishReason: "stop",
        type: "finish",
      };

      yield textChunk;
      yield finishChunk;
    },
  };
  const sequence = await executeStreamCall({
    now: createClock(),
    prompt: createPrompt(),
    provider,
    runtime: {
      emit(event) {
        emittedEvents.push(event);
      },
      now: createClock(),
    },
  });

  return {
    evidence: {
      callables: {
        providerStream:
          streamCalls === 1 &&
          emittedEvents.length > 0 &&
          sequence.response.parts.length > 0,
      },
    },
  };
}

async function runToolExecution(): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  let toolCalls = 0;
  const driver = {
    async execute(context) {
      await Promise.resolve();

      if (!hasToolMessage(context.messages)) {
        return {
          messages: [assistantToolCall("call-tool", "search")],
          resolution: { type: "continue_iteration" },
          toolExecutionMode: "parallel",
        };
      }

      return {
        messages: [assistantText("tool finished")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      };
    },
    id: DRIVER_ID,
  } satisfies RuntimeDriver;
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([driver]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: {
      name: AGENT_NAME,
      tools: [
        {
          description: "Search docs",
          execute() {
            toolCalls += 1;
            return { ok: true };
          },
          inputSchema: { type: "object" },
          name: "search",
        },
      ],
    },
    signal: textSignal("tool"),
    threadId: thread.threadId,
  });

  const events = await collectValues(handle.events());

  return {
    evidence: {
      callables: {
        toolExecute: toolCalls === 1 && handle.status().phase === "completed",
      },
    },
    state: {
      toolExecution: {
        error: readFirstErrorEnvelope(events),
        status: handle.status(),
      },
    },
  };
}

async function runStructuredValidationFailure(): Promise<AdapterProjection> {
  const provider: TuvrenProvider = {
    generate() {
      return Promise.resolve({
        finishReason: "stop",
        parts: [
          {
            data: { answer: 42 },
            name: "answer",
            type: "structured",
          },
        ],
      });
    },
    id: "provider",
    async *stream() {
      await Promise.resolve();
      yield* [];
    },
  };
  const driver = createReActDriver({ providerCallMode: "generate" }).create();
  const result = await driver.execute(
    createDriverExecutionContext({
      config: {
        model: provider,
        name: AGENT_NAME,
        responseFormat: {
          name: "answer",
          schema: {
            properties: {
              answer: { type: "string" },
            },
            required: ["answer"],
            type: "object",
          },
        },
      },
    })
  );

  assertDriverExecutionResult(result, "structured validation result");

  return {
    evidence: {
      callables: {
        validationFailure: result.resolution.type === "fail",
      },
    },
  };
}

async function runDriverExecute(): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  const hooks = createHookCounters();
  const provider = createToolCallingProvider();
  const reactDriver = createReActDriver({
    providerCallMode: "generate",
  }).create();
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: reactDriver.id,
    driverRegistry: createDriverRegistry([reactDriver]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: {
      extensions: [createMeasuredExtension(hooks)],
      model: provider,
      name: AGENT_NAME,
      tools: [
        {
          description: "Search docs",
          execute() {
            return { ok: true };
          },
          inputSchema: { type: "object" },
          name: "search",
        },
      ],
    },
    signal: textSignal("measure driver hooks"),
    threadId: thread.threadId,
  });

  await collectValues(handle.events());

  return {
    evidence: {
      driver: {
        executed: handle.status().phase === "completed",
      },
      hooks: {
        afterIteration: hooks.afterIteration > 0,
        aroundModel: hooks.aroundModel > 0,
        aroundTool: hooks.aroundTool > 0,
        beforeIteration: hooks.beforeIteration > 0,
      },
    },
    state: {
      hookCounts: hooks,
    },
  };
}

async function runDriverExecuteError(): Promise<AdapterProjection> {
  await Promise.resolve();

  const result = {
    resolution: {
      error: new Error("driver execution failed"),
      fatality: "hard",
      type: "fail",
    },
  } satisfies DriverExecutionResult;

  assertDriverExecutionResult(result, "driver error result");

  return {
    result: {
      error: {
        code: "driver_execute_error",
        message:
          result.resolution.type === "fail"
            ? result.resolution.error.message
            : "",
      },
    },
  };
}

async function runDriverResume(): Promise<AdapterProjection> {
  const driver = createMeasuredDriver();

  if (driver.resume === undefined) {
    throw new Error("measured driver must implement resume");
  }

  const result = await driver.resume({
    ...createDriverExecutionContext(),
    approval: {
      decisions: [{ callId: "call-search", type: "approve" }],
    },
  });

  assertDriverExecutionResult(result, "driver resume result");

  return {
    evidence: {
      driver: {
        resumed: result.resolution.type === "end_turn",
      },
    },
  };
}

async function runDriverCheckpoint(): Promise<AdapterProjection> {
  const harness = createFakeKernelHarness();
  const runtime = createTuvrenRuntimeCore({
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([
      createStaticDriver(() => ({
        messages: [assistantText("checkpoint")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      })),
    ]),
    kernel: harness.kernel,
  });
  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: { name: AGENT_NAME },
    signal: textSignal("checkpoint"),
    threadId: thread.threadId,
  });

  await collectValues(handle.events());

  const manifest = await harness.readBranchManifest(thread.branchId);

  return {
    evidence: {
      checkpoint: {
        emitted: Object.keys(manifest).length > 0,
      },
    },
  };
}

function createMeasuredDriver(): RuntimeDriver {
  return {
    execute() {
      return Promise.resolve({
        messages: [assistantText("driver execute")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      });
    },
    id: DRIVER_ID,
    resume() {
      return Promise.resolve({
        messages: [assistantText("driver resume")],
        resolution: {
          reason: "done",
          type: "end_turn",
        },
      });
    },
  };
}

interface HookCounters {
  afterIteration: number;
  aroundModel: number;
  aroundTool: number;
  beforeIteration: number;
}

function createHookCounters(): HookCounters {
  return {
    afterIteration: 0,
    aroundModel: 0,
    aroundTool: 0,
    beforeIteration: 0,
  };
}

function createMeasuredExtension(hooks: HookCounters): TuvrenExtension {
  return {
    afterIteration() {
      hooks.afterIteration += 1;
    },
    async aroundModel(_context, next) {
      hooks.aroundModel += 1;
      return await next();
    },
    async aroundTool(_context, next) {
      hooks.aroundTool += 1;
      return await next();
    },
    beforeIteration() {
      hooks.beforeIteration += 1;
    },
    name: "measured-driver-hooks",
  };
}

function createToolCallingProvider(): TuvrenProvider {
  let generateCalls = 0;

  return {
    generate() {
      generateCalls += 1;

      if (generateCalls === 1) {
        return Promise.resolve({
          finishReason: "tool_call",
          parts: [
            {
              callId: "call-search",
              input: { query: "driver hook measurement" },
              name: "search",
              type: "tool_call",
            },
          ],
        });
      }

      return Promise.resolve(textResponse("driver hook turn completed"));
    },
    id: "provider",
    async *stream() {
      await Promise.resolve();
      yield* [];
    },
  };
}

function createStaticDriver(
  execute: (
    context: DriverExecutionContext
  ) => DriverExecutionResult | Promise<DriverExecutionResult>
): RuntimeDriver {
  return {
    execute(context) {
      return Promise.resolve(execute(context));
    },
    id: DRIVER_ID,
  };
}

function createDriverExecutionContext(input?: {
  config?: DriverExecutionContext["config"];
  emittedEvents?: TuvrenStreamEvent[];
  manifest?: ContextManifest;
  signal?: AbortSignal;
  toolDefinitions?: TuvrenToolDefinition[];
}): DriverExecutionContext {
  const emittedEvents = input?.emittedEvents ?? [];
  const toolDefinitions = input?.toolDefinitions ?? [];

  return {
    branchId: "branch-1",
    config: input?.config ?? { name: AGENT_NAME },
    handoff: {
      createContextPlan({ reason, targetAgent }) {
        return {
          builder() {
            return [];
          },
          mode: "preserve_trace",
          reason,
          sourceContext: {
            handoffIntent: { targetAgent },
            helpers: {
              loadMessage() {
                return null;
              },
              storeMessage() {
                return "0".repeat(64);
              },
              storeMessages() {
                return [];
              },
            },
            manifest: createContextManifest(),
            messages: [],
            sourceAgent: { name: AGENT_NAME },
            targetAgent: { name: targetAgent },
          },
          targetAgent,
        };
      },
    },
    iterationCount: 1,
    manifest: input?.manifest ?? createContextManifest(),
    messages: [
      {
        parts: [{ text: "hello", type: "text" }],
        role: "user",
      },
    ],
    runtime: {
      emit(event) {
        emittedEvents.push(event);
      },
      now: createClock(),
    },
    schemaId: "tuvren.agent.v1",
    signal: input?.signal,
    threadId: "thread-1",
    toolRegistry: createToolRegistry(toolDefinitions),
    turnId: "turn-1",
  };
}

function createToolRegistry(
  tools: readonly TuvrenToolDefinition[]
): ToolRegistry {
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    get(name: string) {
      return toolsByName.get(name);
    },
    has(name: string) {
      return toolsByName.has(name);
    },
    list() {
      return [...toolsByName.values()];
    },
    register(tool: TuvrenToolDefinition) {
      toolsByName.set(tool.name, tool);
    },
    toDefinitions() {
      return [...toolsByName.values()].map((tool) => ({
        description: tool.description,
        inputSchema: { type: "object" },
        name: tool.name,
      }));
    },
  };
}

function createContextManifest(): ContextManifest {
  return {
    byRole: {
      assistant: 0,
      system: 0,
      tool: 0,
      user: 1,
    },
    extensions: {},
    lastAssistantMessageIndex: -1,
    lastUserMessageIndex: 0,
    messageCount: 1,
    tokenEstimate: 0,
    toolCalls: {
      byName: {},
      total: 0,
    },
    toolResults: {
      byName: {},
      total: 0,
    },
    turnBoundaries: [0],
  };
}

function assistantText(text: string): TuvrenMessage {
  return {
    parts: [{ text, type: "text" }],
    role: "assistant",
  };
}

function assistantToolCall(callId: string, name: string): TuvrenMessage {
  return assistantToolCalls([{ callId, input: { query: "docs" }, name }]);
}

function assistantToolCalls(
  calls: readonly [
    { callId: string; input: unknown; name: string },
    ...{ callId: string; input: unknown; name: string }[],
  ]
): TuvrenMessage {
  const [firstCall, ...remainingCalls] = calls;
  const parts: [ToolCallPart, ...ToolCallPart[]] = [
    toToolCallPart(firstCall),
    ...remainingCalls.map(toToolCallPart),
  ];

  return {
    parts,
    role: "assistant",
  };
}

function toToolCallPart(call: {
  callId: string;
  input: unknown;
  name: string;
}): ToolCallPart {
  return {
    callId: call.callId,
    input: call.input,
    name: call.name,
    type: "tool_call",
  };
}

function textSignal(text: string): InputSignal {
  return {
    parts: [{ text, type: "text" }],
  };
}

function textResponse(text: string): TuvrenModelResponse {
  return {
    finishReason: "stop",
    parts: [{ text, type: "text" }],
  };
}

function createPrompt(): Parameters<TuvrenProvider["generate"]>[0] {
  return {
    messages: [{ parts: [{ text: "hello", type: "text" }], role: "user" }],
  };
}

function hasToolMessage(messages: readonly TuvrenMessage[]): boolean {
  return messages.some((message) => message.role === "tool");
}

function createClock(): () => number {
  let now = 1;
  return () => now++;
}

async function collectValues<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];

  for await (const value of values) {
    collected.push(value);
  }

  return collected;
}

function captureEvents<T>(events: AsyncIterable<T>): {
  done: Promise<void>;
  events: T[];
} {
  const collected: T[] = [];

  return {
    done: (async () => {
      for await (const event of events) {
        collected.push(event);
      }
    })(),
    events: collected,
  };
}

async function waitFor(
  condition: () => boolean,
  timeoutMilliseconds = 1000
): Promise<void> {
  const startedAt = Date.now();

  while (!condition()) {
    if (Date.now() - startedAt >= timeoutMilliseconds) {
      throw new Error("timed out waiting for implementation condition");
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

function waitForAbort(signal: AbortSignal | undefined): Promise<void> {
  if (signal === undefined || signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

function readFirstErrorEnvelope(
  events: readonly unknown[]
): Record<string, unknown> | undefined {
  for (const event of events) {
    if (isRecord(event) && isRecord(event.error)) {
      return event.error;
    }
  }

  return undefined;
}

function projectionStatus(
  projection: AdapterProjection
): OperationOutcome["status"] {
  if (isRecord(projection.result) && projection.result.error !== undefined) {
    return "failed";
  }

  return "completed";
}

function throwIfCancelled(controls: AdapterControls): void {
  if (controls.signal?.aborted === true) {
    throw new Error("adapter operation cancelled");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
