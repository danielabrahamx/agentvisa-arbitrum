import type { BrowserCredentialGroupSnapshot } from "@agentvisa/browser-identity";
import type { Address, PublicClient } from "viem";

const SEMAPHORE_GROUP_ABI = [
  {
    type: "function",
    name: "getMerkleTreeRoot",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getMerkleTreeSize",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasMember",
    stateMutability: "view",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "identityCommitment", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "MemberAdded",
    inputs: [
      { indexed: true, name: "groupId", type: "uint256" },
      { indexed: false, name: "index", type: "uint256" },
      { indexed: false, name: "identityCommitment", type: "uint256" },
      { indexed: false, name: "merkleTreeRoot", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MembersAdded",
    inputs: [
      { indexed: true, name: "groupId", type: "uint256" },
      { indexed: false, name: "startIndex", type: "uint256" },
      { indexed: false, name: "identityCommitments", type: "uint256[]" },
      { indexed: false, name: "merkleTreeRoot", type: "uint256" },
    ],
  },
] as const;

interface MemberAddedEvent {
  readonly args: {
    readonly index?: bigint;
    readonly identityCommitment?: bigint;
  };
}

interface MembersAddedEvent {
  readonly args: {
    readonly startIndex?: bigint;
    readonly identityCommitments?: readonly bigint[];
  };
}

export async function loadOnchainCredentialGroupSnapshot(
  publicClient: PublicClient,
  semaphore: Address,
  groupId: bigint,
  identityCommitment: bigint,
): Promise<BrowserCredentialGroupSnapshot> {
  const [root, size, isMember] = await Promise.all([
    publicClient.readContract({
      address: semaphore,
      abi: SEMAPHORE_GROUP_ABI,
      functionName: "getMerkleTreeRoot",
      args: [groupId],
    }),
    publicClient.readContract({
      address: semaphore,
      abi: SEMAPHORE_GROUP_ABI,
      functionName: "getMerkleTreeSize",
      args: [groupId],
    }),
    publicClient.readContract({
      address: semaphore,
      abi: SEMAPHORE_GROUP_ABI,
      functionName: "hasMember",
      args: [groupId, identityCommitment],
    }),
  ]);

  if (!isMember) {
    throw new Error("enroll_first_on_chain");
  }

  const memberCount = Number(size);
  if (memberCount === 0) {
    throw new Error("credential_group_empty");
  }

  const [memberAddedLogs, membersAddedLogs] = await Promise.all([
    publicClient.getContractEvents({
      address: semaphore,
      abi: SEMAPHORE_GROUP_ABI,
      eventName: "MemberAdded",
      args: { groupId },
      fromBlock: 0n,
      toBlock: "latest",
    }),
    publicClient.getContractEvents({
      address: semaphore,
      abi: SEMAPHORE_GROUP_ABI,
      eventName: "MembersAdded",
      args: { groupId },
      fromBlock: 0n,
      toBlock: "latest",
    }),
  ]);

  const members = membersFromAdmissionEvents(
    memberAddedLogs as readonly MemberAddedEvent[],
    membersAddedLogs as readonly MembersAddedEvent[],
    memberCount,
  );

  return {
    members,
    root,
    size: memberCount,
  };
}

export function membersFromAdmissionEvents(
  memberAdded: readonly MemberAddedEvent[],
  membersAdded: readonly MembersAddedEvent[],
  expectedSize: number,
): readonly bigint[] {
  const members: Array<bigint | undefined> = Array.from({ length: expectedSize });

  for (const log of memberAdded) {
    const index = Number(log.args.index);
    const commitment = log.args.identityCommitment;
    if (!Number.isInteger(index) || index < 0 || index >= expectedSize || commitment === undefined) {
      continue;
    }
    members[index] = commitment;
  }

  for (const log of membersAdded) {
    const startIndex = Number(log.args.startIndex);
    const commitments = log.args.identityCommitments;
    if (!Number.isInteger(startIndex) || startIndex < 0 || commitments === undefined) {
      continue;
    }
    for (let offset = 0; offset < commitments.length; offset += 1) {
      const index = startIndex + offset;
      if (index >= expectedSize) break;
      members[index] = commitments[offset];
    }
  }

  if (members.some((member) => member === undefined)) {
    throw new Error("credential_group_members_unavailable");
  }

  return members as bigint[];
}
