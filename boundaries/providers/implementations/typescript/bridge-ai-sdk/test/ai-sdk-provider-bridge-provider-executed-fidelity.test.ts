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

// biome-ignore-all lint/suspicious/useAwait: Mock AI SDK model hooks intentionally preserve async provider signatures.

// KRT-BH005 — Bridge providerExecuted/dynamic fidelity audit (ADR-055).
//
// AI SDK v6 (ai@6.0.142) models a provider-executed tool round-trip as a
// `tool-call` content/stream part carrying `providerExecuted: true` (and, for
// runtime-defined provider tools such as MCP, `dynamic: true`) FOLLOWED BY a
// `tool-result` part. vercel/ai #10888 (open as of 2026-06) is the landmine in
// the AI SDK's own higher-level orchestration: `parseToolCall` — reached only
// through `generateText`/`streamText` — validates these provider-executed
// tool-calls against the USER's function tool map and injects a spurious
// "invalid tool" error when the provider-executed tool name is absent from that
// map (which it always is — the user never declared the provider's built-in).
//
// Tuvren's bridge consumes the LOW-LEVEL `LanguageModelV3.doGenerate`/`doStream`
// contract directly, so `parseToolCall` is never in the path. This audit proves
// that structural immunity behaviourally: a provider-executed tool round-trip is
// driven through the bridge with a user function tool map that deliberately does
// NOT contain the provider-executed tool name (the exact #10888 trigger), and
// the bridge must attribute the round-trip to the provider-native execution
// class WITHOUT injecting a validation error and WITHOUT contaminating the
// client-facing `parts` with a function tool_call the runtime would try to run.

import { describe, expect, test } from "bun:test";
import { TuvrenProviderError } from "@tuvren/core";
import { createAiSdkProviderBridge } from "../src/index.ts";
import {
  collectAsyncIterable,
  createGenerateResult,
  createMockModel,
  createUsage,
  streamFromParts,
} from "./ai-sdk-provider-bridge-test-helpers.ts";

// A user function tool map that does NOT contain the provider-executed tool
// name — the exact configuration that makes AI SDK #10888 fire in generateText.
const USER_FUNCTION_TOOLS = [
  {
    name: "my_function",
    description: "a user-owned function tool",
    inputSchema: { type: "object" as const },
  },
];

// A provider-executed web search, declared to Tuvren as a provider-native tool.
const WEB_SEARCH_DECLARATION = {
  id: "openai.web_search_preview",
  name: "web_search",
};

const WEB_SEARCH_RESULT = {
  results: [{ title: "Tuvren", url: "https://example.com" }],
};

describe("KRT-BH005 provider-executed/dynamic fidelity (generate)", () => {
  test("attributes a providerExecuted+dynamic round-trip to provider-native without a spurious validation error", async () => {
    const bridge = createAiSdkProviderBridge({
      model: createMockModel({
        provider: "openai",
        async doGenerate() {
          // Realistic provider-executed round-trip: the provider's own tool-call
          // record (providerExecuted + dynamic) precedes the tool-result.
          return createGenerateResult({
            content: [
              {
                dynamic: true,
                input: JSON.stringify({ query: "tuvren runtime" }),
                providerExecuted: true,
                toolCallId: "ws-1",
                toolName: "web_search",
                type: "tool-call",
              },
              {
                result: WEB_SEARCH_RESULT,
                toolCallId: "ws-1",
                toolName: "web_search",
                type: "tool-result",
              },
              {
                text: "Based on the search, Tuvren is a runtime.",
                type: "text",
              },
            ],
            finishReason: { raw: "stop", unified: "stop" },
          });
        },
      }),
    });

    const response = await bridge.generate({
      messages: [{ parts: [{ text: "search", type: "text" }], role: "user" }],
      tools: USER_FUNCTION_TOOLS,
      providerNativeTools: [WEB_SEARCH_DECLARATION],
    });

    // (1) The provider-executed result is attributed to provider-native.
    expect(response.providerToolResults).toHaveLength(1);
    const record = response.providerToolResults?.[0];
    expect(record?.name).toBe("web_search");
    expect(record?.executionClass).toBe("provider-native");

    // (2) No spurious validation error: the provider-executed tool-call did NOT
    // get mis-validated against the user function tool map (#10888). The
    // assistant text part is produced normally.
    expect(
      response.parts.some(
        (part) => part.type === "text" && part.text.includes("Tuvren")
      )
    ).toBe(true);

    // (3) The provider-executed tool-call does NOT contaminate the client-facing
    // parts with a function tool_call the runtime would attempt to execute.
    expect(
      response.parts.some(
        (part) => part.type === "tool_call" || part.type === "tool_result"
      )
    ).toBe(false);
  });

  test("still rejects an UNDECLARED providerExecuted tool-call (baseline protection)", async () => {
    const bridge = createAiSdkProviderBridge({
      model: createMockModel({
        provider: "openai",
        async doGenerate() {
          return createGenerateResult({
            content: [
              {
                dynamic: true,
                input: "{}",
                providerExecuted: true,
                toolCallId: "ws-2",
                toolName: "undeclared_tool",
                type: "tool-call",
              },
            ],
            finishReason: { raw: "tool-calls", unified: "tool-calls" },
          });
        },
      }),
    });

    // No providerNativeTools declared → the provider-owned execution is genuinely
    // out of scope for the baseline bridge and must still be rejected.
    await expect(
      bridge.generate({
        messages: [{ parts: [{ text: "go", type: "text" }], role: "user" }],
      })
    ).rejects.toBeInstanceOf(TuvrenProviderError);
  });
});

describe("KRT-BH005 provider-executed/dynamic fidelity (stream)", () => {
  test("attributes a streamed providerExecuted+dynamic round-trip to provider-native without a spurious validation error", async () => {
    const bridge = createAiSdkProviderBridge({
      model: createMockModel({
        provider: "openai",
        async doStream() {
          return {
            stream: streamFromParts([
              {
                dynamic: true,
                input: JSON.stringify({ query: "tuvren runtime" }),
                providerExecuted: true,
                toolCallId: "ws-1",
                toolName: "web_search",
                type: "tool-call",
              },
              {
                result: WEB_SEARCH_RESULT,
                toolCallId: "ws-1",
                toolName: "web_search",
                type: "tool-result",
              },
              { delta: "ok", id: "t-1", type: "text-delta" },
              {
                finishReason: { raw: "stop", unified: "stop" },
                type: "finish",
                usage: createUsage(3, 2),
              },
            ]),
          };
        },
      }),
    });

    const chunks = await collectAsyncIterable(
      bridge.stream({
        messages: [{ parts: [{ text: "search", type: "text" }], role: "user" }],
        tools: USER_FUNCTION_TOOLS,
        providerNativeTools: [WEB_SEARCH_DECLARATION],
      })
    );

    // (1) The provider-executed result surfaces as a provider_tool_result chunk
    // attributed to the provider-native execution class.
    const providerResult = chunks.find(
      (chunk) => chunk.type === "provider_tool_result"
    );
    expect(providerResult).toBeDefined();
    expect((providerResult as { name: string }).name).toBe("web_search");
    expect(
      (providerResult as { providerMetadata?: Record<string, unknown> })
        .providerMetadata?.executionClass
    ).toBe("provider-native");

    // (2) No spurious validation error and no client-facing tool_call chunk for
    // the provider-executed call: only the provider_tool_result carries it.
    expect(
      chunks.some(
        (chunk) =>
          chunk.type === "tool_call_start" || chunk.type === "tool_call_done"
      )
    ).toBe(false);
  });
});
