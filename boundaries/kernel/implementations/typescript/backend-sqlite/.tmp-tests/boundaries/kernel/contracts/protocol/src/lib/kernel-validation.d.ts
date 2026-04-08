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
import type { BranchHeadListEntry, BranchRecord, ComposedVerdict, ObserveResult, PathCollectionKind, PathValue, RecoveryState, RunCompletionStatus, RunRecord, RunStatus, SetHeadResult, StagedResult, StagedResultStatus, StepContext, StepDeclaration, StoredBranch, StoredObject, StoredOrderedPathChunk, StoredRun, StoredSchema, StoredStagedResult, StoredThread, StoredTurn, StoredTurnNode, StoredTurnTree, StoredTurnTreePath, ThreadCreateResult, ThreadRecord, TurnNode, TurnRecord, TurnTreeChangeSet, TurnTreeManifest, TurnTreeSchema, Verdict, VerdictDisposition } from "./kernel-types.js";
export declare function isPathCollectionKind(value: unknown): value is PathCollectionKind;
export declare function assertPathCollectionKind(value: unknown, label?: string): asserts value is PathCollectionKind;
export declare function isPathValue(value: unknown): value is PathValue;
export declare function assertPathValue(value: unknown, label?: string): asserts value is PathValue;
export declare function assertPathValueForCollectionKind(value: unknown, collectionKind: PathCollectionKind, label?: string): asserts value is PathValue;
export declare function isTurnTreeSchema(value: unknown): value is TurnTreeSchema;
export declare function assertTurnTreeSchema(value: unknown, label?: string): asserts value is TurnTreeSchema;
export declare function assertTurnTreeManifest(value: unknown, label?: string): asserts value is TurnTreeManifest;
export declare function assertTurnTreeManifest(value: unknown, schema: TurnTreeSchema, label?: string): asserts value is TurnTreeManifest;
export declare function assertTurnTreeChangeSet(value: unknown, schema: TurnTreeSchema, label?: string): asserts value is TurnTreeChangeSet;
export declare function isStepDeclaration(value: unknown): value is StepDeclaration;
export declare function assertStepDeclaration(value: unknown, label?: string): asserts value is StepDeclaration;
export declare function isObserveResult(value: unknown): value is ObserveResult;
export declare function assertObserveResult(value: unknown, label?: string): asserts value is ObserveResult;
export declare function isVerdictDisposition(value: unknown): value is VerdictDisposition;
export declare function assertVerdictDisposition(value: unknown, label?: string): asserts value is VerdictDisposition;
export declare function isVerdict(value: unknown): value is Verdict;
export declare function assertVerdict(value: unknown, label?: string): asserts value is Verdict;
export declare function isComposedVerdict(value: unknown): value is ComposedVerdict;
export declare function assertComposedVerdict(value: unknown, label?: string): asserts value is ComposedVerdict;
export declare function isStagedResultStatus(value: unknown): value is StagedResultStatus;
export declare function assertStagedResultStatus(value: unknown, label?: string): asserts value is StagedResultStatus;
export declare function isRunStatus(value: unknown): value is RunStatus;
export declare function assertRunStatus(value: unknown, label?: string): asserts value is RunStatus;
export declare function isRunCompletionStatus(value: unknown): value is RunCompletionStatus;
export declare function assertRunCompletionStatus(value: unknown, label?: string): asserts value is RunCompletionStatus;
export declare function isTurnNode(value: unknown): value is TurnNode;
export declare function assertTurnNode(value: unknown, label?: string): asserts value is TurnNode;
export declare function assertTurnNodeIdentity(value: unknown, label?: string): Promise<void>;
export declare function isThreadRecord(value: unknown): value is ThreadRecord;
export declare function assertThreadRecord(value: unknown, label?: string): asserts value is ThreadRecord;
export declare function isBranchRecord(value: unknown): value is BranchRecord;
export declare function assertBranchRecord(value: unknown, label?: string): asserts value is BranchRecord;
export declare function isBranchHeadListEntry(value: unknown): value is BranchHeadListEntry;
export declare function assertBranchHeadListEntry(value: unknown, label?: string): asserts value is BranchHeadListEntry;
export declare function isTurnRecord(value: unknown): value is TurnRecord;
export declare function assertTurnRecord(value: unknown, label?: string): asserts value is TurnRecord;
export declare function isRunRecord(value: unknown): value is RunRecord;
export declare function assertRunRecord(value: unknown, label?: string): asserts value is RunRecord;
export declare function isStepContext(value: unknown): value is StepContext;
export declare function assertStepContext(value: unknown, label?: string): asserts value is StepContext;
export declare function isRecoveryState(value: unknown): value is RecoveryState;
export declare function assertRecoveryState(value: unknown, label?: string): asserts value is RecoveryState;
export declare function isThreadCreateResult(value: unknown): value is ThreadCreateResult;
export declare function assertThreadCreateResult(value: unknown, label?: string): asserts value is ThreadCreateResult;
export declare function isSetHeadResult(value: unknown): value is SetHeadResult;
export declare function assertSetHeadResult(value: unknown, label?: string): asserts value is SetHeadResult;
export declare function isStoredObject(value: unknown): value is StoredObject;
export declare function assertStoredObject(value: unknown, label?: string): asserts value is StoredObject;
export declare function assertStoredObjectIdentity(value: unknown, label?: string): Promise<void>;
export declare function isStoredSchema(value: unknown): value is StoredSchema;
export declare function assertStoredSchema(value: unknown, label?: string): asserts value is StoredSchema;
export declare function isStoredTurnTree(value: unknown): value is StoredTurnTree;
export declare function assertStoredTurnTree(value: unknown, schema: TurnTreeSchema, label?: string): asserts value is StoredTurnTree;
export declare function assertStoredTurnTreeIdentity(value: unknown, schema: TurnTreeSchema, label?: string): Promise<void>;
export declare function isStoredTurnTreePath(value: unknown): value is StoredTurnTreePath;
export declare function assertStoredTurnTreePath(value: unknown, label?: string): asserts value is StoredTurnTreePath;
export declare function assertStoredTurnTreePath(value: unknown, schema: TurnTreeSchema, label?: string): asserts value is StoredTurnTreePath;
export declare function isStoredOrderedPathChunk(value: unknown): value is StoredOrderedPathChunk;
export declare function assertStoredOrderedPathChunk(value: unknown, label?: string): asserts value is StoredOrderedPathChunk;
export declare function assertStoredOrderedPathChunkIdentity(value: unknown, label?: string): Promise<void>;
export declare function isStoredTurnNode(value: unknown): value is StoredTurnNode;
export declare function assertStoredTurnNode(value: unknown, label?: string): asserts value is StoredTurnNode;
export declare function assertStoredTurnNodeIdentity(value: unknown, label?: string): Promise<void>;
export declare function isStoredThread(value: unknown): value is StoredThread;
export declare function assertStoredThread(value: unknown, label?: string): asserts value is StoredThread;
export declare function isStoredBranch(value: unknown): value is StoredBranch;
export declare function assertStoredBranch(value: unknown, label?: string): asserts value is StoredBranch;
export declare function isStoredTurn(value: unknown): value is StoredTurn;
export declare function assertStoredTurn(value: unknown, label?: string): asserts value is StoredTurn;
export declare function isStoredRun(value: unknown): value is StoredRun;
export declare function assertStoredRun(value: unknown, label?: string): asserts value is StoredRun;
export declare function isStoredStagedResult(value: unknown): value is StoredStagedResult;
export declare function assertStoredStagedResult(value: unknown, label?: string): asserts value is StoredStagedResult;
export declare function isStagedResult(value: unknown): value is StagedResult;
export declare function assertStagedResult(value: unknown, label?: string): asserts value is StagedResult;
//# sourceMappingURL=kernel-validation.d.ts.map