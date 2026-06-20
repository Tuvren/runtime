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
import { randomBytes } from "node:crypto";
import {
  createAesGcmPayloadCodec,
  createIdentityPayloadCodec,
  type ErasedPayload,
  IDENTITY_PAYLOAD_CODEC,
  isErasedPayload,
  isPayloadEnvelope,
  type PayloadCodecContext,
  type PayloadKeyring,
} from "../src/lib/payload-codec.js";

const SCOPE = "tenant.acme";
const CONTEXT: PayloadCodecContext = { edge: "message", scope: SCOPE };
const CANNOT_RESOLVE_KEYREF = /cannot resolve keyRef/;

/** In-memory keyring whose entries the host can destroy to simulate erasure. */
function createDestroyableKeyring(initial?: Record<string, Uint8Array>): {
  destroy(keyRef: string): void;
  keyring: PayloadKeyring;
} {
  const keys = new Map<string, Uint8Array>(Object.entries(initial ?? {}));
  return {
    destroy(keyRef) {
      keys.delete(keyRef);
    },
    keyring: {
      resolve(keyRef) {
        return keys.get(keyRef);
      },
    },
  };
}

const PLAINTEXT = new TextEncoder().encode(
  JSON.stringify({ role: "tool", secret: "social-security-number" })
);

describe("identity payload codec", () => {
  test("passes plaintext through unchanged on encrypt and decrypt", async () => {
    const codec = createIdentityPayloadCodec();
    expect(codec).toBe(IDENTITY_PAYLOAD_CODEC);

    const stored = await codec.encrypt(PLAINTEXT, CONTEXT);
    // No envelope: the bytes stored are byte-identical to the plaintext.
    expect(stored).toEqual(PLAINTEXT);
    expect(isPayloadEnvelope(stored)).toBe(false);

    const result = await codec.decrypt(stored, CONTEXT);
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.plaintext).toEqual(PLAINTEXT);
    }
  });
});

describe("AES-256-GCM payload codec", () => {
  test("encrypts to a self-describing envelope that hides the plaintext", async () => {
    const { keyring } = createDestroyableKeyring({
      [SCOPE]: new Uint8Array(randomBytes(32)),
    });
    const codec = createAesGcmPayloadCodec({ keyring });

    const stored = await codec.encrypt(PLAINTEXT, CONTEXT);

    expect(codec.id).toBe("aes-256-gcm");
    expect(isPayloadEnvelope(stored)).toBe(true);
    // The plaintext (and the secret substring) must not appear in the blob.
    expect(Buffer.from(stored).includes(Buffer.from(PLAINTEXT))).toBe(false);
    expect(Buffer.from(stored).toString("utf8")).not.toContain(
      "social-security-number"
    );
  });

  test("round-trips ciphertext back to the exact plaintext", async () => {
    const { keyring } = createDestroyableKeyring({
      [SCOPE]: new Uint8Array(randomBytes(32)),
    });
    const codec = createAesGcmPayloadCodec({ keyring });

    const stored = await codec.encrypt(PLAINTEXT, CONTEXT);
    const result = await codec.decrypt(stored, CONTEXT);

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.plaintext).toEqual(PLAINTEXT);
    }
  });

  test("uses a fresh IV per encryption (no (key, iv) reuse)", async () => {
    const { keyring } = createDestroyableKeyring({
      [SCOPE]: new Uint8Array(randomBytes(32)),
    });
    const codec = createAesGcmPayloadCodec({ keyring });

    const first = await codec.encrypt(PLAINTEXT, CONTEXT);
    const second = await codec.encrypt(PLAINTEXT, CONTEXT);
    // Same plaintext + key but distinct ciphertext (distinct IV/tag).
    expect(first).not.toEqual(second);
  });

  test("returns a typed erased result when the host has destroyed the key", async () => {
    const { destroy, keyring } = createDestroyableKeyring({
      [SCOPE]: new Uint8Array(randomBytes(32)),
    });
    const codec = createAesGcmPayloadCodec({ keyring });

    const stored = await codec.encrypt(PLAINTEXT, CONTEXT);
    // Crypto-shred: destroy the key. The ciphertext envelope stays intact.
    destroy(SCOPE);

    const result = await codec.decrypt(stored, CONTEXT);
    expect(result.status).toBe("erased");
    if (result.status === "erased") {
      expect(result.keyRef).toBe(SCOPE);
      expect(result.reason).toBe("key_unavailable");
    }
  });

  test("rejects a ciphertext replayed under a different Scope (AAD binding)", async () => {
    const otherScope = "tenant.globex";
    const { keyring } = createDestroyableKeyring({
      [SCOPE]: new Uint8Array(randomBytes(32)),
      [otherScope]: new Uint8Array(randomBytes(32)),
    });
    const codec = createAesGcmPayloadCodec({ keyring });

    const stored = await codec.encrypt(PLAINTEXT, CONTEXT);
    // Decrypt under a different Scope context: AAD differs → GCM tag mismatch.
    // (keyRef in the envelope still points at SCOPE, so a key is present and the
    // failure is an integrity error rather than an erased read.)
    await expect(
      codec.decrypt(stored, { edge: "message", scope: otherScope })
    ).rejects.toThrow();
  });

  test("cannot encrypt without a resolvable key", async () => {
    const { keyring } = createDestroyableKeyring();
    const codec = createAesGcmPayloadCodec({ keyring });

    await expect(codec.encrypt(PLAINTEXT, CONTEXT)).rejects.toThrow(
      CANNOT_RESOLVE_KEYREF
    );
  });

  test("supports per-subject keyRef resolution", async () => {
    const subjectKeyRef = "subject.42";
    const { destroy, keyring } = createDestroyableKeyring({
      [subjectKeyRef]: new Uint8Array(randomBytes(32)),
    });
    const codec = createAesGcmPayloadCodec({
      keyring,
      resolveKeyRef: () => subjectKeyRef,
    });

    const stored = await codec.encrypt(PLAINTEXT, CONTEXT);
    expect((await codec.decrypt(stored, CONTEXT)).status).toBe("available");

    destroy(subjectKeyRef);
    expect((await codec.decrypt(stored, CONTEXT)).status).toBe("erased");
  });
});

describe("isErasedPayload", () => {
  test("narrows a typed erased marker", () => {
    const erased: ErasedPayload = {
      keyRef: SCOPE,
      kind: "erased",
      reason: "key_unavailable",
    };
    expect(isErasedPayload(erased)).toBe(true);
    expect(isErasedPayload({ role: "user", parts: [] })).toBe(false);
    expect(isErasedPayload(null)).toBe(false);
    expect(isErasedPayload({ kind: "erased" })).toBe(false);
  });
});
