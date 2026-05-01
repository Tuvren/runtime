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
export type HashString = string;
export type EpochMs = number;
export type KernelRecord =
  | null
  | boolean
  | string
  | number
  | Uint8Array
  | KernelArray
  | KernelObject;
export type KernelArray = KernelRecord[];
export interface KernelObject {
  [key: string]: KernelRecord;
}
export declare function isHashString(value: unknown): value is HashString;
export declare function assertHashString(
  value: unknown,
  label?: string
): asserts value is HashString;
export declare function isEpochMs(value: unknown): value is EpochMs;
export declare function assertEpochMs(
  value: unknown,
  label?: string
): asserts value is EpochMs;
export declare function isKernelRecord(value: unknown): value is KernelRecord;
export declare function assertKernelRecord(
  value: unknown,
  label?: string
): asserts value is KernelRecord;
