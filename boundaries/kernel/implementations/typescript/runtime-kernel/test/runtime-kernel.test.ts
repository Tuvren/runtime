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

import { describe, expect, test } from "bun:test";
import { createMemoryBackend } from "@tuvren/backend-memory";
import { createRuntimeKernel } from "@tuvren/kernel-runtime";

describe("createRuntimeKernel", () => {
  test("returns a truthy RuntimeKernel instance", () => {
    const kernel = createRuntimeKernel({ backend: createMemoryBackend() });
    expect(kernel).toBeTruthy();
  });

  test("kernel has expected syscall namespaces", () => {
    const kernel = createRuntimeKernel({ backend: createMemoryBackend() });
    expect(kernel.branch).toBeTruthy();
    expect(kernel.node).toBeTruthy();
    expect(kernel.run).toBeTruthy();
    expect(kernel.schema).toBeTruthy();
    expect(kernel.staging).toBeTruthy();
    expect(kernel.store).toBeTruthy();
    expect(kernel.thread).toBeTruthy();
    expect(kernel.tree).toBeTruthy();
    expect(kernel.turn).toBeTruthy();
    expect(kernel.verdicts).toBeTruthy();
  });

  test("verdicts.compose priority: abort wins over proceed", async () => {
    const kernel = createRuntimeKernel({ backend: createMemoryBackend() });
    const result = await kernel.verdicts.compose([
      { kind: "proceed" },
      { disposition: "HardFail", kind: "abort", reason: "stop" },
    ]);
    expect(result.kind).toBe("abort");
  });

  test("verdicts.compose priority: abort wins over retry", async () => {
    const kernel = createRuntimeKernel({ backend: createMemoryBackend() });
    const result = await kernel.verdicts.compose([
      { adjustment: {}, kind: "retry" },
      { disposition: "HardFail", kind: "abort", reason: "stop" },
    ]);
    expect(result.kind).toBe("abort");
  });

  test("verdicts.compose returns proceed when all proceed", async () => {
    const kernel = createRuntimeKernel({ backend: createMemoryBackend() });
    const result = await kernel.verdicts.compose([
      { kind: "proceed" },
      { kind: "proceed" },
    ]);
    expect(result.kind).toBe("proceed");
  });
});
