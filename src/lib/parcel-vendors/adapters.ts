import {
  VendorNotConfiguredError,
  type ParcelVendor,
  type VendorId,
  type VendorLookupInput,
  type VendorParcelResult,
} from './vendor';

/**
 * Adapters for the Phase 2 candidate vendors.
 *
 * Each is credential-gated and inert until a key is present. The response
 * mappings below are NOT verified against live APIs — no account exists for
 * any of these yet, and this session established the cost of writing
 * confident-looking integration code against unverified endpoints. Treat every
 * `mapResponse` as a hypothesis to check on the first real call, and the
 * request shapes as placeholders.
 *
 * What IS real here: the interface, the credential gating, and the scorecard
 * they feed. Supplying a key and running the harness is what turns a
 * hypothesis into a measurement.
 */

interface AdapterConfig {
  readonly id: VendorId;
  readonly displayName: string;
  readonly envVar: string;
  /** Documentation entry point, for whoever wires up the real call. */
  readonly docsUrl: string;
  /** Whether the vendor advertises recorded-document images, per its marketing. */
  readonly claimsDocumentImages: boolean;
}

const ADAPTER_CONFIGS: readonly AdapterConfig[] = [
  {
    id: 'datatree',
    displayName: 'DataTree',
    envVar: 'DATATREE_API_KEY',
    docsUrl: 'https://www.firstamdatatree.com/',
    claimsDocumentImages: true,
  },
  {
    id: 'attom',
    displayName: 'ATTOM',
    envVar: 'ATTOM_API_KEY',
    docsUrl: 'https://api.developer.attomdata.com/docs',
    claimsDocumentImages: false,
  },
  {
    id: 'cotality',
    displayName: 'Cotality',
    envVar: 'COTALITY_API_KEY',
    docsUrl: 'https://www.cotality.com/',
    claimsDocumentImages: true,
  },
  {
    id: 'regrid',
    displayName: 'Regrid',
    envVar: 'REGRID_API_KEY',
    docsUrl: 'https://regrid.com/api',
    claimsDocumentImages: false,
  },
];

/**
 * Placeholder mapping. Every candidate vendor returns a different envelope;
 * these key names are guesses and must be replaced against real responses.
 */
function mapUnverifiedResponse(payload: unknown, claimsDocumentImages: boolean): VendorParcelResult | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    const s = String(v ?? '').trim();
    return s === '' ? null : s;
  };

  return {
    parcelId: str(p['apn'] ?? p['parcelId'] ?? p['ain']),
    lotAreaSqFt: num(p['lotSizeSqFt'] ?? p['lotAreaSqFt']),
    landValue: num(p['landValue'] ?? p['assessedLandValue']),
    improvementValue: num(p['improvementValue'] ?? p['assessedImprovementValue']),
    rollYear: str(p['taxYear'] ?? p['rollYear']),
    hasDocumentImage: claimsDocumentImages && Boolean(p['documentImageUrl']),
    raw: payload,
  };
}

function createAdapter(config: AdapterConfig): ParcelVendor {
  return {
    id: config.id,
    displayName: config.displayName,

    isConfigured() {
      return Boolean(process.env[config.envVar]);
    },

    async lookup(_input: VendorLookupInput): Promise<VendorParcelResult | null> {
      if (!process.env[config.envVar]) {
        throw new VendorNotConfiguredError(config.id);
      }
      // Intentionally not implemented. Writing a request shape for an API
      // nobody here has seen would produce code that looks working and is not.
      // See config.docsUrl and replace this with a real call plus a verified
      // mapResponse once credentials exist.
      throw new Error(
        `${config.displayName} adapter is not implemented. Credentials are present ` +
          `(${config.envVar}), so wire the live request against ${config.docsUrl}, ` +
          'then verify mapUnverifiedResponse against a real payload before trusting scores.',
      );
    },
  };
}

export const VENDOR_ADAPTERS: readonly ParcelVendor[] = ADAPTER_CONFIGS.map(createAdapter);

export function getVendorAdapter(id: VendorId): ParcelVendor {
  const adapter = VENDOR_ADAPTERS.find((v) => v.id === id);
  if (!adapter) throw new Error(`Unknown vendor "${id}"`);
  return adapter;
}

/** Exported for tests and for whoever replaces it with a verified mapping. */
export const __unverifiedMapper = mapUnverifiedResponse;
export const VENDOR_CONFIGS = ADAPTER_CONFIGS;
