import { describe, expect, it } from "vitest";

import { membersFromAdmissionEvents } from "../src/onchain-group-snapshot.js";

describe("membersFromAdmissionEvents", () => {
  it("reconstructs members in admission order from MemberAdded logs", () => {
    const members = membersFromAdmissionEvents(
      [
        { args: { index: 0n, identityCommitment: 11n } },
        { args: { index: 1n, identityCommitment: 22n } },
      ],
      [],
      2,
    );

    expect(members).toEqual([11n, 22n]);
  });

  it("fills MembersAdded batches by start index", () => {
    const members = membersFromAdmissionEvents(
      [{ args: { index: 0n, identityCommitment: 11n } }],
      [{ args: { startIndex: 1n, identityCommitments: [22n, 33n] } }],
      3,
    );

    expect(members).toEqual([11n, 22n, 33n]);
  });

  it("fails when event history cannot cover the current tree size", () => {
    expect(() =>
      membersFromAdmissionEvents([{ args: { index: 0n, identityCommitment: 11n } }], [], 2),
    ).toThrow("credential_group_members_unavailable");
  });
});
