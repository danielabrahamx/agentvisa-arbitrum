import assert from "node:assert/strict";
import { describe, it } from "node:test";

import hardhatConfig from "../../hardhat.config.js";

void describe("contract foundation integration", () => {
  void it("uses the configured contract source directory", () => {
    assert.equal(hardhatConfig.paths?.sources, "./contracts");
  });
});
