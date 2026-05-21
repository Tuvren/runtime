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

// biome-ignore-all lint/performance/noBarrelFile: This package entrypoint is the intentional public implementation surface.
// DEPRECATED: @tuvren/runtime-core has been folded into @tuvren/runtime.
// Import from @tuvren/runtime instead. @tuvren/runtime-core will be removed in the next minor release.
console.warn(
  "[deprecated] @tuvren/runtime-core has been folded into @tuvren/runtime. " +
    "Import from @tuvren/runtime instead. @tuvren/runtime-core will be removed in the next minor release."
);

export type {
  ExecutionSessionRequest,
  ExtensionStateUpdate,
  GrpcRuntimeKernelOptions,
  OrchestrationRuntimeOptions,
  RuntimeCoreOptions,
  RuntimeRunLivenessOptions,
  RuntimeWarning,
  TuvrenRuntimeTelemetryAttributeDefinition,
  TuvrenRuntimeTelemetryAttributeKey,
} from "@tuvren/runtime";
export {
  buildSharedExports,
  collectSystemPrompts,
  createContextManifest,
  createDriverRegistry,
  createEmptyContextManifest,
  createGrpcRuntimeKernel,
  createLastOutputOnlyHandoffContextBuilder,
  createOrchestrationRuntime,
  createPreserveTraceHandoffContextBuilder,
  createToolRegistry,
  createTuvrenRuntime as createTuvrenRuntimeCore,
  DEFAULT_AGENT_SCHEMA,
  DEFAULT_AGENT_SCHEMA_ID,
  DEFAULT_MANIFEST_EXTENSION_STATE_WARNING_BUDGET_BYTES,
  DEFAULT_MAX_PARALLEL_TOOL_CALLS,
  runAfterIterationHooks,
  runAfterTurnHooks,
  runBeforeIterationHooks,
  runBeforeTurnHooks,
  TUVREN_RUNTIME_TELEMETRY_ATTRIBUTE_KEYS,
  TUVREN_RUNTIME_TELEMETRY_ATTRIBUTES,
  TUVREN_RUNTIME_TELEMETRY_SCHEMA_URL,
  updateContextManifest,
} from "@tuvren/runtime";
