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
  evidence?: string[];
  fixture?: string;
  operation: string;
}

interface Plan {
  applicability: { capabilities: string[] };
  checks: PlanCheck[];
  fixtures?: Record<string, string>;
  packetId: string;
  planId: string;
  planVersion: string;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PLANS_DIR = resolve(REPO_ROOT, "boundaries/providers/conformance/plans");

await main();

async function main(): Promise<void> {
  // Coverage and negative-shape probes against undeclared providers.bridge.*
  // operations were removed: the shared plan validator only accepts operations
  // declared by the providers operation source. Bringing those operations
  // under authority is a separate spec amendment.
  const extended = buildExtended();

  await writeFile(
    resolve(PLANS_DIR, "provider-api-bridge-extended.json"),
    `${JSON.stringify(extended, null, 2)}\n`
  );

  process.stdout.write(
    `wrote provider-api-bridge-extended.json (${extended.checks.length} checks)\n`
  );
}

function buildExtended(): Plan {
  const checks: PlanCheck[] = [];

  // generate-mapping — granular evidence checks beyond the four already
  // present in the core plan.
  const generateMap = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    capabilities: ["providers.ai-sdk-bridge"],
    checkId: `providers-ext.generate.${id}`,
    evidence,
    fixture: "provider-fixtures",
    operation: "providers.bridge.generate-mapping",
  });
  checks.push(
    generateMap(
      "response-format-type-equals-json",
      { equals: "json", field: "$.generate.responseFormatType", kind: "evidenceField" },
      ["generate.responseFormatType"]
    ),
    generateMap(
      "response-format-name-equals-answer",
      { equals: "answer", field: "$.generate.responseFormatName", kind: "evidenceField" },
      ["generate.responseFormatName"]
    ),
    generateMap(
      "response-part-types-include-structured",
      { contains: "structured", field: "$.generate.responsePartTypes", kind: "evidenceField" },
      ["generate.responsePartTypes"]
    ),
    generateMap(
      "provider-metadata-keys-include-openai",
      { contains: "openai", field: "$.generate.providerMetadataKeys", kind: "evidenceField" },
      ["generate.providerMetadataKeys"]
    ),
    generateMap(
      "response-part-types-shape-array",
      { field: "$.generate.responsePartTypes.0", kind: "evidenceField" },
      ["generate.responsePartTypes.0"]
    ),
    generateMap(
      "response-format-name-matches-pattern",
      { field: "$.generate.responseFormatName", kind: "evidenceField", matches: "^[a-z][a-zA-Z0-9_]*$" },
      ["generate.responseFormatName"]
    ),
  );

  // stream-metadata-continuity
  const streamMeta = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    capabilities: ["providers.ai-sdk-bridge"],
    checkId: `providers-ext.stream.${id}`,
    evidence,
    fixture: "provider-fixtures",
    operation: "providers.bridge.stream-metadata-continuity",
  });
  checks.push(
    streamMeta(
      "chunk-types-end-with-finish",
      { equals: "finish", field: "$.stream.chunkTypes.3", kind: "evidenceField" },
      ["stream.chunkTypes.3"]
    ),
    streamMeta(
      "chunk-types-include-tool-call-start",
      { contains: "tool_call_start", field: "$.stream.chunkTypes", kind: "evidenceField" },
      ["stream.chunkTypes"]
    ),
    streamMeta(
      "chunk-types-include-tool-call-args-delta",
      { contains: "tool_call_args_delta", field: "$.stream.chunkTypes", kind: "evidenceField" },
      ["stream.chunkTypes"]
    ),
    streamMeta(
      "chunk-types-include-tool-call-done",
      { contains: "tool_call_done", field: "$.stream.chunkTypes", kind: "evidenceField" },
      ["stream.chunkTypes"]
    ),
    streamMeta(
      "finish-metadata-keys-include-openai",
      { contains: "openai", field: "$.stream.finishMetadataKeys", kind: "evidenceField" },
      ["stream.finishMetadataKeys"]
    ),
  );

  // structured-output-stream
  const structured = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    capabilities: ["providers.ai-sdk-bridge"],
    checkId: `providers-ext.structured.${id}`,
    evidence,
    fixture: "provider-fixtures",
    operation: "providers.bridge.structured-output-stream",
  });
  checks.push(
    structured(
      "chunk-types-include-structured-delta",
      { contains: "structured_delta", field: "$.structured.chunkTypes", kind: "evidenceField" },
      ["structured.chunkTypes"]
    ),
    structured(
      "chunk-types-include-structured-done",
      { contains: "structured_done", field: "$.structured.chunkTypes", kind: "evidenceField" },
      ["structured.chunkTypes"]
    ),
    structured(
      "done-name-equals-answer",
      { equals: "answer", field: "$.structured.doneName", kind: "evidenceField" },
      ["structured.doneName"]
    ),
    structured(
      "done-name-matches-identifier",
      { field: "$.structured.doneName", kind: "evidenceField", matches: "^[a-z][a-zA-Z0-9_]*$" },
      ["structured.doneName"]
    ),
    structured(
      "first-chunk-is-structured-delta-or-text-delta",
      { field: "$.structured.chunkTypes.0", kind: "evidenceField", matches: "^(structured_delta|text_delta)$" },
      ["structured.chunkTypes.0"]
    ),
  );

  // provider-failure-normalization
  const failure = (id: string, assertion: Record<string, unknown>, evidence: string[]): PlanCheck => ({
    assertions: [assertion],
    capabilities: ["providers.ai-sdk-bridge"],
    checkId: `providers-ext.failure.${id}`,
    evidence,
    fixture: "provider-fixtures",
    operation: "providers.bridge.provider-failure-normalization",
  });
  checks.push(
    failure(
      "error-name-tuvren-provider-error",
      { equals: "TuvrenProviderError", field: "$.failure.errorName", kind: "evidenceField" },
      ["failure.errorName"]
    ),
    failure(
      "error-code-snake-case",
      { field: "$.failure.errorCode", kind: "evidenceField", matches: "^[a-z0-9]+(?:_[a-z0-9]+)*$" },
      ["failure.errorCode"]
    ),
    failure(
      "error-code-equals-ai-sdk-generate-failed",
      { equals: "ai_sdk_generate_failed", field: "$.failure.errorCode", kind: "evidenceField" },
      ["failure.errorCode"]
    ),
    failure(
      "error-name-pascal-case",
      { field: "$.failure.errorName", kind: "evidenceField", matches: "^[A-Z][A-Za-z0-9]+$" },
      ["failure.errorName"]
    ),
  );

  return {
    applicability: { capabilities: ["providers.provider-api"] },
    checks,
    fixtures: {
      "provider-fixtures": "../fixtures/provider-fixtures.json",
    },
    packetId: "tuvren.providers.provider-api",
    planId: "tuvren.providers.provider-api.bridge-extended",
    planVersion: "0.1.0",
  };
}

