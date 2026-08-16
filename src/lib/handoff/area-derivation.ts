/**
 * How the encumbered area was measured.
 *
 * WHY THIS TYPE IS NEW. `ParcelEasement.areaSqFt` is a bare number, and
 * `EasementProvenance` describes how the EASEMENT became known, not how the
 * AREA was measured. Those come apart in practice: state DOT right-of-way
 * layers publish AREA_SF directly — strong area provenance — for temporary
 * easement parcels whose term and compensation are entirely unpublished. One
 * fact is well sourced, the other absent, and a single provenance field cannot
 * say so.
 *
 * NO DEFAULT WIDTH, EVER. A width cannot be inferred from easement type.
 * Uniform Appraisal Standards §4.6.5 forecloses exactly that inference —
 * "there is no 'generic' road easement, conservation easement, or any other
 * type of easement" — recorded as YELLOW_BOOK_4_6_5.noGenericEasementByType.
 * An area with no derivation is `null` plus a not-determined item, never a
 * plausible-looking guess, because area is the figure every later number gets
 * multiplied by.
 */

/** How an encumbered area came to be known. */
export type AreaDerivation =
  /** A published area field in the source layer. */
  | { readonly kind: 'published-field'; readonly layer: string; readonly field: string; readonly queriedOn: string }
  /**
   * Computed from polygon geometry.
   *
   * SPATIAL REFERENCE IS MANDATORY, and this is not bureaucracy. Reading a
   * Web Mercator (EPSG:3857) Shape__Area as square feet understated a real
   * easement by a factor of about 8: the value is square METRES and is
   * additionally inflated by 1/cos²(latitude), around 1.33x at Florida
   * latitudes. It produced a figure that looked entirely reasonable. A
   * projected system in US survey feet (EPSG:2229 for Los Angeles, 2230 for
   * Orange and San Diego) needs no conversion at all. Same call, same field
   * name, answers an order of magnitude apart.
   */
  | {
      readonly kind: 'geometry-computed';
      readonly layer: string;
      readonly method: string;
      readonly spatialReference: string;
      readonly queriedOn: string;
    }
  /** Width x length taken from a recorded instrument or plat. */
  | {
      readonly kind: 'dimensions-stated';
      readonly widthFt: number;
      readonly lengthFt: number;
      readonly documentRef: string;
    }
  /** The user typed it. Unverified. */
  | { readonly kind: 'user-asserted' };

export interface EncumberedAreaSection {
  readonly areaSqFt: number;
  readonly derivation: AreaDerivation;
  /** Share of the parcel encumbered, when parcel area is known. */
  readonly shareOfParcel: number | null;
  /** One line naming how this was measured, for the rendered package. */
  readonly derivationNote: string;
}

export class AreaDerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AreaDerivationError';
  }
}

/** Human-readable provenance for a derivation, always naming its weakness. */
export function describeAreaDerivation(d: AreaDerivation): string {
  switch (d.kind) {
    case 'published-field':
      return (
        `Area as published by the source: field ${d.field} in layer ${d.layer}, queried ` +
        `${d.queriedOn}. Not independently measured — it is the publisher's figure.`
      );
    case 'geometry-computed':
      return (
        `Area computed from published polygon geometry (${d.method}) in layer ${d.layer}, ` +
        `spatial reference ${d.spatialReference}, queried ${d.queriedOn}. Accuracy depends on ` +
        `the publisher's digitisation, which commonly differs from a survey by a few percent.`
      );
    case 'dimensions-stated':
      return (
        `Area from stated dimensions: ${d.widthFt} ft by ${d.lengthFt} ft, per ${d.documentRef}. ` +
        `Assumes a rectangular strip; an irregular easement will differ.`
      );
    case 'user-asserted':
      return 'Area supplied by the user and not verified against any published source or document.';
  }
}

/**
 * Builds the area section, or returns null when no derivation exists.
 *
 * Returning null is a first-class outcome rather than a failure. A caller that
 * cannot say how an area was measured must not get an area, because an
 * unexplained figure is indistinguishable from a measured one once it reaches
 * a rendered page.
 */
export function buildEncumberedArea(
  areaSqFt: number | null,
  derivation: AreaDerivation | null,
  parcelAreaSqFt?: number | null,
): EncumberedAreaSection | null {
  if (areaSqFt === null || derivation === null) return null;
  if (!Number.isFinite(areaSqFt) || areaSqFt <= 0) {
    throw new AreaDerivationError('Encumbered area must be a positive, finite number of square feet');
  }
  if (derivation.kind === 'dimensions-stated') {
    const implied = derivation.widthFt * derivation.lengthFt;
    if (!(implied > 0)) {
      throw new AreaDerivationError('Stated dimensions must both be positive');
    }
  }

  const share =
    parcelAreaSqFt !== null && parcelAreaSqFt !== undefined && parcelAreaSqFt > 0
      ? areaSqFt / parcelAreaSqFt
      : null;

  return {
    areaSqFt,
    derivation,
    shareOfParcel: share,
    derivationNote: describeAreaDerivation(derivation),
  };
}
