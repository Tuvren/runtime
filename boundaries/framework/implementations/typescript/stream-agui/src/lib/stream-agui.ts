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

import { type AGUIEvent, EventSchemas, EventType } from "@ag-ui/core";
import { TuvrenRuntimeError } from "@tuvren/core-types";
import type { TuvrenStreamEvent } from "@tuvren/event-stream";
import {
  cloneTuvrenStreamEvent,
  createStreamAdapterWarningReporter,
  type StreamAdapterOptions,
} from "@tuvren/stream-core";

interface PendingReasoningState {
  messageStarted: boolean;
  started: boolean;
}

interface PendingTextState {
  ended: boolean;
  sawContent: boolean;
  started: boolean;
}

interface PendingToolCallState {
  argsEmitted: boolean;
  name?: string;
  parentMessageId?: string;
  started: boolean;
}

const CUSTOM_FALLBACK_WARNING_CODES = {
  approval: "agui_approval_custom_fallback",
  file: "agui_file_output_custom_fallback",
  messageDone: "agui_message_done_custom_fallback",
  nonFatalError: "agui_nonfatal_error_custom_fallback",
  pausedTurn: "agui_paused_turn_coerced_to_run_finished",
  stateCheckpoint: "agui_state_checkpoint_custom_fallback",
  steering: "agui_steering_custom_fallback",
  structured: "agui_structured_output_custom_fallback",
  toolExecution: "agui_tool_execution_custom_fallback",
} as const;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Protocol projection intentionally keeps the canonical-to-AG-UI mapping table in one switch.
export async function* toAgUiEvents(
  events: AsyncIterable<TuvrenStreamEvent>,
  options?: StreamAdapterOptions
): AsyncIterable<AGUIEvent> {
  const reportWarning = createStreamAdapterWarningReporter(options);
  const reasoningStates = new Map<string, PendingReasoningState>();
  const textStates = new Map<string, PendingTextState>();
  const toolCallStates = new Map<string, PendingToolCallState>();
  let activeRunId: string | undefined;
  let activeThreadId: string | undefined;
  let latestFatalError:
    | Extract<TuvrenStreamEvent, { type: "error" }>
    | undefined;

  for await (const event of events) {
    switch (event.type) {
      case "turn.start": {
        // Tuvren exposes turn ids, not AG-UI-native run ids. Resumed executions
        // therefore derive a stable adapter-local run id instead of inventing a
        // new canonical runtime field.
        activeRunId =
          event.resumedFrom === undefined
            ? event.turnId
            : `${event.turnId}:resume:${event.resumedFrom}`;
        activeThreadId = event.threadId;
        latestFatalError = undefined;

        yield validateAgUiEvent({
          rawEvent: cloneTuvrenStreamEvent(event),
          runId: activeRunId,
          threadId: activeThreadId,
          timestamp: event.timestamp,
          type: EventType.RUN_STARTED,
        });
        break;
      }
      case "turn.end": {
        if (event.status === "failed") {
          yield validateAgUiEvent({
            code: latestFatalError?.error.code,
            message:
              latestFatalError?.error.message ??
              `Turn "${event.turnId}" failed without a fatal error event.`,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.RUN_ERROR,
          });
        } else {
          const activeRunState = requireActiveRunState(
            activeRunId,
            activeThreadId,
            event
          );

          if (event.status === "paused") {
            reportWarning({
              code: CUSTOM_FALLBACK_WARNING_CODES.pausedTurn,
              message:
                "AG-UI has no first-class paused run event, so paused turns are emitted as CUSTOM plus RUN_FINISHED.",
            });

            // The custom pause event preserves the exact Tuvren semantics. The
            // following RUN_FINISHED keeps AG-UI lifecycle consumers well-formed.
            yield createCustomAgUiEvent(
              "tuvren.runtime.turn.paused",
              event,
              event.timestamp
            );
          }

          yield validateAgUiEvent({
            rawEvent: cloneTuvrenStreamEvent(event),
            result: {
              status: event.status,
            },
            runId: activeRunState.runId,
            threadId: activeRunState.threadId,
            timestamp: event.timestamp,
            type: EventType.RUN_FINISHED,
          });
        }

        activeRunId = undefined;
        activeThreadId = undefined;
        latestFatalError = undefined;
        break;
      }
      case "iteration.start":
        yield validateAgUiEvent({
          rawEvent: cloneTuvrenStreamEvent(event),
          stepName: `iteration-${event.iterationCount}`,
          timestamp: event.timestamp,
          type: EventType.STEP_STARTED,
        });
        break;
      case "iteration.end":
        yield validateAgUiEvent({
          rawEvent: cloneTuvrenStreamEvent(event),
          stepName: `iteration-${event.iterationCount}`,
          timestamp: event.timestamp,
          type: EventType.STEP_FINISHED,
        });
        break;
      case "message.start":
        if (!textStates.has(event.messageId)) {
          textStates.set(event.messageId, {
            ended: false,
            sawContent: false,
            started: false,
          });
        }
        break;
      case "text.delta": {
        const textState = ensureTextState(textStates, event.messageId);

        if (!textState.started) {
          textState.started = true;
          yield validateAgUiEvent({
            messageId: event.messageId,
            rawEvent: cloneTuvrenStreamEvent(event),
            role: "assistant",
            timestamp: event.timestamp,
            type: EventType.TEXT_MESSAGE_START,
          });
        }

        if (event.delta.length > 0) {
          textState.sawContent = true;
          yield validateAgUiEvent({
            delta: event.delta,
            messageId: event.messageId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.TEXT_MESSAGE_CONTENT,
          });
        }
        break;
      }
      case "text.done": {
        const textState = ensureTextState(textStates, event.messageId);

        if (!textState.started) {
          textState.started = true;
          yield validateAgUiEvent({
            messageId: event.messageId,
            rawEvent: cloneTuvrenStreamEvent(event),
            role: "assistant",
            timestamp: event.timestamp,
            type: EventType.TEXT_MESSAGE_START,
          });
        }

        if (!textState.sawContent && event.text.length > 0) {
          textState.sawContent = true;
          yield validateAgUiEvent({
            delta: event.text,
            messageId: event.messageId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.TEXT_MESSAGE_CONTENT,
          });
        }

        if (!textState.ended) {
          textState.ended = true;
          yield validateAgUiEvent({
            messageId: event.messageId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.TEXT_MESSAGE_END,
          });
        }
        break;
      }
      case "reasoning.delta": {
        const reasoningId = toReasoningMessageId(event.messageId);
        const reasoningState = ensureReasoningState(
          reasoningStates,
          reasoningId
        );

        if (!reasoningState.started) {
          reasoningState.started = true;
          yield validateAgUiEvent({
            messageId: reasoningId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.REASONING_START,
          });
        }

        if (!reasoningState.messageStarted) {
          reasoningState.messageStarted = true;
          yield validateAgUiEvent({
            messageId: reasoningId,
            rawEvent: cloneTuvrenStreamEvent(event),
            role: "reasoning",
            timestamp: event.timestamp,
            type: EventType.REASONING_MESSAGE_START,
          });
        }

        if (event.delta.length > 0) {
          yield validateAgUiEvent({
            delta: event.delta,
            messageId: reasoningId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.REASONING_MESSAGE_CONTENT,
          });
        }
        break;
      }
      case "reasoning.done": {
        const reasoningId = toReasoningMessageId(event.messageId);
        const reasoningState = ensureReasoningState(
          reasoningStates,
          reasoningId
        );

        if (!reasoningState.started) {
          reasoningState.started = true;
          yield validateAgUiEvent({
            messageId: reasoningId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.REASONING_START,
          });
        }

        if (reasoningState.messageStarted) {
          yield validateAgUiEvent({
            messageId: reasoningId,
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            type: EventType.REASONING_MESSAGE_END,
          });
        }

        yield validateAgUiEvent({
          messageId: reasoningId,
          rawEvent: cloneTuvrenStreamEvent(event),
          timestamp: event.timestamp,
          type: EventType.REASONING_END,
        });
        break;
      }
      case "tool_call.start": {
        const toolCallState = toolCallStates.get(event.callId);

        toolCallStates.set(event.callId, {
          argsEmitted: toolCallState?.argsEmitted ?? false,
          name: event.name,
          parentMessageId: event.messageId,
          started: true,
        });
        yield validateAgUiEvent({
          parentMessageId: event.messageId,
          rawEvent: cloneTuvrenStreamEvent(event),
          timestamp: event.timestamp,
          toolCallId: event.callId,
          toolCallName: event.name,
          type: EventType.TOOL_CALL_START,
        });
        break;
      }
      case "tool_call.args_delta": {
        const toolCallState = toolCallStates.get(event.callId);

        if (toolCallState === undefined || !toolCallState.started) {
          yield createCustomFallbackEvent(
            "tuvren.runtime.tool_call.args_delta",
            event,
            reportWarning,
            "toolExecution"
          );
          break;
        }

        if (event.delta.length === 0) {
          break;
        }

        toolCallState.argsEmitted = true;
        yield validateAgUiEvent({
          delta: event.delta,
          rawEvent: cloneTuvrenStreamEvent(event),
          timestamp: event.timestamp,
          toolCallId: event.callId,
          type: EventType.TOOL_CALL_ARGS,
        });
        break;
      }
      case "tool_call.done": {
        const toolCallState = toolCallStates.get(event.callId) ?? {
          argsEmitted: false,
          name: event.name,
          started: false,
        };

        if (!toolCallState.started) {
          // Canonical streams may legitimately materialize only the finalized
          // tool_call.done payload. In that case we synthesize the AG-UI start
          // and args events from the durable final input instead of dropping the
          // tool call.
          toolCallState.started = true;
          toolCallState.name = event.name;
          toolCallStates.set(event.callId, toolCallState);
          yield validateAgUiEvent({
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            toolCallId: event.callId,
            toolCallName: event.name,
            type: EventType.TOOL_CALL_START,
          });
        }

        if (!toolCallState.argsEmitted) {
          toolCallState.argsEmitted = true;
          yield validateAgUiEvent({
            delta: serializeAgUiTextValue(event.input),
            rawEvent: cloneTuvrenStreamEvent(event),
            timestamp: event.timestamp,
            toolCallId: event.callId,
            type: EventType.TOOL_CALL_ARGS,
          });
        }

        yield validateAgUiEvent({
          rawEvent: cloneTuvrenStreamEvent(event),
          timestamp: event.timestamp,
          toolCallId: event.callId,
          type: EventType.TOOL_CALL_END,
        });
        break;
      }
      case "tool.result":
        yield validateAgUiEvent({
          content: serializeAgUiTextValue(event.output),
          messageId: `tool-result:${event.callId}`,
          rawEvent: cloneTuvrenStreamEvent(event),
          role: "tool",
          timestamp: event.timestamp,
          toolCallId: event.callId,
          type: EventType.TOOL_CALL_RESULT,
        });
        break;
      case "state.snapshot":
        yield validateAgUiEvent({
          rawEvent: cloneTuvrenStreamEvent(event),
          snapshot: {
            contextManifest: event.manifest,
          },
          timestamp: event.timestamp,
          type: EventType.STATE_SNAPSHOT,
        });
        break;
      case "custom":
        yield createCustomAgUiEvent(
          event.name,
          event.data,
          event.timestamp,
          event
        );
        break;
      case "error":
        if (event.fatal) {
          latestFatalError = event;
          break;
        }

        yield createCustomFallbackEvent(
          "tuvren.runtime.error",
          event,
          reportWarning,
          "nonFatalError"
        );
        break;
      case "approval.requested":
        yield createCustomFallbackEvent(
          "tuvren.runtime.approval.requested",
          event,
          reportWarning,
          "approval"
        );
        break;
      case "approval.resolved":
        yield createCustomFallbackEvent(
          "tuvren.runtime.approval.resolved",
          event,
          reportWarning,
          "approval"
        );
        break;
      case "file.done":
        yield createCustomFallbackEvent(
          "tuvren.runtime.file.done",
          event,
          reportWarning,
          "file"
        );
        break;
      case "message.done":
        yield createCustomFallbackEvent(
          "tuvren.runtime.message.done",
          event,
          reportWarning,
          "messageDone"
        );
        break;
      case "state.checkpoint":
        yield createCustomFallbackEvent(
          "tuvren.runtime.state.checkpoint",
          event,
          reportWarning,
          "stateCheckpoint"
        );
        break;
      case "steering.incorporated":
        yield createCustomFallbackEvent(
          "tuvren.runtime.steering.incorporated",
          event,
          reportWarning,
          "steering"
        );
        break;
      case "structured.delta":
        yield createCustomFallbackEvent(
          "tuvren.runtime.structured.delta",
          event,
          reportWarning,
          "structured"
        );
        break;
      case "structured.done":
        yield createCustomFallbackEvent(
          "tuvren.runtime.structured.done",
          event,
          reportWarning,
          "structured"
        );
        break;
      case "tool.start":
        yield createCustomFallbackEvent(
          "tuvren.runtime.tool.start",
          event,
          reportWarning,
          "toolExecution"
        );
        break;
      default:
        throwUnreachableEvent(event);
    }
  }
}

function createCustomAgUiEvent(
  name: string,
  value: unknown,
  timestamp: number,
  rawEvent?: TuvrenStreamEvent
): AGUIEvent {
  return validateAgUiEvent({
    name,
    rawEvent:
      rawEvent === undefined ? undefined : cloneTuvrenStreamEvent(rawEvent),
    timestamp,
    type: EventType.CUSTOM,
    value,
  });
}

function createCustomFallbackEvent(
  name: string,
  event: TuvrenStreamEvent,
  reportWarning: (warning: { code: string; message: string }) => void,
  warningCode: keyof typeof CUSTOM_FALLBACK_WARNING_CODES
): AGUIEvent {
  reportWarning({
    code: CUSTOM_FALLBACK_WARNING_CODES[warningCode],
    message: `AG-UI requires a CUSTOM fallback for "${event.type}".`,
  });

  return createCustomAgUiEvent(name, event, event.timestamp, event);
}

function requireActiveRunState(
  activeRunId: string | undefined,
  activeThreadId: string | undefined,
  event: Extract<TuvrenStreamEvent, { type: "turn.end" }>
): { runId: string; threadId: string } {
  if (activeRunId !== undefined && activeThreadId !== undefined) {
    return {
      runId: activeRunId,
      threadId: activeThreadId,
    };
  }

  throw new TuvrenRuntimeError(
    `turn "${event.turnId}" ended without a preceding turn.start`,
    {
      code: "invalid_stream_adapter_state",
    }
  );
}

function ensureReasoningState(
  states: Map<string, PendingReasoningState>,
  reasoningId: string
): PendingReasoningState {
  const existingState = states.get(reasoningId);

  if (existingState !== undefined) {
    return existingState;
  }

  const nextState: PendingReasoningState = {
    messageStarted: false,
    started: false,
  };
  states.set(reasoningId, nextState);
  return nextState;
}

function ensureTextState(
  states: Map<string, PendingTextState>,
  messageId: string
): PendingTextState {
  const existingState = states.get(messageId);

  if (existingState !== undefined) {
    return existingState;
  }

  const nextState: PendingTextState = {
    ended: false,
    sawContent: false,
    started: false,
  };
  states.set(messageId, nextState);
  return nextState;
}

function serializeAgUiTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const serialized = JSON.stringify(value);
  return serialized ?? "null";
}

function toReasoningMessageId(messageId: string): string {
  return `${messageId}:reasoning`;
}

function validateAgUiEvent(event: AGUIEvent): AGUIEvent {
  try {
    return EventSchemas.parse(event);
  } catch (error: unknown) {
    throw new TuvrenRuntimeError("stream-agui emitted an invalid AG-UI event", {
      cause: error,
      code: "invalid_agui_event",
      details: event,
    });
  }
}

function throwUnreachableEvent(event: never): never {
  throw new TuvrenRuntimeError(
    "stream-agui received an unhandled stream event",
    {
      code: "invalid_stream_adapter_state",
      details: event,
    }
  );
}
