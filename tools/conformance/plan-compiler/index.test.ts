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
});
