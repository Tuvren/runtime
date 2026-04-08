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
import type { HashString, KernelRecord } from "@kraken/shared-core-types";
import type { TurnNode, TurnTreeManifest, TurnTreeSchema } from "./kernel-types.js";
export declare function canonicalizeKernelRecord(value: KernelRecord): unknown;
export declare function encodeDeterministicKernelRecord(value: KernelRecord): Uint8Array;
export declare function decodeDeterministicKernelRecord(bytes: Uint8Array): KernelRecord;
export declare function hashKernelRecord(value: KernelRecord): Promise<HashString>;
export declare function hashOpaqueObjectBytes(bytes: Uint8Array): Promise<HashString>;
export declare function hashTurnTreeIdentity(schemaId: string, manifest: TurnTreeManifest, schema: TurnTreeSchema): Promise<HashString>;
export declare function hashTurnNodeIdentity(value: Omit<TurnNode, "hash"> | TurnNode): Promise<HashString>;
//# sourceMappingURL=kernel-identity.d.ts.map