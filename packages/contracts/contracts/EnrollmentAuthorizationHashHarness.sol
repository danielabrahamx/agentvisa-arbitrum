// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EnrollmentAuthorizationHash} from "./libraries/EnrollmentAuthorizationHash.sol";

/// @dev Test harness exposing the library hash for golden-vector parity checks.
contract EnrollmentAuthorizationHashHarness {
    function hashDigest(
        EnrollmentAuthorizationHash.EnrollmentAuthorization calldata authorization
    ) external pure returns (bytes32) {
        return EnrollmentAuthorizationHash.hashDigest(authorization);
    }
}
