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
import type { TuvrenStreamEvent } from "@tuvren/event-stream";
import {
  cloneTuvrenStreamEvent,
  createFixtureStream,
  createStreamAdapterWarningReporter,
  serializeTuvrenStreamEvent,
  streamAdapterFixtures,
  teeTuvrenStreamEvents,
} from "../src/index.ts";

const EVENT_STREAMS_CONSUMED_PATTERN =
  /event streams may only be consumed once/;

describe("stream-core", () => {
  test("tees one canonical stream into isolated single-consumer branches", async () => {
    let started = false;
    // biome-ignore lint/suspicious/useAwait: Async generators must remain async even when fixture production is synchronous.
    const source = (async function* (): AsyncIterable<TuvrenStreamEvent> {
      started = true;

      for (const event of streamAdapterFixtures.completedTurn) {
        yield cloneTuvrenStreamEvent(event);
      }
    })();
    const [leftBranch, rightBranch] = teeTuvrenStreamEvents(source, 2);

    expect(started).toBe(false);

    const leftEventsPromise = collectEvents(leftBranch);
    const rightEventsPromise = collectEvents(rightBranch);
    const [leftEvents, rightEvents] = await Promise.all([
      leftEventsPromise,
      rightEventsPromise,
    ]);

    expect(started).toBe(true);
    expect(leftEvents).toEqual([...streamAdapterFixtures.completedTurn]);
    expect(rightEvents).toEqual([...streamAdapterFixtures.completedTurn]);
    expect(leftEvents[0]).not.toBe(rightEvents[0]);

    if (
      leftEvents[0]?.type !== "turn.start" ||
      rightEvents[0]?.type !== "turn.start"
    ) {
      throw new Error("expected turn.start fixtures");
    }

    leftEvents[0].turnId = "mutated-left";
    expect(rightEvents[0].turnId).toBe("turn-main");

    expect(() => leftBranch[Symbol.asyncIterator]()).toThrow(
      EVENT_STREAMS_CONSUMED_PATTERN
    );
  });

  test("dedupes warnings by code and swallows observer failures", () => {
    const warnings: string[] = [];
    const reportWarning = createStreamAdapterWarningReporter({
      onWarning(warning) {
        warnings.push(warning.code);

        if (warning.code === "first_warning") {
          throw new Error("observer failure should be ignored");
        }
      },
    });

    reportWarning({
      code: "first_warning",
      message: "one",
    });
    reportWarning({
      code: "first_warning",
      message: "duplicate",
    });
    reportWarning({
      code: "second_warning",
      message: "two",
    });

    expect(warnings).toEqual(["first_warning", "second_warning"]);
  });

  test("serializes Uint8Array payloads into JSON-safe marker objects", async () => {
    const [event] = await collectEvents(
      createFixtureStream([
        {
          data: new Uint8Array([1, 2, 3]),
          mediaType: "application/octet-stream",
          messageId: "message-binary",
          timestamp: 1,
          type: "file.done",
        },
      ])
    );

    if (event?.type !== "file.done") {
      throw new Error("expected file.done event");
    }

    const serialized = serializeTuvrenStreamEvent(event);

    expect(JSON.parse(serialized)).toEqual({
      data: {
        data: [1, 2, 3],
        type: "Uint8Array",
      },
      mediaType: "application/octet-stream",
      messageId: "message-binary",
      timestamp: 1,
      type: "file.done",
    });
  });
});

async function collectEvents<T>(events: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];

  for await (const event of events) {
    collected.push(event);
  }

  return collected;
}
