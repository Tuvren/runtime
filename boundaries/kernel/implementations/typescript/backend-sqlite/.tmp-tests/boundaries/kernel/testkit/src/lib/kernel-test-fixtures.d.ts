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
import { type StagedResult, type StoredObject, type StoredOrderedPathChunk, type StoredSchema, type StoredTurnNode, type StoredTurnTree, type StoredTurnTreePath, type TurnTreeManifest, type TurnTreeSchema } from "@kraken/kernel-contract-protocol";
export declare function createCanonicalKernelTestSchema(): TurnTreeSchema;
export declare function createStoredSchemaRecord(schema: TurnTreeSchema, createdAtMs: number): StoredSchema;
export declare function createStoredObjectRecord(bytes: Uint8Array, createdAtMs: number): Promise<StoredObject>;
export declare function createStoredTurnTreeRecord(schema: TurnTreeSchema, manifest: TurnTreeManifest, createdAtMs: number): Promise<StoredTurnTree>;
export declare function createStoredOrderedPathChunkRecord(hashes: string[], createdAtMs: number): Promise<StoredOrderedPathChunk>;
export declare function createStoredTurnNodeRecord(input: {
    consumedStagedResults: StagedResult[];
    createdAtMs: number;
    eventHash: string | null;
    previousTurnNodeHash: string | null;
    schemaId: string;
    turnTreeHash: string;
}): Promise<StoredTurnNode>;
export declare function createHashSequence(count: number, offset?: number): string[];
export declare function createHashFromIndex(index: number): string;
export declare function createIncrementingClock(initialValue: number): () => number;
export declare function delay(durationMs: number): Promise<void>;
export declare function createCanonicalTurnTreePaths(turnTree: StoredTurnTree, manifest: TurnTreeManifest): StoredTurnTreePath[];
//# sourceMappingURL=kernel-test-fixtures.d.ts.map