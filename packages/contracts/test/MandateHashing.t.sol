pragma solidity ^0.8.28;

import {MandateHashing} from "../contracts/libraries/MandateHashing.sol";

contract MandateHashingTest {
    function testMandateDigestMatchesGoldenVector() public pure {
        MandateHashing.MandateV1 memory mandate = _mandate();

        require(
            MandateHashing.hashMandateV1(mandate) ==
                hex"a57057412f32a509c42fc4bb67ed599d6d0a334fc5ced7f346cee3ef67cd7a04",
            "Mandate Digest mismatch"
        );
    }

    function testMandateDigestBindsPermissionDigest() public pure {
        MandateHashing.MandateV1 memory mandate = _mandate();
        bytes32 originalDigest = MandateHashing.hashMandateV1(mandate);
        mandate.permissionDigest = hex"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

        require(MandateHashing.hashMandateV1(mandate) != originalDigest, "Permission Digest not bound");
    }

    function testUnsupportedMandateVersionReverts() public view {
        MandateHashing.MandateV1 memory mandate = _mandate();
        mandate.version = 2;
        bool reverted;

        try this.hashMandateExternal(mandate) returns (bytes32) {} catch {
            reverted = true;
        }

        require(reverted, "unsupported Mandate version accepted");
    }

    function hashMandateExternal(
        MandateHashing.MandateV1 memory mandate
    ) external pure returns (bytes32) {
        return MandateHashing.hashMandateV1(mandate);
    }

    function testMandateFieldMatchesGoldenVector() public pure {
        require(
            MandateHashing.digestToField(
                hex"a57057412f32a509c42fc4bb67ed599d6d0a334fc5ced7f346cee3ef67cd7a04"
            ) == 9165380481275523325084094523019935225519179123998821192473183492942139849217,
            "Mandate Field mismatch"
        );
    }

    function testScopeFieldMatchesGoldenVector() public pure {
        require(
            MandateHashing.digestToField(
                hex"3b5ce215c968c43393e85fc8f4846a2aa40b21975c7bbf0d5d48b9fabb9454f1"
            ) == 4962325506577176755166674703931804088394211299624358087955212963012580496624,
            "Scope Field mismatch"
        );
    }

    function testMaximumDigestReductionMatchesGoldenVector() public pure {
        require(
            MandateHashing.digestToField(bytes32(type(uint256).max)) ==
                6350874878119819312338956282401532410528162663560392320966563075034087161850,
            "maximum digest reduction mismatch"
        );
    }

    function testBoundaryMandateMatchesGoldenVector() public pure {
        MandateHashing.MandateV1 memory mandate = MandateHashing.MandateV1({
            version: 1,
            chainId: type(uint256).max,
            account: address(0),
            authorization: address(0),
            groupId: type(uint256).max,
            permissionDigest: bytes32(type(uint256).max),
            sessionKey: address(0),
            validAfter: 0,
            validUntil: type(uint48).max,
            authorizationId: bytes32(type(uint256).max)
        });

        require(
            MandateHashing.hashMandateV1(mandate) ==
                hex"19ff5c0294fce51e86691d01ff45e3e3a8d0197ddb826c333af11b5cd0bb5748",
            "boundary Mandate Digest mismatch"
        );
    }

    function testUnsupportedScopeVersionReverts() public view {
        MandateHashing.ScopeV1 memory scope = _scope();
        scope.version = 2;
        bool reverted;

        try this.hashScopeExternal(scope) returns (bytes32) {} catch {
            reverted = true;
        }

        require(reverted, "unsupported Scope version accepted");
    }

    function hashScopeExternal(MandateHashing.ScopeV1 memory scope) external pure returns (bytes32) {
        return MandateHashing.hashScopeV1(scope);
    }

    function testScopeDigestMatchesGoldenVector() public pure {
        MandateHashing.ScopeV1 memory scope = _scope();

        require(
            MandateHashing.hashScopeV1(scope) ==
                hex"3b5ce215c968c43393e85fc8f4846a2aa40b21975c7bbf0d5d48b9fabb9454f1",
            "Scope digest mismatch"
        );
    }

    function testBoundaryScopeMatchesGoldenVector() public pure {
        MandateHashing.ScopeV1 memory scope = MandateHashing.ScopeV1({
            version: 1,
            chainId: type(uint256).max,
            account: address(0),
            authorization: address(0),
            groupId: type(uint256).max,
            permissionDigest: bytes32(type(uint256).max),
            authorizationId: bytes32(type(uint256).max)
        });

        require(
            MandateHashing.hashScopeV1(scope) ==
                hex"84f13b7d3a0ccdb347e638ed3325612e0b05db31676c90ef7cbad2b069b91dd6",
            "boundary Scope digest mismatch"
        );
    }

    function _scope() private pure returns (MandateHashing.ScopeV1 memory) {
        return
            MandateHashing.ScopeV1({
                version: 1,
                chainId: 46630,
                account: 0x1111111111111111111111111111111111111111,
                authorization: 0x2222222222222222222222222222222222222222,
                groupId: 12345678901234567890,
                permissionDigest: hex"3333333333333333333333333333333333333333333333333333333333333333",
                authorizationId: hex"5555555555555555555555555555555555555555555555555555555555555555"
            });
    }

    function _mandate() private pure returns (MandateHashing.MandateV1 memory) {
        return
            MandateHashing.MandateV1({
                version: 1,
                chainId: 46630,
                account: 0x1111111111111111111111111111111111111111,
                authorization: 0x2222222222222222222222222222222222222222,
                groupId: 12345678901234567890,
                permissionDigest: hex"3333333333333333333333333333333333333333333333333333333333333333",
                sessionKey: 0x4444444444444444444444444444444444444444,
                validAfter: 1700000000,
                validUntil: 1700003600,
                authorizationId: hex"5555555555555555555555555555555555555555555555555555555555555555"
            });
    }
}
