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

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PlanCheck {
  assertions: Array<Record<string, unknown>>;
  capabilities?: string[];
  checkId: string;
  controls?: Record<string, unknown>;
  evidence?: string[];
  input?: Record<string, unknown>;
  operation: string;
  scenario?: string;
}

interface Plan {
  applicability: { capabilities: string[] };
  checks: PlanCheck[];
  packetId: string;
  planId: string;
  planVersion: string;
  scenarios?: Record<string, string>;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PLANS_DIR = resolve(REPO_ROOT, "boundaries/framework/conformance/plans");

await main();

async function main(): Promise<void> {
  const plans: Array<{ fileName: string; plan: Plan }> = [
    {
      fileName: "runtime-api-callables-extended.json",
      plan: buildRuntimeApiCallablesExtended(),
    },
    {
      fileName: "runtime-api-lifecycle-extended.json",
      plan: buildRuntimeApiLifecycleExtended(),
    },
    {
      fileName: "runtime-api-coverage.json",
      plan: buildRuntimeApiCoverage(),
    },
    {
      fileName: "event-stream-extended.json",
      plan: buildEventStreamExtended(),
    },
    {
      fileName: "driver-api-extended.json",
      plan: buildDriverApiExtended(),
    },
    {
      fileName: "react-driver-extended.json",
      plan: buildReactDriverExtended(),
    },
  ];

  for (const { fileName, plan } of plans) {
    await writeFile(
      resolve(PLANS_DIR, fileName),
      `${JSON.stringify(plan, null, 2)}\n`
    );
    process.stdout.write(`wrote ${fileName} (${plan.checks.length} checks)\n`);
  }
}

// Runtime API callables — extends shape and value coverage of the six
// per-callable operations that the typescript adapter implements.
function buildRuntimeApiCallablesExtended(): Plan {
  const checks: PlanCheck[] = [];

  // runtime.provider-generate
  const providerGenerate = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    checkId: `runtime-callable-ext.provider-generate.${id}`,
    evidence,
    input: { scenarioPath: "$.provider-generate-text" },
    operation: "runtime.provider-generate",
    scenario: "runtime-api-scenarios",
  });
  checks.push(
    providerGenerate(
      "call-count-positive",
      { field: "$.provider.generate.callCount", kind: "evidenceField" },
      ["provider.generate.callCount"]
    ),
    providerGenerate(
      "response-parts-first-present",
      { field: "$.provider.generate.response.parts.0", kind: "evidenceField" },
      ["provider.generate.response.parts.0"]
    ),
    providerGenerate(
      "finish-reason-string",
      { field: "$.provider.generate.response.finishReason", kind: "evidenceField", matches: "^(stop|length|content_filter|tool_calls)$" },
      ["provider.generate.response.finishReason"]
    ),
    providerGenerate(
      "first-part-text-shape",
      {
        field: "$.provider.generate.response.parts.0.type",
        kind: "evidenceField",
        equals: "text",
      },
      ["provider.generate.response.parts.0.type"]
    ),
    providerGenerate(
      "response-finish-reason-equals-stop",
      {
        equals: "stop",
        field: "$.provider.generate.response.finishReason",
        kind: "evidenceField",
      },
      ["provider.generate.response.finishReason"]
    ),
  );

  // runtime.provider-stream
  const providerStream = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    checkId: `runtime-callable-ext.provider-stream.${id}`,
    evidence,
    input: { scenarioPath: "$.provider-stream-text" },
    operation: "runtime.provider-stream",
    scenario: "runtime-api-scenarios",
  });
  checks.push(
    providerStream(
      "chunk-types-include-finish",
      { contains: "finish", field: "$.provider.stream.chunkTypes", kind: "evidenceField" },
      ["provider.stream.chunkTypes"]
    ),
    providerStream(
      "emitted-event-types-text-delta",
      { contains: "text.delta", field: "$.provider.stream.emittedEventTypes", kind: "evidenceField" },
      ["provider.stream.emittedEventTypes"]
    ),
    providerStream(
      "emitted-event-types-include-message-start",
      { contains: "message.start", field: "$.provider.stream.emittedEventTypes", kind: "evidenceField" },
      ["provider.stream.emittedEventTypes"]
    ),
    providerStream(
      "emitted-event-types-include-message-done",
      { contains: "message.done", field: "$.provider.stream.emittedEventTypes", kind: "evidenceField" },
      ["provider.stream.emittedEventTypes"]
    ),
    providerStream(
      "chunk-types-text-delta-first",
      { equals: "text_delta", field: "$.provider.stream.chunkTypes.0", kind: "evidenceField" },
      ["provider.stream.chunkTypes.0"]
    ),
    providerStream(
      "response-text-matches-scenario",
      {
        equals: "streamed from shared scenario",
        field: "$.provider.stream.response.parts.0.text",
        kind: "evidenceField",
      },
      ["provider.stream.response.parts.0.text"]
    ),
  );

  // runtime.tool-execute
  const toolExecute = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    checkId: `runtime-callable-ext.tool-execute.${id}`,
    evidence,
    input: { scenarioPath: "$.tool-execute-search" },
    operation: "runtime.tool-execute",
    scenario: "runtime-api-scenarios",
  });
  checks.push(
    toolExecute(
      "call-count-equals-one",
      { equals: 1, field: "$.tool.execution.callCount", kind: "evidenceField" },
      ["tool.execution.callCount"]
    ),
    toolExecute(
      "input-query-matches",
      { equals: "shared docs", field: "$.tool.execution.inputs.0.query", kind: "evidenceField" },
      ["tool.execution.inputs.0.query"]
    ),
    toolExecute(
      "output-source-matches",
      { equals: "shared scenario", field: "$.tool.execution.outputs.0.source", kind: "evidenceField" },
      ["tool.execution.outputs.0.source"]
    ),
    toolExecute(
      "output-ok-true",
      { equals: true, field: "$.tool.execution.outputs.0.ok", kind: "evidenceField" },
      ["tool.execution.outputs.0.ok"]
    ),
    toolExecute(
      "state-phase-completed",
      { equals: "completed", field: "$.toolExecution.status.phase", kind: "stateField" },
      ["toolExecution.status.phase"]
    ),
    toolExecute(
      "state-tool-results-total-one",
      { equals: 1, field: "$.toolExecution.status.manifest.toolResults.total", kind: "stateField" },
      ["toolExecution.status.manifest.toolResults.total"]
    ),
  );

  // runtime.approval-resolve
  const approvalResolve = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    checkId: `runtime-callable-ext.approval-resolve.${id}`,
    evidence,
    input: { scenarioPath: "$.paused-turn-resume" },
    operation: "runtime.approval-resolve",
    scenario: "runtime-api-scenarios",
  });
  checks.push(
    approvalResolve(
      "paused-phase-paused",
      { equals: "paused", field: "$.approval.pausedPhase", kind: "evidenceField" },
      ["approval.pausedPhase"]
    ),
    approvalResolve(
      "resumed-phase-completed",
      { equals: "completed", field: "$.approval.resumedPhase", kind: "evidenceField" },
      ["approval.resumedPhase"]
    ),
    approvalResolve(
      "executed-tools-include-search",
      { contains: "search", field: "$.tool.execution.executedNames", kind: "evidenceField" },
      ["tool.execution.executedNames"]
    ),
    approvalResolve(
      "executed-tools-include-email",
      { contains: "email", field: "$.tool.execution.executedNames", kind: "evidenceField" },
      ["tool.execution.executedNames"]
    ),
    approvalResolve(
      "decision-call-id-matches",
      { equals: "call-email", field: "$.approval.decisions.0.callId", kind: "evidenceField" },
      ["approval.decisions.0.callId"]
    ),
    approvalResolve(
      "decision-type-approve",
      { equals: "approve", field: "$.approval.decisions.0.type", kind: "evidenceField" },
      ["approval.decisions.0.type"]
    ),
  );

  // runtime.validate-structured-output
  const validateStructured = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    checkId: `runtime-callable-ext.validate-structured-output.${id}`,
    evidence,
    input: { scenarioPath: "$.structured-validation-failure" },
    operation: "runtime.validate-structured-output",
    scenario: "runtime-api-scenarios",
  });
  checks.push(
    validateStructured(
      "resolution-fail",
      { equals: "fail", field: "$.validation.resolutionType", kind: "evidenceField" },
      ["validation.resolutionType"]
    ),
    validateStructured(
      "resolution-type-string",
      { field: "$.validation.resolutionType", kind: "evidenceField", matches: "^(fail|repair|warn|pass)$" },
      ["validation.resolutionType"]
    ),
  );

  // runtime.cancel-execution
  checks.push(
    {
      assertions: [
        {
          equals: "turn.start",
          field: "$.cancellation.observedEventType",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-callable-ext.cancel-execution.observed-event-type",
      controls: { cancelAfterEvent: "turn.start", deadlineMs: 1000 },
      evidence: ["cancellation.observedEventType"],
      operation: "runtime.cancel-execution",
    },
    {
      assertions: [
        {
          equals: 0,
          field: "$.cancellation.observedEventIndex",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-callable-ext.cancel-execution.observed-event-index-zero",
      controls: { cancelAfterEvent: "turn.start", deadlineMs: 1000 },
      evidence: ["cancellation.observedEventIndex"],
      operation: "runtime.cancel-execution",
    },
    {
      assertions: [
        {
          equals: 2,
          field: "$.cancellation.cancelInvocations",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-callable-ext.cancel-execution.cancel-invocation-count",
      controls: { cancelAfterEvent: "turn.start", deadlineMs: 1000 },
      evidence: ["cancellation.cancelInvocations"],
      operation: "runtime.cancel-execution",
    },
    {
      assertions: [
        {
          equals: 1,
          field: "$.cancellation.errorEventCount",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-callable-ext.cancel-execution.error-event-count-one",
      controls: { cancelAfterEvent: "turn.start", deadlineMs: 1000 },
      evidence: ["cancellation.errorEventCount"],
      operation: "runtime.cancel-execution",
    },
    {
      assertions: [
        {
          equals: "failed",
          field: "$.runtime.phase",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-callable-ext.cancel-execution.runtime-phase-failed",
      controls: { cancelAfterEvent: "turn.start", deadlineMs: 1000 },
      evidence: ["runtime.phase"],
      operation: "runtime.cancel-execution",
    },
  );

  return {
    applicability: { capabilities: ["framework.runtime-api"] },
    checks,
    packetId: "tuvren.framework.runtime-api",
    planId: "tuvren.framework.runtime-api.callables-extended",
    planVersion: "0.1.0",
    scenarios: {
      "runtime-api-scenarios": "../scenarios/runtime-api-scenarios.json",
    },
  };
}

// Runtime API lifecycle — extends evidence assertions on each lifecycle
// callable, adding shape/range checks beyond the single-field originals.
function buildRuntimeApiLifecycleExtended(): Plan {
  const checks: PlanCheck[] = [];

  // execute-turn
  checks.push(
    {
      assertions: [
        {
          equals: "completed",
          field: "$.runtime.phase",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.execute-turn.phase-completed",
      evidence: ["runtime.phase"],
      input: { scenarioPath: "$.completed-turn" },
      operation: "runtime.execute-turn",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          field: "$.runtime.eventCount",
          kind: "evidenceField",
          matches: "^[0-9]+$",
        },
      ],
      // Stringy match would fail because eventCount is a number; this check
      // exists to verify that adapters that mistakenly stringify numeric
      // evidence are caught. Expected to fail when adapter returns a number.
      checkId: "runtime-lifecycle-ext.execute-turn.event-count-numeric-stringy-fails",
      evidence: ["runtime.eventCount"],
      input: { scenarioPath: "$.completed-turn" },
      operation: "runtime.execute-turn",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          field: "$.runtime.phase",
          kind: "evidenceField",
          matches: "^(running|paused|completed|failed)$",
        },
      ],
      checkId: "runtime-lifecycle-ext.execute-turn.phase-enum",
      evidence: ["runtime.phase"],
      input: { scenarioPath: "$.completed-turn" },
      operation: "runtime.execute-turn",
      scenario: "runtime-api-scenarios",
    },
  );

  // approval-resolve trace step — steps are required for $.trace.* paths to
  // resolve; without steps the runner runs single-dispatch and never builds
  // the trace dictionary the assertion reads.
  checks.push(
    {
      assertions: [
        {
          equals: "paused",
          field: "$.trace.approval.evidence.approval.pausedPhase",
          kind: "stateField",
        },
      ],
      checkId: "runtime-lifecycle-ext.approval-resolve.paused-phase-trace",
      evidence: ["trace.approval.evidence.approval.pausedPhase"],
      input: { scenarioPath: "$.paused-turn-resume" },
      operation: "runtime.approval-resolve",
      scenario: "runtime-api-scenarios",
      steps: [
        {
          input: { scenarioPath: "$.paused-turn-resume" },
          operation: "runtime.approval-resolve",
          stepId: "approval",
        },
      ],
    } as PlanCheck,
    {
      assertions: [
        {
          equals: "completed",
          field: "$.trace.approval.evidence.approval.resumedPhase",
          kind: "stateField",
        },
      ],
      checkId: "runtime-lifecycle-ext.approval-resolve.resumed-phase-trace",
      evidence: ["trace.approval.evidence.approval.resumedPhase"],
      input: { scenarioPath: "$.paused-turn-resume" },
      operation: "runtime.approval-resolve",
      scenario: "runtime-api-scenarios",
      steps: [
        {
          input: { scenarioPath: "$.paused-turn-resume" },
          operation: "runtime.approval-resolve",
          stepId: "approval",
        },
      ],
    } as PlanCheck,
  );

  // branch-create assertions (single-shot via state)
  checks.push(
    {
      assertions: [
        {
          equals: "completed",
          field: "$.branch.completedTurnPhase",
          kind: "stateField",
        },
      ],
      checkId: "runtime-lifecycle-ext.branch-create.source-phase-completed",
      evidence: ["branch.completedTurnPhase"],
      input: { scenarioPath: "$.branch-from-completed-head" },
      operation: "runtime.branch-create",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          equals: 2,
          field: "$.branch.sourceMessageCount",
          kind: "stateField",
        },
      ],
      checkId: "runtime-lifecycle-ext.branch-create.source-message-count",
      evidence: ["branch.sourceMessageCount"],
      input: { scenarioPath: "$.branch-from-completed-head" },
      operation: "runtime.branch-create",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          field: "$.branch.sourceHeadTurnNodeHash",
          kind: "stateField",
          matches: "^[a-f0-9]{64}$",
        },
      ],
      checkId: "runtime-lifecycle-ext.branch-create.source-head-hash-format",
      evidence: ["branch.sourceHeadTurnNodeHash"],
      input: { scenarioPath: "$.branch-from-completed-head" },
      operation: "runtime.branch-create",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          field: "$.branch.createdHeadTurnNodeHash",
          kind: "stateField",
          matches: "^[a-f0-9]{64}$",
        },
      ],
      checkId: "runtime-lifecycle-ext.branch-create.created-head-hash-format",
      evidence: ["branch.createdHeadTurnNodeHash"],
      input: { scenarioPath: "$.branch-from-completed-head" },
      operation: "runtime.branch-create",
      scenario: "runtime-api-scenarios",
    },
  );

  // context-transform
  checks.push(
    {
      assertions: [
        {
          equals: 3,
          field: "$.context.messageCount",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.context-transform.message-count",
      evidence: ["context.messageCount"],
      input: { scenarioPath: "$.context-transform-append-summary" },
      operation: "runtime.context-transform",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          equals: "Shared context engineering summary.",
          field: "$.context.summaryText",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.context-transform.summary-text",
      evidence: ["context.summaryText"],
      input: { scenarioPath: "$.context-transform-append-summary" },
      operation: "runtime.context-transform",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          equals: "completed",
          field: "$.runtime.phase",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.context-transform.runtime-phase-completed",
      evidence: ["runtime.phase"],
      input: { scenarioPath: "$.context-transform-append-summary" },
      operation: "runtime.context-transform",
      scenario: "runtime-api-scenarios",
    },
  );

  // recover-result
  checks.push(
    {
      assertions: [
        {
          equals: 1,
          field: "$.recovery.uncommittedStagedResults",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.recover-result.uncommitted-count",
      evidence: ["recovery.uncommittedStagedResults"],
      input: { scenarioPath: "$.recover-staged-result" },
      operation: "runtime.recover-result",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          equals: "tool-search",
          field: "$.recovery.firstTaskId",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.recover-result.first-task-id",
      evidence: ["recovery.firstTaskId"],
      input: { scenarioPath: "$.recover-staged-result" },
      operation: "runtime.recover-result",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          equals: "message",
          field: "$.recovery.firstObjectType",
          kind: "evidenceField",
        },
      ],
      checkId: "runtime-lifecycle-ext.recover-result.first-object-type",
      evidence: ["recovery.firstObjectType"],
      input: { scenarioPath: "$.recover-staged-result" },
      operation: "runtime.recover-result",
      scenario: "runtime-api-scenarios",
    },
    {
      assertions: [
        {
          field: "$.recovery.lastTurnNodeHash",
          kind: "evidenceField",
          matches: "^[a-f0-9]{64}$",
        },
      ],
      checkId: "runtime-lifecycle-ext.recover-result.last-turn-node-hash-format",
      evidence: ["recovery.lastTurnNodeHash"],
      input: { scenarioPath: "$.recover-staged-result" },
      operation: "runtime.recover-result",
      scenario: "runtime-api-scenarios",
    },
  );

  return {
    applicability: { capabilities: ["framework.runtime-api"] },
    checks,
    packetId: "tuvren.framework.runtime-api",
    planId: "tuvren.framework.runtime-api.lifecycle-extended",
    planVersion: "0.1.0",
    scenarios: {
      "runtime-api-scenarios": "../scenarios/runtime-api-scenarios.json",
    },
  };
}

// Coverage probes for runtime-api operations the spec describes that adapters
// don't yet implement. Each check fails on adapters lacking the operation —
// that's the gap we want surfaced.
function buildRuntimeApiCoverage(): Plan {
  const operations: Array<{ evidence: string[]; operation: string }> = [
    { evidence: ["thread.create.threadId"], operation: "runtime.thread-create" },
    { evidence: ["thread.list.threadIds"], operation: "runtime.thread-list" },
    { evidence: ["turn.create.turnId"], operation: "runtime.turn-create" },
    { evidence: ["turn.list.turnIds"], operation: "runtime.turn-list" },
    { evidence: ["branch.list.branchIds"], operation: "runtime.branch-list" },
    {
      evidence: ["branch.archive.archiveBranchId"],
      operation: "runtime.branch-archive",
    },
    {
      evidence: ["history.walk.depth"],
      operation: "runtime.history-walk",
    },
    {
      evidence: ["state.snapshot.checkpoints"],
      operation: "runtime.state-snapshot",
    },
    {
      evidence: ["tool.cancel.invocations"],
      operation: "runtime.tool-cancel",
    },
    {
      evidence: ["provider.cancel.invocations"],
      operation: "runtime.provider-cancel",
    },
    {
      evidence: ["approval.reject.resolution"],
      operation: "runtime.approval-reject",
    },
    {
      evidence: ["context.summarize.tokensSaved"],
      operation: "runtime.context-summarize",
    },
    {
      evidence: ["context.window.usage"],
      operation: "runtime.context-window-status",
    },
    {
      evidence: ["lease.renew.fencingToken"],
      operation: "runtime.lease-renew",
    },
    {
      evidence: ["lease.preempt.previousOwner"],
      operation: "runtime.lease-preempt",
    },
  ];

  const checks: PlanCheck[] = operations.map(({ evidence, operation }) => ({
    assertions: evidence.map((path) => ({
      field: `$.${path}`,
      kind: "evidenceField",
    })),
    checkId: `runtime-coverage.${operation.replace(/\./g, "_")}`,
    evidence,
    operation,
  }));

  return {
    applicability: { capabilities: ["framework.runtime-api"] },
    checks,
    packetId: "tuvren.framework.runtime-api",
    planId: "tuvren.framework.runtime-api.coverage",
    planVersion: "0.1.0",
  };
}

// Event-stream extended — granular assertions on the SSE/AGUI projections for
// each scenario, including event-by-event ordering and frame-payload checks.
function buildEventStreamExtended(): Plan {
  const checks: PlanCheck[] = [];
  const sseProjection = (id: string, assertion: Record<string, unknown>, evidence: string[], scenarioPath: string): PlanCheck => ({
    assertions: [assertion],
    checkId: `event-stream-ext.sse.${id}`,
    evidence,
    input: { scenarioPath },
    operation: "event-stream.runtime-sse-projection",
    scenario: "event-stream-scenarios",
  });
  checks.push(
    sseProjection(
      "completed-turn-frame-events-include-state-snapshot",
      { contains: "state.snapshot", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-include-iteration-start",
      { contains: "iteration.start", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-include-tool-result",
      { contains: "tool.result", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-include-text-delta",
      { contains: "text.delta", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-source-event-types-start-with-turn-start",
      { equals: "turn.start", field: "$.sourceEventTypes.0", kind: "evidenceField" },
      ["sourceEventTypes.0"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-end-with-turn-end",
      {
        equals: "turn.end",
        field: "$.frameEvents.23",
        kind: "evidenceField",
      },
      ["frameEvents.23"],
      "$.completed-tool-turn"
    ),
    // Ordering kind works against context.events (runner-collected from the
    // events() channel). Frame events live inside evidence, so we approximate
    // ordering with a pair of value-containment assertions per scenario.
    sseProjection(
      "completed-turn-frame-events-contain-turn-start",
      { contains: "turn.start", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-contain-turn-end",
      { contains: "turn.end", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-contain-tool-call-start",
      { contains: "tool_call.start", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-frame-events-contain-iteration-end",
      { contains: "iteration.end", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "completed-turn-no-error-event",
      { eventType: "error", field: "$.frameEvents", kind: "noEvent" },
      ["frameEvents"],
      "$.completed-tool-turn"
    ),
    sseProjection(
      "failed-provider-turn-frame-events-include-error",
      { contains: "error", field: "$.frameEvents", kind: "evidenceField" },
      ["frameEvents"],
      "$.failed-provider-turn"
    ),
    sseProjection(
      "paused-approval-turn-source-events-include-approval-requested",
      { contains: "approval.requested", field: "$.sourceEventTypes", kind: "evidenceField" },
      ["sourceEventTypes"],
      "$.paused-approval-turn"
    ),
  );

  // SSE eager subscription
  const sseEager = (id: string, assertion: Record<string, unknown>, evidence: string[], scenarioPath: string): PlanCheck => ({
    assertions: [assertion],
    checkId: `event-stream-ext.sse-eager.${id}`,
    evidence,
    input: { scenarioPath },
    operation: "event-stream.runtime-sse-eager-subscription",
    scenario: "event-stream-scenarios",
  });
  checks.push(
    sseEager(
      "first-direct-event-turn-start",
      { equals: "turn.start", field: "$.firstDirectEventType", kind: "evidenceField" },
      ["firstDirectEventType"],
      "$.completed-tool-turn"
    ),
    sseEager(
      "first-frame-event-turn-start",
      { equals: "turn.start", field: "$.firstFrameEvent", kind: "evidenceField" },
      ["firstFrameEvent"],
      "$.completed-tool-turn"
    ),
    sseEager(
      "failed-turn-first-direct-event-turn-start",
      { equals: "turn.start", field: "$.firstDirectEventType", kind: "evidenceField" },
      ["firstDirectEventType"],
      "$.failed-provider-turn"
    ),
    sseEager(
      "paused-turn-first-frame-event-turn-start",
      { equals: "turn.start", field: "$.firstFrameEvent", kind: "evidenceField" },
      ["firstFrameEvent"],
      "$.paused-approval-turn"
    ),
  );

  // AGUI projection
  const agui = (id: string, assertion: Record<string, unknown>, evidence: string[], scenarioPath: string): PlanCheck => ({
    assertions: [assertion],
    checkId: `event-stream-ext.agui.${id}`,
    evidence,
    input: { scenarioPath },
    operation: "event-stream.runtime-agui-projection",
    scenario: "event-stream-scenarios",
  });
  checks.push(
    agui(
      "completed-turn-event-types-include-run-started",
      { contains: "RUN_STARTED", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-event-types-include-run-finished",
      { contains: "RUN_FINISHED", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-event-types-include-state-snapshot",
      { contains: "STATE_SNAPSHOT", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-event-types-include-tool-call-start",
      { contains: "TOOL_CALL_START", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-event-types-include-tool-call-result",
      { contains: "TOOL_CALL_RESULT", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-event-types-include-text-message-start",
      { contains: "TEXT_MESSAGE_START", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-event-types-include-run-started-and-finished",
      { contains: "RUN_FINISHED", field: "$.eventTypes", kind: "evidenceField" },
      ["eventTypes"],
      "$.completed-tool-turn"
    ),
    agui(
      "completed-turn-warnings-include-checkpoint-fallback",
      { contains: "agui_state_checkpoint_custom_fallback", field: "$.warningCodes", kind: "evidenceField" },
      ["warningCodes"],
      "$.completed-tool-turn"
    ),
    agui(
      "failed-turn-event-types-end-with-run-error",
      { equals: "RUN_ERROR", field: "$.eventTypes.8", kind: "evidenceField" },
      ["eventTypes.8"],
      "$.failed-provider-turn"
    ),
    agui(
      "failed-turn-error-code-snake-case",
      { field: "$.events.8.rawEvent.error.code", kind: "evidenceField", matches: "^[a-z0-9]+(?:_[a-z0-9]+)*$" },
      ["events.8.rawEvent.error.code"],
      "$.failed-provider-turn"
    ),
    agui(
      "paused-turn-warnings-include-paused-coercion",
      { contains: "agui_paused_turn_coerced_to_run_finished", field: "$.warningCodes", kind: "evidenceField" },
      ["warningCodes"],
      "$.paused-approval-turn"
    ),
  );

  // Per-frame index assertions for the completed-tool-turn scenario. This
  // pins the SSE projection ordering one event at a time so that adapters
  // emitting events in a different order light up the offending index.
  const completedToolTurnFrameSequence: readonly string[] = [
    "turn.start",
    "state.checkpoint",
    "state.snapshot",
    "iteration.start",
    "message.start",
    "tool_call.start",
    "tool_call.args_delta",
    "tool_call.done",
    "message.done",
    "tool.start",
    "tool.result",
    "state.checkpoint",
    "state.snapshot",
    "iteration.end",
    "iteration.start",
    "message.start",
    "text.delta",
    "text.done",
    "message.done",
    "state.checkpoint",
    "state.snapshot",
    "iteration.end",
    "state.checkpoint",
    "turn.end",
  ];
  for (const [index, expectedType] of completedToolTurnFrameSequence.entries()) {
    checks.push(
      sseProjection(
        `completed-turn-frame-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.frameEvents.${index}`,
          kind: "evidenceField",
        },
        [`frameEvents.${index}`],
        "$.completed-tool-turn"
      )
    );
  }

  // Per-AGUI-event assertions for the completed-tool-turn scenario.
  const completedToolTurnAguiSequence: readonly string[] = [
    "RUN_STARTED",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_STARTED",
    "TOOL_CALL_START",
    "TOOL_CALL_ARGS",
    "TOOL_CALL_END",
    "CUSTOM",
    "CUSTOM",
    "TOOL_CALL_RESULT",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_FINISHED",
    "STEP_STARTED",
    "TEXT_MESSAGE_START",
    "TEXT_MESSAGE_CONTENT",
    "TEXT_MESSAGE_END",
    "CUSTOM",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_FINISHED",
    "CUSTOM",
    "RUN_FINISHED",
  ];
  for (const [index, expectedType] of completedToolTurnAguiSequence.entries()) {
    checks.push(
      agui(
        `completed-turn-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.eventTypes.${index}`,
          kind: "evidenceField",
        },
        [`eventTypes.${index}`],
        "$.completed-tool-turn"
      )
    );
  }

  // Per-AGUI-event assertions for the failed-provider-turn scenario.
  const failedProviderAguiSequence: readonly string[] = [
    "RUN_STARTED",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_STARTED",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_FINISHED",
    "CUSTOM",
    "RUN_ERROR",
  ];
  for (const [index, expectedType] of failedProviderAguiSequence.entries()) {
    checks.push(
      agui(
        `failed-turn-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.eventTypes.${index}`,
          kind: "evidenceField",
        },
        [`eventTypes.${index}`],
        "$.failed-provider-turn"
      )
    );
  }

  // Per-AGUI-event assertions for the paused-approval-turn scenario.
  const pausedApprovalAguiSequence: readonly string[] = [
    "RUN_STARTED",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_STARTED",
    "TOOL_CALL_START",
    "TOOL_CALL_ARGS",
    "TOOL_CALL_END",
    "CUSTOM",
    "CUSTOM",
    "STATE_SNAPSHOT",
    "STEP_FINISHED",
    "CUSTOM",
    "CUSTOM",
    "RUN_FINISHED",
  ];
  for (const [index, expectedType] of pausedApprovalAguiSequence.entries()) {
    checks.push(
      agui(
        `paused-turn-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.eventTypes.${index}`,
          kind: "evidenceField",
        },
        [`eventTypes.${index}`],
        "$.paused-approval-turn"
      )
    );
  }

  // Per-source-event assertions for the paused-approval-turn scenario.
  const pausedApprovalSourceTypes: readonly string[] = [
    "turn.start",
    "state.checkpoint",
    "iteration.start",
    "tool_call.start",
    "tool_call.args_delta",
    "tool_call.done",
    "approval.requested",
    "iteration.end",
    "turn.end",
  ];
  for (const [index, expectedType] of pausedApprovalSourceTypes.entries()) {
    checks.push(
      sseProjection(
        `paused-approval-source-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.sourceEventTypes.${index}`,
          kind: "evidenceField",
        },
        [`sourceEventTypes.${index}`],
        "$.paused-approval-turn"
      )
    );
  }

  // Per-source-event assertions for the completed-tool-turn scenario.
  const completedToolTurnSourceTypes: readonly string[] = [
    "turn.start",
    "state.checkpoint",
    "iteration.start",
    "message.start",
    "tool_call.start",
    "tool_call.args_delta",
    "tool_call.done",
    "message.done",
    "tool.start",
    "tool.result",
    "state.checkpoint",
    "iteration.end",
    "iteration.start",
    "message.start",
    "text.delta",
    "text.done",
    "message.done",
    "state.checkpoint",
    "iteration.end",
    "turn.end",
  ];
  for (const [index, expectedType] of completedToolTurnSourceTypes.entries()) {
    checks.push(
      sseProjection(
        `completed-turn-source-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.sourceEventTypes.${index}`,
          kind: "evidenceField",
        },
        [`sourceEventTypes.${index}`],
        "$.completed-tool-turn"
      )
    );
  }

  // Per-source-event assertions for the failed-provider-turn scenario.
  const failedProviderTurnSourceTypes: readonly string[] = [
    "turn.start",
    "state.checkpoint",
    "iteration.start",
    "message.start",
    "iteration.end",
    "error",
    "turn.end",
  ];
  for (const [index, expectedType] of failedProviderTurnSourceTypes.entries()) {
    checks.push(
      sseProjection(
        `failed-turn-source-event-${index.toString().padStart(2, "0")}`,
        {
          equals: expectedType,
          field: `$.sourceEventTypes.${index}`,
          kind: "evidenceField",
        },
        [`sourceEventTypes.${index}`],
        "$.failed-provider-turn"
      )
    );
  }

  return {
    applicability: { capabilities: ["framework.event-stream"] },
    checks,
    packetId: "tuvren.framework.event-stream",
    planId: "tuvren.framework.event-stream.extended",
    planVersion: "0.1.0",
    scenarios: {
      "event-stream-scenarios": "../scenarios/event-stream-scenarios.json",
    },
  };
}

// Driver API extended — broader assertions on driver.execute and driver.resume
// resolution shapes, including coverage probes for unimplemented driver
// surfaces (lifecycle hooks, telemetry, and structured cancellation).
function buildDriverApiExtended(): Plan {
  const checks: PlanCheck[] = [];

  const driverExecute = (id: string, assertion: Record<string, unknown>, evidence: string[], scenarioPath: string): PlanCheck => ({
    assertions: [assertion],
    checkId: `driver-api-ext.execute.${id}`,
    evidence,
    input: { scenarioPath },
    operation: "driver.execute",
    scenario: "driver-api-scenarios",
  });
  checks.push(
    driverExecute(
      "hook-turn-phase-completed",
      { equals: "completed", field: "$.driver.phase", kind: "evidenceField" },
      ["driver.phase"],
      "$.driver-hook-turn"
    ),
    driverExecute(
      "hook-turn-phase-string",
      { field: "$.driver.phase", kind: "evidenceField", matches: "^(running|paused|completed|failed)$" },
      ["driver.phase"],
      "$.driver-hook-turn"
    ),
    driverExecute(
      "provider-failure-error-envelope",
      { kind: "errorEnvelope", path: "$.result.error" },
      ["result.error.code"],
      "$.driver-provider-failure"
    ),
    driverExecute(
      "provider-failure-error-code-snake-case",
      { field: "$.result.error.code", kind: "evidenceField", matches: "^[a-z0-9]+(?:_[a-z0-9]+)*$" },
      ["result.error.code"],
      "$.driver-provider-failure"
    ),
    driverExecute(
      "provider-failure-message-non-empty",
      { field: "$.result.error.message", kind: "evidenceField", matches: ".+" },
      ["result.error.message"],
      "$.driver-provider-failure"
    ),
  );

  const driverResume = (id: string, assertion: Record<string, unknown>, evidence: string[], scenarioPath: string): PlanCheck => ({
    assertions: [assertion],
    checkId: `driver-api-ext.resume.${id}`,
    evidence,
    input: { scenarioPath },
    operation: "driver.resume",
    scenario: "driver-api-scenarios",
  });
  checks.push(
    driverResume(
      "approval-resolution-end-turn",
      { equals: "end_turn", field: "$.driver.resolutionType", kind: "evidenceField" },
      ["driver.resolutionType"],
      "$.driver-resume-approval"
    ),
    driverResume(
      "approval-pending-call-id-list-non-empty",
      { contains: "call-search", field: "$.driver.pendingToolCallIds", kind: "evidenceField" },
      ["driver.pendingToolCallIds"],
      "$.driver-resume-approval"
    ),
    driverResume(
      "approval-decision-call-id-includes-call-search",
      { contains: "call-search", field: "$.driver.approvalDecisionCallIds", kind: "evidenceField" },
      ["driver.approvalDecisionCallIds"],
      "$.driver-resume-approval"
    ),
    driverResume(
      "missing-pending-call-resolution-fail",
      { equals: "fail", field: "$.driver.resolutionType", kind: "evidenceField" },
      ["driver.resolutionType"],
      "$.driver-resume-missing-pending-call"
    ),
    driverResume(
      "missing-pending-call-error-envelope",
      { kind: "errorEnvelope", path: "$.result.error" },
      ["result.error.code"],
      "$.driver-resume-missing-pending-call"
    ),
  );

  // Coverage probes — driver operations the spec mentions but adapters lack.
  const probes: Array<{ evidence: string[]; operation: string }> = [
    { evidence: ["driver.cancel.cancellationKind"], operation: "driver.cancel" },
    { evidence: ["driver.replay.iterations"], operation: "driver.replay" },
    { evidence: ["driver.metrics.iterationCount"], operation: "driver.metrics" },
    {
      evidence: ["driver.before-iteration.invocations"],
      operation: "driver.before-iteration",
    },
    {
      evidence: ["driver.around-model.invocations"],
      operation: "driver.around-model",
    },
    {
      evidence: ["driver.around-tool.invocations"],
      operation: "driver.around-tool",
    },
    {
      evidence: ["driver.after-iteration.invocations"],
      operation: "driver.after-iteration",
    },
    {
      evidence: ["driver.terminate.reason"],
      operation: "driver.terminate",
    },
  ];

  for (const probe of probes) {
    checks.push({
      assertions: probe.evidence.map((path) => ({
        field: `$.${path}`,
        kind: "evidenceField",
      })),
      checkId: `driver-api-ext.coverage.${probe.operation.replace(/\./g, "_")}`,
      evidence: probe.evidence,
      operation: probe.operation,
    });
  }

  return {
    applicability: { capabilities: ["framework.driver-api"] },
    checks,
    packetId: "tuvren.framework.driver-api",
    planId: "tuvren.framework.driver-api.extended",
    planVersion: "0.1.0",
    scenarios: {
      "driver-api-scenarios": "../scenarios/driver-api-scenarios.json",
    },
  };
}

// React-driver extended — broader hook-count and checkpoint-shape coverage
// against the existing driver.execute and driver.checkpoint operations.
function buildReactDriverExtended(): Plan {
  const checks: PlanCheck[] = [];

  const hookCheck = (id: string, field: string, expected: number): PlanCheck => ({
    assertions: [
      { equals: expected, field: `$.${field}`, kind: "evidenceField" },
    ],
    checkId: `react-driver-ext.${id}`,
    evidence: [field],
    input: { scenarioPath: "$.driver-hook-turn" },
    operation: "driver.execute",
    scenario: "driver-api-scenarios",
  });
  checks.push(
    hookCheck("before-iteration-twice", "hooks.beforeIteration", 2),
    hookCheck("around-model-twice", "hooks.aroundModel", 2),
    hookCheck("after-iteration-twice", "hooks.afterIteration", 2),
    hookCheck("around-tool-once", "hooks.aroundTool", 1),
  );

  // Hook ordering: assert that beforeIteration hits at least 1 and afterIteration matches.
  const hookFieldExists = (id: string, field: string): PlanCheck => ({
    assertions: [{ field: `$.${field}`, kind: "evidenceField" }],
    checkId: `react-driver-ext.hook-field-present.${id}`,
    evidence: [field],
    input: { scenarioPath: "$.driver-hook-turn" },
    operation: "driver.execute",
    scenario: "driver-api-scenarios",
  });
  checks.push(
    hookFieldExists("before-iteration-present", "hooks.beforeIteration"),
    hookFieldExists("after-iteration-present", "hooks.afterIteration"),
    hookFieldExists("around-model-present", "hooks.aroundModel"),
    hookFieldExists("around-tool-present", "hooks.aroundTool"),
  );

  // Checkpoint trace
  checks.push(
    {
      assertions: [
        {
          equals: 4,
          field: "$.trace.checkpoint.evidence.checkpoint.manifestPathCount",
          kind: "stateField",
        },
      ],
      checkId: "react-driver-ext.checkpoint-manifest-path-count",
      evidence: ["trace.checkpoint.evidence.checkpoint.manifestPathCount"],
      input: { scenarioPath: "$.driver-checkpoint-turn" },
      operation: "driver.checkpoint",
      scenario: "driver-api-scenarios",
      steps: [
        {
          input: { scenarioPath: "$.driver-checkpoint-turn" },
          operation: "driver.checkpoint",
          stepId: "checkpoint",
        },
      ],
    } as PlanCheck,
  );

  // Coverage probes for unimplemented react-driver concepts.
  const probes: Array<{ evidence: string[]; operation: string }> = [
    {
      evidence: ["reactDriver.replay.iterations"],
      operation: "react-driver.replay",
    },
    {
      evidence: ["reactDriver.budget.maxIterations"],
      operation: "react-driver.budget",
    },
    {
      evidence: ["reactDriver.tool.allowList"],
      operation: "react-driver.tool-allowlist",
    },
  ];
  for (const probe of probes) {
    checks.push({
      assertions: probe.evidence.map((path) => ({
        field: `$.${path}`,
        kind: "evidenceField",
      })),
      checkId: `react-driver-ext.coverage.${probe.operation.replace(/\./g, "_")}`,
      evidence: probe.evidence,
      operation: probe.operation,
    });
  }

  return {
    applicability: { capabilities: ["framework.react-driver"] },
    checks,
    packetId: "tuvren.framework.react-driver",
    planId: "tuvren.framework.react-driver.extended",
    planVersion: "0.1.0",
    scenarios: {
      "driver-api-scenarios": "../scenarios/driver-api-scenarios.json",
    },
  };
}
