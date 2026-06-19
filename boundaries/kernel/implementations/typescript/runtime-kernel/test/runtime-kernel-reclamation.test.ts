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
import { createMemoryBackend } from "@tuvren/backend-memory";
import type { RuntimeBackend } from "@tuvren/kernel-protocol";
import { createRuntimeKernel } from "@tuvren/kernel-runtime";
import { TEST_SCHEMA } from "./runtime-kernel-test-helpers.ts";

interface ReclamationFixture {
  backend: RuntimeBackend;
  branchId: string;
  kernel: ReturnType<typeof createRuntimeKernel>;
  rootTurnNodeHash: string;
  schemaId: string;
  setClock: (value: number) => void;
  threadId: string;
}

async function createReclamationFixture(
  initialClock = 1
): Promise<ReclamationFixture> {
  let clock = initialClock;
  const now = () => clock;
  const backend = createMemoryBackend({ now });
  const kernel = createRuntimeKernel({ backend, now });
  const schemaId = await kernel.schema.register(TEST_SCHEMA);
  const threadId = "thread_reclamation";
  const branchId = "branch_reclamation";
  const thread = await kernel.thread.create(threadId, schemaId, branchId);

  return {
    backend,
    branchId: thread.branchId,
    kernel,
    rootTurnNodeHash: thread.rootTurnNodeHash,
    schemaId,
    setClock: (value: number) => {
      clock = value;
    },
    threadId: thread.threadId,
  };
}

/**
 * Runs a single non-deterministic step that checkpoints `eventHash` into the
 * branch head, then completes the run. The resulting checkpoint turn node and
 * its event object are reachable from the (non-archived) branch head.
 */
async function checkpointEventIntoBranchHead(
  fixture: ReclamationFixture,
  input: { eventHash: string; runId: string; turnId: string }
): Promise<string> {
  const turn = await fixture.kernel.turn.create(
    input.turnId,
    fixture.threadId,
    fixture.branchId,
    null,
    fixture.rootTurnNodeHash
  );
  await fixture.kernel.run.create(
    input.runId,
    turn.turnId,
    fixture.branchId,
    fixture.schemaId,
    fixture.rootTurnNodeHash,
    [{ deterministic: false, id: "checkpoint", sideEffects: false }]
  );
  const completed = await fixture.kernel.run.completeStep(
    input.runId,
    "checkpoint",
    input.eventHash
  );
  if (completed.turnNodeHash === undefined) {
    throw new Error("expected checkpoint turn node");
  }
  await fixture.kernel.run.complete(input.runId, "completed");
  return completed.turnNodeHash;
}

describe("createRuntimeKernel maintenance.reclamation", () => {
  test("releases objects unreachable from live roots and retains reachable lineage", async () => {
    const fixture = await createReclamationFixture();

    const reachableEventHash = await fixture.kernel.store.put(
      new Uint8Array([9, 9, 9]),
      "application/event"
    );
    const headTurnNodeHash = await checkpointEventIntoBranchHead(fixture, {
      eventHash: reachableEventHash,
      runId: "run_reachable",
      turnId: "turn_reachable",
    });

    const orphanOne = await fixture.kernel.store.put(new Uint8Array([1]));
    const orphanTwo = await fixture.kernel.store.put(new Uint8Array([2]));

    const summary = await fixture.kernel.maintenance.reclaim();

    // Unreachable objects are released.
    expect(await fixture.kernel.store.has(orphanOne)).toBe(false);
    expect(await fixture.kernel.store.has(orphanTwo)).toBe(false);
    expect(summary.releasedObjectCount).toBeGreaterThanOrEqual(2);

    // No object reachable from a live root is released.
    expect(await fixture.kernel.store.has(reachableEventHash)).toBe(true);

    // Reachable lineage stays structurally intact and readable.
    const thread = await fixture.kernel.thread.get(fixture.threadId);
    expect(thread?.rootTurnNodeHash).toBe(fixture.rootTurnNodeHash);
    const branches = await fixture.kernel.branch.list(fixture.threadId);
    expect(branches).toContainEqual([fixture.branchId, headTurnNodeHash]);
    expect(await fixture.kernel.node.get(headTurnNodeHash)).not.toBeNull();
  });

  test("retains objects newer than the oldest active execution lease (grace window)", async () => {
    const fixture = await createReclamationFixture();

    // Orphan created before any active execution lease.
    fixture.setClock(10);
    const orphanBeforeLease = await fixture.kernel.store.put(
      new Uint8Array([1])
    );

    // Active (running) run acquires the oldest execution lease at t=20.
    fixture.setClock(20);
    const turn = await fixture.kernel.turn.create(
      "turn_active_lease",
      fixture.threadId,
      fixture.branchId,
      null,
      fixture.rootTurnNodeHash
    );
    await fixture.kernel.run.create(
      "run_active_lease",
      turn.turnId,
      fixture.branchId,
      fixture.schemaId,
      fixture.rootTurnNodeHash,
      [{ deterministic: true, id: "work", sideEffects: false }]
    );

    // Orphan created after the lease horizon — protected by the grace window.
    fixture.setClock(30);
    const orphanAfterLease = await fixture.kernel.store.put(
      new Uint8Array([2])
    );

    fixture.setClock(40);
    await fixture.kernel.maintenance.reclaim();

    // Older unreachable object is released; newer-than-lease object is retained
    // even though it is also unreachable.
    expect(await fixture.kernel.store.has(orphanBeforeLease)).toBe(false);
    expect(await fixture.kernel.store.has(orphanAfterLease)).toBe(true);
  });

  test("reclaims an archived branch and its exclusive lineage while retaining the live branch", async () => {
    const fixture = await createReclamationFixture();

    const abandonedEventHash = await fixture.kernel.store.put(
      new Uint8Array([7, 7, 7]),
      "application/event"
    );
    const abandonedHead = await checkpointEventIntoBranchHead(fixture, {
      eventHash: abandonedEventHash,
      runId: "run_abandoned",
      turnId: "turn_abandoned",
    });

    // Backward head move archives the abandoned segment into an archive branch.
    const rollback = await fixture.kernel.branch.setHead(
      fixture.branchId,
      fixture.rootTurnNodeHash
    );
    expect(rollback.archiveBranch?.headTurnNodeHash).toBe(abandonedHead);

    const summary = await fixture.kernel.maintenance.reclaim();

    // The abandoned segment (only reachable via the archive branch) is released.
    expect(await fixture.kernel.store.has(abandonedEventHash)).toBe(false);
    expect(await fixture.kernel.node.get(abandonedHead)).toBeNull();
    expect(summary.releasedArchivedBranchCount).toBeGreaterThanOrEqual(1);
    expect(summary.releasedTurnNodeCount).toBeGreaterThanOrEqual(1);

    // The live branch (now at root) and the thread root remain intact.
    const branches = await fixture.kernel.branch.list(fixture.threadId);
    expect(branches).toContainEqual([
      fixture.branchId,
      fixture.rootTurnNodeHash,
    ]);
    expect(branches.some(([branchId]) => branchId.includes("archive"))).toBe(
      false
    );
    expect(
      await fixture.kernel.node.get(fixture.rootTurnNodeHash)
    ).not.toBeNull();
  });

  test("is a safe no-op when nothing is unreachable", async () => {
    const fixture = await createReclamationFixture();

    const summary = await fixture.kernel.maintenance.reclaim();

    expect(summary.releasedObjectCount).toBe(0);
    expect(summary.releasedTurnNodeCount).toBe(0);
    expect(summary.releasedArchivedBranchCount).toBe(0);
    expect(summary.retainedObjectCount).toBeGreaterThanOrEqual(1);

    // The thread is still fully readable after a no-op reclaim.
    const thread = await fixture.kernel.thread.get(fixture.threadId);
    expect(thread?.rootTurnNodeHash).toBe(fixture.rootTurnNodeHash);
  });

  test("rejects reclamation when the backend does not advertise the capability", async () => {
    const nonReclaimingBackend: RuntimeBackend = {
      capabilities: () => ({ "thread.enumeration": true }),
      health: () => Promise.resolve({ ok: true }),
      transact: () => {
        throw new Error("transact must not be reached when reclaim is gated");
      },
    };
    const kernel = createRuntimeKernel({ backend: nonReclaimingBackend });

    await expect(kernel.maintenance.reclaim()).rejects.toThrow(
      "maintenance.reclamation is not supported by this backend"
    );
  });

  test("rejects reclamation when the backend advertises support but omits the backing operation", async () => {
    const advertisesButUnimplemented: RuntimeBackend = {
      capabilities: () => ({
        "maintenance.reclamation": true,
        "thread.enumeration": true,
      }),
      health: () => Promise.resolve({ ok: true }),
      transact: () => {
        throw new Error("transact must not be reached when reclaim is gated");
      },
    };
    const kernel = createRuntimeKernel({
      backend: advertisesButUnimplemented,
    });

    await expect(kernel.maintenance.reclaim()).rejects.toThrow(
      "backend advertises maintenance.reclamation but does not implement reclaim"
    );
  });
});
