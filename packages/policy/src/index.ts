export const MANDATE_PROTOCOL_VERSION = 1 as const;

export {
  APPLICATION_ACCOUNT_V1_DOMAIN,
  APPLICATION_ACCOUNT_V1_DOMAIN_TEXT,
  APPLICATION_REGISTRATION_V1_DOMAIN,
  APPLICATION_REGISTRATION_V1_DOMAIN_TEXT,
  deriveApplicationRegistrationV1,
  parseApplicationRegistrationV1,
  type ApplicationRegistrationFieldsV1,
  type ApplicationRegistrationV1,
} from "./application-registration-v1.js";
export {
  ENROLLMENT_AUTHORIZATION_V1_DOMAIN,
  ENROLLMENT_AUTHORIZATION_V1_DOMAIN_TEXT,
  hashEnrollmentAuthorizationV1,
  parseEnrollmentAuthorizationV1,
  validateEnrollmentAuthorizationV1ForSource,
  type EnrollmentAuthorizationV1,
  type EnrollmentSourcePolicyV1,
} from "./enrollment-authorization-v1.js";
export { SNARK_SCALAR_FIELD, digestToField } from "./field.js";
export {
  MANDATE_V1_TYPE,
  MANDATE_V1_TYPEHASH,
  hashMandateV1,
  type MandateV1,
} from "./mandate-v1.js";
export {
  REWARD_AUTHORIZATION_V1_NAME,
  REWARD_AUTHORIZATION_V1_TYPE,
  REWARD_AUTHORIZATION_V1_TYPEHASH,
  REWARD_AUTHORIZATION_V1_TYPES,
  REWARD_AUTHORIZATION_V1_VERSION,
  hashRewardAuthorizationV1,
  parseRewardAuthorizationDomainV1,
  parseRewardAuthorizationV1,
  rewardAuthorizationTypedDataV1,
  type RewardAuthorizationDomainV1,
  type RewardAuthorizationV1,
} from "./reward-authorization-v1.js";
export { SCOPE_V1_TYPE, SCOPE_V1_TYPEHASH, hashScopeV1, type ScopeV1 } from "./scope-v1.js";
