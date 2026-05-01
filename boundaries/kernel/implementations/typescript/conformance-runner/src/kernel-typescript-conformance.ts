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

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createMemoryBackend } from "@tuvren/backend-memory";
import { TuvrenPersistenceError } from "@tuvren/core-types";
import {
  decodeDeterministicKernelRecord,
  hashKernelRecord,
  hashOpaqueObjectBytes,
  hashTurnNodeIdentity,
  type StoredBranch,
  type StoredThread,
  type StoredTurn,
} from "@tuvren/kernel-protocol";
import {
  createCanonicalTurnTreePaths,
  createStoredObjectRecord,
  createStoredSchemaRecord,
  createStoredTurnNodeRecord,
  createStoredTurnTreeRecord,
} from "@tuvren/kernel-testkit";
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
import {
  canonicalKernelTestSchemaFixture,
  kernelProtocolDeterministicFixtures,
  kernelProtocolLogicalFixtures,
} from "../../../../testkit/src/lib/kernel-conformance-fixtures.ts";

const KERNEL_MANIFEST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../conformance/scenarios/suite-manifest.json"
);
const IMPLEMENTATION_ID = "typescript-kernel";
const LANGUAGE = "typescript";

await main();

async function main(): Promise<void> {
  const manifest = await readConformanceSuiteManifest(KERNEL_MANIFEST_PATH);
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
    case "kernel.protocol.deterministic_hashing":
      return createDeterministicHashingCheck();
    case "kernel.protocol.schema_roundtrip":
      return Promise.resolve(createSchemaRoundtripCheck());
    case "kernel.logical.diff_paths":
      return Promise.resolve(createLogicalDiffCheck());
    case "kernel.logical.branch_list":
      return Promise.resolve(createBranchListCheck());
    case "kernel.logical.recovery_state":
      return Promise.resolve(createRecoveryStateCheck());
    case "kernel.lineage.cross_thread_rejection":
      return createCrossThreadLineageCheck();
    case "kernel.turn.lateral_head_guard":
      return createLateralTurnHeadGuardCheck();
    default:
      throw new Error(`unsupported kernel conformance check ${checkId}`);
  }
}

async function createDeterministicHashingCheck(): Promise<ConformanceCheckResult> {
  const rawOpaqueHash = await hashOpaqueObjectBytes(
    Uint8Array.from(kernelProtocolDeterministicFixtures.rawOpaqueBytes)
  );
  const schemaHash = await hashKernelRecord(
    decodeDeterministicKernelRecord(
      hexToBytes(
        kernelProtocolDeterministicFixtures.turnTreeSchemaRecordCborHex
      )
    )
  );
  const turnNodeHash = await hashTurnNodeIdentity({
    consumedStagedResults: [
      ...kernelProtocolDeterministicFixtures.turnNodeIdentityRecord
        .consumedStagedResults,
    ],
    eventHash:
      kernelProtocolDeterministicFixtures.turnNodeIdentityRecord.eventHash,
    previousTurnNodeHash:
      kernelProtocolDeterministicFixtures.turnNodeIdentityRecord
        .previousTurnNodeHash,
    schemaId:
      kernelProtocolDeterministicFixtures.turnNodeIdentityRecord.schemaId,
    turnTreeHash:
      kernelProtocolDeterministicFixtures.turnNodeIdentityRecord.turnTreeHash,
  });

  return createCheckResult(
    "kernel.protocol.deterministic_hashing",
    [
      createAssertionResult(
        "raw_opaque_bytes_hash",
        rawOpaqueHash ===
          kernelProtocolDeterministicFixtures.rawOpaqueBytesSha256Hex
      ),
      createAssertionResult(
        "turn_tree_schema_hash",
        schemaHash ===
          kernelProtocolDeterministicFixtures.turnTreeSchemaRecordSha256Hex
      ),
      createAssertionResult(
        "turn_node_identity_hash",
        turnNodeHash ===
          kernelProtocolDeterministicFixtures.turnNodeIdentityRecordSha256Hex
      ),
    ],
    {
      hashKinds: ["rawOpaqueBytes", "turnTreeSchema", "turnNodeIdentity"],
    }
  );
}

function createSchemaRoundtripCheck(): ConformanceCheckResult {
  const decodedSchema = decodeDeterministicKernelRecord(
    hexToBytes(kernelProtocolDeterministicFixtures.turnTreeSchemaRecordCborHex)
  );
  const decodedTurnNode = decodeDeterministicKernelRecord(
    hexToBytes(
      kernelProtocolDeterministicFixtures.turnNodeIdentityRecordCborHex
    )
  );

  return createCheckResult("kernel.protocol.schema_roundtrip", [
    createAssertionResult(
      "turn_tree_schema_cbor_roundtrip",
      isDeepStrictEqual(
        decodedSchema,
        kernelProtocolDeterministicFixtures.turnTreeSchemaRecord
      )
    ),
    createAssertionResult(
      "turn_node_identity_cbor_roundtrip",
      isDeepStrictEqual(
        decodedTurnNode,
        kernelProtocolDeterministicFixtures.turnNodeIdentityRecord
      )
    ),
  ]);
}

function createLogicalDiffCheck(): ConformanceCheckResult {
  const diffPaths = Object.keys(
    kernelProtocolLogicalFixtures.turnTreeChangeSet
  ).sort((left, right) => left.localeCompare(right));

  return createCheckResult(
    "kernel.logical.diff_paths",
    [
      createAssertionResult(
        "logical_diff_matches_fixture_paths",
        arraysAreEqual(diffPaths, ["context.manifest", "messages"])
      ),
    ],
    {
      diffPaths,
    }
  );
}

function createBranchListCheck(): ConformanceCheckResult {
  const [branchId, headHash] =
    kernelProtocolLogicalFixtures.branchHeadListEntry;

  return createCheckResult(
    "kernel.logical.branch_list",
    [
      createAssertionResult(
        "branch_list_matches_fixture_entry",
        branchId === "branch_main" &&
          headHash ===
            "9999999999999999999999999999999999999999999999999999999999999999"
      ),
    ],
    {
      branchEntries: [kernelProtocolLogicalFixtures.branchHeadListEntry],
    }
  );
}

function createRecoveryStateCheck(): ConformanceCheckResult {
  const recoveryState = kernelProtocolLogicalFixtures.recoveryState;

  return createCheckResult(
    "kernel.logical.recovery_state",
    [
      createAssertionResult(
        "recovery_state_last_completed_step",
        recoveryState.lastCompletedStepId === "tool_execution"
      ),
      createAssertionResult(
        "recovery_state_consumed_results",
        recoveryState.consumedStagedResults.length === 1
      ),
      createAssertionResult(
        "recovery_state_uncommitted_results",
        recoveryState.uncommittedStagedResults.length === 1
      ),
    ],
    {
      recoveryStepIds: [
        recoveryState.lastCompletedStepId,
        ...recoveryState.stepSequence.map((step: { id: string }) => step.id),
      ],
    }
  );
}

async function createCrossThreadLineageCheck(): Promise<ConformanceCheckResult> {
  const backend = createMemoryBackend();
  const error = await capturePersistenceError(async () => {
    const schema = canonicalKernelTestSchemaFixture;
    const schemaRecord = createStoredSchemaRecord(schema, 1);
    const rootTree = await createStoredTurnTreeRecord(
      schema,
      {
        "context.manifest": null,
        messages: [],
      },
      2
    );
    const rootNodeA = await createStoredTurnNodeRecord({
      consumedStagedResults: [],
      createdAtMs: 3,
      eventHash: null,
      previousTurnNodeHash: null,
      schemaId: schema.schemaId,
      turnTreeHash: rootTree.hash,
    });
    const rootNodeB = await createStoredTurnNodeRecord({
      consumedStagedResults: [],
      createdAtMs: 4,
      eventHash: null,
      previousTurnNodeHash: null,
      schemaId: schema.schemaId,
      turnTreeHash: rootTree.hash,
    });
    const threadA: StoredThread = {
      createdAtMs: 5,
      rootTurnNodeHash: rootNodeA.hash,
      schemaId: schema.schemaId,
      threadId: "thread_a",
    };
    const threadB: StoredThread = {
      createdAtMs: 6,
      rootTurnNodeHash: rootNodeB.hash,
      schemaId: schema.schemaId,
      threadId: "thread_b",
    };
    const branchA: StoredBranch = {
      branchId: "branch_a",
      createdAtMs: 7,
      headTurnNodeHash: rootNodeA.hash,
      threadId: threadA.threadId,
      updatedAtMs: 7,
    };

    await backend.transact(async (tx) => {
      await tx.schemas.put(schemaRecord);
      await tx.turnTrees.put(rootTree);
      await tx.turnTreePaths.putMany(
        createCanonicalTurnTreePaths(rootTree, {
          "context.manifest": null,
          messages: [],
        })
      );
      await tx.turnNodes.put(rootNodeA);
      await tx.turnNodes.put(rootNodeB);
      await tx.threads.put(threadA);
      await tx.threads.put(threadB);
      await tx.branches.set(branchA);
    });

    await backend.transact(async (tx) => {
      await tx.branches.set({
        branchId: "branch_cross_thread",
        createdAtMs: 8,
        headTurnNodeHash: rootNodeA.hash,
        threadId: threadB.threadId,
        updatedAtMs: 8,
      });
    });
  });

  return createCheckResult(
    "kernel.lineage.cross_thread_rejection",
    [
      createAssertionResult(
        "cross_thread_branch_create_rejected",
        error instanceof TuvrenPersistenceError
      ),
    ],
    {
      errorCode: error?.code ?? null,
    }
  );
}

async function createLateralTurnHeadGuardCheck(): Promise<ConformanceCheckResult> {
  const backend = createMemoryBackend();
  const error = await capturePersistenceError(async () => {
    const schema = canonicalKernelTestSchemaFixture;
    const schemaRecord = createStoredSchemaRecord(schema, 10);
    const rootTree = await createStoredTurnTreeRecord(
      schema,
      {
        "context.manifest": null,
        messages: [],
      },
      11
    );
    const rootNode = await createStoredTurnNodeRecord({
      consumedStagedResults: [],
      createdAtMs: 12,
      eventHash: null,
      previousTurnNodeHash: null,
      schemaId: schema.schemaId,
      turnTreeHash: rootTree.hash,
    });
    const childNodeA = await createStoredTurnNodeRecord({
      consumedStagedResults: [],
      createdAtMs: 13,
      eventHash: null,
      previousTurnNodeHash: rootNode.hash,
      schemaId: schema.schemaId,
      turnTreeHash: rootTree.hash,
    });
    const childNodeB = await createStoredTurnNodeRecord({
      consumedStagedResults: [],
      createdAtMs: 14,
      eventHash: null,
      previousTurnNodeHash: rootNode.hash,
      schemaId: schema.schemaId,
      turnTreeHash: rootTree.hash,
    });
    const thread: StoredThread = {
      createdAtMs: 15,
      rootTurnNodeHash: rootNode.hash,
      schemaId: schema.schemaId,
      threadId: "thread_main",
    };
    const branch: StoredBranch = {
      branchId: "branch_main",
      createdAtMs: 16,
      headTurnNodeHash: childNodeA.hash,
      threadId: thread.threadId,
      updatedAtMs: 16,
    };
    const turn: StoredTurn = {
      branchId: branch.branchId,
      createdAtMs: 17,
      headTurnNodeHash: childNodeA.hash,
      parentTurnId: null,
      startTurnNodeHash: childNodeA.hash,
      threadId: thread.threadId,
      turnId: "turn_main",
      updatedAtMs: 17,
    };
    const objectRecord = await createStoredObjectRecord(
      new Uint8Array([1]),
      18
    );

    await backend.transact(async (tx) => {
      await tx.schemas.put(schemaRecord);
      await tx.turnTrees.put(rootTree);
      await tx.turnTreePaths.putMany(
        createCanonicalTurnTreePaths(rootTree, {
          "context.manifest": null,
          messages: [],
        })
      );
      await tx.objects.put(objectRecord);
      await tx.turnNodes.put(rootNode);
      await tx.turnNodes.put(childNodeA);
      await tx.turnNodes.put(childNodeB);
      await tx.threads.put(thread);
      await tx.branches.set(branch);
      await tx.turns.set(turn);
    });

    await backend.transact(async (tx) => {
      await tx.turns.set({
        ...turn,
        headTurnNodeHash: childNodeB.hash,
        updatedAtMs: 18,
      });
    });
  });

  return createCheckResult(
    "kernel.turn.lateral_head_guard",
    [
      createAssertionResult(
        "lateral_turn_head_move_rejected",
        error instanceof TuvrenPersistenceError
      ),
    ],
    {
      errorCode: error?.code ?? null,
    }
  );
}

async function capturePersistenceError(
  run: () => Promise<void>
): Promise<TuvrenPersistenceError | undefined> {
  try {
    await run();
    return undefined;
  } catch (error: unknown) {
    if (error instanceof TuvrenPersistenceError) {
      return error;
    }

    throw error;
  }
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0) {
    throw new Error("fixture hex must have even length");
  }

  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < value.length; index += 2) {
    const byte = Number.parseInt(value.slice(index, index + 2), 16);

    if (!Number.isSafeInteger(byte)) {
      throw new Error("fixture hex must decode");
    }

    bytes[index / 2] = byte;
  }

  return bytes;
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
