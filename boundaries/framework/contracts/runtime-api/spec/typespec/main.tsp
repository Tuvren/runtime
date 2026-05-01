import "@typespec/json-schema";

@TypeSpec.JsonSchema.jsonSchema("https://tuvren.dev/schemas/framework/runtime-api/")
namespace Tuvren.Framework.RuntimeApi;

@minLength(1)
@pattern(".*\\S.*", "Must contain non-whitespace content.")
scalar NonEmptyString extends string;

scalar EpochMs extends int64;

model Metadata is Record<unknown>;
model TuvrenJsonSchemaObject is Record<unknown>;

union TuvrenJsonSchema {
  object: TuvrenJsonSchemaObject,
  boolean: boolean,
}

model ErrorEnvelope {
  code: NonEmptyString;
  message: string;
  details?: unknown;
  cause?: ErrorEnvelope;
}

model TextPart {
  type: "text";
  text: string;
  providerMetadata?: Metadata;
}

model ToolCallPart {
  type: "tool_call";
  callId: NonEmptyString;
  name: NonEmptyString;
  input: unknown;
  providerMetadata?: Metadata;
}

model ToolResultPart {
  type: "tool_result";
  callId: NonEmptyString;
  name: NonEmptyString;
  output: unknown;
  isError?: boolean;
  providerMetadata?: Metadata;
}

model StructuredPart {
  type: "structured";
  data: unknown;
  name?: string;
  providerMetadata?: Metadata;
}

union ContentPart {
  text: TextPart,
  toolCall: ToolCallPart,
  toolResult: ToolResultPart,
  structured: StructuredPart,
}

model TuvrenMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  parts?: ContentPart[];
  providerMetadata?: Metadata;
}

model ProviderUsage {
  inputTokens: int32;
  outputTokens: int32;
}

model TuvrenModelResponse {
  finishReason: "stop" | "tool_call" | "length" | "error" | "content_filter";
  parts: ContentPart[];
  providerMetadata?: Metadata;
  usage?: ProviderUsage;
}

model RenderedToolDefinition {
  name: NonEmptyString;
  description: string;
  inputSchema: TuvrenJsonSchema;
}

model StructuredOutputRequest {
  name?: string;
  schema: TuvrenJsonSchema;
  strict?: boolean;
}

model TuvrenPrompt {
  messages: TuvrenMessage[];
  tools?: RenderedToolDefinition[];
  responseFormat?: StructuredOutputRequest;
  config?: Metadata;
}

model PendingToolCall {
  callId: NonEmptyString;
  name: NonEmptyString;
  input: unknown;
  @minItems(1)
  decisions: NonEmptyString[];
  message: NonEmptyString;
}

model ApprovalRequest {
  completedResults: ToolResultPart[];
  @minItems(1)
  toolCalls: PendingToolCall[];
}

model ApprovalDecision {
  callId: NonEmptyString;
  type: "approve" | "edit" | "reject" | string;
  editedInput?: unknown;
  message?: string;
}

model ApprovalResponse {
  @minItems(1)
  decisions: ApprovalDecision[];
}

model ContextManifest {
  messageCount: int32;
  tokenEstimate?: int32;
  byRole?: Metadata;
  toolCalls?: Metadata;
  toolResults?: Metadata;
  extensions?: Metadata;
  turnBoundaries?: int32[];
}

model ExecutionStatus {
  phase: "running" | "paused" | "completed" | "failed";
  iterationCount: int32;
  activeAgent?: NonEmptyString;
  approval?: ApprovalRequest;
  manifest?: ContextManifest;
  pauseReason?: string;
}

model RuntimeOperationInput {
  threadId?: NonEmptyString;
  branchId?: NonEmptyString;
  turnId?: NonEmptyString;
  prompt?: TuvrenPrompt;
  messages?: TuvrenMessage[];
  approval?: ApprovalResponse;
  toolName?: NonEmptyString;
  toolInput?: unknown;
  controls?: Metadata;
}

model RuntimeOperationOutcome {
  status: "completed" | "paused" | "failed" | "running";
  response?: TuvrenModelResponse;
  approval?: ApprovalRequest;
  error?: ErrorEnvelope;
  manifest?: ContextManifest;
  events?: unknown[];
}

enum RuntimeOperationName {
  executeTurn: "runtime.execute-turn",
  providerGenerate: "runtime.provider-generate",
  providerStream: "runtime.provider-stream",
  toolExecute: "runtime.tool-execute",
  approvalResolve: "runtime.approval-resolve",
  contextTransform: "runtime.context-transform",
  branchCreate: "runtime.branch-create",
  cancelExecution: "runtime.cancel-execution",
  recoverResult: "runtime.recover-result",
  validateStructuredOutput: "runtime.validate-structured-output",
}

model RuntimeOperation {
  operation: RuntimeOperationName;
  input: RuntimeOperationInput;
  outcome?: RuntimeOperationOutcome;
}
