// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title GameRewardClaim
/// @notice Consumes one-time EIP-712 Reward Authorizations for synthetic points.
/// @dev Generalized by Stable Application ID. Stores no identity or proof data.
contract GameRewardClaim is EIP712 {
    using ECDSA for bytes32;

    error InvalidAuthorizer();
    error InvalidSignature();
    error ClaimExpired();
    error ClaimAlreadyConsumed();
    error ZeroRecipient();
    error ZeroClaimId();
    error ZeroResultId();
    error ZeroApplicationId();
    error UnsupportedAuthorizationVersion(uint8 version);

    bytes32 public constant REWARD_AUTHORIZATION_V1_TYPEHASH = keccak256(
        "RewardAuthorizationV1(uint8 version,bytes32 stableApplicationId,bytes32 resultId,bytes32 claimId,address recipient,uint256 amount,uint64 expiresAt)"
    );

    address public immutable authorizer;

    mapping(bytes32 claimId => bool consumed) public claimConsumed;
    mapping(bytes32 stableApplicationId => mapping(address recipient => uint256 points))
        public syntheticPoints;

    event RewardClaimed(
        bytes32 indexed claimId,
        bytes32 indexed stableApplicationId,
        bytes32 resultId,
        address indexed recipient,
        uint256 amount
    );

    struct RewardAuthorizationV1 {
        uint8 version;
        bytes32 stableApplicationId;
        bytes32 resultId;
        bytes32 claimId;
        address recipient;
        uint256 amount;
        uint64 expiresAt;
    }

    constructor(address authorizer_) EIP712("agentvisa.reward-authorization.v1", "1") {
        if (authorizer_ == address(0)) {
            revert InvalidAuthorizer();
        }
        authorizer = authorizer_;
    }

    function claim(RewardAuthorizationV1 calldata authorization, bytes calldata signature) external {
        if (authorization.version != 1) {
            revert UnsupportedAuthorizationVersion(authorization.version);
        }
        if (authorization.stableApplicationId == bytes32(0)) {
            revert ZeroApplicationId();
        }
        if (authorization.resultId == bytes32(0)) {
            revert ZeroResultId();
        }
        if (authorization.claimId == bytes32(0)) {
            revert ZeroClaimId();
        }
        if (authorization.recipient == address(0)) {
            revert ZeroRecipient();
        }
        if (block.timestamp > authorization.expiresAt) {
            revert ClaimExpired();
        }
        if (claimConsumed[authorization.claimId]) {
            revert ClaimAlreadyConsumed();
        }

        address signer = _hashTypedDataV4(_structHash(authorization)).recover(signature);
        if (signer != authorizer) {
            revert InvalidSignature();
        }

        // Consume the claim ID and update points before any further interaction.
        claimConsumed[authorization.claimId] = true;
        syntheticPoints[authorization.stableApplicationId][authorization.recipient] +=
            authorization.amount;

        emit RewardClaimed(
            authorization.claimId,
            authorization.stableApplicationId,
            authorization.resultId,
            authorization.recipient,
            authorization.amount
        );
    }

    function _structHash(RewardAuthorizationV1 calldata authorization) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                REWARD_AUTHORIZATION_V1_TYPEHASH,
                authorization.version,
                authorization.stableApplicationId,
                authorization.resultId,
                authorization.claimId,
                authorization.recipient,
                authorization.amount,
                authorization.expiresAt
            )
        );
    }
}
