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
import { EventSchemas, EventType } from "@ag-ui/core";
import type { TuvrenStreamEvent } from "@tuvren/event-stream";
import {
  createFixtureStream,
  streamAdapterFixtures,
} from "@tuvren/stream-core";
import { toAgUiEvents } from "../src/index.ts";

describe("stream-agui", () => {
  test("maps canonical runtime events onto validated AG-UI events", async () => {
    const warnings: string[] = [];
    const events = await collectEvents(
      toAgUiEvents(createFixtureStream(streamAdapterFixtures.completedTurn), {
        onWarning(warning) {
          warnings.push(warning.code);
        },
      })
    );

    expect(events.map((event) => EventSchemas.parse(event).type)).toEqual([
      EventType.RUN_STARTED,
      EventType.STEP_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      EventType.CUSTOM,
      EventType.TOOL_CALL_RESULT,
      EventType.STATE_SNAPSHOT,
      EventType.CUSTOM,
      EventType.CUSTOM,
      EventType.STEP_FINISHED,
      EventType.RUN_FINISHED,
    ]);

    expect(warnings).toEqual([
      "agui_tool_execution_custom_fallback",
      "agui_message_done_custom_fallback",
    ]);
    expect(events[0]?.rawEvent).toEqual(streamAdapterFixtures.completedTurn[0]);

    const stateSnapshot = events.find(
      (event) => event.type === EventType.STATE_SNAPSHOT
    );

    expect(stateSnapshot?.snapshot).toEqual({
      contextManifest:
        streamAdapterFixtures.completedTurn[10]?.type === "state.snapshot"
          ? streamAdapterFixtures.completedTurn[10].manifest
          : undefined,
    });
  });

  test("coerces paused approval turns into CUSTOM plus RUN_FINISHED", async () => {
    const warnings: string[] = [];
    const events = await collectEvents(
      toAgUiEvents(createFixtureStream(streamAdapterFixtures.pausedTurn), {
        onWarning(warning) {
          warnings.push(warning.code);
        },
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.CUSTOM,
      EventType.CUSTOM,
      EventType.RUN_FINISHED,
    ]);
    expect(warnings).toEqual([
      "agui_approval_custom_fallback",
      "agui_paused_turn_coerced_to_run_finished",
    ]);

    const pausedTurnEvent = events.find(
      (event) =>
        event.type === EventType.CUSTOM &&
        event.name === "tuvren.runtime.turn.paused"
    );

    expect(pausedTurnEvent?.value).toEqual(streamAdapterFixtures.pausedTurn[2]);
  });

  test("uses the last fatal canonical error to emit RUN_ERROR on failed turns", async () => {
    const events = await collectEvents(
      toAgUiEvents(createFixtureStream(streamAdapterFixtures.failedTurn))
    );

    expect(events.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.RUN_ERROR,
    ]);
    expect(events[1]).toMatchObject({
      code: "runtime_execution_cancelled",
      message: "execution cancelled",
      type: EventType.RUN_ERROR,
    });
  });

  test("synthesizes missing tool-call args from tool_call.done input", async () => {
    const events = await collectEvents(
      toAgUiEvents(
        createFixtureStream([
          {
            threadId: "thread-tools",
            timestamp: 1,
            turnId: "turn-tools",
            type: "turn.start",
          },
          {
            callId: "call-weather",
            input: {
              city: "Santiago",
            },
            name: "get_weather",
            timestamp: 2,
            type: "tool_call.done",
          },
          {
            status: "completed",
            timestamp: 3,
            turnId: "turn-tools",
            type: "turn.end",
          },
        ] satisfies readonly TuvrenStreamEvent[])
      )
    );

    expect(events.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      EventType.RUN_FINISHED,
    ]);
    expect(events[2]).toMatchObject({
      delta: '{"city":"Santiago"}',
      type: EventType.TOOL_CALL_ARGS,
    });
  });

  test("synthesizes a text content event when only text.done exists", async () => {
    const events = await collectEvents(
      toAgUiEvents(
        createFixtureStream([
          {
            threadId: "thread-text",
            timestamp: 1,
            turnId: "turn-text",
            type: "turn.start",
          },
          {
            messageId: "message-text",
            text: "Final only",
            timestamp: 2,
            type: "text.done",
          },
          {
            status: "completed",
            timestamp: 3,
            turnId: "turn-text",
            type: "turn.end",
          },
        ] satisfies readonly TuvrenStreamEvent[])
      )
    );

    expect(events.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
    expect(events[2]).toMatchObject({
      delta: "Final only",
      type: EventType.TEXT_MESSAGE_CONTENT,
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
