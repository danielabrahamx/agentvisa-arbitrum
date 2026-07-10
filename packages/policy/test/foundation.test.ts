import { describe, expect, it } from "vitest";

import { MANDATE_PROTOCOL_VERSION } from "../src/index.js";

describe("policy foundation", () => {
  it("exports the documented Mandate protocol version", () => {
    expect(MANDATE_PROTOCOL_VERSION).toBe(1);
  });
});
