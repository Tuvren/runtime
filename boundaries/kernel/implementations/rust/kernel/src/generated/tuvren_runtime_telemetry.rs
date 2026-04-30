// Copyright 2026 Oscar Yáñez Cisterna (@SkrOYC)
//
// Licensed under the Apache License, Version 2.0.
//
// Generated from telemetry/semconv/tuvren-runtime.yaml via weaver.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TuvrenRuntimeTelemetryAttributeDefinition {
    pub key: &'static str,
    pub brief: &'static str,
    pub examples: &'static [&'static str],
    pub stability: &'static str,
    pub r#type: &'static str,
}

pub const TUVREN_RUNTIME_TELEMETRY_SCHEMA_URL: &str = "https://tuvren.dev/schemas/telemetry/0.1.0";

pub const TUVREN_RUNTIME_TELEMETRY_ATTRIBUTES: &[TuvrenRuntimeTelemetryAttributeDefinition] = &[
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.backend.id",
        brief: "The backend implementation identifier selected by the runtime.",
        examples: &["sqlite"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.branch.id",
        brief: "The Tuvren runtime branch identifier.",
        examples: &["branch_main"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.checkpoint.hash",
        brief: "The current checkpoint hash observed during runtime progression.",
        examples: &["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.driver.id",
        brief: "The active driver identifier for the runtime execution.",
        examples: &["react"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.parent_checkpoint.hash",
        brief: "The parent checkpoint hash that the current checkpoint extends from.",
        examples: &["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.provider.id",
        brief: "The provider bridge or provider identifier used for model work.",
        examples: &["ai-sdk-openai"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.resumed_from.hash",
        brief: "The checkpoint hash that a resumed execution continued from.",
        examples: &["cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.run.id",
        brief: "The Tuvren runtime run identifier.",
        examples: &["run_main"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.tool_call.id",
        brief: "The current tool call identifier when the execution is inside tool work.",
        examples: &["tool_call_1"],
        stability: "development",
        r#type: "string",
    },
    TuvrenRuntimeTelemetryAttributeDefinition {
        key: "tuvren.runtime.turn.id",
        brief: "The Tuvren runtime turn identifier.",
        examples: &["turn_main"],
        stability: "development",
        r#type: "string",
    },
];

pub const TUVREN_RUNTIME_TELEMETRY_ATTRIBUTE_KEYS: &[&str] = &[
    "tuvren.runtime.backend.id",
    "tuvren.runtime.branch.id",
    "tuvren.runtime.checkpoint.hash",
    "tuvren.runtime.driver.id",
    "tuvren.runtime.parent_checkpoint.hash",
    "tuvren.runtime.provider.id",
    "tuvren.runtime.resumed_from.hash",
    "tuvren.runtime.run.id",
    "tuvren.runtime.tool_call.id",
    "tuvren.runtime.turn.id",
];
