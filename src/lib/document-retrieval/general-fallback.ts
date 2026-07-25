import type { GeneralGuidance } from './types';

export interface GeneralFallbackReasoning {
  reason: string;
  guidance: GeneralGuidance;
}

/**
 * Nationwide fallback for any address outside LA County's detailed coverage.
 * Per docs/development-strategy-v2.md, this deliberately stays generic —
 * jurisdiction-specific fallback instructions for other counties are Phase 2's
 * county coverage matrix work, not Phase 1 MVP scope. It always routes to
 * Track 3, since that track doesn't require the recorded document image
 * itself to produce useful output.
 */
export function buildGeneralFallback(
  county: string | null,
  state: string,
): GeneralFallbackReasoning {
  return {
    reason: county
      ? `No detailed fallback data is available yet for ${county} County, ${state}.`
      : "This address's county could not be determined by this MVP's coverage.",
    guidance: {
      message:
        "This address is outside this tool's detailed county coverage. You can still " +
        'look up the recorded document yourself, or continue to a risk summary built ' +
        'from nationally available parcel data.',
      steps: [
        'Contact the county recorder (or equivalent land records office) for this address.',
        "Ask for a name-based Grantor/Grantee index search if you don't have a document " +
          'or instrument number.',
        'A local title company can often pull recorded documents for a fee.',
      ],
      routeTo: 'track-3',
    },
  };
}
