import {
  parseRewardAuthorizationV1,
  rewardAuthorizationTypedDataV1,
  type RewardAuthorizationDomainV1,
  type RewardAuthorizationV1,
} from "@agentvisa/policy";
import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from "viem";

import type { ApplicationRegistrationService } from "./application-registration-service.js";
import type { RobotRallyAdapter } from "./robot-rally-adapter.js";

const RESULT_ID_DOMAIN = keccak256(stringToHex("agentvisa.application-result-id.v1"));
const CLAIM_ID_DOMAIN = keccak256(stringToHex("agentvisa.reward-claim-id.v1"));

export interface ApplicationResultRecord {
  readonly resultId: Hex;
  readonly stableApplicationId: Hex;
  readonly accountId: Hex;
  readonly winIndex: number;
  readonly createdAt: bigint;
}

export interface IssuedRewardClaimRecord {
  readonly claimId: Hex;
  readonly resultId: Hex;
  readonly stableApplicationId: Hex;
  readonly accountId: Hex;
  readonly recipient: Address;
  readonly amount: bigint;
  readonly expiresAt: bigint;
  readonly issuedAt: bigint;
}

export interface RewardClaimStore {
  getResult(resultId: Hex): ApplicationResultRecord | undefined;
  getResultByAccountWin(accountId: Hex, winIndex: number): ApplicationResultRecord | undefined;
  putResult(result: ApplicationResultRecord): void;
  getClaimByResult(resultId: Hex): IssuedRewardClaimRecord | undefined;
  getClaim(claimId: Hex): IssuedRewardClaimRecord | undefined;
  putClaim(claim: IssuedRewardClaimRecord): void;
}

export type RewardAuthorizationRejectionReason =
  "invalid_session" | "banned" | "ineligible" | "already_authorized";

export type RewardAuthorizationIssueResult =
  | {
      readonly status: "issued";
      readonly authorization: RewardAuthorizationV1;
      readonly domain: RewardAuthorizationDomainV1;
      readonly signature: Hex;
      readonly result: ApplicationResultRecord;
    }
  | {
      readonly status: "rejected";
      readonly reason: RewardAuthorizationRejectionReason;
    };

export interface IssueRewardAuthorizationInput {
  readonly token: string;
  readonly recipient: Address;
  readonly amount: bigint;
  readonly expiresAt: bigint;
  readonly domain: RewardAuthorizationDomainV1;
}

export interface RewardAuthorizerConfiguration {
  readonly stableApplicationId: Hex;
  readonly applicationAccounts: ApplicationRegistrationService;
  readonly robotRally: RobotRallyAdapter;
  readonly store: RewardClaimStore;
  readonly authorizer: PrivateKeyAccount;
  readonly currentTime: () => bigint;
  readonly defaultAmount?: bigint;
}

class MemoryRewardClaimStore implements RewardClaimStore {
  readonly #results = new Map<Hex, ApplicationResultRecord>();
  readonly #resultsByWin = new Map<string, ApplicationResultRecord>();
  readonly #claims = new Map<Hex, IssuedRewardClaimRecord>();
  readonly #claimsByResult = new Map<Hex, IssuedRewardClaimRecord>();

  getResult(resultId: Hex): ApplicationResultRecord | undefined {
    return this.#results.get(resultId.toLowerCase() as Hex);
  }

  getResultByAccountWin(accountId: Hex, winIndex: number): ApplicationResultRecord | undefined {
    return this.#resultsByWin.get(`${accountId.toLowerCase()}:${winIndex}`);
  }

  putResult(result: ApplicationResultRecord): void {
    const resultId = result.resultId.toLowerCase() as Hex;
    const accountId = result.accountId.toLowerCase() as Hex;
    const normalized = { ...result, resultId, accountId };
    this.#results.set(resultId, normalized);
    this.#resultsByWin.set(`${accountId}:${result.winIndex}`, normalized);
  }

  getClaimByResult(resultId: Hex): IssuedRewardClaimRecord | undefined {
    return this.#claimsByResult.get(resultId.toLowerCase() as Hex);
  }

  getClaim(claimId: Hex): IssuedRewardClaimRecord | undefined {
    return this.#claims.get(claimId.toLowerCase() as Hex);
  }

  putClaim(claim: IssuedRewardClaimRecord): void {
    const claimId = claim.claimId.toLowerCase() as Hex;
    const resultId = claim.resultId.toLowerCase() as Hex;
    const normalized = { ...claim, claimId, resultId };
    this.#claims.set(claimId, normalized);
    this.#claimsByResult.set(resultId, normalized);
  }
}

function deriveResultId(stableApplicationId: Hex, accountId: Hex, winIndex: number): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
      [RESULT_ID_DOMAIN, stableApplicationId, accountId, BigInt(winIndex)],
    ),
  );
}

function deriveClaimId(resultId: Hex, recipient: Address, amount: bigint, expiresAt: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [CLAIM_ID_DOMAIN, resultId, recipient, amount, expiresAt],
    ),
  );
}

export class RewardAuthorizer {
  readonly #stableApplicationId: Hex;
  readonly #applicationAccounts: ApplicationRegistrationService;
  readonly #robotRally: RobotRallyAdapter;
  readonly #store: RewardClaimStore;
  readonly #authorizer: PrivateKeyAccount;
  readonly #currentTime: () => bigint;
  readonly #defaultAmount: bigint;

  constructor(configuration: RewardAuthorizerConfiguration) {
    this.#stableApplicationId = configuration.stableApplicationId;
    this.#applicationAccounts = configuration.applicationAccounts;
    this.#robotRally = configuration.robotRally;
    this.#store = configuration.store;
    this.#authorizer = configuration.authorizer;
    this.#currentTime = configuration.currentTime;
    this.#defaultAmount = configuration.defaultAmount ?? 100n;
  }

  get store(): RewardClaimStore {
    return this.#store;
  }

  async issueForEligibleWin(
    input: IssueRewardAuthorizationInput,
  ): Promise<RewardAuthorizationIssueResult> {
    const authentication = this.#applicationAccounts.authenticateSession(input.token);
    if (authentication.status === "rejected") {
      return authentication;
    }

    const account = authentication.account;
    if (account.status === "banned") {
      return { status: "rejected", reason: "banned" };
    }

    const gameState = this.#robotRally.getState(account.accountId);
    if (!gameState || gameState.wins < 1 || gameState.isBanned) {
      return { status: "rejected", reason: gameState?.isBanned ? "banned" : "ineligible" };
    }

    const winIndex = gameState.wins;
    const existingResult = this.#store.getResultByAccountWin(account.accountId, winIndex);
    const result =
      existingResult ??
      ({
        resultId: deriveResultId(this.#stableApplicationId, account.accountId, winIndex),
        stableApplicationId: this.#stableApplicationId,
        accountId: account.accountId,
        winIndex,
        createdAt: this.#currentTime(),
      } satisfies ApplicationResultRecord);

    if (this.#store.getClaimByResult(result.resultId)) {
      return { status: "rejected", reason: "already_authorized" };
    }

    const amount = input.amount > 0n ? input.amount : this.#defaultAmount;
    const authorization = parseRewardAuthorizationV1({
      version: 1,
      stableApplicationId: this.#stableApplicationId,
      resultId: result.resultId,
      claimId: deriveClaimId(result.resultId, input.recipient, amount, input.expiresAt),
      recipient: input.recipient,
      amount,
      expiresAt: input.expiresAt,
    });

    if (authorization.expiresAt <= this.#currentTime()) {
      return { status: "rejected", reason: "ineligible" };
    }

    // Persist eligibility consumption before returning a signature that can leave the process.
    if (!existingResult) {
      this.#store.putResult(result);
    }
    this.#store.putClaim({
      claimId: authorization.claimId,
      resultId: result.resultId,
      stableApplicationId: this.#stableApplicationId,
      accountId: account.accountId,
      recipient: authorization.recipient,
      amount: authorization.amount,
      expiresAt: authorization.expiresAt,
      issuedAt: this.#currentTime(),
    });

    const signature = await this.#authorizer.signTypedData(
      rewardAuthorizationTypedDataV1(authorization, input.domain),
    );

    return {
      status: "issued",
      authorization,
      domain: input.domain,
      signature,
      result,
    };
  }
}

export function createMemoryRewardClaimStore(): RewardClaimStore {
  return new MemoryRewardClaimStore();
}
