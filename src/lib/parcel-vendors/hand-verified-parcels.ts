/**
 * Hand-verified parcel test set for vendor evaluation.
 *
 * Every row was pulled from the LA County public Esri parcel service on
 * 2026-07-28 and is ground truth as the county publishes it. This is
 * the fixture a candidate vendor (DataTree, ATTOM, Cotality, Regrid) gets
 * scored against: given the street address, does the vendor return this AIN,
 * this lot area, this assessed value?
 *
 * Stratified deliberately. A set of 25 suburban single-family homes would
 * score every vendor near-perfectly and tell you nothing. These span old and
 * new Prop 13 base years, commercial and industrial use, and multi-unit
 * addresses where one street line maps to many parcels -- the cases where
 * vendors actually diverge.
 *
 * Scope limit: LA County only, because it is the one county with a verified
 * machine-queryable source to derive ground truth from. A vendor scoring well
 * here is not thereby proven nationally.
 */

export interface TestParcel {
  /** Which sampling stratum this row exercises. */
  readonly stratum:
    | 'res-old-base'
    | 'res-new-base'
    | 'commercial'
    | 'industrial'
    | 'multi-unit';
  readonly ain: string;
  readonly apn: string;
  /** Street line as a user would type it, including any unit. */
  readonly streetLine: string;
  readonly situsFullAddress: string;
  readonly zip: string;
  readonly unit: string | null;
  readonly useType: string;
  readonly lotAreaSqFt: number;
  /**
   * Assessed land value, or null. Some parcels in the set legitimately carry
   * no assessed value — exempt and public property among them — and a vendor
   * cannot be scored on a field the county itself does not publish.
   */
  readonly landValue: number | null;
  readonly improvementValue: number | null;
  readonly rollYear: string;
  readonly landBaseYear: string | null;
}

export const HAND_VERIFIED_PARCELS: readonly TestParcel[] = [
  {
    "stratum": "res-old-base",
    "ain": "2004001008",
    "apn": "2004-001-008",
    "streetLine": "8325 MAYNARD AVE",
    "situsFullAddress": "8325 MAYNARD AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11810.17,
    "landValue": 133608,
    "improvementValue": 230878,
    "rollYear": "2026",
    "landBaseYear": "1980"
  },
  {
    "stratum": "res-old-base",
    "ain": "2004001009",
    "apn": "2004-001-009",
    "streetLine": "8311 MAYNARD AVE",
    "situsFullAddress": "8311 MAYNARD AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 14878.67,
    "landValue": 145585,
    "improvementValue": 218496,
    "rollYear": "2026",
    "landBaseYear": "1984"
  },
  {
    "stratum": "res-old-base",
    "ain": "2004001010",
    "apn": "2004-001-010",
    "streetLine": "8305 MAYNARD AVE",
    "situsFullAddress": "8305 MAYNARD AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11675.88,
    "landValue": 129079,
    "improvementValue": 218387,
    "rollYear": "2026",
    "landBaseYear": "1980"
  },
  {
    "stratum": "res-old-base",
    "ain": "2004001011",
    "apn": "2004-001-011",
    "streetLine": "8301 MAYNARD AVE",
    "situsFullAddress": "8301 MAYNARD AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 13359.72,
    "landValue": 127507,
    "improvementValue": 179724,
    "rollYear": "2026",
    "landBaseYear": "1979"
  },
  {
    "stratum": "res-old-base",
    "ain": "2004001015",
    "apn": "2004-001-015",
    "streetLine": "8318 MAYNARD AVE",
    "situsFullAddress": "8318 MAYNARD AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11028.36,
    "landValue": 120572,
    "improvementValue": 214230,
    "rollYear": "2026",
    "landBaseYear": "1979"
  },
  {
    "stratum": "res-new-base",
    "ain": "2004001027",
    "apn": "2004-001-027",
    "streetLine": "8329 FAUST AVE",
    "situsFullAddress": "8329 FAUST AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11533.34,
    "landValue": 402722,
    "improvementValue": 244965,
    "rollYear": "2026",
    "landBaseYear": "2022"
  },
  {
    "stratum": "res-new-base",
    "ain": "2004002001",
    "apn": "2004-002-001",
    "streetLine": "22726 ECCLES ST",
    "situsFullAddress": "22726 ECCLES ST LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11019,
    "landValue": 873304,
    "improvementValue": 376902,
    "rollYear": "2026",
    "landBaseYear": "2022"
  },
  {
    "stratum": "res-new-base",
    "ain": "2004002003",
    "apn": "2004-002-003",
    "streetLine": "22742 ECCLES ST",
    "situsFullAddress": "22742 ECCLES ST LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11087.3,
    "landValue": 842455,
    "improvementValue": 229150,
    "rollYear": "2026",
    "landBaseYear": "2022"
  },
  {
    "stratum": "res-new-base",
    "ain": "2004002008",
    "apn": "2004-002-008",
    "streetLine": "8370 FALLBROOK AVE",
    "situsFullAddress": "8370 FALLBROOK AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11010.29,
    "landValue": 1091400,
    "improvementValue": 258060,
    "rollYear": "2026",
    "landBaseYear": "2025"
  },
  {
    "stratum": "res-new-base",
    "ain": "2004002010",
    "apn": "2004-002-010",
    "streetLine": "8356 FALLBROOK AVE",
    "situsFullAddress": "8356 FALLBROOK AVE LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Residential",
    "lotAreaSqFt": 11432.82,
    "landValue": 1142400,
    "improvementValue": 622200,
    "rollYear": "2026",
    "landBaseYear": "2025"
  },
  {
    "stratum": "commercial",
    "ain": "2005002016",
    "apn": "2005-002-016",
    "streetLine": "8407 FALLBROOK AVE",
    "situsFullAddress": "8407 FALLBROOK AVE WEST HILLS CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Commercial",
    "lotAreaSqFt": 995733.61,
    "landValue": 20310253,
    "improvementValue": 4380639,
    "rollYear": "2026",
    "landBaseYear": "2019"
  },
  {
    "stratum": "commercial",
    "ain": "2005002017",
    "apn": "2005-002-017",
    "streetLine": "8401 FALLBROOK AVE",
    "situsFullAddress": "8401 FALLBROOK AVE WEST HILLS CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Commercial",
    "lotAreaSqFt": 705602.67,
    "landValue": 14621105,
    "improvementValue": 27535470,
    "rollYear": "2026",
    "landBaseYear": "2019"
  },
  {
    "stratum": "commercial",
    "ain": "2005002018",
    "apn": "2005-002-018",
    "streetLine": "0  ",
    "situsFullAddress": "",
    "zip": " ",
    "unit": null,
    "useType": "Commercial",
    "lotAreaSqFt": 306108.55,
    "landValue": 5559045,
    "improvementValue": 16560,
    "rollYear": "2026",
    "landBaseYear": "2021"
  },
  {
    "stratum": "commercial",
    "ain": "2005002019",
    "apn": "2005-002-019",
    "streetLine": "22801 ROSCOE BLVD",
    "situsFullAddress": "22801 ROSCOE BLVD LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Commercial",
    "lotAreaSqFt": 375168.81,
    "landValue": 13374703,
    "improvementValue": 15924580,
    "rollYear": "2026",
    "landBaseYear": "2017"
  },
  {
    "stratum": "commercial",
    "ain": "2005021017",
    "apn": "2005-021-017",
    "streetLine": "8300 VALLEY CIRCLE BLVD",
    "situsFullAddress": "8300 VALLEY CIRCLE BLVD WEST HILLS CA 91304",
    "zip": "91304",
    "unit": null,
    "useType": "Commercial",
    "lotAreaSqFt": 27864.44,
    "landValue": 1421790,
    "improvementValue": 1777237,
    "rollYear": "2026",
    "landBaseYear": "2005"
  },
  {
    "stratum": "industrial",
    "ain": "2005002901",
    "apn": "2005-002-901",
    "streetLine": "0  ",
    "situsFullAddress": "",
    "zip": " ",
    "unit": null,
    "useType": "Industrial",
    "lotAreaSqFt": 216407.61,
    "landValue": null,
    "improvementValue": null,
    "rollYear": "null",
    "landBaseYear": "0000"
  },
  {
    "stratum": "industrial",
    "ain": "2048011020",
    "apn": "2048-011-020",
    "streetLine": "5171 CLARETON DR",
    "situsFullAddress": "5171 CLARETON DR AGOURA HILLS CA 91301",
    "zip": "91301",
    "unit": null,
    "useType": "Industrial",
    "lotAreaSqFt": 70466.78,
    "landValue": 1442989,
    "improvementValue": 1533170,
    "rollYear": "2026",
    "landBaseYear": "2013"
  },
  {
    "stratum": "industrial",
    "ain": "2048011900",
    "apn": "2048-011-900",
    "streetLine": "0  ",
    "situsFullAddress": "",
    "zip": " ",
    "unit": null,
    "useType": "Industrial",
    "lotAreaSqFt": 138029.42,
    "landValue": null,
    "improvementValue": null,
    "rollYear": "null",
    "landBaseYear": "0000"
  },
  {
    "stratum": "industrial",
    "ain": "2048011901",
    "apn": "2048-011-901",
    "streetLine": "0  ",
    "situsFullAddress": "",
    "zip": " ",
    "unit": null,
    "useType": "Industrial",
    "lotAreaSqFt": 73249.1,
    "landValue": null,
    "improvementValue": null,
    "rollYear": "null",
    "landBaseYear": "0000"
  },
  {
    "stratum": "industrial",
    "ain": "2048012019",
    "apn": "2048-012-019",
    "streetLine": "5308 DERRY AVE",
    "situsFullAddress": "5308 DERRY AVE AGOURA HILLS CA 91301",
    "zip": "91301",
    "unit": null,
    "useType": "Industrial",
    "lotAreaSqFt": 827071.4,
    "landValue": 1786517,
    "improvementValue": 22476062,
    "rollYear": "2026",
    "landBaseYear": "1998"
  },
  {
    "stratum": "multi-unit",
    "ain": "2012001103",
    "apn": "2012-001-103",
    "streetLine": "8005 HANNA AVE Unit #71",
    "situsFullAddress": "8005 HANNA AVE #71 LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": "#71",
    "useType": "Residential",
    "lotAreaSqFt": 85316.61,
    "landValue": 183876,
    "improvementValue": 429053,
    "rollYear": "2026",
    "landBaseYear": "2015"
  },
  {
    "stratum": "multi-unit",
    "ain": "2012012017",
    "apn": "2012-012-017",
    "streetLine": "22040 STRATHERN ST Unit UNIT   1",
    "situsFullAddress": "22040 STRATHERN ST UNIT   1 LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": "UNIT   1",
    "useType": "Residential",
    "lotAreaSqFt": 99832.24,
    "landValue": 148118,
    "improvementValue": 221881,
    "rollYear": "2026",
    "landBaseYear": "1984"
  },
  {
    "stratum": "multi-unit",
    "ain": "2012012018",
    "apn": "2012-012-018",
    "streetLine": "22040 STRATHERN ST Unit UNIT   2",
    "situsFullAddress": "22040 STRATHERN ST UNIT   2 LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": "UNIT   2",
    "useType": "Residential",
    "lotAreaSqFt": 99832.24,
    "landValue": 112529,
    "improvementValue": 337595,
    "rollYear": "2026",
    "landBaseYear": "2014"
  },
  {
    "stratum": "multi-unit",
    "ain": "2012012019",
    "apn": "2012-012-019",
    "streetLine": "22040 STRATHERN ST Unit UNIT   3",
    "situsFullAddress": "22040 STRATHERN ST UNIT   3 LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": "UNIT   3",
    "useType": "Residential",
    "lotAreaSqFt": 99832.24,
    "landValue": 205661,
    "improvementValue": 412405,
    "rollYear": "2026",
    "landBaseYear": "2022"
  },
  {
    "stratum": "multi-unit",
    "ain": "2012012020",
    "apn": "2012-012-020",
    "streetLine": "22040 STRATHERN ST Unit UNIT   4",
    "situsFullAddress": "22040 STRATHERN ST UNIT   4 LOS ANGELES CA 91304",
    "zip": "91304",
    "unit": "UNIT   4",
    "useType": "Residential",
    "lotAreaSqFt": 99832.24,
    "landValue": 149180,
    "improvementValue": 223781,
    "rollYear": "2026",
    "landBaseYear": "1984"
  }
];
