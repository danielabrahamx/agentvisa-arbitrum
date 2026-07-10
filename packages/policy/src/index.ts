export const MANDATE_PROTOCOL_VERSION = 1 as const;

export { SNARK_SCALAR_FIELD, digestToField } from "./field.js";
export {
  MANDATE_V1_TYPE,
  MANDATE_V1_TYPEHASH,
  hashMandateV1,
  type MandateV1,
} from "./mandate-v1.js";
export { SCOPE_V1_TYPE, SCOPE_V1_TYPEHASH, hashScopeV1, type ScopeV1 } from "./scope-v1.js";
