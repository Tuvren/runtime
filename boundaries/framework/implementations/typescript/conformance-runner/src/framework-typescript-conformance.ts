/**
 * Copyright 2026 Oscar Yáñez Cisterna (@SkrOYC)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventSchemas, EventType } from "@ag-ui/core";
import {
  assertTuvrenStreamEvent,
  type TuvrenStreamEvent,
} from "@tuvren/event-stream";
import { toAgUiEvents } from "@tuvren/stream-agui";
import { teeTuvrenStreamEvents } from "@tuvren/stream-core";
import { toSseFrames } from "@tuvren/stream-sse";
import {
  type CompiledConformancePlan,
  type ConformancePlanCheck,
  evaluateAssertions,
  loadConformancePlan,
} from "../../../../../../tools/conformance/plan-compiler/index.js";
import {
  type ConformanceCheckResult,
  type ConformanceEvidence,
  createAssertionResult,
  createCheckResult,
  createConformanceEvidenceSummary,
} from "../../../../../../tools/scripts/lib/conformance-contract.js";
import {
  emitConformanceEvidence,
  readConformanceSuiteManifest,
  selectImplementationChecks,
} from "../../../../../../tools/scripts/lib/conformance-runner.js";

const FRAMEWORK_MANIFEST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../conformance/scenarios/suite-manifest.json"
);
const EVENT_STREAM_PLAN_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../conformance/plans/event-stream-core.json"
);
const IMPLEMENTATION_ID = "typescript-framework";
const LANGUAGE = "typescript";
let eventStreamPlan: CompiledConformancePlan | undefined;
let eventStreamFixtures: FrameworkStreamFixtureSet | undefined;

interface FrameworkStreamFixtureSet {
  completedTurn: readonly TuvrenStreamEvent[];
  failedTurn: readonly TuvrenStreamEvent[];
  pausedTurn: readonly TuvrenStreamEvent[];
}

await main();

async function main(): Promise<void> {
  const manifest = await readConformanceSuiteManifest(FRAMEWORK_MANIFEST_PATH);
  const checkResults: ConformanceCheckResult[] = [];

  for (const check of selectImplementationChecks(manifest, IMPLEMENTATION_ID)) {
    checkResults.push(await runCheck(check.checkId));
  }

  const summary = createConformanceEvidenceSummary(checkResults);
  const evidence: ConformanceEvidence = {
    boundary: manifest.boundary,
    checkResults,
    implementationId: IMPLEMENTATION_ID,
    language: LANGUAGE,
    status: summary.failedChecks === 0 ? "pass" : "fail",
    suiteId: manifest.suiteId,
    suiteVersion: manifest.suiteVersion,
    summary,
  };

  emitConformanceEvidence(evidence);
}

function runCheck(checkId: string): Promise<ConformanceCheckResult> {
  switch (checkId) {
    case "framework.stream.completed_turn_sequence":
      return createCompletedTurnSequenceCheck();
    case "framework.stream.failed_turn_terminal_error":
      return createFailedTurnCheck();
    case "framework.stream.paused_turn_approval_shape":
      return createPausedTurnCheck();
    case "framework.stream.sse_projection":
      return createSseProjectionCheck();
    case "framework.stream.sse_eager_subscription":
      return createSseEagerSubscriptionCheck();
    case "framework.stream.agui_projection":
      return createAgUiProjectionCheck();
    case "framework.stream.agui_failed_turn_error_projection":
      return createAgUiFailedTurnCheck();
    case "framework.stream.agui_paused_turn_fallback":
      return createAgUiPausedTurnCheck();
    default:
      throw new Error(`unsupported framework conformance check ${checkId}`);
  }
}

async function createCompletedTurnSequenceCheck(): Promise<ConformanceCheckResult> {
  const planCheck = await readEventStreamPlanCheck(0);
  const fixtures = await readEventStreamFixtures();
  const eventTypes = fixtures.completedTurn.map((event) => event.type);

  return createCheckResult(
    "framework.stream.completed_turn_sequence",
    evaluateAssertions(planCheck, {
      events: fixtures.completedTurn,
    }),
    {
      eventTypes,
    }
  );
}

async function createFailedTurnCheck(): Promise<ConformanceCheckResult> {
  const planCheck = await readEventStreamPlanCheck(1);
  const fixtures = await readEventStreamFixtures();
  const terminalEvent = fixtures.failedTurn.at(-1);

  return createCheckResult(
    "framework.stream.failed_turn_terminal_error",
    evaluateAssertions(planCheck, {
      events: fixtures.failedTurn,
    }),
    {
      failedStatus:
        terminalEvent?.type === "turn.end" ? terminalEvent.status : undefined,
    }
  );
}

async function createPausedTurnCheck(): Promise<ConformanceCheckResult> {
  const planCheck = await readEventStreamPlanCheck(2);
  const fixtures = await readEventStreamFixtures();
  const approvalEvent = fixtures.pausedTurn[1];

  return createCheckResult(
    "framework.stream.paused_turn_approval_shape",
    evaluateAssertions(planCheck, {
      events: fixtures.pausedTurn,
    }),
    {
      approvalNames:
        approvalEvent?.type === "approval.requested"
          ? approvalEvent.request.toolCalls.map((toolCall) => toolCall.name)
          : [],
    }
  );
}

async function readEventStreamFixtures(): Promise<FrameworkStreamFixtureSet> {
  if (eventStreamFixtures !== undefined) {
    return eventStreamFixtures;
  }

  const plan = await readEventStreamPlan();
  const fixture = plan.fixtures.get("stream-events");

  // This TypeScript projection validates loaded JSON bytes only; fixture
  // authority remains the conformance plan and boundary-owned fixture file.
  assertFrameworkStreamFixtureSet(fixture, "stream-events fixture");
  eventStreamFixtures = fixture;
  return eventStreamFixtures;
}

async function readEventStreamPlan(): Promise<CompiledConformancePlan> {
  eventStreamPlan ??= await loadConformancePlan(EVENT_STREAM_PLAN_PATH);
  return eventStreamPlan;
}

async function readEventStreamPlanCheck(
  index: number
): Promise<ConformancePlanCheck> {
  const plan = await readEventStreamPlan();
  // Keep promoted semantic check ids in the conformance plan. The runner keeps
  // legacy suite-manifest ids only as compatibility evidence labels.
  const planCheck = plan.plan.checks[index];

  if (planCheck === undefined) {
    throw new Error(`event-stream conformance plan is missing check ${index}`);
  }

  return planCheck;
}

async function createSseProjectionCheck(): Promise<ConformanceCheckResult> {
  const fixtures = await readEventStreamFixtures();
  const frames = await collectStreamValues(
    toSseFrames(createFixtureEventStream(fixtures.completedTurn))
  );
  const firstFrame = frames[0];
  const toolResultFrame = frames.find((frame) =>
    frame.data.includes('"type":"tool.result"')
  );

  return createCheckResult(
    "framework.stream.sse_projection",
    [
      createAssertionResult(
        "sse_turn_start_event",
        firstFrame?.event === "turn.start" &&
          firstFrame.data.includes('"type":"turn.start"')
      ),
      createAssertionResult(
        "sse_tool_result_payload",
        toolResultFrame?.event === "tool.result" &&
          toolResultFrame.data.includes('"hits":2')
      ),
    ],
    {
      frameEvents: frames.map((frame) => frame.event ?? "message"),
    }
  );
}

async function createSseEagerSubscriptionCheck(): Promise<ConformanceCheckResult> {
  const fixtures = await readEventStreamFixtures();
  const [sseBranch, directBranch] = teeTuvrenStreamEvents(
    createFixtureEventStream(fixtures.completedTurn),
    2
  );
  const sseFrames = toSseFrames(sseBranch);
  const directIterator = directBranch[Symbol.asyncIterator]();
  const firstDirectEvent = await directIterator.next();

  await waitForAsyncTurn();
  await directIterator.return?.();

  const frames = await collectStreamValues(sseFrames);

  return createCheckResult("framework.stream.sse_eager_subscription", [
    createAssertionResult(
      "sse_preserves_turn_start_after_delayed_poll",
      firstDirectEvent.done === false &&
        firstDirectEvent.value.type === "turn.start" &&
        frames[0]?.event === "turn.start"
    ),
  ]);
}

async function createAgUiProjectionCheck(): Promise<ConformanceCheckResult> {
  const fixtures = await readEventStreamFixtures();
  const warnings: string[] = [];
  const events = await collectStreamValues(
    toAgUiEvents(createFixtureEventStream(fixtures.completedTurn), {
      onWarning(warning) {
        warnings.push(warning.code);
      },
    })
  );
  const aguiTypes = events.map((event) => EventSchemas.parse(event).type);
  const stateSnapshot = events.find(
    (event) => event.type === EventType.STATE_SNAPSHOT
  );

  return createCheckResult(
    "framework.stream.agui_projection",
    [
      createAssertionResult(
        "agui_completed_turn_event_types",
        arraysAreEqual(aguiTypes, [
          EventType.RUN_STARTED,
          EventType.STEP_STARTED,
          EventType.TEXT_MESSAGE_START,
          EventType.TEXT_MESSAGE_CONTENT,
          EventType.TEXT_MESSAGE_END,
          EventType.TOOL_CALL_START,
          EventType.TOOL_CALL_ARGS,
          EventType.TOOL_CALL_END,
          EventType.CUSTOM,
          EventType.TOOL_CALL_RESULT,
          EventType.STATE_SNAPSHOT,
          EventType.CUSTOM,
          EventType.CUSTOM,
          EventType.STEP_FINISHED,
          EventType.RUN_FINISHED,
        ])
      ),
      createAssertionResult(
        "agui_completed_turn_state_snapshot",
        stateSnapshot?.type === EventType.STATE_SNAPSHOT &&
          stateSnapshot.snapshot.contextManifest !== undefined
      ),
    ],
    {
      aguiTypes,
      warningCodes: warnings,
    }
  );
}

async function createAgUiFailedTurnCheck(): Promise<ConformanceCheckResult> {
  const fixtures = await readEventStreamFixtures();
  const events = await collectStreamValues(
    toAgUiEvents(createFixtureEventStream(fixtures.failedTurn))
  );
  const runError = events[1];

  return createCheckResult(
    "framework.stream.agui_failed_turn_error_projection",
    [
      createAssertionResult(
        "agui_failed_turn_run_error",
        runError?.type === EventType.RUN_ERROR &&
          runError.code === "runtime_execution_cancelled"
      ),
    ],
    {
      errorCode: runError?.type === EventType.RUN_ERROR ? runError.code : null,
    }
  );
}

async function createAgUiPausedTurnCheck(): Promise<ConformanceCheckResult> {
  const fixtures = await readEventStreamFixtures();
  const warnings: string[] = [];
  const events = await collectStreamValues(
    toAgUiEvents(createFixtureEventStream(fixtures.pausedTurn), {
      onWarning(warning) {
        warnings.push(warning.code);
      },
    })
  );
  const pausedEvent = events.find(
    (event) =>
      event.type === EventType.CUSTOM &&
      event.name === "tuvren.runtime.turn.paused"
  );

  return createCheckResult(
    "framework.stream.agui_paused_turn_fallback",
    [
      createAssertionResult(
        "agui_paused_turn_event_types",
        arraysAreEqual(
          events.map((event) => event.type),
          [
            EventType.RUN_STARTED,
            EventType.CUSTOM,
            EventType.CUSTOM,
            EventType.RUN_FINISHED,
          ]
        )
      ),
      createAssertionResult(
        "agui_paused_turn_custom_payload",
        pausedEvent?.type === EventType.CUSTOM &&
          JSON.stringify(pausedEvent.rawEvent) ===
            JSON.stringify(fixtures.pausedTurn[2])
      ),
    ],
    {
      warningCodes: warnings,
    }
  );
}

function arraysAreEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

async function collectStreamValues<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];

  for await (const value of values) {
    collected.push(value);
  }

  return collected;
}

function createFixtureEventStream(
  events: readonly TuvrenStreamEvent[]
): AsyncIterable<TuvrenStreamEvent> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<TuvrenStreamEvent> {
      await Promise.resolve();

      for (const event of events) {
        yield cloneTuvrenStreamEvent(event);
      }
    },
  };
}

async function waitForAsyncTurn(): Promise<void> {
  await Promise.resolve();
}

function assertFrameworkStreamFixtureSet(
  value: unknown,
  label: string
): asserts value is FrameworkStreamFixtureSet {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  assertTuvrenStreamEvents(value.completedTurn, `${label}.completedTurn`);
  assertTuvrenStreamEvents(value.failedTurn, `${label}.failedTurn`);
  assertTuvrenStreamEvents(value.pausedTurn, `${label}.pausedTurn`);
}

function assertTuvrenStreamEvents(
  value: unknown,
  label: string
): asserts value is readonly TuvrenStreamEvent[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  for (const [index, event] of value.entries()) {
    assertTuvrenStreamEvent(event, `${label}[${index}]`);
  }
}

function cloneTuvrenStreamEvent(event: TuvrenStreamEvent): TuvrenStreamEvent {
  const cloned = structuredClone(event);
  assertTuvrenStreamEvent(cloned, "cloned stream event");
  return cloned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
