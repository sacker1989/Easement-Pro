/**
 * Who maintains it, who repairs it, who pays when something goes wrong — and
 * what the homeowner may build.
 *
 * WHY THIS IS THE MOST VALUABLE THING A FREE TOOL CAN SAY. The restriction
 * checklist already answers "what can I not do here". That is the defensive
 * half. The questions homeowners actually arrive with are the other half, and
 * nothing in this product answered them:
 *
 *   The utility cut a trench across my lawn. Who puts it back?
 *   Nobody has mown the easement strip in three years. Is that mine?
 *   The sewer line under my yard is failing. Am I paying for that?
 *   Does any of this come off my sale price?
 *
 * Those are worth money to know and cost nothing to say at a general level,
 * because the answers are mostly structural — they follow from what kind of
 * easement it is and who holds it, not from the particular wording of one
 * instrument.
 *
 * EVERY FIELD IS A TYPICAL ARRANGEMENT, NOT A FINDING. Same posture as
 * restriction-checklist.ts and for the same reason: the document controls and
 * can say the opposite. The difference between "utility easements usually put
 * restoration on the utility" and "your utility must restore your lawn" is the
 * difference between an explainer and legal advice, and only the first is
 * being offered. `documentControls` is on every record rather than stated once
 * in a banner, so a surface rendering a single responsibility cannot drop it.
 *
 * WHAT IS DELIBERATELY NOT HERE: anything that tells a homeowner they HAVE a
 * claim, or what to demand. Pursuing a claim is the paid next step and a
 * different product. This one explains the landscape so they can tell whether
 * there is anything worth pursuing — which is also the honest order to do it
 * in, since most of the time the answer is no.
 */

import type { EasementType } from './easement-types';

/** Who typically bears a duty. Deliberately coarse — precision needs the document. */
export type Party =
  | 'holder' // the utility, agency or neighbouring owner who benefits
  | 'owner' // the homeowner whose land is burdened
  | 'shared'
  | 'depends-on-document';

export interface Responsibility {
  readonly question: string;
  readonly typically: Party;
  /** The plain answer, stated as what is usual rather than what is true here. */
  readonly answer: string;
  /** What flips it the other way. Named so the reader knows what to look for. */
  readonly whatWouldChangeIt: string;
}

export interface EasementResponsibilities {
  readonly easementType: EasementType;
  readonly heading: string;
  readonly responsibilities: readonly Responsibility[];
  /**
   * The value and protection angle, in one or two sentences.
   *
   * Present on every type because it is the reason a homeowner is reading at
   * all, and because an easement's effect on value is routinely either
   * overestimated (panic) or ignored entirely (surprise at closing).
   */
  readonly valueAndProtection: string;
  /** The single most useful thing this homeowner could do next, at no cost. */
  readonly freeNextStep: string;
  /** Required on every record. See the module header. */
  readonly documentControls: true;
}

const RESTORATION: Responsibility = {
  question: 'If they dig up my yard, who puts it back?',
  typically: 'holder',
  answer:
    'An easement holder generally has to restore the surface after working in the easement area — ' +
    'backfill the trench, re-grade, replace turf. "Restore" usually means serviceable rather than ' +
    'identical, so mature planting and custom hardscape are the losses that tend not to come back.',
  whatWouldChangeIt:
    'The instrument may spell out a restoration standard, or may say nothing at all. Where it says ' +
    'nothing, what counts as adequate restoration is exactly the kind of thing that gets argued ' +
    'about, and photographs taken BEFORE work starts are worth more than any argument afterwards.',
};

const SURFACE_UPKEEP: Responsibility = {
  question: 'Who mows it, weeds it, and keeps it tidy?',
  typically: 'owner',
  answer:
    'Day-to-day surface upkeep usually stays with the homeowner. You still own the land — the ' +
    'holder has a right to use it, not possession of it — so the lawn, the weeds and the leaves ' +
    'are generally still yours.',
  whatWouldChangeIt:
    'Holders that need clear access, especially for overhead lines and pipelines, often take on ' +
    'vegetation control themselves and may do it more aggressively than a homeowner would like.',
};

const INFRASTRUCTURE_REPAIR: Responsibility = {
  question: 'The pipe or line itself is failing. Who pays?',
  typically: 'holder',
  answer:
    'The holder generally owns and maintains its own infrastructure. A utility main under your ' +
    'yard is the utility’s to repair and replace, and that remains true even though the repair ' +
    'happens on your land and inconveniences you.',
  whatWouldChangeIt:
    'A SHARED or private line — one serving your property together with a neighbour’s, rather ' +
    'than a public main passing through — is a different situation and frequently a shared cost. ' +
    'Which one you have is worth establishing before anything fails.',
};

function record(
  easementType: EasementType,
  heading: string,
  responsibilities: readonly Responsibility[],
  valueAndProtection: string,
  freeNextStep: string,
): EasementResponsibilities {
  return {
    easementType,
    heading,
    responsibilities,
    valueAndProtection,
    freeNextStep,
    documentControls: true,
  };
}

const IMPROVE_UTILITY: Responsibility = {
  question: 'Can I build, pave or plant over it?',
  typically: 'depends-on-document',
  answer:
    'Permanent structures over a utility easement are generally out. Reversible surface treatments ' +
    'such as lawn, a gravel path or removable planters are usually tolerated. The practical test ' +
    'is whether a crew could reach what is buried without destroying what you built.',
  whatWouldChangeIt:
    'Many utilities will consent to specific improvements in writing if asked beforehand. Asking ' +
    'costs nothing; building first and asking later is how people lose a patio.',
};

/**
 * One record per easement type.
 *
 * `satisfies` rather than a plain annotation so a new easement type is a
 * compile error here rather than a silent gap — the same exhaustiveness
 * discipline SCREENING_BAND_BY_TYPE uses.
 */
export const RESPONSIBILITIES_BY_TYPE = {
  'utility-overhead': record(
    'utility-overhead',
    'Overhead utility line',
    [
      SURFACE_UPKEEP,
      INFRASTRUCTURE_REPAIR,
      RESTORATION,
      {
        question: 'Can I plant trees under the line?',
        typically: 'holder',
        answer:
          'Vegetation management under conductors is generally the utility’s responsibility and ' +
          'they exercise it. Expect trees under or near the line to be trimmed to clearance ' +
          'standards on the utility’s schedule rather than yours, and expect the shape to be ' +
          'decided by clearance rather than by appearance.',
        whatWouldChangeIt:
          'Choosing species that mature below the clearance height avoids the conflict entirely. ' +
          'Most utilities publish a list of what they consider safe to plant.',
      },
    ],
    'Overhead lines are visible, which means buyers price them in and the effect is usually already ' +
      'in the market. The avoidable loss is not the line — it is planting or building something ' +
      'that later gets cut back or removed.',
    'Photograph the easement area now, from several angles, with dates. It costs nothing and it is ' +
      'the single most useful thing you can have if restoration is ever disputed.',
  ),

  'utility-underground': record(
    'utility-underground',
    'Underground utility line',
    [SURFACE_UPKEEP, INFRASTRUCTURE_REPAIR, RESTORATION, IMPROVE_UTILITY],
    'Buried lines are invisible until someone digs, which cuts both ways: little day-to-day effect ' +
      'on value, and a real risk of discovering the easement at the worst moment — when a buyer’s ' +
      'title search finds it, or when you have already paid for a pool design.',
    'Call 811 (or your state’s one-call service) before any digging. It is free, legally expected, ' +
      'and it tells you where things actually are rather than where the map says.',
  ),

  sewer: record(
    'sewer',
    'Sewer line',
    [
      SURFACE_UPKEEP,
      INFRASTRUCTURE_REPAIR,
      RESTORATION,
      {
        question: 'Is the lateral from my house my responsibility?',
        typically: 'owner',
        answer:
          'This is the distinction that costs homeowners the most money. The MAIN is generally the ' +
          'agency’s. The LATERAL — the pipe running from your house to the main — is very often ' +
          'the homeowner’s, in many places all the way to the connection, including the part ' +
          'under the public street.',
        whatWouldChangeIt:
          'Responsibility for laterals varies by jurisdiction more than almost anything else here. ' +
          'Your sewer agency publishes its split, and it is worth reading before a backup rather ' +
          'than during one.',
      },
    ],
    'Sewer easements rarely move a sale price on their own. Lateral responsibility does — a failed ' +
      'lateral is a five-figure repair that surprises people precisely because the easement made ' +
      'them assume the agency owned everything.',
    'Find out from your sewer agency where their responsibility ends and yours begins. One phone ' +
      'call, no cost, and it is the answer that matters most here.',
  ),

  'storm-drain': record(
    'storm-drain',
    'Storm drain',
    [SURFACE_UPKEEP, INFRASTRUCTURE_REPAIR, RESTORATION, IMPROVE_UTILITY],
    'Usually modest effect on value. The protection angle matters more: a blocked or undersized ' +
      'storm drain can put water where it has never been, and drainage disputes between neighbours ' +
      'are among the most common property disputes there are.',
    'Watch where water actually goes in the first heavy rain after you notice the easement, and ' +
      'photograph it. Observed drainage behaviour beats any map.',
  ),

  'water-line': record(
    'water-line',
    'Water line',
    [SURFACE_UPKEEP, INFRASTRUCTURE_REPAIR, RESTORATION, IMPROVE_UTILITY],
    'A potable water main is treated like any other utility for value purposes. The distinctive ' +
      'risk is a leak: water finds foundations, and a main failing under your yard is the holder’s ' +
      'to repair but yours to live through.',
    'Note where any visible valve covers or meter boxes sit. They mark the alignment and tell you ' +
      'what you should not pave over.',
  ),

  pipeline: record(
    'pipeline',
    'Pipeline (gas, petroleum, transmission)',
    [
      SURFACE_UPKEEP,
      INFRASTRUCTURE_REPAIR,
      RESTORATION,
      {
        question: 'Why are the rules here stricter than for other utilities?',
        typically: 'holder',
        answer:
          'Transmission pipelines carry specific federal and state safety requirements, and ' +
          'operators enforce access and clearance far more firmly than a typical utility. Expect ' +
          'patrols, marker posts you may not remove, and little flexibility about what sits on ' +
          'the right of way.',
        whatWouldChangeIt:
          'Nothing you can negotiate easily. This is the easement type where asking permission ' +
          'before doing anything is not merely prudent but expected.',
      },
    ],
    'Pipelines are the easement type most likely to affect a buyer’s willingness rather than just ' +
      'the price, and the effect is poorly captured by any rule of thumb. If a figure matters to ' +
      'you here, it needs an appraiser.',
    'Look up the operator on the National Pipeline Mapping System and keep their emergency number. ' +
      'Free, and the one piece of information you would want immediately.',
  ),

  'access-ingress-egress': record(
    'access-ingress-egress',
    'Access / driveway easement',
    [
      {
        question: 'Who maintains the shared driveway?',
        typically: 'shared',
        answer:
          'Where several owners use a way, maintenance is commonly shared in proportion to use, ' +
          'and in many places that is the default even with nothing in writing. In practice it is ' +
          'whoever gets tired of the potholes first.',
        whatWouldChangeIt:
          'A written maintenance agreement, recorded, settles this and is the single most useful ' +
          'document a shared-access property can have. Its absence is the usual reason these ' +
          'turn into disputes.',
      },
      RESTORATION,
      {
        question: 'Can I gate it or narrow it?',
        typically: 'depends-on-document',
        answer:
          'Generally not in a way that interferes with the holder’s use. Access easements are ' +
          'about passage, so anything that obstructs passage — a gate without keys, a narrowing, ' +
          'parking across it — tends to be the thing that starts the argument.',
        whatWouldChangeIt:
          'Agreement among everyone who uses it, in writing. Gates are frequently fine when ' +
          'everyone has a key and nobody was surprised.',
      },
    ],
    'Access easements affect the WHOLE parcel rather than a strip, and they cut both ways: being ' +
      'burdened by one can reduce value, while benefiting from one may be the only thing making a ' +
      'landlocked parcel usable at all. This is the type where a rule-of-thumb percentage is most ' +
      'misleading.',
    'Write down who actually uses the way and how often. If there is no recorded maintenance ' +
      'agreement, proposing one is cheap, usually welcomed, and prevents the dispute rather than ' +
      'winning it.',
  ),

  'public-right-of-way': record(
    'public-right-of-way',
    'Public right of way',
    [
      {
        question: 'Who maintains the strip between my fence and the road?',
        typically: 'shared',
        answer:
          'Commonly split in a way that surprises people: the agency maintains the travelled way ' +
          'and its own infrastructure, while the homeowner is often expected to maintain the ' +
          'parkway, verge or sidewalk frontage — sometimes including liability for its condition.',
        whatWouldChangeIt:
          'This is set by local ordinance and varies street by street. Your city publishes it.',
      },
      RESTORATION,
      IMPROVE_UTILITY,
    ],
    'A public right of way across your frontage is normal and usually priced in. The thing worth ' +
      'knowing is how far it extends back from the kerb — it is frequently further than owners ' +
      'assume, and improvements built inside it can be required to come out.',
    'Ask your city for the right-of-way width on your street and measure it from the kerb. Free, ' +
      'and it often moves the line several feet from where people think it is.',
  ),

  drainage: record(
    'drainage',
    'Drainage easement',
    [SURFACE_UPKEEP, INFRASTRUCTURE_REPAIR, RESTORATION, IMPROVE_UTILITY],
    'Modest direct effect on value. The real exposure is that blocking or re-routing drainage — ' +
      'even unintentionally, by filling a low spot or adding hardscape — can move water onto a ' +
      'neighbour and create liability that did not exist before.',
    'Do not fill, re-grade or pave within a drainage easement without asking first. It is the ' +
      'cheapest way to avoid the one genuinely expensive mistake available here.',
  ),

  slope: record(
    'slope',
    'Slope easement',
    [
      {
        question: 'Who keeps the slope from failing?',
        typically: 'depends-on-document',
        answer:
          'Slope easements are usually held so that an agency can maintain the stability of ground ' +
          'supporting a road or structure. Who actually maintains it — and who is responsible if ' +
          'it fails — varies more here than for any other type, and the instrument is the only ' +
          'place that answers it.',
        whatWouldChangeIt:
          'Read the instrument. On slopes this is not boilerplate advice: failure is expensive and ' +
          'responsibility is genuinely unpredictable without it.',
      },
      SURFACE_UPKEEP,
      RESTORATION,
    ],
    'Slope easements usually take area that was unbuildable anyway, so the direct value effect is ' +
      'often small. Liability for a failure is the part that is not small.',
    'Get a copy of the recorded instrument. For slope easements specifically, the general rules ' +
      'are weak and the document does nearly all the work.',
  ),

  conservation: record(
    'conservation',
    'Conservation easement',
    [
      {
        question: 'Who manages the protected land?',
        typically: 'owner',
        answer:
          'Usually you do, within the restrictions. A conservation easement is mostly a set of ' +
          'things you agree not to do rather than a right for someone else to come and do things, ' +
          'so the land generally stays yours to look after.',
        whatWouldChangeIt:
          'The holding organisation typically has monitoring rights — an annual visit to confirm ' +
          'compliance — and specific management obligations are sometimes written in.',
      },
      {
        question: 'Can I still use the land myself?',
        typically: 'owner',
        answer:
          'Usually yes, and more than people expect. A conservation easement typically restricts ' +
          'development and subdivision rather than ordinary enjoyment — walking, farming, ' +
          'forestry and recreation are often expressly preserved. It is a limit on what the land ' +
          'can become, not a transfer of it.',
        whatWouldChangeIt:
          'The permitted-uses section of the instrument is where this lives, and it is specific ' +
          'rather than general. Two conservation easements on neighbouring parcels can allow ' +
          'quite different things.',
      },
      {
        question: 'Can this ever be lifted?',
        typically: 'depends-on-document',
        answer:
          'Conservation easements are generally perpetual by design and are among the hardest to ' +
          'remove. That is the point of them rather than a defect.',
        whatWouldChangeIt:
          'Very little. Treat it as permanent when planning anything.',
      },
    ],
    'The value effect is real and specific: development potential is what was given up, so the ' +
      'loss depends entirely on what could have been built. Percentage rules of thumb are useless ' +
      'here. There may also be tax consequences, which belong with your accountant.',
    'Get the easement document and the baseline documentation report that was prepared when it was ' +
      'granted. The baseline report describes the land as it was and is the reference point for ' +
      'every later question.',
  ),

  prescriptive: record(
    'prescriptive',
    'Prescriptive (established by use, no recorded document)',
    [
      {
        question: 'There is no document. What governs?',
        typically: 'depends-on-document',
        answer:
          'Nothing is recorded, so there is no document to read and no written allocation of ' +
          'responsibility. What exists — if anything — is defined by the pattern of use itself, ' +
          'which means its scope is genuinely uncertain until someone establishes it.',
        whatWouldChangeIt:
          'Whether a prescriptive easement exists at all is a factual question about years of use ' +
          'on the ground. It comes before every other question here.',
      },
      {
        question: 'Who maintains whatever is being used?',
        typically: 'depends-on-document',
        answer:
          'Nobody has agreed anything, so in practice it falls to whoever cares — usually the ' +
          'person relying on the use, sometimes nobody at all. A worn track across your land with ' +
          'no agreement behind it tends to deteriorate until it causes a problem.',
        whatWouldChangeIt:
          'A written agreement converts an uncertain prescriptive situation into a defined one, ' +
          'and both sides often prefer that to the ambiguity. It is worth considering before the ' +
          'relationship sours rather than after.',
      },
      {
        question: 'Should I just block it?',
        typically: 'owner',
        answer:
          'Think before acting. If no easement has been established, blocking may be entirely ' +
          'within your rights. If one has, interfering with it can expose you. The two look ' +
          'identical from your side of the fence, and this is the type where acting first is most ' +
          'likely to be the expensive choice.',
        whatWouldChangeIt:
          'This is the clearest case in this product for a conversation with an attorney before ' +
          'doing anything, rather than after.',
      },
    ],
    'An unrecorded claim is the one that most reliably surprises people at sale, because a buyer’s ' +
      'title search will not find it and a buyer’s inspection may. Resolving it while you are not ' +
      'under contract is worth considerably more than resolving it while you are.',
    'Write down what you have observed — who uses it, how, how often, and for how long. Dates and ' +
      'specifics. This costs nothing and is precisely what anyone you later consult will ask for ' +
      'first.',
  ),
} satisfies Record<EasementType, EasementResponsibilities>;

export function responsibilitiesFor(easementType: EasementType): EasementResponsibilities {
  return RESPONSIBILITIES_BY_TYPE[easementType];
}

/**
 * Stated wherever these are shown.
 *
 * Says the same thing `documentControls` says in the type, in the user's
 * words, because a boolean on a record is a guarantee to a programmer and
 * nothing at all to a homeowner.
 */
export const RESPONSIBILITIES_DISCLOSURE =
  'These are the arrangements that are usual for this kind of easement. They are not a reading of ' +
  'your easement document and not legal advice — your document controls, and it can say the ' +
  'opposite of anything here. Use this to work out which questions are worth asking, then confirm ' +
  'the answers against the recorded instrument or with an attorney licensed in your state.';
