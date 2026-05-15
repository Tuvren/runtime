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

import { decodeSseStream, reportSseWireCompliance } from "@tuvren/stream-sse";
import type { AdapterProjection } from "./framework-adapter-runtime.ts";

export function createFrameworkAdapterEventStreamSse(): {
  runDecodeTrace(input: unknown): Promise<AdapterProjection>;
  runReportWireCompliance(input: unknown): Promise<AdapterProjection>;
} {
  async function runDecodeTrace(input: unknown): Promise<AdapterProjection> {
    // The shared runner resolves the plan's `fixturePath` against the SSE
    // trace fixture and passes the resolved value on `input.fixture`. For
    // every check in `event-stream-sse.json`, that value is the
    // `encodedBytes` string for one WHATWG-normative trace, so the adapter's
    // only responsibility is to feed the bytes through the language-local
    // WHATWG decoder and surface the result under `result.sse.decoded` —
    // the shape the SSE plan's `resultField` and `schemaValid` assertions
    // walk.
    await Promise.resolve();
    const encodedBytes = readEncodedBytes(input);
    const decoded = decodeSseStream(encodedBytes);

    return {
      result: {
        sse: {
          decoded,
        },
      },
    };
  }

  async function runReportWireCompliance(
    _input: unknown
  ): Promise<AdapterProjection> {
    // `event-stream-sse.report-wire-compliance` is a self-report check: the
    // plan asserts each normative wire property as an independent boolean
    // under `$.sse.wire.*` so a regression in any one property surfaces as
    // its own failure rather than collapsing into a single composite signal.
    await Promise.resolve();

    return {
      result: {
        sse: {
          wire: reportSseWireCompliance(),
        },
      },
    };
  }

  return { runDecodeTrace, runReportWireCompliance };
}

function readEncodedBytes(input: unknown): string {
  if (
    typeof input === "object" &&
    input !== null &&
    "fixture" in input &&
    typeof (input as { fixture: unknown }).fixture === "string"
  ) {
    return (input as { fixture: string }).fixture;
  }

  throw new Error(
    "event-stream-sse.decode-trace expects the runner to supply the resolved encodedBytes string under input.fixture"
  );
}
