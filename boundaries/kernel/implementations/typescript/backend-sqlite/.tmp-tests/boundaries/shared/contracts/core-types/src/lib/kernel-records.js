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
const HASH_STRING_PATTERN = /^[0-9a-f]{64}$/;
export function isHashString(value) {
    return typeof value === "string" && HASH_STRING_PATTERN.test(value);
}
export function assertHashString(value, label = "value") {
    if (!isHashString(value)) {
        throw new TypeError(`${label} must be a lowercase 64-character SHA-256 hex digest`);
    }
}
export function isEpochMs(value) {
    return isCanonicalKernelInteger(value);
}
export function assertEpochMs(value, label = "value") {
    if (!isEpochMs(value)) {
        throw new RangeError(`${label} must be a safe integer Unix epoch millisecond value`);
    }
}
export function isKernelRecord(value) {
    return isKernelRecordValueInternal(value, new WeakSet());
}
export function assertKernelRecord(value, label = "value") {
    if (!isKernelRecord(value)) {
        throw new TypeError(`${label} must match the restricted Kraken kernel record profile`);
    }
}
function isKernelRecordValueInternal(value, activeParents) {
    if (value === null) {
        return true;
    }
    switch (typeof value) {
        case "boolean":
        case "string":
            return true;
        case "number":
            return isCanonicalKernelInteger(value);
        case "object":
            if (value instanceof Uint8Array) {
                return isCanonicalKernelBytes(value);
            }
            if (activeParents.has(value)) {
                return false;
            }
            activeParents.add(value);
            if (Array.isArray(value)) {
                const isValidArray = isDenseKernelArray(value, activeParents);
                activeParents.delete(value);
                return isValidArray;
            }
            if (!isPlainKernelObject(value)) {
                activeParents.delete(value);
                return false;
            }
            for (const key of Object.keys(value)) {
                if (!isKernelRecordValueInternal(value[key], activeParents)) {
                    activeParents.delete(value);
                    return false;
                }
            }
            activeParents.delete(value);
            return true;
        default:
            return false;
    }
}
function isPlainKernelObject(value) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        return false;
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
        return false;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.getOwnPropertyNames(descriptors)) {
        const descriptor = descriptors[key];
        if (!(descriptor?.enumerable && Object.hasOwn(descriptor, "value")) ||
            Object.hasOwn(descriptor, "get") ||
            Object.hasOwn(descriptor, "set")) {
            return false;
        }
    }
    return true;
}
function isDenseKernelArray(value, activeParents) {
    if (Object.getOwnPropertySymbols(value).length > 0) {
        return false;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.getOwnPropertyNames(descriptors)) {
        if (key === "length") {
            continue;
        }
        const descriptor = descriptors[key];
        const index = Number(key);
        if (!(descriptor?.enumerable &&
            Object.hasOwn(descriptor, "value") &&
            Number.isInteger(index) &&
            index >= 0 &&
            index < value.length &&
            String(index) === key) ||
            Object.hasOwn(descriptor, "get") ||
            Object.hasOwn(descriptor, "set")) {
            return false;
        }
    }
    for (let index = 0; index < value.length; index += 1) {
        if (!(Object.hasOwn(value, index) &&
            isKernelRecordValueInternal(value[index], activeParents))) {
            return false;
        }
    }
    return true;
}
function isCanonicalKernelInteger(value) {
    return (typeof value === "number" &&
        Number.isSafeInteger(value) &&
        !Object.is(value, -0));
}
function isCanonicalKernelBytes(value) {
    if (Object.getOwnPropertySymbols(value).length > 0) {
        return false;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.getOwnPropertyNames(descriptors)) {
        const descriptor = descriptors[key];
        const index = Number(key);
        if (!(descriptor?.enumerable &&
            Object.hasOwn(descriptor, "value") &&
            Number.isInteger(index) &&
            index >= 0 &&
            index < value.length &&
            String(index) === key) ||
            Object.hasOwn(descriptor, "get") ||
            Object.hasOwn(descriptor, "set")) {
            return false;
        }
    }
    return true;
}
