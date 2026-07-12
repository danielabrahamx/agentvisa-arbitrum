// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

import {EnrollmentAuthorizationHash} from "./libraries/EnrollmentAuthorizationHash.sol";

/// @title AgentVisaAdmission
/// @notice Thin adapter: verify upstream enrollment signatures and admit commitments to Semaphore.
/// @dev No custom zk verification. Registration nullifiers use upstream `Semaphore.validateProof`.
contract AgentVisaAdmission {
    using ECDSA for bytes32;

    error InvalidSemaphore();
    error InvalidEnrollmentSigner();
    error UnsupportedAuthorizationVersion(uint8 version);
    error InvalidSourceId();
    error InvalidUniquenessDomain();
    error InvalidCredentialSchema();
    error InvalidAssuranceId();
    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error AuthorizationValidityTooLong();
    error InvalidIdentityCommitment();
    error NonceAlreadyConsumed();
    error OpaqueSubjectAlreadyConsumed();
    error InvalidSignature();

    ISemaphore public immutable semaphore;
    uint256 public immutable credentialGroupId;
    bytes32 public immutable sourceId;
    bytes32 public immutable uniquenessDomain;
    bytes32 public immutable credentialSchemaId;
    bytes32 public immutable acceptedAssuranceId;
    uint64 public immutable maximumValiditySeconds;
    address public immutable enrollmentSigner;

    mapping(bytes32 nonce => bool consumed) public nonceConsumed;
    mapping(bytes32 opaqueSubjectDigest => bool consumed) public opaqueSubjectConsumed;

    event Enrolled(uint256 indexed commitment, bytes32 indexed opaqueSubjectDigest);

    constructor(
        address semaphore_,
        uint256 credentialGroupId_,
        bytes32 sourceId_,
        bytes32 uniquenessDomain_,
        bytes32 credentialSchemaId_,
        bytes32 acceptedAssuranceId_,
        uint64 maximumValiditySeconds_,
        address enrollmentSigner_
    ) {
        if (semaphore_ == address(0)) {
            revert InvalidSemaphore();
        }
        if (enrollmentSigner_ == address(0)) {
            revert InvalidEnrollmentSigner();
        }
        if (
            sourceId_ == bytes32(0) ||
            uniquenessDomain_ == bytes32(0) ||
            credentialSchemaId_ == bytes32(0) ||
            acceptedAssuranceId_ == bytes32(0) ||
            maximumValiditySeconds_ == 0
        ) {
            revert InvalidSourceId();
        }

        semaphore = ISemaphore(semaphore_);
        credentialGroupId = credentialGroupId_;
        sourceId = sourceId_;
        uniquenessDomain = uniquenessDomain_;
        credentialSchemaId = credentialSchemaId_;
        acceptedAssuranceId = acceptedAssuranceId_;
        maximumValiditySeconds = maximumValiditySeconds_;
        enrollmentSigner = enrollmentSigner_;
    }

    function enroll(
        EnrollmentAuthorizationHash.EnrollmentAuthorization calldata authorization,
        bytes calldata signature
    ) external {
        if (authorization.version != 1) {
            revert UnsupportedAuthorizationVersion(authorization.version);
        }
        if (authorization.sourceId != sourceId) {
            revert InvalidSourceId();
        }
        if (authorization.uniquenessDomain != uniquenessDomain) {
            revert InvalidUniquenessDomain();
        }
        if (authorization.credentialSchemaId != credentialSchemaId) {
            revert InvalidCredentialSchema();
        }
        if (authorization.assuranceId != acceptedAssuranceId) {
            revert InvalidAssuranceId();
        }
        if (authorization.expiresAt <= authorization.issuedAt) {
            revert AuthorizationExpired();
        }
        if (authorization.expiresAt - authorization.issuedAt > maximumValiditySeconds) {
            revert AuthorizationValidityTooLong();
        }
        if (authorization.issuedAt > block.timestamp) {
            revert AuthorizationNotYetValid();
        }
        if (authorization.expiresAt <= block.timestamp) {
            revert AuthorizationExpired();
        }
        if (!EnrollmentAuthorizationHash.isValidIdentityCommitment(authorization.semaphoreIdentityCommitment)) {
            revert InvalidIdentityCommitment();
        }
        if (nonceConsumed[authorization.nonce]) {
            revert NonceAlreadyConsumed();
        }
        if (opaqueSubjectConsumed[authorization.opaqueSubjectDigest]) {
            revert OpaqueSubjectAlreadyConsumed();
        }

        bytes32 digest = EnrollmentAuthorizationHash.hashDigest(authorization);
        address signer = digest.recover(signature);
        if (signer != enrollmentSigner) {
            revert InvalidSignature();
        }

        nonceConsumed[authorization.nonce] = true;
        opaqueSubjectConsumed[authorization.opaqueSubjectDigest] = true;

        semaphore.addMember(credentialGroupId, authorization.semaphoreIdentityCommitment);

        emit Enrolled(authorization.semaphoreIdentityCommitment, authorization.opaqueSubjectDigest);
    }
}
