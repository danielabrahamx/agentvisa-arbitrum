// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title EnrollmentAuthorizationHash
/// @notice Matches `hashEnrollmentAuthorizationV1` in `@agentvisa/policy`.
library EnrollmentAuthorizationHash {
    /// @dev keccak256("agentvisa.enrollment-authorization.v1") as bytes32 text hash.
    bytes32 internal constant DOMAIN_SEPARATOR =
        0x597ccb2585de40af1a9cda83ad0ded334fc275c29c5606a18837b4fccde9c30a;

    /// @dev BN254 scalar field order used by Semaphore v4.
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct EnrollmentAuthorization {
        uint8 version;
        bytes32 sourceId;
        bytes32 uniquenessDomain;
        bytes32 opaqueSubjectDigest;
        bytes32 credentialSchemaId;
        bytes32 assuranceId;
        uint256 semaphoreIdentityCommitment;
        uint64 issuedAt;
        uint64 expiresAt;
        bytes32 nonce;
    }

    function hashDigest(EnrollmentAuthorization calldata authorization) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DOMAIN_SEPARATOR,
                    authorization.version,
                    authorization.sourceId,
                    authorization.uniquenessDomain,
                    authorization.opaqueSubjectDigest,
                    authorization.credentialSchemaId,
                    authorization.assuranceId,
                    authorization.semaphoreIdentityCommitment,
                    authorization.issuedAt,
                    authorization.expiresAt,
                    authorization.nonce
                )
            );
    }

    function isValidIdentityCommitment(uint256 commitment) internal pure returns (bool) {
        return commitment > 0 && commitment < SNARK_SCALAR_FIELD;
    }
}
