/**
 * The professional-handoff layer.
 *
 * WHAT THIS BARREL DELIBERATELY DOES NOT RE-EXPORT: anything from
 * `src/lib/valuation/calculator.ts` or `valuation-matrix.ts`. Those compute
 * `area × unit value × impact %`, which is the strip valuation §4.6.5 rejects.
 * They remain reachable through the valuation barrel; they must not become
 * reachable through this one, because a caller importing from `@/lib/handoff`
 * is holding the artefact that says no such figure exists. A source-text test
 * asserts the absence.
 *
 * Named exports rather than `export *`, matching `src/lib/valuation/index.ts`.
 * The list is worth the maintenance: it is the layer's public surface, and
 * adding to it is a decision rather than a side effect of adding a file.
 */

export {
  buildNotDetermined,
  hasFloorItems,
  allNotDeterminedKeys,
  FLOOR_KEYS,
  type NotDeterminedKey,
  type NotDeterminedItem,
  type NotDeterminedSection,
  type NotDeterminedInputs,
  type Resolver,
} from './not-determined';

export {
  buildEncumberedArea,
  describeAreaDerivation,
  AreaDerivationError,
  type AreaDerivation,
  type EncumberedAreaSection,
} from './area-derivation';

export {
  scanForAppraisalClaims,
  explainClaimScan,
  FORBIDDEN_CLAIM_PATTERNS,
  REQUIRED_DISCLAIMER_PHRASE,
  type ClaimScanResult,
} from './appraisal-claim-scan';

export {
  buildReferralPackage,
  buildLandValueSection,
  assertPackageIntegrity,
  parseReferralPackage,
  ReferralPackageError,
  PACKAGE_VERSION,
  STANDING_HEADER,
  type ReferralPackage,
  type ReferralPackageInput,
  type ParcelIdentity,
  type EvidenceSection,
  type LandValueSection,
  type Caveat,
} from './referral-package';

export {
  renderPlainText,
  renderMarkdown,
  renderJson,
  buildSections,
  ILLUSTRATIVE_BANNER,
  NOT_DETERMINED_HEADING,
  NOT_REVIEWED_BY_COUNSEL_LINE,
  type RenderedSection,
} from './render';

export {
  applyObservedRent,
  buildAppraiserRentRequest,
  RENT_REQUEST_CONSTRAINT,
  type HandoffRentRate,
  type RentTerms,
  type LandClassMatch,
  type TemporaryEasementSection,
  type AppraiserRentRequest,
} from './rent-intake';

export {
  interpretField,
  classifyParcel,
  type AcquisitionMeaning,
  type FieldSemantic,
  type RecordsRequestJurisdictionRule,
  type UnsupportedJurisdiction,
  type JurisdictionLookup,
  type ParcelEvidence,
  type TargetGroup,
  type ClassifiedParcel,
} from './records-request/jurisdiction-rule';

export { lookupJurisdiction, supportedJurisdictions } from './records-request/registry';

// The one researched rule is exported by name. Anyone reaching for it for a
// different state has to type a Florida identifier to do it, which is the
// point at which they should stop.
export { FL_FDOT_D7, FL_FDOT_D7_WORKED_PARCELS } from './records-request/fl-fdot';

export {
  buildRecordsRequest,
  buildRequestFromRule,
  RecordsRequestError,
  NOT_SENT_BANNER,
  type RequestItem,
  type RecordsRequestOptions,
  type RecordsRequestDraft,
  type RecordsRequestResult,
} from './records-request/build-request';
