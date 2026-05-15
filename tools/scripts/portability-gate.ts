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
 *
 * Epic AL portability gate.
 *
 * Enforces the Epic AL portable-surface inventory's closed state:
 *  - Every surface classified `portable` in the inventory owns a registered
 *    authority packet with at least one executable verification path.
 *  - Standing implementation-specific exceptions (AG-UI, AI-SDK bridge) do
 *    not silently acquire a packet without an explicit Tasks.md/TechSpec
 *    revision.
 *  - The active set of authority packets matches the inventory exactly —
 *    new packets must arrive through an inventory revision so portability
 *    scope cannot drift below or above the documented surface.
 *  - Cross-implementation authority sources required by the inventory (the
 *    kernel CDDL grammar, the SSE TypeSpec, the tool-contracts TypeSpec, the
 *    telemetry semconv YAML) exist on disk and are referenced by their
 *    owning packet.
 *
 * The gate reads its expected topology, standing exceptions, and required
 * authoritative sources from the machine-readable inventory companion at
 * `constitution/support/live/epic-al-portability-inventory.json`. That JSON
 * is the canonical machine projection of the human inventory MD, so the gate
 * fails when either the JSON or the on-disk packet topology drifts from the
 * other. Hardcoded constants are deliberately not maintained in this file:
 * changing the inventory must be a one-step edit to the JSON sidecar (and
 * the human MD it accompanies), not a separate edit to the gate script.
 *
 * This script replaces `docs:af-gap-plan:check` as the canonical portability
 * proxy in `verify.ts` and `package.json`. The AF gap plan and the AL gap
 * inventory remain checked-in evidence; this gate enforces that the live
 * packet topology has not drifted from the inventory's closed state.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface AuthorityPacketManifest {
  authoritativeSources: Array<{ format: string; path: string }>;
  bindingProjections?: Record<string, string>;
  boundary: string;
  conformancePlans?: Array<{ path: string; planId: string }>;
  packetId: string;
  surface: string;
  verificationPaths: Array<{ kind: string; target: string }>;
  version: string;
}

interface AdapterManifest {
  adapterId: string;
  authorityPackets: string[];
  boundary: string;
}

interface PortabilityGateFailure {
  message: string;
  rule: string;
}

interface InventoryExpectedPacket {
  classification: "portable" | "interop" | "telemetry";
  inventorySection?: string;
  packetId: string;
  packetPath: string;
}

interface InventoryStandingException {
  forbiddenSurfaceNames: readonly string[];
  inventorySection?: string;
  label: string;
}

interface InventoryRequiredSource {
  inventorySection?: string;
  packetId: string;
  rationale: string;
  sourcePath: string;
}

interface PortabilityInventoryManifest {
  expectedPackets: readonly InventoryExpectedPacket[];
  manifestId: string;
  manifestVersion: string;
  requiredAuthoritativeSources: readonly InventoryRequiredSource[];
  standingExceptions: readonly InventoryStandingException[];
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BOUNDARIES_ROOT = resolve(REPO_ROOT, "boundaries");
const INVENTORY_PATH = resolve(
  REPO_ROOT,
  "constitution/support/live/epic-al-portable-surface-conformance-gap-inventory.md"
);
const INVENTORY_MANIFEST_PATH = resolve(
  REPO_ROOT,
  "constitution/support/live/epic-al-portability-inventory.json"
);
const INVENTORY_MANIFEST_ID = "epic-al.portability-inventory";
const ALLOWED_CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "portable",
  "interop",
  "telemetry",
]);
const MANIFEST_FILE_NAME = "authority-packet.json";
const ADAPTER_MANIFEST_FILE_NAME = "adapter.json";

const EXECUTABLE_VERIFICATION_KINDS: ReadonlySet<string> = new Set([
  "schema-validation",
  "openapi-validation",
  "conformance-plan",
  "interop-smoke",
  "vocabulary-check",
]);

await main();

async function main(): Promise<void> {
  const inventoryLoad = await loadInventoryManifest();

  if (inventoryLoad.failures.length > 0) {
    console.error("portability gate failed:");
    for (const failure of inventoryLoad.failures) {
      console.error(`  [${failure.rule}] ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const inventory = inventoryLoad.manifest;

  if (inventory === undefined) {
    console.error(
      "portability gate failed: inventory manifest could not be loaded"
    );
    process.exitCode = 1;
    return;
  }

  const failures = await runPortabilityGate(inventory);

  if (failures.length > 0) {
    console.error("portability gate failed:");
    for (const failure of failures) {
      console.error(`  [${failure.rule}] ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `portability gate passed (${inventory.expectedPackets.length} packets, ${inventory.standingExceptions.length} standing exceptions, ${inventory.requiredAuthoritativeSources.length} required sources)`
  );
}

async function runPortabilityGate(
  inventory: PortabilityInventoryManifest
): Promise<PortabilityGateFailure[]> {
  const failures: PortabilityGateFailure[] = [];
  const onDiskManifests = await loadAllManifests();
  const adapterManifests = await loadAllAdapterManifests();
  const expectedPacketIds = new Set(
    inventory.expectedPackets.map((entry) => entry.packetId)
  );
  const expectedPaths = new Set(
    inventory.expectedPackets.map((entry) => entry.packetPath)
  );

  failures.push(...checkInventoryExists());
  failures.push(...checkExpectedTopologyIsUnique(inventory));
  failures.push(
    ...checkExpectedPacketsPresent(
      inventory,
      expectedPacketIds,
      onDiskManifests
    )
  );
  failures.push(
    ...checkNoUnexpectedPackets(
      expectedPaths,
      expectedPacketIds,
      onDiskManifests
    )
  );
  failures.push(...checkPacketIdUniqueness(onDiskManifests));
  failures.push(...checkExecutableVerification(onDiskManifests));
  failures.push(...checkStandingExceptions(inventory, onDiskManifests));
  failures.push(...checkRequiredSources(inventory, onDiskManifests));
  failures.push(...checkAdapterCoverage(onDiskManifests, adapterManifests));

  return failures;
}

interface InventoryLoadResult {
  failures: PortabilityGateFailure[];
  manifest: PortabilityInventoryManifest | undefined;
}

async function loadInventoryManifest(): Promise<InventoryLoadResult> {
  if (!existsSync(INVENTORY_MANIFEST_PATH)) {
    return {
      failures: [
        {
          rule: "inventory-manifest",
          message: `machine-readable inventory companion missing at ${relative(REPO_ROOT, INVENTORY_MANIFEST_PATH)}; this JSON is the gate's source of truth and must accompany the human inventory MD`,
        },
      ],
      manifest: undefined,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(INVENTORY_MANIFEST_PATH, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      failures: [
        {
          rule: "inventory-manifest",
          message: `inventory manifest at ${relative(REPO_ROOT, INVENTORY_MANIFEST_PATH)} is not parseable JSON: ${detail}`,
        },
      ],
      manifest: undefined,
    };
  }

  const validation = validateInventoryManifestShape(parsed);

  if (validation.failures.length > 0) {
    return { failures: validation.failures, manifest: undefined };
  }

  return { failures: [], manifest: validation.manifest };
}

interface InventoryShapeValidation {
  failures: PortabilityGateFailure[];
  manifest: PortabilityInventoryManifest | undefined;
}

function validateInventoryManifestShape(
  raw: unknown
): InventoryShapeValidation {
  const failures: PortabilityGateFailure[] = [];

  if (!isRecord(raw)) {
    return {
      failures: [
        {
          rule: "inventory-manifest",
          message:
            "inventory manifest must be a JSON object with manifestId, manifestVersion, expectedPackets, standingExceptions, and requiredAuthoritativeSources",
        },
      ],
      manifest: undefined,
    };
  }

  if (raw.manifestId !== INVENTORY_MANIFEST_ID) {
    failures.push({
      rule: "inventory-manifest",
      message: `inventory manifest manifestId must equal "${INVENTORY_MANIFEST_ID}"; got ${JSON.stringify(raw.manifestId)}`,
    });
  }

  if (typeof raw.manifestVersion !== "string") {
    failures.push({
      rule: "inventory-manifest",
      message: "inventory manifest manifestVersion must be a string",
    });
  }

  const expectedPackets = validateExpectedPackets(raw.expectedPackets);
  failures.push(...expectedPackets.failures);

  const standingExceptions = validateStandingExceptions(raw.standingExceptions);
  failures.push(...standingExceptions.failures);

  const requiredSources = validateRequiredSources(
    raw.requiredAuthoritativeSources
  );
  failures.push(...requiredSources.failures);

  if (failures.length > 0) {
    return { failures, manifest: undefined };
  }

  return {
    failures,
    manifest: {
      expectedPackets: expectedPackets.entries,
      manifestId: raw.manifestId as string,
      manifestVersion: raw.manifestVersion as string,
      requiredAuthoritativeSources: requiredSources.entries,
      standingExceptions: standingExceptions.entries,
    },
  };
}

function validateExpectedPackets(value: unknown): {
  entries: InventoryExpectedPacket[];
  failures: PortabilityGateFailure[];
} {
  const failures: PortabilityGateFailure[] = [];
  const entries: InventoryExpectedPacket[] = [];

  if (!Array.isArray(value)) {
    failures.push({
      rule: "inventory-manifest",
      message: "inventory manifest expectedPackets must be an array",
    });
    return { entries, failures };
  }

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      failures.push({
        rule: "inventory-manifest",
        message: `expectedPackets[${index}] must be an object`,
      });
      continue;
    }

    if (typeof entry.packetId !== "string") {
      failures.push({
        rule: "inventory-manifest",
        message: `expectedPackets[${index}].packetId must be a string`,
      });
      continue;
    }

    if (typeof entry.packetPath !== "string") {
      failures.push({
        rule: "inventory-manifest",
        message: `expectedPackets[${index}].packetPath must be a string`,
      });
      continue;
    }

    if (
      typeof entry.classification !== "string" ||
      !ALLOWED_CLASSIFICATIONS.has(entry.classification)
    ) {
      failures.push({
        rule: "inventory-manifest",
        message: `expectedPackets[${index}].classification must be one of ${[...ALLOWED_CLASSIFICATIONS].join(", ")}`,
      });
      continue;
    }

    entries.push({
      classification: entry.classification as
        | "portable"
        | "interop"
        | "telemetry",
      inventorySection:
        typeof entry.inventorySection === "string"
          ? entry.inventorySection
          : undefined,
      packetId: entry.packetId,
      packetPath: entry.packetPath,
    });
  }

  return { entries, failures };
}

function validateStandingExceptions(value: unknown): {
  entries: InventoryStandingException[];
  failures: PortabilityGateFailure[];
} {
  const failures: PortabilityGateFailure[] = [];
  const entries: InventoryStandingException[] = [];

  if (!Array.isArray(value)) {
    failures.push({
      rule: "inventory-manifest",
      message: "inventory manifest standingExceptions must be an array",
    });
    return { entries, failures };
  }

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      failures.push({
        rule: "inventory-manifest",
        message: `standingExceptions[${index}] must be an object`,
      });
      continue;
    }

    if (typeof entry.label !== "string") {
      failures.push({
        rule: "inventory-manifest",
        message: `standingExceptions[${index}].label must be a string`,
      });
      continue;
    }

    if (
      !(
        Array.isArray(entry.forbiddenSurfaceNames) &&
        entry.forbiddenSurfaceNames.every((name) => typeof name === "string")
      )
    ) {
      failures.push({
        rule: "inventory-manifest",
        message: `standingExceptions[${index}].forbiddenSurfaceNames must be a non-empty array of strings`,
      });
      continue;
    }

    entries.push({
      forbiddenSurfaceNames: entry.forbiddenSurfaceNames as string[],
      inventorySection:
        typeof entry.inventorySection === "string"
          ? entry.inventorySection
          : undefined,
      label: entry.label,
    });
  }

  return { entries, failures };
}

function validateRequiredSources(value: unknown): {
  entries: InventoryRequiredSource[];
  failures: PortabilityGateFailure[];
} {
  const failures: PortabilityGateFailure[] = [];
  const entries: InventoryRequiredSource[] = [];

  if (!Array.isArray(value)) {
    failures.push({
      rule: "inventory-manifest",
      message:
        "inventory manifest requiredAuthoritativeSources must be an array",
    });
    return { entries, failures };
  }

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      failures.push({
        rule: "inventory-manifest",
        message: `requiredAuthoritativeSources[${index}] must be an object`,
      });
      continue;
    }

    if (
      typeof entry.packetId !== "string" ||
      typeof entry.sourcePath !== "string" ||
      typeof entry.rationale !== "string"
    ) {
      failures.push({
        rule: "inventory-manifest",
        message: `requiredAuthoritativeSources[${index}] must declare string packetId, sourcePath, and rationale`,
      });
      continue;
    }

    entries.push({
      inventorySection:
        typeof entry.inventorySection === "string"
          ? entry.inventorySection
          : undefined,
      packetId: entry.packetId,
      rationale: entry.rationale,
      sourcePath: entry.sourcePath,
    });
  }

  return { entries, failures };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function checkAdapterCoverage(
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>,
  adapterManifests: ReadonlyMap<string, AdapterManifest>
): PortabilityGateFailure[] {
  // A packet that declares `conformancePlans` must be referenced by *every*
  // adapter manifest of the matching boundary, not just one. The shared
  // runner discovers plans per adapter manifest (`tools/conformance/runner/
  // run.ts:606-620`), so a packet that one adapter references but another
  // omits silently disappears from the omitting adapter's measured evidence
  // even though the portability gate would still pass. For a cross-
  // implementation portability gate, "at least one adapter somewhere in the
  // boundary" is too weak — every measured implementation lane has to see
  // the plan.
  const failures: PortabilityGateFailure[] = [];
  const adaptersByBoundary = new Map<string, AdapterManifest[]>();

  for (const adapter of adapterManifests.values()) {
    const existing = adaptersByBoundary.get(adapter.boundary);

    if (existing === undefined) {
      adaptersByBoundary.set(adapter.boundary, [adapter]);
    } else {
      existing.push(adapter);
    }
  }

  for (const [packetPath, manifest] of onDisk.entries()) {
    const planCount = manifest.conformancePlans?.length ?? 0;

    if (planCount === 0) {
      continue;
    }

    const adapters = adaptersByBoundary.get(manifest.boundary) ?? [];

    if (adapters.length === 0) {
      failures.push({
        rule: "adapter-coverage",
        message: `packet ${manifest.packetId} declares ${planCount} conformance plan(s) but no adapter manifest exists for boundary ${manifest.boundary}; the shared runner cannot discover this packet's plans`,
      });
      continue;
    }

    const missingAdapters = adapters.filter(
      (adapter) => !adapter.authorityPackets.includes(packetPath)
    );

    if (missingAdapters.length > 0) {
      const missingAdapterIds = missingAdapters
        .map((adapter) => adapter.adapterId)
        .sort()
        .join(", ");

      failures.push({
        rule: "adapter-coverage",
        message: `packet ${manifest.packetId} at ${packetPath} declares ${planCount} conformance plan(s) but is not referenced by every ${manifest.boundary}-boundary adapter manifest; add ${packetPath} to: ${missingAdapterIds}`,
      });
    }
  }

  return failures;
}

function checkExpectedTopologyIsUnique(
  inventory: PortabilityInventoryManifest
): PortabilityGateFailure[] {
  // The inventory manifest is the gate's source of truth, so a typo or
  // copy-paste mistake that duplicates a packetId or packetPath would silently
  // narrow what we enforce. Catch that here rather than letting it propagate.
  const failures: PortabilityGateFailure[] = [];
  const seenPacketIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const entry of inventory.expectedPackets) {
    if (seenPacketIds.has(entry.packetId)) {
      failures.push({
        rule: "expected-topology-unique",
        message: `inventory manifest lists packetId ${entry.packetId} more than once`,
      });
    } else {
      seenPacketIds.add(entry.packetId);
    }

    if (seenPaths.has(entry.packetPath)) {
      failures.push({
        rule: "expected-topology-unique",
        message: `inventory manifest lists packetPath ${entry.packetPath} more than once`,
      });
    } else {
      seenPaths.add(entry.packetPath);
    }
  }

  return failures;
}

async function loadAllManifests(): Promise<
  Map<string, AuthorityPacketManifest>
> {
  const manifests = new Map<string, AuthorityPacketManifest>();
  const paths = await findFilesByName(BOUNDARIES_ROOT, MANIFEST_FILE_NAME);

  for (const manifestPath of paths) {
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8")
    ) as AuthorityPacketManifest;
    manifests.set(relative(REPO_ROOT, manifestPath), manifest);
  }

  return manifests;
}

async function loadAllAdapterManifests(): Promise<
  Map<string, AdapterManifest>
> {
  const manifests = new Map<string, AdapterManifest>();
  const paths = await findFilesByName(
    BOUNDARIES_ROOT,
    ADAPTER_MANIFEST_FILE_NAME
  );

  for (const manifestPath of paths) {
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8")
    ) as AdapterManifest;
    manifests.set(relative(REPO_ROOT, manifestPath), manifest);
  }

  return manifests;
}

async function findFilesByName(
  directory: string,
  fileName: string
): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await findFilesByName(entryPath, fileName)));
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      paths.push(entryPath);
    }
  }

  return paths.sort();
}

function checkInventoryExists(): PortabilityGateFailure[] {
  if (existsSync(INVENTORY_PATH)) {
    return [];
  }

  return [
    {
      rule: "inventory-presence",
      message: `Epic AL inventory missing at ${relative(REPO_ROOT, INVENTORY_PATH)}; portability gate requires the inventory as the human-readable closure record.`,
    },
  ];
}

function checkExpectedPacketsPresent(
  inventory: PortabilityInventoryManifest,
  expectedPacketIds: ReadonlySet<string>,
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>
): PortabilityGateFailure[] {
  const failures: PortabilityGateFailure[] = [];
  const seenPacketIds = new Set(
    [...onDisk.values()].map((manifest) => manifest.packetId)
  );

  for (const expected of inventory.expectedPackets) {
    const manifest = onDisk.get(expected.packetPath);

    if (manifest === undefined) {
      failures.push({
        rule: "expected-packet-present",
        message: `expected packet ${expected.packetId} missing at ${expected.packetPath}`,
      });
      continue;
    }

    if (manifest.packetId !== expected.packetId) {
      failures.push({
        rule: "expected-packet-present",
        message: `packet at ${expected.packetPath} declares packetId ${manifest.packetId}; inventory expects ${expected.packetId}`,
      });
    }
  }

  for (const expected of expectedPacketIds) {
    if (!seenPacketIds.has(expected)) {
      failures.push({
        rule: "expected-packet-present",
        message: `inventory expects packetId ${expected} but no on-disk packet declares it`,
      });
    }
  }

  return failures;
}

function checkNoUnexpectedPackets(
  expectedPaths: ReadonlySet<string>,
  expectedPacketIds: ReadonlySet<string>,
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>
): PortabilityGateFailure[] {
  const failures: PortabilityGateFailure[] = [];

  for (const [path, manifest] of onDisk.entries()) {
    // The path check is the primary guard: it catches an extra
    // authority-packet.json planted at any location that the inventory does
    // not name, even when that file reuses an already-expected packetId.
    // The packetId check then catches any new manifest that lands at an
    // expected-looking path but declares a fresh portable surface the
    // inventory has not promoted.
    if (!expectedPaths.has(path)) {
      failures.push({
        rule: "no-unexpected-packets",
        message: `authority-packet.json at ${path} is not listed in EXPECTED_PACKET_TOPOLOGY; revise the AL inventory and the expected-topology table together before adding new cross-implementation surfaces (declared packetId: ${manifest.packetId})`,
      });
      continue;
    }

    if (!expectedPacketIds.has(manifest.packetId)) {
      failures.push({
        rule: "no-unexpected-packets",
        message: `packet ${manifest.packetId} at ${path} is not listed in the AL inventory's expected topology; revise the inventory and EXPECTED_PACKET_TOPOLOGY together before adding new cross-implementation surfaces`,
      });
    }
  }

  return failures;
}

function checkPacketIdUniqueness(
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>
): PortabilityGateFailure[] {
  // Two manifests at different paths must not share the same packetId, or
  // tooling that resolves a packet by id would silently pick whichever file
  // wins the directory walk. This guard catches that even when both paths
  // happen to be in `expectedPaths` (e.g., a copy-paste at one expected
  // location of another expected packet's id).
  const failures: PortabilityGateFailure[] = [];
  const pathsByPacketId = new Map<string, string[]>();

  for (const [path, manifest] of onDisk.entries()) {
    const existing = pathsByPacketId.get(manifest.packetId);

    if (existing === undefined) {
      pathsByPacketId.set(manifest.packetId, [path]);
    } else {
      existing.push(path);
    }
  }

  for (const [packetId, paths] of pathsByPacketId.entries()) {
    if (paths.length > 1) {
      failures.push({
        rule: "packet-id-uniqueness",
        message: `packetId ${packetId} is declared at multiple paths: ${paths.sort().join(", ")}`,
      });
    }
  }

  return failures;
}

function checkExecutableVerification(
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>
): PortabilityGateFailure[] {
  const failures: PortabilityGateFailure[] = [];

  for (const [path, manifest] of onDisk.entries()) {
    const executable = manifest.verificationPaths.some((verificationPath) =>
      EXECUTABLE_VERIFICATION_KINDS.has(verificationPath.kind)
    );

    if (!executable) {
      failures.push({
        rule: "executable-verification",
        message: `packet ${manifest.packetId} at ${path} has no executable verification path; portable packets require schema-validation, openapi-validation, conformance-plan, interop-smoke, or vocabulary-check`,
      });
    }
  }

  return failures;
}

function checkStandingExceptions(
  inventory: PortabilityInventoryManifest,
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>
): PortabilityGateFailure[] {
  const failures: PortabilityGateFailure[] = [];

  for (const exception of inventory.standingExceptions) {
    const forbidden = new Set(exception.forbiddenSurfaceNames);

    for (const [path, manifest] of onDisk.entries()) {
      if (forbidden.has(manifest.surface)) {
        failures.push({
          rule: "standing-exceptions-unchanged",
          message: `packet ${manifest.packetId} at ${path} owns surface "${manifest.surface}" which is the Epic AL standing exception ${exception.label}; standing exceptions may not be promoted to portable authority without an explicit Tasks.md/TechSpec revision`,
        });
      }
    }
  }

  return failures;
}

function checkRequiredSources(
  inventory: PortabilityInventoryManifest,
  onDisk: ReadonlyMap<string, AuthorityPacketManifest>
): PortabilityGateFailure[] {
  const failures: PortabilityGateFailure[] = [];
  const manifestsByPacketId = new Map<string, AuthorityPacketManifest>();

  for (const manifest of onDisk.values()) {
    manifestsByPacketId.set(manifest.packetId, manifest);
  }

  for (const required of inventory.requiredAuthoritativeSources) {
    if (!existsSync(resolve(REPO_ROOT, required.sourcePath))) {
      failures.push({
        rule: "required-sources",
        message: `${required.rationale}: required source ${required.sourcePath} is missing on disk`,
      });
      continue;
    }

    const manifest = manifestsByPacketId.get(required.packetId);

    if (manifest === undefined) {
      failures.push({
        rule: "required-sources",
        message: `${required.rationale}: packet ${required.packetId} is not present on disk; cannot verify source registration`,
      });
      continue;
    }

    const declared = manifest.authoritativeSources.some(
      (source) => source.path === required.sourcePath
    );

    if (!declared) {
      failures.push({
        rule: "required-sources",
        message: `${required.rationale}: ${required.sourcePath} exists on disk but is not declared under ${required.packetId}.authoritativeSources`,
      });
    }
  }

  return failures;
}
