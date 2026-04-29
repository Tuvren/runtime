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
import { fileURLToPath } from "node:url";
import { parse } from "cddl";

const REQUIRED_CDDL_ASSIGNMENTS = [
  "turn-tree-schema",
  "turn-tree-manifest",
  "staged-result",
  "turn-node",
  "thread-record",
  "branch-record",
  "turn-record",
  "run-record",
  "recovery-state",
  "thread-create-result",
  "branch-head-list-entry",
  "set-head-result",
  "stored-object",
  "stored-turn-tree",
  "stored-turn-node",
  "stored-run",
  "stored-staged-result",
] as const;

describe("kernel CDDL grammar", () => {
  test("parses the authored kernel record grammar and names canonical families", () => {
    const cddlPath = fileURLToPath(
      new URL("../spec/cddl/kernel-records.cddl", import.meta.url)
    );
    const assignments = parse(cddlPath);
    const assignmentNames = new Set(
      assignments.map((assignment) => assignment.Name)
    );

    for (const requiredAssignment of REQUIRED_CDDL_ASSIGNMENTS) {
      expect(assignmentNames.has(requiredAssignment)).toBe(true);
    }
  });
});
