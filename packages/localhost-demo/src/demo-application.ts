import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import {
  ApplicationRegistrationService,
  RewardAuthorizer,
  RobotRallyAdapter,
  SqliteApplicationStore,
  SqliteRewardClaimStore,
  SqliteRobotRallyStore,
  type ApplicationRegistrationResult,
  type RegistrationProofVerifier,
  type RewardAuthorizationIssueResult,
  type RobotRallyPlayerMetadata,
} from "@agentvisa/application-service";
import {
  CredentialIssuer,
  SqliteCredentialIssuanceStore,
  createSyntheticUniquenessSource,
  type CredentialIssuanceResult,
} from "@agentvisa/credential-issuer";
import { Group } from "@semaphore-protocol/group";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  DEMO_REWARD_CLAIM_AMOUNT,
  DEMO_REWARD_CLAIM_CHAIN_ID,
  DEMO_REWARD_CLAIM_CONTRACT,
  DEMO_REWARD_CLAIM_TTL_SECONDS,
  demoRewardClaimPublicConfig,
  type DemoRewardClaimPublicConfig,
} from "./claim-constants.js";
import {
  DEMO_CREDENTIAL_GROUP_ID,
  DEMO_SOURCE_POLICY,
  ROBOT_RALLY_APPLICATION_ID,
} from "./constants.js";
import { BrowserLoginKeyAuthenticator } from "./login-key-authenticator.js";
import { SqliteDemoJourneyStore } from "./sqlite-demo-journey-store.js";

export interface DemoRewardClaimConfiguration {
  readonly authorizerPrivateKey: Hex;
  readonly chainId?: bigint;
  readonly verifyingContract?: Address;
  readonly defaultAmount?: bigint;
  readonly authorizationTtlSeconds?: bigint;
}

export interface DemoApplicationConfiguration {
  readonly dataDirectory: string;
  readonly currentTime?: () => bigint;
  readonly proofVerifier?: RegistrationProofVerifier;
  readonly challengeFactory?: () => string;
  readonly sessionTokenFactory?: () => string;
  readonly rewardClaim?: DemoRewardClaimConfiguration;
}

export type DemoEnrollmentResult =
  | {
      readonly status: "issued" | "existing";
      readonly credential: {
        readonly credentialId: Hex;
        readonly groupId: Hex;
        readonly membershipIndex: number;
        readonly issuedAt: bigint;
      };
      readonly group: {
        readonly members: readonly bigint[];
        readonly root: bigint;
        readonly size: number;
      };
    }
  | Extract<CredentialIssuanceResult, { readonly status: "conflict" | "rejected" }>;

export type DemoClaimAuthorizationResult =
  | RewardAuthorizationIssueResult
  | { readonly status: "rejected"; readonly reason: "claim_disabled" | "malformed_request" };

export class DemoApplication {
  readonly #credentialStore: SqliteCredentialIssuanceStore;
  readonly #applicationStore: SqliteApplicationStore;
  readonly #robotRallyStore: SqliteRobotRallyStore;
  readonly #rewardClaimStore: SqliteRewardClaimStore | undefined;
  readonly #issuer: CredentialIssuer;
  readonly #registration: ApplicationRegistrationService;
  readonly #loginKeys: BrowserLoginKeyAuthenticator;
  readonly #robotRally: RobotRallyAdapter;
  readonly #rewardAuthorizer: RewardAuthorizer | undefined;
  readonly #rewardClaimPublic: DemoRewardClaimPublicConfig;
  readonly #authorizationTtlSeconds: bigint;
  readonly #claimDomain:
    { readonly chainId: bigint; readonly verifyingContract: Address } | undefined;
  readonly #source: ReturnType<typeof createSyntheticUniquenessSource>;
  readonly #journeyStore: SqliteDemoJourneyStore;
  readonly #currentTime: () => bigint;
  #isClosed = false;

  constructor(configuration: DemoApplicationConfiguration) {
    mkdirSync(configuration.dataDirectory, { recursive: true });
    this.#currentTime = configuration.currentTime ?? (() => BigInt(Math.floor(Date.now() / 1000)));
    this.#credentialStore = new SqliteCredentialIssuanceStore({
      databasePath: join(configuration.dataDirectory, "credential-issuance.sqlite"),
    });
    const applicationDatabasePath = join(configuration.dataDirectory, "robot-rally.sqlite");
    this.#applicationStore = new SqliteApplicationStore({ databasePath: applicationDatabasePath });
    this.#robotRallyStore = new SqliteRobotRallyStore({ databasePath: applicationDatabasePath });
    this.#journeyStore = new SqliteDemoJourneyStore(
      join(configuration.dataDirectory, "demo-journeys.sqlite"),
    );
    this.#source = loadOrCreateSyntheticSource(configuration.dataDirectory);
    this.#issuer = new CredentialIssuer({
      sourcePolicy: DEMO_SOURCE_POLICY,
      sourceVerifier: this.#source.verifier,
      groupId: DEMO_CREDENTIAL_GROUP_ID,
      store: this.#credentialStore,
      currentTime: this.#currentTime,
    });
    this.#loginKeys = new BrowserLoginKeyAuthenticator(
      this.#currentTime,
      configuration.challengeFactory,
    );
    this.#registration = new ApplicationRegistrationService({
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      credentialGroupId: DEMO_CREDENTIAL_GROUP_ID,
      rootPolicy: { classify: (root) => this.#classifyRoot(root) },
      ...(configuration.proofVerifier === undefined
        ? {}
        : { proofVerifier: configuration.proofVerifier }),
      store: this.#applicationStore,
      currentTime: this.#currentTime,
      loginKeyAuthenticator: this.#loginKeys,
      ...(configuration.sessionTokenFactory === undefined
        ? {}
        : { sessionTokenFactory: configuration.sessionTokenFactory }),
    });
    this.#robotRally = new RobotRallyAdapter(this.#registration, this.#robotRallyStore);

    const rewardClaim = configuration.rewardClaim;
    if (rewardClaim === undefined) {
      this.#rewardClaimStore = undefined;
      this.#rewardAuthorizer = undefined;
      this.#authorizationTtlSeconds = DEMO_REWARD_CLAIM_TTL_SECONDS;
      this.#rewardClaimPublic = demoRewardClaimPublicConfig(false);
      this.#claimDomain = undefined;
    } else {
      const chainId = rewardClaim.chainId ?? BigInt(DEMO_REWARD_CLAIM_CHAIN_ID);
      const verifyingContract = getAddress(
        rewardClaim.verifyingContract ?? DEMO_REWARD_CLAIM_CONTRACT,
      );
      this.#rewardClaimStore = new SqliteRewardClaimStore({
        databasePath: join(configuration.dataDirectory, "reward-claims.sqlite"),
      });
      this.#authorizationTtlSeconds =
        rewardClaim.authorizationTtlSeconds ?? DEMO_REWARD_CLAIM_TTL_SECONDS;
      this.#rewardAuthorizer = new RewardAuthorizer({
        stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
        applicationAccounts: this.#registration,
        robotRally: this.#robotRally,
        store: this.#rewardClaimStore,
        authorizer: privateKeyToAccount(rewardClaim.authorizerPrivateKey),
        currentTime: this.#currentTime,
        defaultAmount: rewardClaim.defaultAmount ?? DEMO_REWARD_CLAIM_AMOUNT,
      });
      this.#rewardClaimPublic = {
        ...demoRewardClaimPublicConfig(true),
        chainId: Number(chainId),
        contractAddress: verifyingContract,
      };
      this.#claimDomain = { chainId, verifyingContract };
    }
  }

  get rewardClaimConfig(): DemoRewardClaimPublicConfig {
    return this.#rewardClaimPublic;
  }

  async enroll(input: unknown): Promise<DemoEnrollmentResult> {
    const request = parseEnrollmentRequest(input);
    if (request === undefined) {
      return { status: "rejected", reason: "malformed_request" };
    }
    const commitmentKey = request.semaphoreIdentityCommitment.toString();
    const issuedAt = this.#journeyStore.getOrCreateIssuedAt(commitmentKey, this.#currentTime());
    try {
      const authorization = await this.#source.authorize({
        opaqueSyntheticSubject: `synthetic-holder-${commitmentKey}`,
        semaphoreIdentityCommitment: request.semaphoreIdentityCommitment,
        issuedAt,
        expiresAt: issuedAt + DEMO_SOURCE_POLICY.maximumValiditySeconds,
        nonce: keccak256(stringToHex(`agentvisa.localhost-enrollment.v1.${commitmentKey}`)),
      });
      return projectEnrollmentResult(await this.#issuer.issue(authorization));
    } catch {
      return { status: "rejected", reason: "malformed_request" };
    }
  }

  register(input: unknown): Promise<ApplicationRegistrationResult> {
    return this.#registration.register(input);
  }

  createLoginChallenge(
    accountId: Hex,
  ):
    | { readonly status: "created"; readonly challenge: string }
    | { readonly status: "rejected"; readonly reason: "unknown_account" | "banned" } {
    const account = this.#applicationStore.getAccount(accountId);
    if (account === undefined) return { status: "rejected", reason: "unknown_account" };
    if (account.status === "banned") return { status: "rejected", reason: "banned" };
    return {
      status: "created",
      challenge: this.#loginKeys.createChallenge(account.loginPublicKey),
    };
  }

  createSession(accountId: Hex, authentication: unknown) {
    return this.#registration.createSession(accountId, authentication);
  }

  play(token: string, metadata: RobotRallyPlayerMetadata) {
    return this.#robotRally.play(token, metadata);
  }

  win(token: string) {
    return this.#robotRally.win(token);
  }

  async issueClaimAuthorization(
    token: string,
    recipientInput: unknown,
  ): Promise<DemoClaimAuthorizationResult> {
    if (this.#rewardAuthorizer === undefined || this.#claimDomain === undefined) {
      return { status: "rejected", reason: "claim_disabled" };
    }
    const recipient = parseRecipient(recipientInput);
    if (recipient === undefined) {
      return { status: "rejected", reason: "malformed_request" };
    }
    return this.#rewardAuthorizer.issueForEligibleWin({
      token,
      recipient,
      amount: DEMO_REWARD_CLAIM_AMOUNT,
      expiresAt: this.#currentTime() + this.#authorizationTtlSeconds,
      domain: this.#claimDomain,
    });
  }

  flagBot(accountId: Hex) {
    return this.#applicationStore.getAccount(accountId) === undefined
      ? undefined
      : this.#robotRally.flagBot(accountId);
  }

  ban(accountId: Hex): boolean {
    return this.#robotRally.ban(accountId);
  }

  listOperatorAccounts() {
    const accountIds = this.#applicationStore
      .listAuditEvents()
      .filter(({ eventType }) => eventType === "account_registered")
      .map(({ accountId }) => accountId);
    return accountIds.flatMap((accountId) => {
      const account = this.#applicationStore.getAccount(accountId);
      if (account === undefined) return [];
      const game = this.#robotRally.getState(accountId);
      return [
        {
          accountId,
          status: account.status,
          plays: game?.plays ?? 0,
          wins: game?.wins ?? 0,
          isManuallyFlaggedBot: game?.isManuallyFlaggedBot ?? false,
          ...(game?.latestUsername === undefined ? {} : { latestUsername: game.latestUsername }),
          ...(game?.latestWallet === undefined ? {} : { latestWallet: game.latestWallet }),
        },
      ];
    });
  }

  listAuditEvents() {
    return this.#applicationStore.listAuditEvents();
  }

  close(): void {
    if (this.#isClosed) return;
    this.#rewardClaimStore?.close();
    this.#robotRallyStore.close();
    this.#applicationStore.close();
    this.#credentialStore.close();
    this.#journeyStore.close();
    this.#isClosed = true;
  }

  #classifyRoot(root: bigint): "current" | "historical" | "rejected" {
    const snapshot = this.#credentialStore.getGroupSnapshot(DEMO_CREDENTIAL_GROUP_ID);
    if (snapshot.size === 0) return "rejected";
    if (snapshot.root === root) return "current";
    for (let size = 1; size < snapshot.size; size += 1) {
      if (new Group(snapshot.members.slice(0, size)).root === root) return "historical";
    }
    return "rejected";
  }
}

function parseRecipient(value: unknown): Address | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) return undefined;
  try {
    return getAddress(value);
  } catch {
    return undefined;
  }
}

function parseEnrollmentRequest(
  input: unknown,
): { readonly semaphoreIdentityCommitment: bigint } | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).length !== 1 ||
    typeof value.semaphoreIdentityCommitment !== "string" ||
    !/^[1-9][0-9]*$/.test(value.semaphoreIdentityCommitment)
  ) {
    return undefined;
  }
  return {
    semaphoreIdentityCommitment: BigInt(value.semaphoreIdentityCommitment),
  };
}

function projectEnrollmentResult(result: CredentialIssuanceResult): DemoEnrollmentResult {
  if (result.status !== "issued" && result.status !== "existing") return result;
  return {
    status: result.status,
    credential: {
      credentialId: result.credential.credentialId,
      groupId: result.credential.groupId,
      membershipIndex: result.credential.membershipIndex,
      issuedAt: result.credential.issuedAt,
    },
    group: result.group,
  };
}

function loadOrCreateSyntheticSource(dataDirectory: string) {
  const keyPath = join(dataDirectory, "synthetic-source.key");
  try {
    const privateKey = readFileSync(keyPath, "utf8").trim() as Hex;
    return createSyntheticUniquenessSource({ privateKey, policy: DEMO_SOURCE_POLICY });
  } catch {
    for (;;) {
      const privateKey: Hex = `0x${randomBytes(32).toString("hex")}`;
      try {
        const source = createSyntheticUniquenessSource({ privateKey, policy: DEMO_SOURCE_POLICY });
        writeFileSync(keyPath, `${privateKey}\n`, { encoding: "utf8", mode: 0o600 });
        return source;
      } catch {
        // The secp256k1 range excludes a negligible fraction of random 32-byte values.
      }
    }
  }
}
