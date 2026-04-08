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
export type KrakenErrorCode = string;
export interface KrakenErrorOptions {
    cause?: unknown;
    code: KrakenErrorCode;
    details?: unknown;
}
export declare function isKrakenErrorCode(value: unknown): value is KrakenErrorCode;
export declare function assertKrakenErrorCode(value: unknown, label?: string): asserts value is KrakenErrorCode;
export declare abstract class KrakenError extends Error {
    readonly code: KrakenErrorCode;
    readonly details?: unknown;
    readonly cause?: unknown;
    protected constructor(message: string, options: KrakenErrorOptions);
}
export declare class KrakenValidationError extends KrakenError {
    constructor(message: string, options: KrakenErrorOptions);
}
export declare class KrakenPersistenceError extends KrakenError {
    constructor(message: string, options: KrakenErrorOptions);
}
export declare class KrakenLineageError extends KrakenError {
    constructor(message: string, options: KrakenErrorOptions);
}
export declare class KrakenRecoveryError extends KrakenError {
    constructor(message: string, options: KrakenErrorOptions);
}
export declare class KrakenRuntimeError extends KrakenError {
    constructor(message: string, options: KrakenErrorOptions);
}
export declare class KrakenProviderError extends KrakenError {
    constructor(message: string, options: KrakenErrorOptions);
}
//# sourceMappingURL=kraken-error.d.ts.map