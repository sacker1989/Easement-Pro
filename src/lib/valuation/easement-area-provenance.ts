/**
 * Where the encumbered area came from, which is the weakest input in the
 * product and was the least labelled.
 *
 * EVERY DOLLAR FIGURE IS A PERCENTAGE OF THIS NUMBER. The screening range and
 * the IRWA estimate both multiply a per-square-foot land value by the easement
 * area, so an area that is wrong by a factor of two makes both figures wrong
 * by a factor of two. The land value is read from the county. The area is not
 * read from anywhere.
 *
 * THE DEFECT THIS EXISTS TO FIX. `/report` defaulted the area to 800 sq ft
 * when the query string omitted it, and the homepage — the hero call to
 * action, which asks for an address and nothing else — omits it on every
 * visit. So the primary funnel produced a figure derived from 800 sq ft, shown
 * with no indication that 800 was assumed rather than measured.
 *
 * IT WAS WORSE THAN A SILENT DEFAULT. `buildRemedyPlan` was called with
 * `areaEstablished: unified !== null` — `unified` being the county PARCEL
 * match. A parcel match establishes the LOT area, from county geometry, and
 * says nothing whatever about the easement footprint. The step it gated reads
 * "Establish the encumbered area properly ... a guess here propagates into
 * every figure downstream", and it was suppressed exactly when the county data
 * was good. Measured on the live build: the step appeared on a report where no
 * parcel matched and vanished on one where a parcel did. The better the data,
 * the quieter the product about the number it knows nothing about — and the
 * homepage funnel hit the quiet case every time, having never asked.
 */

/** The placeholder the report fills in when nobody supplies an area. */
export const DEFAULT_EASEMENT_AREA_SQ_FT = 800;

/**
 * How the area that drives the figures was arrived at.
 *
 * ONLY THE TWO REACHABLE CASES ARE HERE. A recorded instrument stating a width
 * and length, or a county publishing an easement polygon, would be a third —
 * and would be the first thing in this product that could set
 * `areaIsEstablished` to true. Neither is implemented, so neither is listed:
 * a variant nobody can produce reads as capability that exists. When one
 * arrives, `AREA_IS_ESTABLISHED` below stops compiling until it is classified.
 */
export type EasementAreaProvenance =
  /** Nobody supplied one. The report filled in a placeholder. */
  | 'assumed-default'
  /** The homeowner typed a number, which the form invites them to guess at. */
  | 'user-estimate';

/**
 * Whether the area is established in the sense the remedy plan means:
 * measured or documented, not estimated.
 *
 * BOTH ARE FALSE TODAY, and that is the honest answer rather than a stub. A
 * placeholder is not established, and neither is a figure the form explicitly
 * invites the reader to guess — the step this gates exists to tell them to go
 * and find out. `satisfies` makes the map exhaustive, so a third provenance
 * cannot be added without deciding this question for it.
 */
const AREA_IS_ESTABLISHED = {
  'assumed-default': false,
  'user-estimate': false,
} satisfies Record<EasementAreaProvenance, boolean>;

export function areaIsEstablished(provenance: EasementAreaProvenance): boolean {
  return AREA_IS_ESTABLISHED[provenance];
}

/**
 * Reads the provenance off the raw query-string value.
 *
 * ABSENT AND BLANK BOTH MEAN ASSUMED, because an empty field is not an
 * estimate. A value that does not parse is also assumed rather than rejected:
 * the caller is about to fall back to the default for it anyway, and labelling
 * the figure is more useful than refusing the report.
 */
export function easementAreaProvenance(raw: string | undefined): EasementAreaProvenance {
  if (raw === undefined) return 'assumed-default';
  const trimmed = raw.trim();
  if (trimmed === '') return 'assumed-default';
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'assumed-default';
  return 'user-estimate';
}

/**
 * Said next to the figure, not only at the top of the page.
 *
 * ADJACENT TO THE NUMBER ON PURPOSE. The report already orders its disclosures
 * so that nobody meets a dollar figure before reading what it is not, and the
 * same reasoning applies here with more force: a caveat in a paragraph above
 * the fold is read by whoever scrolls, and this one has to be read by whoever
 * looks at the number. It names the placeholder so the reader can tell at a
 * glance whether it resembles their property.
 */
export const ASSUMED_AREA_CAVEAT =
  `Based on an assumed easement area of ${DEFAULT_EASEMENT_AREA_SQ_FT.toLocaleString()} sq ft, ` +
  'because none was given. That is a placeholder, not a measurement of your property — the ' +
  'figures scale directly with it, so a real easement half this size halves them. Enter your own ' +
  'area above for a figure that relates to your parcel.';

/** The same point in one line, for the form field that collects the area. */
export const AREA_FIELD_HINT =
  `Left blank, the report assumes ${DEFAULT_EASEMENT_AREA_SQ_FT.toLocaleString()} sq ft and says ` +
  'so next to every figure. A rough guess of your own is worth more than the placeholder.';
