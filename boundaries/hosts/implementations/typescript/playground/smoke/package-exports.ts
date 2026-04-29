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
import {
  createPlaygroundHost,
  DEFAULT_GEMINI_PLAYGROUND_SCENARIOS,
  DEFAULT_PLAYGROUND_SCENARIOS,
  haveAllChecksPassed,
  loadPlaygroundConfig,
  runPlaygroundScenario,
  runPlaygroundScenarioMatrix,
} from "@tuvren/playground-host";

describe("@tuvren/playground-host package exports", () => {
  test("exposes the private playground harness surface", () => {
    expect(typeof createPlaygroundHost).toBe("function");
    expect(typeof haveAllChecksPassed).toBe("function");
    expect(typeof loadPlaygroundConfig).toBe("function");
    expect(typeof runPlaygroundScenario).toBe("function");
    expect(typeof runPlaygroundScenarioMatrix).toBe("function");
    expect(DEFAULT_GEMINI_PLAYGROUND_SCENARIOS).toContain("approval");
    expect(DEFAULT_PLAYGROUND_SCENARIOS).toContain("streaming");
  });
});
