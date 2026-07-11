import type { Hex } from "viem";

import { ApplicationRegistrationService } from "./application-registration-service.js";

export interface RobotRallyPlayerMetadata {
  readonly username?: string;
  readonly wallet?: string;
}

export interface RobotRallyAccountState {
  readonly accountId: Hex;
  readonly plays: number;
  readonly wins: number;
  readonly isManuallyFlaggedBot: boolean;
  readonly isBanned: boolean;
  readonly latestUsername?: string;
  readonly latestWallet?: string;
}

export interface RobotRallyStateStore {
  get(accountId: Hex): RobotRallyAccountState | undefined;
  put(state: RobotRallyAccountState): void;
  list(): readonly RobotRallyAccountState[];
}

type RobotRallyActivityResult =
  | {
      readonly status: "played" | "won";
      readonly accountId: Hex;
      readonly plays: number;
      readonly wins: number;
    }
  | { readonly status: "rejected"; readonly reason: "invalid_session" | "banned" };

function initialState(accountId: Hex): RobotRallyAccountState {
  return {
    accountId,
    plays: 0,
    wins: 0,
    isManuallyFlaggedBot: false,
    isBanned: false,
  };
}

class MemoryRobotRallyStateStore implements RobotRallyStateStore {
  readonly #accounts = new Map<Hex, RobotRallyAccountState>();

  get(accountId: Hex): RobotRallyAccountState | undefined {
    return this.#accounts.get(accountId);
  }

  put(state: RobotRallyAccountState): void {
    this.#accounts.set(state.accountId, state);
  }

  list(): readonly RobotRallyAccountState[] {
    return [...this.#accounts.values()];
  }
}

export class RobotRallyAdapter {
  readonly #store: RobotRallyStateStore;

  constructor(
    readonly applicationAccounts: ApplicationRegistrationService,
    store: RobotRallyStateStore = new MemoryRobotRallyStateStore(),
  ) {
    this.#store = store;
  }

  play(token: string, metadata: RobotRallyPlayerMetadata): RobotRallyActivityResult {
    const authentication = this.applicationAccounts.authenticateSession(token);
    if (authentication.status === "rejected") {
      return authentication;
    }
    const current =
      this.#store.get(authentication.account.accountId) ??
      initialState(authentication.account.accountId);
    const updated: RobotRallyAccountState = {
      ...current,
      plays: current.plays + 1,
      ...(metadata.username === undefined ? {} : { latestUsername: metadata.username }),
      ...(metadata.wallet === undefined ? {} : { latestWallet: metadata.wallet }),
    };
    this.#store.put(updated);
    return {
      status: "played",
      accountId: updated.accountId,
      plays: updated.plays,
      wins: updated.wins,
    };
  }

  win(token: string): RobotRallyActivityResult {
    const authentication = this.applicationAccounts.authenticateSession(token);
    if (authentication.status === "rejected") {
      return authentication;
    }
    const current =
      this.#store.get(authentication.account.accountId) ??
      initialState(authentication.account.accountId);
    const updated = { ...current, wins: current.wins + 1 };
    this.#store.put(updated);
    return {
      status: "won",
      accountId: updated.accountId,
      plays: updated.plays,
      wins: updated.wins,
    };
  }

  flagBot(accountId: Hex): RobotRallyAccountState {
    const current = this.#store.get(accountId) ?? initialState(accountId);
    const updated = { ...current, isManuallyFlaggedBot: true };
    this.#store.put(updated);
    return updated;
  }

  ban(accountId: Hex): boolean {
    if (!this.applicationAccounts.banAccount(accountId)) {
      return false;
    }
    const current = this.#store.get(accountId) ?? initialState(accountId);
    this.#store.put({ ...current, isBanned: true });
    return true;
  }

  getState(accountId: Hex): RobotRallyAccountState | undefined {
    return this.#store.get(accountId);
  }

  listStates(): readonly RobotRallyAccountState[] {
    return this.#store.list();
  }
}
