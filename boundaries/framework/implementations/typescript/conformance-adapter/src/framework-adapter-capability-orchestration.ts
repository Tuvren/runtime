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

import type { PolicyDimension } from "@tuvren/runtime";
import {
  createCapabilityPolicyEngine,
  createDriverRegistry,
  createTuvrenRuntime as createTuvrenRuntimeCore,
} from "@tuvren/runtime";
import {
  type AdapterProjection,
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

/**
 * Runs a single defineTool tool execution and returns evidence about the
 * CapabilityInvocationAttribution on tool.start and tool.result events.
 *
 * Used by the runtime-api-capability-orchestration check set to assert:
 * - Back-compat invariant: defineTool resolves to tuvren-server execution class
 * - Attribution is additive (existing event fields survive)
 * - Observation limits for tuvren-server are full lifecycle
 */
export async function runCapabilityOrchestrationFoundation(
  toolName: string
): Promise<AdapterProjection> {
  const harness = createConformanceKernelHarness();
  let toolCallCount = 0;

  const driver = createStaticDriver(async (context) => {
    await Promise.resolve();
    if (!context.messages.some((m) => m.role === "tool")) {
      return {
        messages: [
          assistantToolCalls([
            {
              callId: "cap-call-1",
              input: { q: "conformance" },
              name: toolName,
            },
          ]),
        ],
        resolution: { type: "continue_iteration" as const },
        toolExecutionMode: "parallel",
      };
    }
    return {
      messages: [assistantText("capability orchestration conformance done")],
      resolution: { reason: "done", type: "end_turn" as const },
    };
  });

  const runtime = createTuvrenRuntimeCore({
    createId: createConformanceIdFactory(),
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
          description: `Conformance capability tool ${toolName}`,
          execute() {
            toolCallCount += 1;
            return { ok: true };
          },
          inputSchema: { type: "object" },
          name: toolName,
        },
      ],
    },
    signal: textSignal("capability orchestration conformance test"),
    threadId: thread.threadId,
  });

  const events = await collectValues(handle.events());

  const toolStartEvent = events.find(
    (e): e is Extract<(typeof events)[number], { type: "tool.start" }> =>
      (e as { type?: unknown }).type === "tool.start"
  );
  const toolResultEvent = events.find(
    (e): e is Extract<(typeof events)[number], { type: "tool.result" }> =>
      (e as { type?: unknown }).type === "tool.result"
  );

  const startAttribution = (
    toolStartEvent as Record<string, unknown> | undefined
  )?.attribution as Record<string, unknown> | undefined;
  const resultAttribution = (
    toolResultEvent as Record<string, unknown> | undefined
  )?.attribution as Record<string, unknown> | undefined;
  const observation = startAttribution?.observation as
    | Record<string, unknown>
    | undefined;

  const evidence = {
    capabilityOrchestration: {
      backCompat: {
        startEventCallId: (
          toolStartEvent as Record<string, unknown> | undefined
        )?.callId,
        startEventName: (toolStartEvent as Record<string, unknown> | undefined)
          ?.name,
        startEventType: (toolStartEvent as Record<string, unknown> | undefined)
          ?.type,
        startAttribution: {
          capabilityId: startAttribution?.capabilityId,
          executionClass: startAttribution?.executionClass,
          observation: {
            canAudit: observation?.canAudit,
            canCancel: observation?.canCancel,
            canObserveIntermediate: observation?.canObserveIntermediate,
            canPersistResult: observation?.canPersistResult,
            canResume: observation?.canResume,
            canRetry: observation?.canRetry,
            executionClass: observation?.executionClass,
          },
          owner: startAttribution?.owner,
        },
        resultAttribution: {
          executionClass: resultAttribution?.executionClass,
          owner: resultAttribution?.owner,
        },
        toolCallCount,
      },
    },
  };

  return { evidence, result: evidence };
}

/**
 * Exercises both Capability Policy Engine decision points:
 * 1. Policy-unit decisions (standalone engine call) for exposure/invocation.
 * 2. A real tool-execution turn with a denied capability to prove invocation
 *    denial surfaces as tool.result isError:true (the wired behavior).
 *
 * Used by the runtime-api-capability-orchestration check set to assert:
 * - Exposure-time: denied surfaces return exposed:false with a non-secret reason
 * - Invocation-time standalone: denied capabilities return admitted:false
 * - Invocation-time wired: a denied capability produces tool.result isError:true
 * - Permitted surfaces/capabilities pass through unaffected
 */
export async function runCapabilityOrchestrationPolicyDecisions(): Promise<AdapterProjection> {
  const deniedSurface = "denied-surface";
  const deniedToolName = "denied-tool";
  const permittedSurface = "permitted-surface";

  const engine = createCapabilityPolicyEngine({
    deniedCapabilityIds: new Set([deniedToolName]),
    deniedSurfaceNames: new Set([deniedSurface]),
  });

  const context = {
    modelId: "conformance-model",
    permissions: [] as string[],
    providerId: "conformance-provider",
  };

  // --- Part 1: Standalone policy-unit decisions ---
  const exposureDecisions = engine.evaluateExposure(
    [
      {
        capabilityId: deniedToolName,
        description: "Denied surface",
        inputSchema: { type: "object" },
        name: deniedSurface,
      },
      {
        capabilityId: "permitted.capability",
        description: "Permitted surface",
        inputSchema: { type: "object" },
        name: permittedSurface,
      },
    ],
    context
  );

  const deniedExposure = exposureDecisions.find(
    (d) => d.surfaceName === deniedSurface
  );
  const permittedExposure = exposureDecisions.find(
    (d) => d.surfaceName === permittedSurface
  );

  const deniedInvocationDecision = engine.evaluateInvocation(
    {
      capabilityId: deniedToolName,
      endpoint: { id: "test", kind: "tuvren-in-process" },
      executionClass: "tuvren-server",
    },
    context
  );

  const permittedInvocationDecision = engine.evaluateInvocation(
    {
      capabilityId: "permitted.capability",
      endpoint: { id: "test", kind: "tuvren-in-process" },
      executionClass: "tuvren-server",
    },
    context
  );

  // --- Part 2: Wired invocation denial → tool.result isError:true ---
  const harness = createConformanceKernelHarness();
  let deniedToolExecuted = false;

  const driver = createStaticDriver(async (ctx) => {
    await Promise.resolve();
    if (!ctx.messages.some((m) => m.role === "tool")) {
      return {
        messages: [
          assistantToolCalls([
            {
              callId: "denied-call-1",
              input: {},
              name: deniedToolName,
            },
          ]),
        ],
        resolution: { type: "continue_iteration" as const },
        toolExecutionMode: "parallel",
      };
    }
    return {
      messages: [assistantText("capability policy conformance done")],
      resolution: { reason: "done", type: "end_turn" as const },
    };
  });

  const runtime = createTuvrenRuntimeCore({
    createId: createConformanceIdFactory(),
    defaultDriverId: DRIVER_ID,
    driverRegistry: createDriverRegistry([driver]),
    kernel: harness.kernel,
  });

  const thread = await runtime.createThread({});
  const handle = runtime.executeTurn({
    branchId: thread.branchId,
    config: {
      capabilityPolicyEngine: engine,
      name: AGENT_NAME,
      tools: [
        {
          description: "Denied capability tool",
          execute() {
            deniedToolExecuted = true;
            return { ok: true };
          },
          inputSchema: { type: "object" },
          name: deniedToolName,
        },
      ],
    },
    signal: textSignal("capability policy denial test"),
    threadId: thread.threadId,
  });

  const events = await collectValues(handle.events());

  const toolResultEvent = events.find(
    (e) => (e as unknown as Record<string, unknown>).type === "tool.result"
  );
  const toolResultIsError =
    (toolResultEvent as unknown as Record<string, unknown> | undefined)
      ?.isError === true;

  const evidence = {
    capabilityPolicy: {
      exposure: {
        denied: {
          exposed: deniedExposure?.exposed,
          hasReason:
            typeof deniedExposure?.reason === "string" &&
            (deniedExposure.reason ?? "").length > 0,
          surfaceName: deniedExposure?.surfaceName,
        },
        permitted: {
          exposed: permittedExposure?.exposed,
          surfaceName: permittedExposure?.surfaceName,
        },
      },
      invocation: {
        denied: {
          admitted: deniedInvocationDecision.admitted,
          capabilityId: deniedInvocationDecision.capabilityId,
          deniedToolExecuted,
          hasReason:
            typeof deniedInvocationDecision.reason === "string" &&
            (deniedInvocationDecision.reason ?? "").length > 0,
          toolResultIsError,
        },
        permitted: {
          admitted: permittedInvocationDecision.admitted,
          capabilityId: permittedInvocationDecision.capabilityId,
        },
      },
    },
  };

  return { evidence, result: evidence };
}

// ---------------------------------------------------------------------------
// BB006: capability-policy conformance adapter operations
// ---------------------------------------------------------------------------

function makeSurface(name: string, capabilityId: string, extra?: Record<string, unknown>) {
  return {
    capabilityId,
    description: `conformance surface ${name}`,
    inputSchema: { type: "object" as const },
    name,
    ...extra,
  };
}

function makeBinding(capabilityId: string, extra?: Record<string, unknown>) {
  return {
    capabilityId,
    endpoint: { id: "conformance-in-process", kind: "tuvren-in-process" as const },
    executionClass: "tuvren-server" as const,
    ...extra,
  };
}

const baseContext = {
  modelId: "conformance-model",
  permissions: [] as string[],
  providerId: "conformance-provider",
};

/**
 * BB001: Data-residency dimension checks at both decision points.
 */
export async function runCapabilityPolicyResidency(): Promise<AdapterProjection> {
  const engine = createCapabilityPolicyEngine({ allowedRegions: new Set(["US"]) });

  const disallowedSurface = makeSurface("disallowed-surface", "cap.disallowed", { endpointRegion: "EU" });
  const allowedSurface = makeSurface("allowed-surface", "cap.allowed", { endpointRegion: "US" });
  const exposureDecisions = engine.evaluateExposure([disallowedSurface, allowedSurface], baseContext);
  const disallowedExposure = exposureDecisions.find((d) => d.surfaceName === "disallowed-surface");
  const allowedExposure = exposureDecisions.find((d) => d.surfaceName === "allowed-surface");

  const disallowedBinding = {
    capabilityId: "cap.disallowed",
    endpoint: { id: "eu-endpoint", kind: "tuvren-server" as const, region: "EU" },
    executionClass: "tuvren-server" as const,
  };
  const allowedBinding = {
    capabilityId: "cap.allowed",
    endpoint: { id: "us-endpoint", kind: "tuvren-in-process" as const, region: "US" },
    executionClass: "tuvren-server" as const,
  };
  const disallowedInvocation = engine.evaluateInvocation(disallowedBinding, baseContext);
  const allowedInvocation = engine.evaluateInvocation(allowedBinding, baseContext);

  const evidence = {
    residency: {
      exposure: {
        disallowedRegion: {
          exposed: disallowedExposure?.exposed,
          hasReason: typeof disallowedExposure?.reason === "string" && (disallowedExposure.reason ?? "").length > 0,
        },
        allowedRegion: { exposed: allowedExposure?.exposed },
      },
      invocation: {
        disallowedRegion: {
          admitted: disallowedInvocation.admitted,
          hasReason: typeof disallowedInvocation.reason === "string" && (disallowedInvocation.reason ?? "").length > 0,
        },
        allowedRegion: { admitted: allowedInvocation.admitted },
      },
    },
  };
  return { evidence, result: evidence };
}

/**
 * BB002: Risk-classification dimension checks at both decision points.
 */
export async function runCapabilityPolicyRiskClassification(): Promise<AdapterProjection> {
  const engineMediumMax = createCapabilityPolicyEngine({ maxAllowedRiskClass: "medium" });
  const engineApproval = createCapabilityPolicyEngine({ highRiskRequiresApproval: true });
  const enginePermissive = createCapabilityPolicyEngine();

  const highRiskSurface = makeSurface("high-risk-tool", "cap.high", { riskClass: "high" });
  const lowRiskSurface = makeSurface("low-risk-tool", "cap.low", { riskClass: "low" });
  const highInMedium = engineMediumMax.evaluateExposure([highRiskSurface], baseContext);
  const lowInPermissive = enginePermissive.evaluateExposure([lowRiskSurface], baseContext);

  const highBinding = { ...makeBinding("cap.high"), riskClass: "high" as const };
  const lowBinding = { ...makeBinding("cap.low"), riskClass: "low" as const };
  const highApproval = engineApproval.evaluateInvocation(highBinding, baseContext);
  const lowPermissive = enginePermissive.evaluateInvocation(lowBinding, baseContext);

  const evidence = {
    riskClassification: {
      exposure: {
        highRiskInMediumContext: {
          exposed: highInMedium[0]?.exposed,
          hasReason: typeof highInMedium[0]?.reason === "string" && (highInMedium[0]?.reason ?? "").length > 0,
        },
        lowRisk: { exposed: lowInPermissive[0]?.exposed },
      },
      invocation: {
        highRiskApproval: { requiresApproval: highApproval.requiresApproval },
        lowRisk: { admitted: lowPermissive.admitted },
      },
    },
  };
  return { evidence, result: evidence };
}

/**
 * BB003: User-presence and active-endpoint checks at both decision points.
 */
export async function runCapabilityPolicyPresenceAndEndpoint(): Promise<AdapterProjection> {
  const engine = createCapabilityPolicyEngine();

  const endpointSurface = makeSurface("endpoint-required", "cap.endpoint", { requiresActiveEndpoint: true });
  const noEndpointCtx = { ...baseContext, endpointAttached: false };
  const withEndpointCtx = { ...baseContext, endpointAttached: true };
  const noEndpoint = engine.evaluateExposure([endpointSurface], noEndpointCtx);
  const withEndpoint = engine.evaluateExposure([endpointSurface], withEndpointCtx);

  const presenceBinding = { ...makeBinding("cap.presence"), requiresUserPresence: true };
  const noUserCtx = { ...baseContext, userPresent: false };
  const withUserCtx = { ...baseContext, userPresent: true };
  const noUser = engine.evaluateInvocation(presenceBinding, noUserCtx);
  const withUser = engine.evaluateInvocation(presenceBinding, withUserCtx);

  const evidence = {
    presence: {
      exposure: {
        noEndpoint: {
          exposed: noEndpoint[0]?.exposed,
          hasReason: typeof noEndpoint[0]?.reason === "string" && (noEndpoint[0]?.reason ?? "").length > 0,
        },
        endpointPresent: { exposed: withEndpoint[0]?.exposed },
      },
      invocation: {
        noUser: {
          admitted: noUser.admitted,
          hasReason: typeof noUser.reason === "string" && (noUser.reason ?? "").length > 0,
        },
        userPresent: { admitted: withUser.admitted },
      },
    },
  };
  return { evidence, result: evidence };
}

/**
 * BB004: Credential-boundary and idempotency annotation checks.
 */
export async function runCapabilityPolicyCredentialBoundary(): Promise<AdapterProjection> {
  const engine = createCapabilityPolicyEngine({ enforceCredentialBoundary: true });

  const scopedBinding = { ...makeBinding("cap.scoped"), credentialScope: "files.read" };
  const noScopeBinding = makeBinding("cap.noscope");
  const idempotentBinding = { ...makeBinding("cap.idempotent"), idempotencyPolicy: "idempotent" as const };
  const nonIdempotentBinding = { ...makeBinding("cap.nonidempotent"), idempotencyPolicy: "non-idempotent" as const };

  const missingScopeCtx = { ...baseContext, entitledCredentialScopes: [] as string[] };
  const entitledCtx = { ...baseContext, entitledCredentialScopes: ["files.read"] };

  const missingScope = engine.evaluateInvocation(scopedBinding, missingScopeCtx);
  const entitled = engine.evaluateInvocation(scopedBinding, entitledCtx);
  const noScope = engine.evaluateInvocation(noScopeBinding, missingScopeCtx);
  const idempotent = engine.evaluateInvocation(idempotentBinding, entitledCtx);
  const nonIdempotent = engine.evaluateInvocation(nonIdempotentBinding, entitledCtx);

  const evidence = {
    credentialBoundary: {
      invocation: {
        missingScope: {
          admitted: missingScope.admitted,
          hasReason: typeof missingScope.reason === "string" && (missingScope.reason ?? "").length > 0,
          reasonExposesScope: (missingScope.reason ?? "").includes("files.read"),
        },
        entitledScope: { admitted: entitled.admitted },
        noScope: { admitted: noScope.admitted },
        idempotentBinding: { policyCanRetry: idempotent.policyCanRetry },
        nonIdempotentBinding: { policyCanRetry: nonIdempotent.policyCanRetry },
      },
    },
  };
  return { evidence, result: evidence };
}

/**
 * BB005: Composition and precedence — deny from any dimension, determinism,
 * extension dimensions compose after framework.
 */
export async function runCapabilityPolicyComposition(): Promise<AdapterProjection> {
  const engineResidencyFirst = createCapabilityPolicyEngine({
    allowedRegions: new Set(["US"]),
    maxAllowedRiskClass: "low",
  });
  const multiBinding = {
    capabilityId: "cap.multi",
    endpoint: { id: "eu", kind: "tuvren-server" as const, region: "EU" },
    executionClass: "tuvren-server" as const,
    riskClass: "high" as const,
  };

  const residencyFirst = engineResidencyFirst.evaluateInvocation(multiBinding, baseContext);
  const run1 = engineResidencyFirst.evaluateInvocation(multiBinding, baseContext);
  const run2 = engineResidencyFirst.evaluateInvocation(multiBinding, baseContext);

  const extensionDimension: PolicyDimension = {
    checkExposure: () => null,
    checkInvocation: (b) => ({
      admitted: false as const,
      capabilityId: b.capabilityId,
      executionClass: b.executionClass,
      reason: "extension-policy: conformance denial",
    }),
  };
  const engineWithExt = createCapabilityPolicyEngine({ dimensions: [extensionDimension] });
  const extBinding = makeBinding("cap.extension");
  const extensionDenial = engineWithExt.evaluateInvocation(extBinding, baseContext);

  const passExtension: PolicyDimension = { checkExposure: () => null, checkInvocation: () => null };
  const engineFrameworkFirst = createCapabilityPolicyEngine({
    deniedCapabilityIds: new Set(["cap.framework-denied"]),
    dimensions: [passExtension],
  });
  const frameworkDenied = engineFrameworkFirst.evaluateInvocation(
    makeBinding("cap.framework-denied"), baseContext
  );

  const evidence = {
    composition: {
      firstDimensionDenialHonored:
        residencyFirst.admitted === false &&
        typeof residencyFirst.reason === "string" &&
        residencyFirst.reason.includes("residency"),
      deterministicRuns: {
        run1Admitted: run1.admitted,
        run1Reason: run1.reason,
        run2Admitted: run2.admitted,
        run2Reason: run2.reason,
        reasonsMatch: run1.reason === run2.reason,
      },
      denialHasReason:
        typeof residencyFirst.reason === "string" && (residencyFirst.reason ?? "").length > 0,
      extensionDimensionDenial: { admitted: extensionDenial.admitted },
      frameworkDenialNotOverridden: frameworkDenied.admitted === false,
      reasonIdentifiesDimension:
        typeof residencyFirst.reason === "string" && residencyFirst.reason.includes("residency"),
    },
  };
  return { evidence, result: evidence };
}
