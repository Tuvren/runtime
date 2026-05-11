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

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { loadConformancePlan } from "./index.ts";

describe("resultField required evidence", () => {
  test("roots required evidence under result instead of a bare evidence path", async () => {
    const compiledPlan = await loadConformancePlan(
      "boundaries/framework/conformance/plans/driver-api-core.json"
    );
    const check = compiledPlan.checks.find(
      (entry) => entry.check.checkId === "driver-api.execute.resolution"
    );

    expect(check?.requiredEvidence).toContain("result.driver.phase");
    expect(check?.requiredEvidence).not.toContain("driver.phase");
  });

  test("roots whole-result assertions at result", async () => {
    const compiledPlan = await loadMutatedPlan(
      "boundaries/framework/conformance/plans/driver-api-core.json",
      (plan) => {
        const checks = readArray(plan.checks, "checks");
        const targetCheck = readRecord(
          checks.find((entry) => readRecordString(entry, "checkId") === "driver-api.execute.resolution"),
          "driver-api.execute.resolution check"
        );
        const assertions = readArray(targetCheck.assertions, "assertions");
        const targetAssertion = readRecord(
          assertions.find((entry) => readRecordString(entry, "kind") === "resultField"),
          "driver-api.execute.resolution resultField assertion"
        );

        targetAssertion.field = "$";
      }
    );
    const check = compiledPlan.checks.find(
      (entry) => entry.check.checkId === "driver-api.execute.resolution"
    );

    expect(check?.requiredEvidence).toContain("result");
  });

  test("roots step resultField assertions under trace.step.result", async () => {
    const compiledPlan = await loadMutatedPlan(
      "boundaries/framework/conformance/plans/react-driver-callables.json",
      (plan) => {
        const checks = readArray(plan.checks, "checks");
        const targetCheck = readRecord(
          checks.find(
            (entry) =>
              readRecordString(entry, "checkId") ===
              "react-driver-callable.checkpoint"
          ),
          "react-driver-callable.checkpoint check"
        );
        const steps = readArray(targetCheck.steps, "steps");
        const checkpointStep = readRecord(steps[0], "checkpoint step");

        checkpointStep.assertions = [
          {
            equals: "ok",
            field: "$.answer",
            kind: "resultField",
          },
        ];
      }
    );
    const check = compiledPlan.checks.find(
      (entry) => entry.check.checkId === "react-driver-callable.checkpoint"
    );

    expect(check?.requiredEvidence).toContain(
      "result.trace.checkpoint.result.answer"
    );
  });

  test("rejects resultField assertions without a field", async () => {
    await expect(
      loadMutatedPlan("boundaries/framework/conformance/plans/driver-api-core.json", (plan) => {
        const checks = readArray(plan.checks, "checks");
        const targetCheck = readRecord(
          checks.find(
            (entry) => readRecordString(entry, "checkId") === "driver-api.execute.resolution"
          ),
          "driver-api.execute.resolution check"
        );
        const assertions = readArray(targetCheck.assertions, "assertions");
        const targetAssertion = readRecord(
          assertions.find((entry) => readRecordString(entry, "kind") === "resultField"),
          "driver-api.execute.resolution resultField assertion"
        );

        delete targetAssertion.field;
      })
    ).rejects.toThrow(
      "has no field configured on resultField assertion"
    );
  });
});

async function loadMutatedPlan(
  planPath: string,
  mutate: (plan: Record<string, unknown>) => void
) {
  const source = readRecord(
    JSON.parse(await readFile(join(process.cwd(), planPath), "utf8")),
    planPath
  );
  mutate(source);

  const tempDir = await mkdtemp(join(tmpdir(), "tuvren-plan-"));
  const tempPath = join(tempDir, "plan.json");

  await writeFile(tempPath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
  return await loadConformancePlan(tempPath);
}

function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readRecordString(
  value: unknown,
  key: string
): string | undefined {
  return typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === "string"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
