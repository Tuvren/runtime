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

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventSchemas } from "@ag-ui/core";
import {
  assertTuvrenStreamEvent,
  type TuvrenStreamEvent,
} from "@tuvren/event-stream";
import { toAgUiEvents } from "@tuvren/stream-agui";
import { teeTuvrenStreamEvents } from "@tuvren/stream-core";
import { toSseFrames } from "@tuvren/stream-sse";
import {
  type AssertionContext,
  type CompiledConformancePlan,
  type ConformancePlanCheck,
  evaluateAssertions,
  loadConformancePlan,
} from "../../../../../../tools/conformance/plan-compiler/index.js";
import {
  type ConformanceCheckResult,
  type ConformanceEvidence,
  createCheckResult,
  createConformanceEvidenceSummary,
} from "../../../../../../tools/scripts/lib/conformance-contract.js";
import { emitConformanceEvidence } from "../../../../../../tools/scripts/lib/conformance-runner.js";
import {
  type AdapterControls,
  type ImplementationAdapter,
  type OperationOutcome,
  TypeScriptFrameworkAdapter,
} from "./adapter-scaffold.ts";

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../.."
);
const FRAMEWORK_AUTHORITY_PACKET_PATHS: readonly string[] = [
  "boundaries/framework/contracts/event-stream/spec/authority-packet.json",
  "boundaries/framework/contracts/runtime-api/spec/authority-packet.json",
  "boundaries/framework/contracts/driver-api/spec/authority-packet.json",
];
const IMPLEMENTATION_ID = "typescript-framework";
const LANGUAGE = "typescript";
const SUITE_ID = "tuvren.framework.promoted-authority";
const SUITE_VERSION = "0.1.0";

interface AuthorityPacketManifest {
  conformancePlans: readonly AuthorityPacketPlanReference[];
  packetId: string;
}

interface AuthorityPacketPlanReference {
  path: string;
  planId: string;
}

interface CheckRunContext {
  adapter: ImplementationAdapter;
  check: ConformancePlanCheck;
  plan: CompiledConformancePlan;
}

type OperationHandler = (
  context: CheckRunContext
) => AssertionContext | Promise<AssertionContext>;

const OPERATION_HANDLERS: Readonly<Record<string, OperationHandler>> = {
  "event-stream.agui-projection": createAgUiProjectionContext,
  "event-stream.fixture-events": createFixtureEventsContext,
  "event-stream.sse-eager-subscription": createSseEagerSubscriptionContext,
  "event-stream.sse-projection": createSseProjectionContext,
};

await main();

async function main(): Promise<void> {
  const plans = await readFrameworkPlans();
  const checkResults: ConformanceCheckResult[] = [];
  const adapter = new TypeScriptFrameworkAdapter();

  try {
    for (const plan of plans) {
      await adapter.initialize(plan.plan.packetId, plan.plan.planVersion);

      for (const check of plan.plan.checks) {
        checkResults.push(await runPlanCheck(adapter, plan, check));
      }
    }
  } finally {
    await adapter.shutdown();
  }

  const summary = createConformanceEvidenceSummary(checkResults);
  const evidence: ConformanceEvidence = {
    boundary: "framework",
    checkResults,
    implementationId: IMPLEMENTATION_ID,
    language: LANGUAGE,
    status: summary.failedChecks === 0 ? "pass" : "fail",
    suiteId: SUITE_ID,
    suiteVersion: SUITE_VERSION,
    summary,
  };

  emitConformanceEvidence(evidence);
}

async function readFrameworkPlans(): Promise<CompiledConformancePlan[]> {
  const planPaths = new Set<string>();

  for (const manifestPath of FRAMEWORK_AUTHORITY_PACKET_PATHS) {
    const manifest = await readAuthorityPacketManifest(manifestPath);

    for (const plan of manifest.conformancePlans ?? []) {
      planPaths.add(plan.path);
    }
  }

  const plans: CompiledConformancePlan[] = [];

  for (const planPath of [...planPaths].sort()) {
    plans.push(await loadConformancePlan(planPath));
  }

  return plans;
}

async function readAuthorityPacketManifest(
  manifestPath: string
): Promise<AuthorityPacketManifest> {
  const manifest: unknown = JSON.parse(
    await readFile(resolve(REPO_ROOT, manifestPath), "utf8")
  );

  if (!isRecord(manifest) || typeof manifest.packetId !== "string") {
    throw new Error(
      `${manifestPath} must contain an authority packet manifest`
    );
  }

  return readAuthorityPacketManifestValue(manifest, manifestPath);
}

function readAuthorityPacketManifestValue(
  value: unknown,
  label: string
): AuthorityPacketManifest {
  if (!isRecord(value) || typeof value.packetId !== "string") {
    throw new Error(`${label} must contain an authority packet manifest`);
  }

  const conformancePlans = readPlanReferences(
    value.conformancePlans,
    `${label}.conformancePlans`
  );

  return {
    conformancePlans,
    packetId: value.packetId,
  };
}

function readPlanReferences(
  value: unknown,
  label: string
): readonly AuthorityPacketPlanReference[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array when present`);
  }

  return value.map((entry, index) =>
    readPlanReference(entry, `${label}[${index}]`)
  );
}

function readPlanReference(
  value: unknown,
  label: string
): AuthorityPacketPlanReference {
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    typeof value.planId !== "string"
  ) {
    throw new Error(`${label} must contain planId and path strings`);
  }

  return {
    path: value.path,
    planId: value.planId,
  };
}

async function runPlanCheck(
  adapter: ImplementationAdapter,
  plan: CompiledConformancePlan,
  check: ConformancePlanCheck
): Promise<ConformanceCheckResult> {
  const handler = OPERATION_HANDLERS[check.operation];
  const context =
    handler === undefined
      ? await createAdapterOperationContext({ adapter, check, plan })
      : await handler({ adapter, check, plan });
  const details = createDetails(context);

  return createCheckResult(
    check.checkId,
    evaluateAssertions(check, context),
    details
  );
}

function createFixtureEventsContext({
  check,
  plan,
}: CheckRunContext): AssertionContext {
  return {
    events: readFixtureEvents(plan, check),
  };
}

async function createSseProjectionContext({
  check,
  plan,
}: CheckRunContext): Promise<AssertionContext> {
  const frames = await collectStreamValues(
    toSseFrames(createFixtureEventStream(readFixtureEvents(plan, check)))
  );

  return {
    evidence: {
      frameEvents: frames.map((frame) => frame.event),
      framePayloads: frames.map((frame) => parseJsonValue(frame.data)),
    },
  };
}

async function createSseEagerSubscriptionContext({
  check,
  plan,
}: CheckRunContext): Promise<AssertionContext> {
  const [sseBranch, directBranch] = teeTuvrenStreamEvents(
    createFixtureEventStream(readFixtureEvents(plan, check)),
    2
  );
  const sseFrames = toSseFrames(sseBranch);
  const directIterator = directBranch[Symbol.asyncIterator]();
  const firstDirectEvent = await directIterator.next();

  await waitForAsyncTurn();
  await directIterator.return?.();

  const frames = await collectStreamValues(sseFrames);

  return {
    evidence: {
      firstDirectEventType:
        firstDirectEvent.done === false
          ? readRecordString(firstDirectEvent.value, "type")
          : undefined,
      firstFrameEvent: frames[0]?.event,
    },
  };
}

async function createAgUiProjectionContext({
  check,
  plan,
}: CheckRunContext): Promise<AssertionContext> {
  const warningCodes: string[] = [];
  const rawEvents = await collectStreamValues(
    toAgUiEvents(createFixtureEventStream(readFixtureEvents(plan, check)), {
      onWarning(warning) {
        warningCodes.push(warning.code);
      },
    })
  );
  const events = rawEvents.map((event) => EventSchemas.parse(event));

  return {
    evidence: {
      eventTypes: events.map((event) => event.type),
      events,
      warningCodes,
    },
  };
}

async function createAdapterOperationContext({
  adapter,
  check,
  plan,
}: CheckRunContext): Promise<AssertionContext> {
  const input = createAdapterInput(plan, check);
  const controls = createAdapterControls(check);
  const outcome = await adapter.dispatch(check.operation, input, controls);
  const adapterEvents = await collectStreamValues(
    adapter.events(check.operation, input, controls)
  );
  const inspectedState =
    adapter.inspectState === undefined
      ? undefined
      : await adapter.inspectState({
          checkId: check.checkId,
          operation: check.operation,
        });

  await adapter.emitEvidence(check.checkId, "adapter.events", {
    count: adapterEvents.length,
  });

  return createAdapterAssertionContext(outcome, inspectedState);
}

function createAdapterInput(
  plan: CompiledConformancePlan,
  check: ConformancePlanCheck
): Record<string, unknown> {
  // Scenarios flow into adapter inputs only. Expected evidence, results,
  // and state remain plan assertions so the runner cannot prove itself.
  const input: Record<string, unknown> = {
    checkInput: check.input,
  };

  if (check.scenario !== undefined) {
    input.scenario = plan.scenarios.get(check.scenario);
  }

  return input;
}

function createAdapterControls(check: ConformancePlanCheck): AdapterControls {
  if (check.controls === undefined) {
    return {};
  }

  return {
    cancelAfterEvent: check.controls.cancelAfterEvent,
  };
}

function createAdapterAssertionContext(
  outcome: OperationOutcome,
  inspectedState: unknown
): AssertionContext {
  if (!isRecord(outcome.result)) {
    return {
      result: outcome.result,
      state: inspectedState ?? undefined,
    };
  }

  return {
    evidence: readOptionalRecord(outcome.result.evidence),
    result: outcome.result.result,
    state: inspectedState ?? readOptionalRecord(outcome.result.state),
  };
}

function readOptionalRecord(
  value: unknown
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error("operation context field must be an object when present");
  }

  return value;
}

function readFixtureEvents(
  plan: CompiledConformancePlan,
  check: ConformancePlanCheck
): readonly TuvrenStreamEvent[] {
  if (check.fixture === undefined) {
    throw new Error(`${check.checkId} requires a fixture`);
  }

  const fixture = plan.fixtures.get(check.fixture);
  const fixturePath = readInputString(check.input, "fixturePath");
  const value = readPath(fixture, fixturePath);

  if (!Array.isArray(value)) {
    throw new Error(`${check.checkId} fixture path must resolve to an array`);
  }

  for (const [index, event] of value.entries()) {
    assertTuvrenStreamEvent(event, `${check.checkId}.events[${index}]`);
  }

  return value;
}

function createDetails(context: AssertionContext): Record<string, unknown> {
  const details: Record<string, unknown> = {};

  if (context.events !== undefined) {
    details.eventTypes = context.events.map((event) =>
      isRecord(event) ? event.type : undefined
    );
  }

  if (context.evidence !== undefined) {
    Object.assign(details, context.evidence);
  }

  if (context.result !== undefined) {
    details.result = context.result;
  }

  if (context.state !== undefined) {
    details.state = context.state;
  }

  return details;
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

function cloneTuvrenStreamEvent(event: TuvrenStreamEvent): TuvrenStreamEvent {
  const cloned = structuredClone(event);
  assertTuvrenStreamEvent(cloned, "cloned stream event");
  return cloned;
}

async function waitForAsyncTurn(): Promise<void> {
  await Promise.resolve();
}

function parseJsonValue(value: string): unknown {
  return JSON.parse(value);
}

function readInputString(input: unknown, key: string): string {
  if (!isRecord(input) || typeof input[key] !== "string") {
    throw new Error(`check input must contain ${key}`);
  }

  return input[key];
}

function readRecordString(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === "string"
    ? value[key]
    : undefined;
}

function readPath(source: unknown, path: string): unknown {
  if (path === "$") {
    return source;
  }

  if (!path.startsWith("$.")) {
    throw new Error(`unsupported path ${path}`);
  }

  let current = source;

  for (const segment of path.slice(2).split(".")) {
    if (Array.isArray(current)) {
      const index = Number(segment);

      if (!Number.isInteger(index)) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
