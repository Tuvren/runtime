use std::collections::BTreeMap;
use std::sync::Arc;

use tuvren_kernel_rust::{
    InMemoryKernel, InMemoryKernelOptions, IncorporationRule, KernelRecord, PathCollectionKind,
    PathDefinition, RunCompletionStatus, StagedResult, StagedResultStatus, StepDeclaration,
    TurnNode, TurnTreeSchema, decode_deterministic_kernel_record, hash_bytes_to_hex,
    hash_kernel_record, hash_turn_node_identity, schema_to_record,
};

#[test]
fn deterministic_identity_matches_shared_fixture_vectors() {
    let fixture: serde_json::Value = serde_json::from_str(include_str!(
        "../../../../conformance/fixtures/kernel-protocol-deterministic.json"
    ))
    .expect("fixture parses");
    let raw_bytes = fixture["rawOpaqueBytes"]
        .as_array()
        .expect("raw bytes")
        .iter()
        .map(|value| value.as_u64().expect("byte") as u8)
        .collect::<Vec<_>>();
    assert_eq!(
        hash_bytes_to_hex(&raw_bytes),
        fixture["rawOpaqueBytesSha256Hex"]
            .as_str()
            .expect("raw hash")
    );

    let schema = canonical_schema_with_metadata();
    assert_eq!(
        hash_kernel_record(&schema_to_record(&schema)).expect("schema hashes"),
        fixture["turnTreeSchemaRecordSha256Hex"]
            .as_str()
            .expect("schema hash")
    );

    let record_hex = fixture["turnTreeSchemaRecordCborHex"]
        .as_str()
        .expect("schema cbor hex");
    let decoded = decode_deterministic_kernel_record(&hex_to_bytes(record_hex))
        .expect("fixture cbor is canonical");
    assert_eq!(
        hash_kernel_record(&decoded).expect("decoded hashes"),
        fixture["turnTreeSchemaRecordSha256Hex"]
            .as_str()
            .expect("schema hash")
    );

    let turn_node_record = fixture["turnNodeIdentityRecord"]
        .as_object()
        .expect("turn node object");
    let staged = turn_node_record["consumedStagedResults"]
        .as_array()
        .expect("staged results")[0]
        .as_object()
        .expect("staged result");
    let node = TurnNode {
        consumed_staged_results: vec![StagedResult {
            interrupt_payload: None,
            object_hash: staged["objectHash"]
                .as_str()
                .expect("objectHash")
                .to_string(),
            object_type: staged["objectType"]
                .as_str()
                .expect("objectType")
                .to_string(),
            status: StagedResultStatus::Completed,
            task_id: staged["taskId"].as_str().expect("taskId").to_string(),
            timestamp_ms: staged["timestamp"].as_i64().expect("timestamp"),
        }],
        event_hash: Some(
            turn_node_record["eventHash"]
                .as_str()
                .expect("eventHash")
                .to_string(),
        ),
        hash: String::new(),
        previous_turn_node_hash: None,
        schema_id: turn_node_record["schemaId"]
            .as_str()
            .expect("schemaId")
            .to_string(),
        turn_tree_hash: turn_node_record["turnTreeHash"]
            .as_str()
            .expect("turnTreeHash")
            .to_string(),
    };
    assert_eq!(
        hash_turn_node_identity(&node).expect("node hashes"),
        fixture["turnNodeIdentityRecordSha256Hex"]
            .as_str()
            .expect("node hash")
    );
}

#[test]
fn in_memory_kernel_runs_checkpoint_and_recovery_flow() {
    let kernel = InMemoryKernel::with_options(InMemoryKernelOptions {
        now: Some(Arc::new(|| 1_717_171_717_171)),
    });
    let schema = canonical_schema();
    kernel
        .schema_register(schema)
        .expect("schema register succeeds");
    let thread = kernel
        .thread_create("thread_main", "schema_main", "branch_main")
        .expect("thread create succeeds");
    let turn = kernel
        .turn_create(
            "turn_main",
            "thread_main",
            "branch_main",
            None,
            &thread.root_turn_node_hash,
        )
        .expect("turn create succeeds");
    let run = kernel
        .run_create(
            "run_main",
            &turn.turn_id,
            "branch_main",
            "schema_main",
            &thread.root_turn_node_hash,
            vec![StepDeclaration {
                deterministic: false,
                id: "model_call".to_string(),
                metadata: None,
                side_effects: false,
            }],
        )
        .expect("run create succeeds");
    assert_eq!(run.current_step_index, 0);

    let (_, staged) = kernel
        .staging_stage(
            "run_main",
            b"hello".to_vec(),
            "msg_assistant",
            "message",
            StagedResultStatus::Completed,
            None,
        )
        .expect("stage succeeds");
    assert_eq!(staged.timestamp_ms, 1_717_171_717_171);
    let (checkpointed, turn_node_hash) = kernel
        .run_complete_step("run_main", "model_call", None, Vec::new(), None)
        .expect("step completes");
    assert!(checkpointed);
    let turn_node_hash = turn_node_hash.expect("turn node hash");
    assert_eq!(
        kernel
            .branch_get("branch_main")
            .expect("branch get")
            .expect("branch")
            .head_turn_node_hash,
        turn_node_hash
    );
    kernel
        .run_complete("run_main", RunCompletionStatus::Completed, None)
        .expect("run completes");
    let recovery = kernel.run_recover("run_main").expect("recovery succeeds");
    assert_eq!(
        recovery.last_completed_step_id.as_deref(),
        Some("model_call")
    );
    assert_eq!(recovery.consumed_staged_results.len(), 1);
}

fn canonical_schema() -> TurnTreeSchema {
    TurnTreeSchema {
        incorporation_rules: vec![
            IncorporationRule {
                object_type: "message".to_string(),
                target_path: "messages".to_string(),
            },
            IncorporationRule {
                object_type: "context_manifest".to_string(),
                target_path: "context.manifest".to_string(),
            },
        ],
        paths: vec![
            PathDefinition {
                collection: PathCollectionKind::Ordered,
                metadata: None,
                path: "messages".to_string(),
            },
            PathDefinition {
                collection: PathCollectionKind::Single,
                metadata: None,
                path: "context.manifest".to_string(),
            },
        ],
        schema_id: "schema_main".to_string(),
    }
}

fn canonical_schema_with_metadata() -> TurnTreeSchema {
    let mut chat_metadata = BTreeMap::new();
    chat_metadata.insert("role".to_string(), KernelRecord::Text("chat".to_string()));
    let mut manifest_metadata = BTreeMap::new();
    manifest_metadata.insert("version".to_string(), KernelRecord::Integer(1));
    let mut schema = canonical_schema();
    schema.paths[0].metadata = Some(KernelRecord::Map(chat_metadata));
    schema.paths[1].metadata = Some(KernelRecord::Map(manifest_metadata));
    schema
}

fn hex_to_bytes(value: &str) -> Vec<u8> {
    hex::decode(value).expect("valid hex fixture")
}
