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
export type TuvrenErrorCode = string;
export interface TuvrenErrorOptions {
  cause?: unknown;
  code: TuvrenErrorCode;
  details?: unknown;
}
export declare function isTuvrenErrorCode(
  value: unknown
): value is TuvrenErrorCode;
export declare function assertTuvrenErrorCode(
  value: unknown,
  label?: string
): asserts value is TuvrenErrorCode;
export declare abstract class TuvrenError extends Error {
  readonly code: TuvrenErrorCode;
  readonly details?: unknown;
  readonly cause?: unknown;
  protected constructor(message: string, options: TuvrenErrorOptions);
}
export declare class TuvrenValidationError extends TuvrenError {
  constructor(message: string, options: TuvrenErrorOptions);
}
export declare class TuvrenPersistenceError extends TuvrenError {
  constructor(message: string, options: TuvrenErrorOptions);
}
export declare class TuvrenLineageError extends TuvrenError {
  constructor(message: string, options: TuvrenErrorOptions);
}
export declare class TuvrenRecoveryError extends TuvrenError {
  constructor(message: string, options: TuvrenErrorOptions);
}
export declare class TuvrenRuntimeError extends TuvrenError {
  constructor(message: string, options: TuvrenErrorOptions);
}
export declare class TuvrenProviderError extends TuvrenError {
  constructor(message: string, options: TuvrenErrorOptions);
}
