/**
 * Shared duration vocabulary for the Analysis Layer.
 *
 * WHY THIS FILE EXISTS. `DurationBasis` was declared in ca-rule-set.ts and
 * mixed two different kinds of thing:
 *
 *   - bases read from the INSTRUMENT — the document says "perpetual", or the
 *     document states a term. Those are facts about a recorded document and
 *     hold in any jurisdiction.
 *   - bases that are CALIFORNIA LEGAL PRESUMPTIONS — that an appurtenant
 *     easement runs with the land absent contrary language, that a
 *     prescriptive easement is perpetual once established, that an easement in
 *     gross may end with the grantee. Those are state doctrine and other
 *     states do not necessarily share them.
 *
 * Keeping both in one union declared in the CA file meant the shared
 * vocabulary asserted California doctrine for every state that came after. The
 * split follows the rule that produces each value: the two `ca-express-*`
 * rules read the document, the three `*-default-presumption` rules apply
 * doctrine.
 *
 * A state rule set declares its own presumption bases and unions them onto
 * ExpressDurationBasis. Nothing here should ever name a doctrine.
 */

/**
 * Duration bases readable from the instrument itself.
 *
 * These are jurisdiction-neutral because they report what the document says
 * rather than what the law presumes. A state rule set may still decline to use
 * them, but it will not have to contradict them.
 */
export type ExpressDurationBasis = 'perpetual-express' | 'term-limited';

/**
 * A duration finding.
 *
 * Generic over the basis so a state rule set can narrow it to its own union
 * while shared consumers — the wizard, the letter builders — stay agnostic.
 * The default is deliberately `string`: those consumers pass the value through
 * without inspecting it, and constraining them to one state's doctrine is the
 * problem this file exists to remove.
 */
export interface DurationDetermination<B extends string = string> {
  basis: B;
  summary: string;
}
