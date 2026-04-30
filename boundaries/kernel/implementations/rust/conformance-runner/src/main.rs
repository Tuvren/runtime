use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::Value;
use tuvren_kernel_rust::{
    InMemoryKernel, KernelError, KernelRecord, PathCollectionKind, PathDefinition, PathValue,
    StagedResult, StagedResultStatus, TurnNode, TurnTreeSchema, hash_bytes_to_hex,
    hash_kernel_record, hash_turn_node_identity, kernel_record_from_json, schema_to_record,
};

const MANIFEST_PATH: &str = "boundaries/kernel/conformance/scenarios/suite-manifest.json";

fn main() -> Result<(), KernelError> {
    let suite = read_suite()?;
    assert_eq!(suite.manifest.boundary, "kernel");
    assert_eq!(suite.manifest.suite_id, "tuvren.kernel.protocol-seed");
    assert_eq!(suite.manifest.suite_version, "0.1.0");

    let deterministic = suite.deterministic;
    let raw_bytes = deterministic.raw_opaque_bytes;
    assert_eq!(
        hash_bytes_to_hex(&raw_bytes),
        deterministic.raw_opaque_bytes_sha256_hex
    );

    let schema = parse_schema(&deterministic.turn_tree_schema_record)?;
    assert_eq!(
        hash_kernel_record(&schema_to_record(&schema))?,
        deterministic.turn_tree_schema_record_sha256_hex
    );

    let node = parse_turn_node_identity(&deterministic.turn_node_identity_record)?;
    assert_eq!(
        hash_turn_node_identity(&node)?,
        deterministic.turn_node_identity_record_sha256_hex
    );

    let kernel = InMemoryKernel::new();
    kernel.schema_register(parse_schema(&suite.canonical_schema)?)?;
    let created = kernel.thread_create("thread_conformance", "schema_main", "branch_main")?;
    let mut changes = BTreeMap::new();
    let logical = suite.logical;
    let logical_changes = logical
        .turn_tree_change_set
        .as_object()
        .ok_or_else(|| error("invalid_fixture", "turnTreeChangeSet must be an object"))?;
    for (path, value) in logical_changes {
        changes.insert(path.clone(), parse_path_value(value)?);
    }
    let changed_tree =
        kernel.tree_create("schema_main", changes, Some(&created.root_turn_tree_hash))?;
    let diff = kernel.tree_diff(&created.root_turn_tree_hash, &changed_tree)?;
    assert_eq!(
        diff,
        vec!["context.manifest".to_string(), "messages".to_string()]
    );

    println!(
        "kernel Rust conformance passed: {}@{}",
        suite.manifest.suite_id, suite.manifest.suite_version
    );
    Ok(())
}

#[derive(Deserialize)]
struct SuiteManifest {
    boundary: String,
    fixtures: Vec<SuiteFixture>,
    #[serde(rename = "suiteId")]
    suite_id: String,
    #[serde(rename = "suiteVersion")]
    suite_version: String,
}

#[derive(Deserialize)]
struct SuiteFixture {
    id: String,
    path: String,
}

#[derive(Deserialize)]
struct DeterministicFixture {
    #[serde(rename = "rawOpaqueBytes")]
    raw_opaque_bytes: Vec<u8>,
    #[serde(rename = "rawOpaqueBytesSha256Hex")]
    raw_opaque_bytes_sha256_hex: String,
    #[serde(rename = "turnNodeIdentityRecord")]
    turn_node_identity_record: Value,
    #[serde(rename = "turnNodeIdentityRecordSha256Hex")]
    turn_node_identity_record_sha256_hex: String,
    #[serde(rename = "turnTreeSchemaRecord")]
    turn_tree_schema_record: Value,
    #[serde(rename = "turnTreeSchemaRecordSha256Hex")]
    turn_tree_schema_record_sha256_hex: String,
}

#[derive(Deserialize)]
struct LogicalFixture {
    #[serde(rename = "turnTreeChangeSet")]
    turn_tree_change_set: Value,
}

struct FixtureSuite {
    canonical_schema: Value,
    deterministic: DeterministicFixture,
    logical: LogicalFixture,
    manifest: SuiteManifest,
}

fn read_suite() -> Result<FixtureSuite, KernelError> {
    let manifest_path = Path::new(MANIFEST_PATH);
    let manifest: SuiteManifest = read_json(manifest_path)?;
    let manifest_dir = manifest_path
        .parent()
        .ok_or_else(|| error("invalid_manifest_path", "manifest path must have a parent"))?;
    let canonical_schema: Value = read_json(&fixture_path(
        manifest_dir,
        &manifest.fixtures,
        "canonical-turn-tree-schema",
    )?)?;
    let deterministic: DeterministicFixture = read_json(&fixture_path(
        manifest_dir,
        &manifest.fixtures,
        "kernel-protocol-deterministic",
    )?)?;
    let logical: LogicalFixture = read_json(&fixture_path(
        manifest_dir,
        &manifest.fixtures,
        "kernel-protocol-logical",
    )?)?;

    Ok(FixtureSuite {
        canonical_schema,
        deterministic,
        logical,
        manifest,
    })
}

fn fixture_path(
    manifest_dir: &Path,
    fixtures: &[SuiteFixture],
    expected_id: &str,
) -> Result<PathBuf, KernelError> {
    let fixture = fixtures
        .iter()
        .find(|fixture| fixture.id == expected_id)
        .ok_or_else(|| error("fixture_not_found", "suite fixture is missing"))?;
    Ok(manifest_dir.join(&fixture.path))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, KernelError> {
    let text = fs::read_to_string(path).map_err(|source| {
        error(
            "fixture_read_failed",
            &format!("failed to read {}: {source}", path.display()),
        )
    })?;
    serde_json::from_str(&text).map_err(|source| {
        error(
            "fixture_parse_failed",
            &format!("failed to parse {}: {source}", path.display()),
        )
    })
}

fn parse_schema(value: &Value) -> Result<TurnTreeSchema, KernelError> {
    let object = value
        .as_object()
        .ok_or_else(|| error("invalid_schema_fixture", "schema fixture must be an object"))?;
    let schema_id = read_string(object.get("schemaId"), "schemaId")?;
    let paths = read_array(object.get("paths"), "paths")?
        .iter()
        .map(parse_path_definition)
        .collect::<Result<Vec<_>, _>>()?;
    let incorporation_rules = read_array(object.get("incorporationRules"), "incorporationRules")?
        .iter()
        .map(|value| {
            let object = value.as_object().ok_or_else(|| {
                error(
                    "invalid_incorporation_rule",
                    "incorporation rule must be an object",
                )
            })?;
            Ok(tuvren_kernel_rust::IncorporationRule {
                object_type: read_string(object.get("objectType"), "objectType")?,
                target_path: read_string(object.get("targetPath"), "targetPath")?,
            })
        })
        .collect::<Result<Vec<_>, KernelError>>()?;

    Ok(TurnTreeSchema {
        incorporation_rules,
        paths,
        schema_id,
    })
}

fn parse_path_definition(value: &Value) -> Result<PathDefinition, KernelError> {
    let object = value.as_object().ok_or_else(|| {
        error(
            "invalid_path_definition",
            "path definition must be an object",
        )
    })?;
    let collection = match read_string(object.get("collection"), "collection")?.as_str() {
        "ordered" => PathCollectionKind::Ordered,
        "single" => PathCollectionKind::Single,
        _ => return Err(error("invalid_path_collection", "invalid path collection")),
    };
    let metadata = object
        .get("metadata")
        .map(kernel_record_from_json)
        .transpose()?;
    Ok(PathDefinition {
        collection,
        metadata,
        path: read_string(object.get("path"), "path")?,
    })
}

fn parse_turn_node_identity(value: &Value) -> Result<TurnNode, KernelError> {
    let object = value.as_object().ok_or_else(|| {
        error(
            "invalid_turn_node_fixture",
            "turn node fixture must be an object",
        )
    })?;
    let staged_results = read_array(object.get("consumedStagedResults"), "consumedStagedResults")?
        .iter()
        .map(parse_staged_result)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(TurnNode {
        consumed_staged_results: staged_results,
        event_hash: read_nullable_string(object.get("eventHash"), "eventHash")?,
        hash: String::new(),
        previous_turn_node_hash: read_nullable_string(
            object.get("previousTurnNodeHash"),
            "previousTurnNodeHash",
        )?,
        schema_id: read_string(object.get("schemaId"), "schemaId")?,
        turn_tree_hash: read_string(object.get("turnTreeHash"), "turnTreeHash")?,
    })
}

fn parse_staged_result(value: &Value) -> Result<StagedResult, KernelError> {
    let object = value
        .as_object()
        .ok_or_else(|| error("invalid_staged_result", "staged result must be an object"))?;
    let status = match read_string(object.get("status"), "status")?.as_str() {
        "completed" => StagedResultStatus::Completed,
        "failed" => StagedResultStatus::Failed,
        "interrupted" => StagedResultStatus::Interrupted,
        _ => {
            return Err(error(
                "invalid_staged_result_status",
                "invalid staged result status",
            ));
        }
    };
    Ok(StagedResult {
        interrupt_payload: object
            .get("interruptPayload")
            .map(kernel_record_from_json)
            .transpose()?,
        object_hash: read_string(object.get("objectHash"), "objectHash")?,
        object_type: read_string(object.get("objectType"), "objectType")?,
        status,
        task_id: read_string(object.get("taskId"), "taskId")?,
        timestamp_ms: read_i64(object.get("timestamp"), "timestamp")?,
    })
}

fn parse_path_value(value: &Value) -> Result<PathValue, KernelError> {
    if value.is_null() {
        return Ok(PathValue::Null);
    }
    if let Some(text) = value.as_str() {
        return Ok(PathValue::Single(text.to_string()));
    }
    read_array(Some(value), "path value").and_then(|values| {
        values
            .iter()
            .map(|value| {
                value.as_str().map(ToString::to_string).ok_or_else(|| {
                    error("invalid_path_value", "ordered path values must be strings")
                })
            })
            .collect::<Result<Vec<_>, _>>()
            .map(PathValue::Ordered)
    })
}

fn read_string(value: Option<&Value>, label: &str) -> Result<String, KernelError> {
    value
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| {
            error(
                "invalid_string_fixture",
                &format!("{label} must be a string"),
            )
        })
}

fn read_nullable_string(value: Option<&Value>, label: &str) -> Result<Option<String>, KernelError> {
    match value {
        Some(Value::Null) => Ok(None),
        Some(Value::String(value)) => Ok(Some(value.clone())),
        _ => Err(error(
            "invalid_nullable_string_fixture",
            &format!("{label} must be a string or null"),
        )),
    }
}

fn read_i64(value: Option<&Value>, label: &str) -> Result<i64, KernelError> {
    value.and_then(Value::as_i64).ok_or_else(|| {
        error(
            "invalid_integer_fixture",
            &format!("{label} must be an integer"),
        )
    })
}

fn read_array<'a>(value: Option<&'a Value>, label: &str) -> Result<&'a Vec<Value>, KernelError> {
    value.and_then(Value::as_array).ok_or_else(|| {
        error(
            "invalid_array_fixture",
            &format!("{label} must be an array"),
        )
    })
}

fn error(code: &str, message: &str) -> KernelError {
    KernelError::new(code, message, Option::<KernelRecord>::None)
}
