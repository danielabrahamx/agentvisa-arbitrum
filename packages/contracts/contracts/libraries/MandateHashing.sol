pragma solidity ^0.8.28;

library MandateHashing {
    error UnsupportedMandateVersion(uint8 version);
    error UnsupportedScopeVersion(uint8 version);

    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 internal constant MANDATE_V1_TYPEHASH = keccak256(
        "MandateV1(uint8 version,uint256 chainId,address account,address authorization,uint256 groupId,bytes32 permissionDigest,address sessionKey,uint48 validAfter,uint48 validUntil,bytes32 authorizationId)"
    );
    bytes32 internal constant SCOPE_V1_TYPEHASH = keccak256(
        "ScopeV1(uint8 version,uint256 chainId,address account,address authorization,uint256 groupId,bytes32 permissionDigest,bytes32 authorizationId)"
    );

    struct MandateV1 {
        uint8 version;
        uint256 chainId;
        address account;
        address authorization;
        uint256 groupId;
        bytes32 permissionDigest;
        address sessionKey;
        uint48 validAfter;
        uint48 validUntil;
        bytes32 authorizationId;
    }

    struct ScopeV1 {
        uint8 version;
        uint256 chainId;
        address account;
        address authorization;
        uint256 groupId;
        bytes32 permissionDigest;
        bytes32 authorizationId;
    }

    function digestToField(bytes32 digest) internal pure returns (uint256) {
        return uint256(digest) % SNARK_SCALAR_FIELD;
    }

    function hashMandateV1(MandateV1 memory mandate) internal pure returns (bytes32) {
        if (mandate.version != 1) {
            revert UnsupportedMandateVersion(mandate.version);
        }

        return keccak256(
            abi.encode(
                MANDATE_V1_TYPEHASH,
                mandate.version,
                mandate.chainId,
                mandate.account,
                mandate.authorization,
                mandate.groupId,
                mandate.permissionDigest,
                mandate.sessionKey,
                mandate.validAfter,
                mandate.validUntil,
                mandate.authorizationId
            )
        );
    }

    function hashScopeV1(ScopeV1 memory scope) internal pure returns (bytes32) {
        if (scope.version != 1) {
            revert UnsupportedScopeVersion(scope.version);
        }

        return keccak256(
            abi.encode(
                SCOPE_V1_TYPEHASH,
                scope.version,
                scope.chainId,
                scope.account,
                scope.authorization,
                scope.groupId,
                scope.permissionDigest,
                scope.authorizationId
            )
        );
    }
}
