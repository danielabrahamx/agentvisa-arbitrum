import { deriveApplicationRegistrationV1, type ApplicationRegistrationV1 } from "@agentvisa/policy";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

export const BROWSER_SEMAPHORE_IDENTITY_STORAGE_KEY = "agentvisa.semaphore-identity.v1";
export const BROWSER_LOGIN_KEY_STORAGE_KEY = "agentvisa.login-key.p256.v1";

export interface BrowserIdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BrowserSemaphoreIdentity {
  readonly commitment: bigint;
}

export interface EnrollmentCommitmentRequest {
  readonly semaphoreIdentityCommitment: bigint;
}

export interface BrowserCredentialGroupSnapshot {
  readonly members: readonly bigint[];
  readonly root: bigint;
  readonly size: number;
}

export interface BrowserSnarkArtifacts {
  readonly wasm: string;
  readonly zkey: string;
}

export interface BrowserRegistrationProof {
  readonly merkleTreeDepth: number;
  readonly merkleTreeRoot: string;
  readonly nullifier: string;
  readonly message: string;
  readonly scope: string;
  readonly points: readonly [string, string, string, string, string, string, string, string];
}

export interface BrowserLoginKey {
  readonly loginPublicKey: `0x${string}`;
}

export interface BrowserLoginAuthentication extends BrowserLoginKey {
  readonly challenge: string;
  readonly publicKeySpki: string;
  readonly signature: string;
}

interface StoredLoginKey {
  readonly privateKey: JsonWebKey;
  readonly publicKey: JsonWebKey;
}

export function loadOrCreateBrowserSemaphoreIdentity(
  storage: BrowserIdentityStorage,
  storageKey = BROWSER_SEMAPHORE_IDENTITY_STORAGE_KEY,
): BrowserSemaphoreIdentity {
  const storedIdentity = storage.getItem(storageKey);
  let identity: Identity;

  if (storedIdentity === null) {
    identity = new Identity();
    storage.setItem(storageKey, identity.export());
  } else {
    try {
      identity = Identity.import(storedIdentity);
      if (identity.export() !== storedIdentity) {
        throw new Error("non-canonical identity export");
      }
    } catch {
      throw new Error("stored Semaphore identity is invalid");
    }
  }

  // Enrollment code receives a commitment-only projection. The exported
  // identity secret remains behind the browser-owned storage boundary.
  return Object.freeze({ commitment: identity.commitment });
}

export function createEnrollmentCommitmentRequest(
  identity: BrowserSemaphoreIdentity,
): EnrollmentCommitmentRequest {
  return Object.freeze({
    semaphoreIdentityCommitment: identity.commitment,
  });
}

export async function generateBrowserRegistrationProof(
  storage: BrowserIdentityStorage,
  snapshot: BrowserCredentialGroupSnapshot,
  registration: ApplicationRegistrationV1,
  artifacts: BrowserSnarkArtifacts,
): Promise<BrowserRegistrationProof> {
  const identity = loadIdentity(storage);
  const group = new Group([...snapshot.members]);
  if (
    snapshot.size !== group.size ||
    snapshot.root !== group.root ||
    !group.members.includes(identity.commitment)
  ) {
    throw new Error("Credential group snapshot is invalid for this browser identity");
  }
  const fields = deriveApplicationRegistrationV1(registration);
  // Semaphore proof package exports are not fully typed for ESLint.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- audited upstream API
  const proof = (await generateProof(
    identity,
    group,
    fields.message,
    fields.scope,
    1,
    artifacts,
  )) as BrowserRegistrationProof;
  return proof;
}

export async function loadOrCreateBrowserLoginKey(
  storage: BrowserIdentityStorage,
): Promise<BrowserLoginKey> {
  const keys = await loadOrCreateLoginCryptoKeys(storage);
  return Object.freeze({ loginPublicKey: await deriveLoginPublicKey(keys.publicKey) });
}

export async function signBrowserLoginChallenge(
  storage: BrowserIdentityStorage,
  challenge: string,
): Promise<BrowserLoginAuthentication> {
  if (challenge.length < 16 || challenge.length > 512 || challenge.trim() !== challenge) {
    throw new RangeError("login challenge must be 16 to 512 trimmed characters");
  }
  const keys = await loadOrCreateLoginCryptoKeys(storage);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(challenge),
  );
  const publicKeySpki = await crypto.subtle.exportKey("spki", keys.publicKey);
  return Object.freeze({
    challenge,
    loginPublicKey: await deriveLoginPublicKey(keys.publicKey),
    publicKeySpki: encodeBase64Url(publicKeySpki),
    signature: encodeBase64Url(signature),
  });
}

function loadIdentity(
  storage: BrowserIdentityStorage,
  storageKey = BROWSER_SEMAPHORE_IDENTITY_STORAGE_KEY,
): Identity {
  const storedIdentity = storage.getItem(storageKey);
  if (storedIdentity === null) {
    throw new Error("browser Semaphore identity has not been created");
  }
  try {
    const identity = Identity.import(storedIdentity);
    if (identity.export() !== storedIdentity) {
      throw new Error("non-canonical identity export");
    }
    return identity;
  } catch {
    throw new Error("stored Semaphore identity is invalid");
  }
}

async function loadOrCreateLoginCryptoKeys(
  storage: BrowserIdentityStorage,
): Promise<CryptoKeyPair> {
  const stored = storage.getItem(BROWSER_LOGIN_KEY_STORAGE_KEY);
  if (stored === null) {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    if (!("privateKey" in keys) || !("publicKey" in keys)) {
      throw new Error("Login Key generation did not return a sign/verify key pair");
    }
    const serialized: StoredLoginKey = {
      privateKey: await crypto.subtle.exportKey("jwk", keys.privateKey),
      publicKey: await crypto.subtle.exportKey("jwk", keys.publicKey),
    };
    storage.setItem(BROWSER_LOGIN_KEY_STORAGE_KEY, JSON.stringify(serialized));
    return keys;
  }
  try {
    const parsed = JSON.parse(stored) as StoredLoginKey;
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      parsed.privateKey,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"],
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      parsed.publicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );
    return { privateKey, publicKey };
  } catch {
    throw new Error("stored browser Login Key is invalid");
  }
}

async function deriveLoginPublicKey(publicKey: CryptoKey): Promise<`0x${string}`> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  const digest = await crypto.subtle.digest("SHA-256", spki);
  return `0x${[...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
