import { keccak256, stringToHex } from "viem";

export const ROBOT_RALLY_APPLICATION_ID = keccak256(stringToHex("agentvisa.robot-rally.v1"));
export const DEMO_CREDENTIAL_GROUP_ID = keccak256(
  stringToHex("agentvisa.synthetic-credential-group.v1"),
);

export const DEMO_SOURCE_POLICY = Object.freeze({
  sourceId: keccak256(stringToHex("agentvisa.synthetic-localhost-source.v1")),
  uniquenessDomain: keccak256(stringToHex("agentvisa.synthetic-localhost-people.v1")),
  credentialSchemaId: keccak256(stringToHex("agentvisa.semaphore-credential.v1")),
  acceptedAssuranceIds: Object.freeze([
    keccak256(stringToHex("agentvisa.synthetic-localhost-assurance.v1")),
  ]),
  maximumValiditySeconds: 300n,
});
