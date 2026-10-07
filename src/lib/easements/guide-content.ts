import type { EasementType } from './easement-types';
import { EASEMENT_TYPES } from './easement-types';

/**
 * Educational guide content for /learn — one plain-language guide per
 * easement type.
 *
 * CONTENT DISCIPLINE. Everything descriptive here is either (a) rendered from
 * responsibilities.ts (headings, Q&A, valueAndProtection, freeNextStep), (b)
 * general public knowledge (811 one-call, county recorder / title search,
 * dated photographs), or (c) a widely-reported public incident with a cited
 * source. Nothing invents a holder name, a process step, a legal outcome, or
 * a homeowner story. Where no solid public incident exists for a type, the
 * "when this goes wrong" section presents the documented risk pattern from
 * responsibilities.ts and is explicitly labeled illustrative.
 *
 * INCIDENT GROUND RULES. Sourced incidents only: San Bruno 2010 (NTSB),
 * Eaton Fire 2025 (CAL FIRE / LA County Fire official investigation),
 * Camp Fire 2018 (Cal Fire determination), CGA DIRT excavation statistics,
 * published sewer-lateral cost data. The Eaton Fire section states the
 * official finding and notes the DA review / litigation posture rather than
 * asserting settled liability.
 */

export interface GuideSource {
  readonly label: string;
  readonly url: string;
}

export interface GuideIncident {
  readonly title: string;
  /** The documented incident (or labeled illustrative pattern). Sourced. */
  readonly whatHappened: string;
  /** The mechanism: the specific access or maintenance failure behind it. */
  readonly whyItHappened: string;
  /**
   * The mapping: ties the same mechanism to the reader's own property.
   * Phrased as the typical arrangement, never a prediction about their home.
   */
  readonly couldItHappenToYou: string;
  readonly sources: readonly GuideSource[];
  /** True when this is the documented risk pattern, not a specific incident. */
  readonly illustrative: boolean;
}

export interface GuidePhoto {
  /** Local path under /public, e.g. '/learn/pipeline-marker.jpg'. */
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
  /** Photographer/source + license, e.g. 'Bob Embleton, CC BY-SA 2.0 via Wikimedia Commons'. */
  readonly credit: string;
}

export interface GuideContent {
  readonly type: EasementType;
  /** One line for the /learn index. Plain language. */
  readonly oneLiner: string;
  /** Plain-language paragraphs: what this thing is. */
  readonly whatItIs: readonly string[];
  /** How a homeowner checks whether this exists on their property. */
  readonly howToCheck: readonly string[];
  /** The process for getting it maintained. Usual arrangements, never promises. */
  readonly howToRequestMaintenance: readonly string[];
  readonly photo?: GuidePhoto;
  readonly incident: GuideIncident;
}

function guide(content: Omit<GuideContent, 'type'> & { type: EasementType }): GuideContent {
  return content;
}

export const GUIDE_BY_TYPE = {
  'utility-overhead': guide({
    type: 'utility-overhead',
    oneLiner: 'Power or phone lines on poles over your land',
    whatItIs: [
      'An overhead utility easement means poles and wires carrying electricity or phone ' +
        'service cross your property. The utility has the right to use the strip under the ' +
        'lines: to trim trees back to clearance, to keep the corridor clear, and to come ' +
        'through for repairs.',
      'You still own the land. What you give up is the right to build or plant anything ' +
        'under the wires that would get in the way — because the utility will cut it back ' +
        'on their schedule, not yours.',
    ],
    howToCheck: [
      'Look up: poles, wires, and transformers on or near your lot are the visible clue.',
      'Check your title report or deed — a recorded utility easement names the holder and the strip.',
      'Ask your electric utility which lines cross your parcel and how wide their clearance corridor is.',
      'Run the free SafeHomeValue report on your address — it flags overhead-utility easements.',
    ],
    howToRequestMaintenance: [
      'Identify the utility — your electric bill, or the name stenciled on the poles.',
      'Call their vegetation-management or right-of-way line for trimming and clearance issues. ' +
        'Call 911 only if wires are down and sparking.',
      'Photograph the area first, with dates, from several angles — before any work happens.',
      'What to expect: trimming under the lines is generally the utility’s job, done to clearance ' +
        'standards on their timetable. Expect the shape of the cut to be decided by clearance, not by looks.',
      'Never prune near power lines yourself, and never plant trees that will mature into the wires — ' +
        'most utilities publish a list of what is safe to plant underneath.',
    ],
    photo: {
      src: '/learn/overhead-lines.jpg',
      alt: 'A high-voltage transmission tower with power lines',
      caption: 'Transmission towers like this one carry lines across ordinary neighborhoods — and the corridors beneath them.',
      credit: 'Novoklimov, CC0 via Wikimedia Commons',
    },
    incident: {
      title: 'When the equipment above your neighborhood fails',
      whatHappened:
        'On January 7, 2025, the Eaton Fire started near Altadena, California. After an ' +
        '18-month investigation, state and county fire officials concluded that electrical arcing ' +
        'from out-of-service Southern California Edison equipment on a transmission tower sparked ' +
        'the blaze. Nineteen people were killed and more than 9,000 homes and businesses were ' +
        'destroyed or damaged. A second, earlier case: the November 2018 Camp Fire, which Cal Fire ' +
        'determined was caused by PG&E transmission lines near Pulga — 85 people killed and nearly ' +
        '19,000 structures destroyed, with a second ignition point where vegetation had grown into ' +
        'distribution lines.',
      whyItHappened:
        'In both fires the mechanism was utility infrastructure meeting dry vegetation: arcing or ' +
        'failing equipment above receptive fuel. The Camp Fire’s second ignition was literally ' +
        'vegetation grown into power lines — the exact thing clearance trimming exists to prevent.',
      couldItHappenToYou:
        'If overhead lines cross your property in a high fire-risk zone, this combination — aging ' +
        'utility equipment above dry vegetation — exists at your address too. The difference is ' +
        'maintenance: utilities are generally responsible for vegetation clearance and equipment ' +
        'condition, and in California’s highest-risk zones defensible-space law adds duties for ' +
        'homeowners as well. That is the arrangement to confirm, not a prediction about your home.',
      sources: [
        {
          label: 'LA Times via FireRescue1: Eaton Fire investigation findings (SoCal Edison tower)',
          url: 'https://www.firerescue1.com/legal/what-sparked-the-deadly-eaton-fire-probe-points-to-socal-edison-tower',
        },
        {
          label: 'Rep. Judy Chu: statement on the official Eaton Fire cause determination',
          url: 'http://chu.house.gov/media-center/press-releases/rep-chus-statement-confirmation-eaton-fire-cause',
        },
        {
          label: 'Associated Press via FireRescue1: Cal Fire determination on the Camp Fire (PG&E lines)',
          url: 'https://www.firerescue1.com/wildfire/articles/fire-officials-pge-equipment-sparked-deadly-calif-fire-gMT1fJcyecUMBI7O/',
        },
      ],
      illustrative: false,
    },
  }),

  'utility-underground': guide({
    type: 'utility-underground',
    oneLiner: 'Buried electric or phone cables under your yard',
    whatItIs: [
      'A buried utility easement means electric or telecom cables run under your land in a ' +
        'marked corridor. Day to day you see nothing — no poles, no wires — which is exactly ' +
        'why these get discovered at the worst moment: a buyer’s title search, or a shovel.',
      'The practical rule is simple: a crew must be able to reach what is buried without ' +
        'destroying what you built. Permanent structures over the corridor are generally out; ' +
        'lawn, gravel paths, and removable planters are usually tolerated.',
    ],
    howToCheck: [
      'Look for surface clues: pad-mounted transformer boxes, valve covers, meter boxes, marker ' +
        'posts, or a suspiciously straight stripe of greener grass.',
      'Call 811 before any digging — it is free, and locators will mark the public lines on your lot.',
      'Check your title report for a recorded underground utility easement.',
      'Ask the utility for their easement and as-built maps for your parcel.',
    ],
    howToRequestMaintenance: [
      'The utility generally owns and repairs its own buried infrastructure — if you suspect a ' +
        'failing cable (flickering power, repeated outages on one circuit), call them.',
      'Before you dig for any project — fence posts, a pool, a garden bed — call 811 and wait ' +
        'for the marks. Hand-dig carefully near the marks.',
      'Photograph the area with dates before any utility work begins; restoration after a dig is ' +
        'generally the holder’s job, but “restored” usually means serviceable, not identical.',
      'If you plan improvements over the corridor, ask the utility for written consent first. ' +
        'Asking costs nothing; building first is how people lose a patio.',
    ],
    incident: {
      title: 'The strike that didn’t have to happen',
      whatHappened:
        'In 2025, the Common Ground Alliance’s Damage Information Reporting Tool logged 221,717 ' +
        'unique incidents of damage to buried utilities across the US and Canada — a record high. ' +
        'The industry group estimates the total economic cost of striking buried lines at $83.2 ' +
        'billion a year once outages, emergency response, and repairs are counted.',
      whyItHappened:
        'The leading root cause, year after year, is failure to notify 811 before digging — 22.3% ' +
        'of 2025 incidents. The mechanism is always the same: someone digs where a buried line ' +
        'runs, without having it located first.',
      couldItHappenToYou:
        'Any digging project on your property — fence posts, a new patio, a tree — carries this ' +
        'exact risk if buried lines cross your lot and nobody calls 811. The 811 call is free and ' +
        'is the standard protection against it; the incidents above are what the unmarked dig looks ' +
        'like at scale.',
      sources: [
        {
          label: 'Underground Construction: CGA 2025 DIRT data (221,717 damage reports; 811 notification the top root cause)',
          url: 'http://admin.undergroundinfrastructure.com/news/2026/july/buried-utility-damages-hit-record-high-in-2025-cga-reports',
        },
        {
          label: 'EHS Today: CGA “Between the Lines” report ($83.2B annual cost of buried-utility damage)',
          url: 'https://eponline.com/articles/2026/08/17/underground-utility-damage-costs-us-economy-83-billion-annually.aspx',
        },
      ],
      illustrative: false,
    },
  }),

  sewer: guide({
    type: 'sewer',
    oneLiner: 'A sewer pipe running under your property',
    whatItIs: [
      'A sewer easement covers the pipes under your yard: the big shared main, and the ' +
        'smaller lateral that runs from your house to the main. Here is the distinction that ' +
        'costs homeowners the most money — the main is generally the agency’s, but the lateral ' +
        'is very often yours, in many places all the way to the connection, including the part ' +
        'under the public street.',
      'Most people assume the easement means the agency owns everything underground. It does not.',
    ],
    howToCheck: [
      'Ask your sewer agency where their responsibility ends and yours begins — they publish ' +
        'the split, and it varies by jurisdiction more than almost anything else here.',
      'Look for manhole covers: they mark the main’s alignment across or near your lot.',
      'Check your title report for a recorded sewer easement.',
      'Before buying, get a sewer-scope camera inspection — a standard home inspection does not include one.',
    ],
    howToRequestMaintenance: [
      'For the main: call the sewer agency — it is generally theirs to repair and replace.',
      'For the lateral: it is typically yours. Hire a plumber, and get a camera scope first so ' +
        'you know what you are dealing with before anyone digs.',
      'Do this before a backup, not during one: find out the responsibility split with one phone ' +
        'call while nothing is wrong.',
      'Keep records of any work, and photograph the yard with dates before excavation — ' +
        'restoration of the surface is generally the holder’s job when they dig.',
    ],
    photo: {
      src: '/learn/sewer-trench.jpg',
      alt: 'A sewer trench being backfilled after pipe work',
      caption: 'What a sewer repair looks like from the surface: a trench across the yard, then backfill.',
      credit: 'Robin Stott, CC BY-SA 2.0 via Wikimedia Commons',
    },
        incident: {
      title: 'The $25,000 pipe nobody told you was yours',
      whatHappened:
        'At a Beaver City council meeting, a property owner described a failed sewer lateral ' +
        'connection that cost her $25,000–$45,000 to dig up and repair — enough to jeopardize ' +
        'her business. She asked the city to consider an optional sewer-repair insurance ' +
        'add-on. City staff replied that the city does not maintain private laterals: the ' +
        'repair responsibility runs from the building to the city main and rests entirely ' +
        'with the property owner.',
      whyItHappened:
        'In most jurisdictions the sewer lateral — the pipe connecting a home to the municipal ' +
        'main — is private property even where it crosses public ground. Fulton County’s ' +
        'official service-lateral guidance states the owner is responsible for the lateral ' +
        '"even if the blockage is located within a public road right-of-way (ROW) or within ' +
        'a sewer easement." The pipe is out of sight, so it fails without warning, and ' +
        'homeowner’s policies generally treat lateral repair as maintenance, not a covered loss.',
      couldItHappenToYou:
        'If your parcel has a recorded sewer easement, the utility owns the main — but the ' +
        'lateral from your house to that main is still yours, including the stretch under the ' +
        'street or inside the easement corridor. When the utility needs to excavate for main ' +
        'work, they are entitled to dig up the easement strip; restoring your landscaping ' +
        'afterward is your problem. A sewer scope camera inspection before buying (or now) ' +
        'is the check the guide recommends.',
      sources: [
        {
          label: 'CitizenPortal: Beaver City council on private lateral responsibility',
          url: 'https://citizenportal.ai/articles/6488729/Utah/Resident-seeks-help-after-2500045000-lateral-repair-council-reiterates-private-lateral-responsibility',
        },
        {
          /*
           * ADDED ON REVIEW. The paragraph above quotes Fulton County's
           * guidance verbatim and cited a brokerage blog and a news
           * aggregator for it. The quote is accurate — this is the county's
           * own PDF, and it says exactly that — but a verbatim quote
           * attributed to an official source has to link to the official
           * source, or the reader has to take the quote on trust.
           */
          label: 'Fulton County: service lateral responsibility (official)',
          url: 'https://fultoncountyga.gov/-/media/Water-and-Sewer-Service-Laterals-Flyer-6424.pdf',
        },
        {
          label: 'The Agency Atlanta: sewer laterals and sewer scopes on older homes',
          url: 'https://theagency-atlanta.com/blog/sewer-laterals-and-sewer-scopes-on-older-atlanta-homes',
        },
      ],
      illustrative: false,
    },
  }),

  'storm-drain': guide({
    type: 'storm-drain',
    oneLiner: 'Pipes or channels carrying rainwater across your land',
    whatItIs: [
      'A storm-drain easement covers the pipes, culverts, or open channels that move rainwater ' +
        'across or off your property. A city or county agency usually owns and maintains the ' +
        'system; you own the land it crosses.',
      'The value effect is usually modest. The protection angle matters more: a blocked or ' +
        'undersized storm drain can put water where it has never been.',
    ],
    howToCheck: [
      'Look for catch basins, grates, culvert openings, concrete channels, or low swales on or ' +
        'next to your lot.',
      'Ask your city or county public works department which storm infrastructure touches your parcel.',
      'Check your plat map for drainage dedications.',
      'Watch where water actually goes in the first heavy rain after you notice it — and photograph it. ' +
        'Observed behavior beats any map.',
    ],
    howToRequestMaintenance: [
      'Report blockages — leaves, sediment, trash, collapsed grates — to public works. Clearing ' +
        'the system is generally their job.',
      'Do not fill, re-grade, or pave near the drain or channel without asking first.',
      'Document flooding or ponding with dated photos and video; it is the evidence that gets ' +
        'a slow bureaucracy moving.',
      'If water starts arriving from a neighbor’s changes uphill, talk to the city — drainage ' +
        'disputes between neighbors are among the most common property disputes there are.',
    ],
    photo: {
      src: '/learn/flash-flood.jpg',
      alt: 'Flood water covering a road after heavy rain',
      caption: 'When drainage fails, water goes where it has never been — often across someone’s property.',
      credit: 'Richard Webb, CC BY-SA 2.0 via Wikimedia Commons',
    },
        incident: {
      title: 'When the drains couldn’t keep up — San Diego, January 2024',
      whatHappened:
        'On January 22, 2024, an intense storm dropped nearly a year’s worth of rain on parts ' +
        'of San Diego. Flood-control channels and storm drains were overwhelmed; millions of ' +
        'gallons of runoff swept through Shelltown, Barrio Logan, Southcrest, and other ' +
        'Chollas Creek neighborhoods. Hundreds of homes and apartments flooded, scores of cars ' +
        'were washed away, thousands of residents were displaced, and two deaths were ' +
        'investigated as flood-related. Nearly 2,000 victims are suing the city in more than ' +
        '50 lawsuits.',
      whyItHappened:
        'The failure was documented, not just weather. A city report published just before ' +
        'the flood warned that "age, combined with deferred maintenance due to historic ' +
        'underfunding of the storm drain system, poses a risk of flooding and catastrophic ' +
        'failure." City records show nearly half of all channel segments hadn’t been ' +
        'maintained in at least 15 years; a 2016 maintenance plan for the South Chollas ' +
        'channel was never carried out. A similar 2018 flood had already produced a lawsuit ' +
        'settled for just over $200,000 — without any channel improvements attached.',
      couldItHappenToYou:
        'Storm-drain easements carry a public pipe or channel across private land. The holder ' +
        'maintains the infrastructure, but when it is undersized or unmaintained, the water ' +
        'doesn’t respect the easement boundary — it finds the lowest point, which may be your ' +
        'living room. Ask the city or county when the drain serving your parcel was last ' +
        'cleaned or rebuilt; a channel that hasn’t been maintained in 15 years is a known ' +
        'risk, not a surprise.',
      sources: [
        {
          label: 'Stormwater: San Diego stormwater infrastructure crisis amid record rainfall',
          url: 'https://www.stormwater.com/home/news/55359879/san-diego-faces-stormwater-infrastructure-crisis-amid-record-rainfall',
        },
        {
          label: 'ProgramBusiness: legal claims against San Diego over January flooding',
          url: 'https://programbusiness.com/news/new-legal-claims-against-san-diego-over-january-flooding-seek-class-action-status/',
        },
      ],
      illustrative: false,
    },
  }),

  'water-line': guide({
    type: 'water-line',
    oneLiner: 'A drinking-water main under your yard',
    whatItIs: [
      'A water-line easement covers a potable water main crossing your land. The water utility ' +
        'owns the main and is generally responsible for repairing it — but the repair happens ' +
        'on your land, tears up your yard, and you live through it.',
      'The distinctive risk is a leak: water finds foundations, and a main failing under your ' +
        'yard is the holder’s to fix but yours to endure.',
    ],
    howToCheck: [
      'Look for valve covers, meter boxes, and fire hydrants — they mark the alignment. Note ' +
        'what you should not pave over.',
      'Ask your water utility for their easement maps for your parcel.',
      'Check your title report for a recorded water-line easement.',
      'Watch for the warning signs of a leak: soggy ground that never dries, an unexplained ' +
        'wet patch, or a water bill that jumps for no reason.',
    ],
    howToRequestMaintenance: [
      'Suspect a leak? Call the water utility — the main is theirs to repair and replace.',
      'Photograph the area with dates before any excavation; surface restoration after their ' +
        'dig is generally the holder’s job, at a “serviceable” standard.',
      'Do not build permanent structures over the alignment — a crew must be able to reach ' +
        'the main without destroying what you built.',
      'Ask the utility in writing before any significant improvement near the corridor.',
    ],
    photo: {
      src: '/learn/water-main-repair.jpg',
      alt: 'Road opened up for water main repair works',
      caption: 'A water main repair: the utility’s pipe to fix, the homeowner’s yard to live through.',
      credit: 'Humphrey Bolton, CC BY-SA 2.0 via Wikimedia Commons',
    },
        incident: {
      title: 'The 90-year-old pipe under Sunset Boulevard',
      whatHappened:
        'On July 29, 2014, a more than 90-year-old steel-riveted 30-inch water main burst ' +
        'under Sunset Boulevard in Westwood, Los Angeles, sending a geyser about 30 feet into ' +
        'the air. Between 8 and 20 million gallons of water poured out before crews could shut ' +
        'it off three hours later. The flood inundated Bruin Walk, Pauley Pavilion, and two ' +
        'UCLA parking garages, trapping more than 700 cars; several motorists had to be ' +
        'rescued from flooded vehicles. UCLA submitted a $13 million damage claim to the ' +
        'LADWP, which acknowledged responsibility.',
      whyItHappened:
        'The pipe was installed in 1921 — a century of aging trunk infrastructure still in ' +
        'service. The LADWP had not flagged this segment for replacement, and once it ' +
        'ruptured there was no fast way to isolate it: shutting the wrong valves would have ' +
        'cut water to surrounding customers or stressed other old pipes into failing too.',
      couldItHappenToYou:
        'A water-line easement gives the utility the right to run — and to excavate — a ' +
        'pressurized main across your property. Trunk mains are the utility’s to maintain, ' +
        'but your service line (house to meter or main) is typically yours, and it fails the ' +
        'same way the big pipes do: corrosion plus age plus pressure. If your home was built ' +
        'before the 1970s and the service line is original, assume it is on borrowed time. ' +
        'And if a utility main crosses your lot, know where it is before you plant ' +
        'deep-rooted trees or pour a driveway over it.',
      sources: [
        {
          label: 'Daily Bruin: UCLA demands $13M for 2014 flood damages',
          url: 'https://dailybruin.com/2015/07/09/ucla-officials-demand-13m-for-damages-from-2014-summer-flood',
        },
        {
          label: 'UCLA IOES: is aging infrastructure to blame for the water main break',
          url: 'https://www.ioes.ucla.edu/video/is-aging-infrastructure-to-blame-for-ucla-water-main-break/',
        },
      ],
      illustrative: false,
    },
  }),

  pipeline: guide({
    type: 'pipeline',
    oneLiner: 'A gas or fuel pipeline crossing your property',
    whatItIs: [
      'A pipeline easement covers a transmission pipeline — natural gas or petroleum products — ' +
        'crossing your land in a marked corridor. This is the most strictly controlled easement ' +
        'type there is: federal and state safety rules apply, operators patrol the corridor, ' +
        'marker posts mark it (and you may not remove them), and there is little flexibility ' +
        'about what sits on the right of way.',
      'Expect patrols, strict clearance, and an operator who takes the corridor seriously. ' +
        'That strictness exists for a reason.',
    ],
    howToCheck: [
      'Look for marker posts — they are the visible sign, and removing them is not allowed.',
      'Look up the operator on the National Pipeline Mapping System (a public map) and keep ' +
        'their emergency number where you can find it.',
      'Call 811 before any digging — always, no exceptions near a pipeline corridor.',
      'Check your title report for the recorded pipeline easement and its width.',
    ],
    howToRequestMaintenance: [
      'Contact the pipeline operator directly — the NPMS listing gives you the name and number. ' +
        'For anything affecting the right of way, asking permission beforehand is expected, not optional.',
      'Report anything unusual immediately on the operator’s emergency line: exposed pipe, dead ' +
        'vegetation in a line pattern, unauthorized digging, or a gas smell.',
      'Never dig, build, or plant deep-rooted trees on the corridor without the operator’s ' +
        'written consent.',
      'Photograph the corridor’s condition with dates; it is your record of what was there before ' +
        'any work.',
    ],
    photo: {
      src: '/learn/pipeline-marker.jpg',
      alt: 'A pipeline marker post in a field',
      caption: 'Marker posts like this one mark the corridor — they must stay where they are.',
      credit: 'Bob Embleton, CC BY-SA 2.0 via Wikimedia Commons',
    },
    incident: {
      title: 'San Bruno, 2010: what a pipeline failure looks like',
      whatHappened:
        'On September 9, 2010, at 6:11 p.m., a 30-inch PG&E natural gas transmission pipeline ' +
        '(Line 132) ruptured in a residential neighborhood of San Bruno, California. The escaping ' +
        'gas ignited. Eight people were killed, 38 homes were destroyed, and 70 more were damaged.',
      whyItHappened:
        'The National Transportation Safety Board’s probable cause: PG&E’s inadequate quality ' +
        'assurance and quality control when the pipe section was installed in 1956 — a substandard, ' +
        'poorly welded section — combined with an integrity-management program that failed to ' +
        'detect and remove the defective pipe over the decades. The failure mode was maintenance ' +
        'and oversight, not bad luck.',
      couldItHappenToYou:
        'Transmission pipelines run under ordinary residential streets in every metro area, and ' +
        'the corridor rules — no structures, call before digging, know the operator — exist because ' +
        'this is the failure mode. If a pipeline easement crosses your property, the San Bruno ' +
        'mechanism (an old defect, missed by integrity management) is the reason the strictest ' +
        'easement rules in the book apply to your yard.',
      sources: [
        {
          label: 'NTSB investigation DCA10MP008: PG&E Line 132 rupture, San Bruno (8 killed, 38 homes destroyed)',
          url: 'https://www.ntsb.gov/investigations/Pages/DCA10MP008.aspx',
        },
      ],
      illustrative: false,
    },
  }),

  'access-ingress-egress': guide({
    type: 'access-ingress-egress',
    oneLiner: 'A shared driveway or access road across your land',
    whatItIs: [
      'An access easement gives someone the right to cross part of your land to reach theirs — ' +
        'a shared driveway, an access road to a landlocked parcel. It is about passage: anything ' +
        'that obstructs passage, like a gate without keys or parking across it, tends to be what ' +
        'starts the argument.',
      'Unlike most easements, this one affects the whole parcel rather than a strip — and it ' +
        'cuts both ways. Being burdened by one can reduce value; benefiting from one may be the ' +
        'only thing making a landlocked parcel usable at all.',
    ],
    howToCheck: [
      'Read your deed — access easements are usually spelled out there, including who may use the way.',
      'Look at your plat or subdivision map for the marked access strip.',
      'Talk to the neighbors who use it: who maintains it now, and is there anything in writing?',
      'Check whether a maintenance agreement exists and whether it is recorded — its absence is ' +
        'the usual reason these turn into disputes.',
    ],
    howToRequestMaintenance: [
      'Start with a conversation, not a demand: maintenance is commonly shared in proportion to ' +
        'use, and in practice it is whoever gets tired of the potholes first.',
      'Propose a written, recorded maintenance agreement splitting costs. It is cheap, usually ' +
        'welcomed, and prevents the dispute rather than winning it.',
      'Write down who actually uses the way and how often — the factual record matters if ' +
        'things go formal.',
      'Do not gate, narrow, or block the way without everyone’s written agreement. Gates are ' +
        'frequently fine when everyone has a key and nobody was surprised.',
    ],
        incident: {
      title: 'The driveway that belonged to the neighbor — Romero v. Shih (2022)',
      whatHappened:
        'A California buyer purchased a home and discovered that the wall between the ' +
        'properties and a portion of the neighbor’s driveway sat on the buyer’s side of the ' +
        'property line. The buyer asked the court to order the encroachments removed so he ' +
        'could enjoy his full property. The neighbor refused. The California Court of Appeal ' +
        'held the neighbor was entitled to an equitable easement over the disputed strip — ' +
        'removing the driveway and wall would have been an undue hardship that blocked the ' +
        'neighbor’s access. The buyer got money damages for the lost strip but could not get ' +
        'his land back. (Romero v. Shih (2022) 78 Cal.App.5th 326.)',
      whyItHappened:
        'The driveway had been built and used across the line for years. Courts weigh ' +
        'hardship: once a neighbor genuinely depends on a crossing for access, removal can be ' +
        'refused even against the recorded owner, with damages substituted for the land itself.',
      couldItHappenToYou:
        'This is exactly how an unrecorded access arrangement becomes permanent. If a ' +
        'neighbor’s driveway, path, or gate has crossed your line — or if your driveway ' +
        'crosses theirs — long enough and openly enough, a court can convert it into an ' +
        'easement you can’t undo. Check the survey and the title report before you buy; and ' +
        'if you already own, a licensed survey is cheaper than a lawsuit.',
      sources: [
        {
          label: 'First Tuesday Journal: buyer subject to an encroachment (Romero v. Shih)',
          url: 'https://journal.firsttuesday.us/is-the-buyer-of-a-property-subject-to-an-encroachment-able-to-remove-the-encroachment/85992/',
        },
      ],
      illustrative: false,
    },
  }),

  'public-right-of-way': guide({
    type: 'public-right-of-way',
    oneLiner: 'The city-controlled strip along your street',
    whatItIs: [
      'A public right of way is the strip the city or county controls along your street: the ' +
        'road, the sidewalk, and — this is the part that surprises people — often several feet ' +
        'beyond what you would guess, back from the curb.',
      'Having one across your frontage is normal and usually already priced in. The thing ' +
        'worth knowing is exactly how far back it extends, because anything you build inside it ' +
        'can be required to come out.',
    ],
    howToCheck: [
      'Ask your city for the right-of-way width on your street, then measure it back from the ' +
        'curb yourself. It is frequently further than owners assume.',
      'Check your plat map for the dedicated right of way.',
      'Look at where the sidewalk, utility poles, and fire hydrants sit — they are usually inside it.',
      'Ask the city which maintenance split applies on your street: it is set by local ordinance ' +
        'and varies street by street.',
    ],
    howToRequestMaintenance: [
      'The split is set by ordinance: the agency usually maintains the traveled way and its own ' +
        'infrastructure, while you are often expected to maintain the parkway, verge, or sidewalk ' +
        'frontage — sometimes including liability for its condition.',
      'Report damaged sidewalks, dead street trees, or broken curbs to the city; keep a dated ' +
        'record of the report.',
      'Do not build walls, fences, or permanent landscaping inside the right of way without ' +
        'checking — permitted work inside it can still be ordered removed.',
      'If the city does work in front of your house, photograph the parkway before and after.',
    ],
    incident: {
      title: 'The fence that had to come down',
      whatHappened:
        'Illustrative pattern, not a single case: a homeowner builds a handsome fence and ' +
        'landscaping three feet inside what they assumed was their line. Years later the city ' +
        'widens the road — or a utility needs the corridor — and the right of way is found to ' +
        'extend six feet past the curb. The improvements come out at the owner’s expense.',
      whyItHappened:
        'The mechanism is the invisible line: the right of way usually extends further back from ' +
        'the curb than owners assume, and “I didn’t know” is not a defense against a recorded ' +
        'dedication. The improvement was always removable; nobody checked.',
      couldItHappenToYou:
        'If you have never measured your street’s right-of-way width back from the curb, anything ' +
        'you have built near the street may already sit inside it. The documented pattern is that ' +
        'this is discovered at the worst moment — when the work crew arrives — and the free ' +
        'protection is the tape measure and the phone call to the city.',
      sources: [],
      illustrative: true,
    },
  }),

  drainage: guide({
    type: 'drainage',
    oneLiner: 'A path rainwater is allowed to take across your land',
    whatItIs: [
      'A drainage easement is the path water is allowed to take across your land: a ditch, a ' +
        'swale, a low area that carries runoff. The direct effect on value is usually modest.',
      'The real exposure is liability. Blocking or re-routing drainage — even unintentionally, ' +
        'by filling a low spot or adding hardscape — can move water onto a neighbor and create ' +
        'a liability that did not exist before.',
    ],
    howToCheck: [
      'Walk your lot during or right after rain: look for swales, ditches, and the actual path ' +
        'water takes. Photograph it.',
      'Check your plat and any grading plan for marked drainage paths.',
      'Ask the city or county about mapped drainage courses touching your parcel.',
      'Notice where water ponds — that is the system telling you how it works.',
    ],
    howToRequestMaintenance: [
      'Keep the path clear of debris, sediment, and overgrowth you control.',
      'Do not fill, re-grade, or pave within a drainage easement without asking first — it is ' +
        'the cheapest way to avoid the one genuinely expensive mistake available here.',
      'If a neighbor’s changes send water your way, document with dated photos and video, then ' +
        'talk to the city before talking to a lawyer.',
      'If the easement holder is an agency, report blockages to them; the conveyance is ' +
        'generally theirs to keep working.',
    ],
        incident: {
      title: 'The inlet that buried a neighborhood — San Diego County, January 2024',
      whatHappened:
        'During the January 22, 2024 storm, a privately owned storm-drain inlet at Murdock ' +
        'Elementary School in Casa de Oro became overwhelmed and clogged with mud and debris. ' +
        'The overflow triggered a slope failure, which then clogged the publicly maintained ' +
        '36-inch storm-drain inlet downstream — burying it under 6 to 8 feet of sediment for ' +
        'about 100 feet. Water and debris continued on into a private residence and its pool. ' +
        'The County Flood Control District issued emergency repairs costing $350,041.67 just ' +
        'to excavate and restore the public inlet, pipe, and channel. (County of San Diego ' +
        'Flood Control District Board agenda, February 28, 2024 — a public government record.)',
      whyItHappened:
        'Drainage systems are chains: the private inlet upstream, the school’s slope, and the ' +
        'public inlet downstream each had a different owner with a different maintenance duty. ' +
        'When the first link failed, every link below it failed. The county’s record notes ' +
        'further improvements were still pending on the school district’s slope repair — the ' +
        'private failure point.',
      couldItHappenToYou:
        'Your drainage easement is almost never the whole system. Water arrives from uphill ' +
        'properties and leaves through facilities maintained by different owners — a school, ' +
        'an HOA, the city, a neighbor. Ask who owns and maintains each link above and below ' +
        'your parcel, because the weakest link decides where the water ends up, and easements ' +
        'don’t stop mud.',
      sources: [
        {
          label: 'County of San Diego Flood Control District board agenda, Feb 28 2024',
          url: 'https://sdcounty.legistar1.com/daystar.legistar6.sdk.ws/View.ashx?M=F&GovernmentGUID=SDCT&LogicalFileName=a6525741-066f-4fd9-810d-28c829d7710f.docx&From=Granicus',
        },
        /*
         * REMOVED ON REVIEW: a citation to Yee v. City of Sausalito (1983)
         * sat here and the narrative above never mentioned it. A reader
         * following it would have found an unrelated 1983 case with no
         * connection to the January 2024 inlet failure.
         *
         * In a file whose whole premise is that these incidents are
         * documented, a citation that supports nothing undermines the ones
         * that support something. It was not replaced with a guess at what it
         * was meant to prove — the county board agenda above is a primary
         * record and carries the account on its own.
         */
      ],
      illustrative: false,
    },
  }),

  slope: guide({
    type: 'slope',
    oneLiner: 'A graded hillside someone else may maintain',
    whatItIs: [
      'A slope easement covers a cut or fill slope on graded land — the engineered hillside ' +
        'holding up a road or a building pad. An agency or developer keeps the right to access ' +
        'it and keep it stable.',
      'This is the easement type where the general rules are weakest. Who maintains the slope, ' +
        'and who pays if it fails, varies more here than anywhere else — the recorded instrument ' +
        'is the only place that reliably answers it.',
    ],
    howToCheck: [
      'Get a copy of the recorded instrument. For slopes this is not boilerplate advice: the ' +
        'document does nearly all the work, and failure is expensive.',
      'Look at the graded slopes on, above, or below your lot — whose land are they on, and ' +
        'who seems to be maintaining them?',
      'Ask the agency, developer, or HOA who holds the slope rights for your tract.',
      'Check your title report and any geotechnical reports from when the lot was graded.',
    ],
    howToRequestMaintenance: [
      'Read the instrument first, so you know who actually bears the duty — guessing wrong ' +
        'here is expensive.',
      'Report warning signs promptly and in writing to the holder: new cracks, leaning fences ' +
        'or walls, fresh seepage, soil piling at the toe.',
      'Photograph the slope with dates, seasonally — slow movement is visible across time in ' +
        'a way it never is in a single visit.',
      'Do not cut into, re-grade, or add load (walls, pools, heavy fill) at the top or toe of ' +
        'a slope without engineering advice.',
    ],
    photo: {
      src: '/learn/landslide.jpg',
      alt: 'Landslide damage to homes in California',
      caption: 'What slope failure looks like: when graded ground moves, the damage is total, not cosmetic.',
      credit: 'Dave Gatley / FEMA, public domain via Wikimedia Commons',
    },
        incident: {
      title: 'The hillside that kept moving — Rancho Palos Verdes, 2023–2024',
      whatHappened:
        'After the wet winters of 2023 and 2024, the ancient Portuguese Bend landslide ' +
        'complex in Rancho Palos Verdes accelerated from inches per year to as much as 9–12 ' +
        'inches per week. The ground movement broke water and gas distribution pipes, ' +
        'displaced sanitary sewer lines (including a roughly 10,000-gallon sewer spill in ' +
        'August 2024), and leaned utility poles. SoCalGas cut service to about 135 homes in ' +
        'July 2024; Southern California Edison cut power to about 140 homes and 53 businesses ' +
        'that September. Roughly 20 homes were red-tagged as uninhabitable; driveways dropped ' +
        '6–10 feet below the houses they served. The governor declared a state of emergency. ' +
        'Residents paid for repairs out of pocket — including retirement savings — because ' +
        'standard homeowners policies exclude earth movement.',
      whyItHappened:
        'The slide plane is a bentonite clay layer hundreds of feet down — ancient volcanic ' +
        'ash that loses strength when wet. It cannot be excavated or reinforced from above; ' +
        'the city’s dewatering wells only slow it. Slope easements exist precisely because ' +
        'graded hillsides need permanent cut-and-fill support and drainage control — and once ' +
        'the ground starts moving, the structures on it go with it regardless of who ' +
        'maintained what.',
      couldItHappenToYou:
        'If your lot was graded — cut into a hill, filled at the edge, terraced — the slope ' +
        'easement on your parcel marks where the hill is allowed to push. Look for the early ' +
        'signs: doors that stop closing, cracks stepping through stucco, driveways separating ' +
        'from garage floors, leaning retaining walls. And read your policy’s earth-movement ' +
        'exclusion now, not after the hill moves.',
      sources: [
        {
          label: 'ABC7: Rancho Palos Verdes landslide crisis and power shutoff',
          url: 'https://abcotv.geo.hosted.abcotvs.com/post/backup-generators-bail-rancho-palos-verdes-amid-landslide-crisis-socal-edison-power-shutoff/15256403/',
        },
        {
          label: 'WAMC: landslides trigger state of emergency in coastal California city',
          url: 'https://www.wamc.org/2024-09-04/landslides-in-coastal-california-city-trigger-state-of-emergency',
        },
      ],
      illustrative: false,
    },
  }),

  conservation: guide({
    type: 'conservation',
    oneLiner: 'A permanent limit on developing your land',
    whatItIs: [
      'A conservation easement is a perpetual agreement — usually with a land trust or agency — ' +
        'that limits what your land can become. Typically: no development, no subdivision. ' +
        'Ordinary enjoyment usually continues — walking, farming, forestry, recreation are ' +
        'often expressly preserved.',
      'Think of it as a limit on the land’s future, not a transfer of the land. And treat it ' +
        'as permanent when planning anything: these are among the hardest easements to remove, ' +
        'which is the point of them rather than a defect.',
    ],
    howToCheck: [
      'Read the recorded instrument — especially the permitted-uses section, which is specific ' +
        'rather than general. Two neighboring parcels can allow quite different things.',
      'Get the baseline documentation report prepared when the easement was granted: it ' +
        'describes the land as it was and is the reference point for every later question.',
      'Talk to the holding organization about what they monitor and how the annual visit works.',
      'Check your title report — it should reference the easement and the holder.',
    ],
    howToRequestMaintenance: [
      'You generally manage the land within the restrictions; the holder’s role is monitoring, ' +
        'typically an annual visit to confirm compliance.',
      'Before any significant change — new structures, new agricultural use, timber work — ' +
        'check the permitted uses and ask the holder in writing.',
      'Keep the baseline report and the instrument where you can find them; every question ' +
        'starts there.',
      'If the holder’s monitoring visit flags something, address it in writing and keep the thread.',
    ],
        incident: {
      title: 'The easement that turned out to be a tax shelter — the IRS crackdown',
      whatHappened:
        'Since 2016 the IRS has called syndicated conservation easements "one of the worst ' +
        'tax scams." In 2023 a federal jury convicted promoters Jack Fisher and James Sinnott ' +
        'of conspiracy to defraud the United States and related offenses; in 2024 they were ' +
        'sentenced to 25 and 23 years in prison and ordered to pay hundreds of millions in ' +
        'restitution. Their scheme sold more than $1.3 billion in fraudulent tax deductions, ' +
        'backed by appraisals often more than 10 times what they had actually paid for the ' +
        'land, plus backdated documents and false filings. The IRS reports the fraud cost the ' +
        'Treasury an estimated $36 billion since 2010. (irs.gov — official source.)',
      whyItHappened:
        'A conservation easement permanently extinguishes development rights — that is its ' +
        'whole purpose, and it is also where its dollar value lives. Promoters exploited ' +
        'exactly that: they sold investors the deduction value of extinguished development ' +
        'rights, then inflated the appraisals to multiply it.',
      couldItHappenToYou:
        'This case is the cautionary extreme — it involved investors, not typical homeowners. ' +
        'The ordinary version: if your parcel carries a conservation easement (or one is ' +
        'proposed), the development potential is already gone whether or not the paperwork’s ' +
        'valuation was honest. That is the permanent, parcel-wide value impact the guide ' +
        'describes. Always get an independent appraisal and independent counsel before signing ' +
        'anything with "perpetual" in it.',
      sources: [
        {
          label: 'IRS: conservation easements',
          url: 'https://www.irs.gov/charities-non-profits/conservation-easements',
        },
        {
          label: 'IRS Criminal Investigation: syndicated conservation easement convictions',
          url: 'https://www.irs.gov/compliance/criminal-investigation/two-tax-shelter-promoters-found-guilty-in-billion-dollar-syndicated-conservation-easement-tax-scheme',
        },
      ],
      illustrative: false,
    },
  }),

  prescriptive: guide({
    type: 'prescriptive',
    oneLiner: 'Someone’s long-time use of your land, with no paperwork',
    whatItIs: [
      'A prescriptive easement is use that became rights: a neighbor — or the public — has ' +
        'openly used part of your land for years, with no written agreement, and that pattern ' +
        'of use itself may have created legal rights. Nothing is recorded, so a title search ' +
        'will not find it.',
      'Whether one exists at all is a factual question about years of use on the ground, and ' +
        'its scope is genuinely uncertain until someone establishes it. This is the one case ' +
        'where talking to an attorney comes before acting, not after.',
    ],
    howToCheck: [
      'Observe and write down what you see: who uses it, how, how often, for how long. Dates ' +
        'and specifics — this costs nothing and is precisely what anyone you consult will ask ' +
        'for first.',
      'Ask the neighbors, calmly, how long the use has gone on.',
      'Check with a title company — expect to find nothing recorded, which is itself information.',
      'Do not rely on a standard home inspection to catch this; inspectors look at the house, ' +
        'not at who walks across the side yard.',
    ],
    howToRequestMaintenance: [
      'There is no agreement to enforce and no defined maintenance duty — in practice it falls ' +
        'to whoever cares, usually the person relying on the use, sometimes nobody at all.',
      'Consider proposing a written agreement that converts the ambiguity into defined rights. ' +
        'Both sides often prefer that to the uncertainty — and it is worth doing before the ' +
        'relationship sours.',
      'Do not block the use unilaterally first. If rights have vested, interfering can expose ' +
        'you; if they have not, blocking may be within your rights. The two look identical from ' +
        'your side of the fence.',
      'This is the clearest case in the book for a conversation with an attorney licensed in ' +
        'your state before doing anything.',
    ],
        incident: {
      title: 'The driveway the title search never found — Kapner v. Meadowlark Ranch (2004)',
      whatHappened:
        'In 1986 Sylvan Kapner bought a five-acre parcel plus a 1/80th interest in a ' +
        '60-foot-wide roadway parcel in Riverside County. Within a year he built a house, ' +
        'driveway, gate, and perimeter fence — portions of which encroached onto the roadway ' +
        'parcel. A 2001 survey by the association administering the road revealed the ' +
        'encroachments; Kapner refused to remove them or sign an encroachment agreement and ' +
        'claimed a prescriptive easement. The California Court of Appeal rejected the claim: ' +
        'his improvements were substantial structures that, "as a practical matter," ' +
        'prevented the true owner from using the land at all, which California law does not ' +
        'allow a prescriptive easement to do. The judgment required him to sign an agreement ' +
        'to remove the improvements on demand — or remove them. (116 Cal.App.4th 1182.)',
      whyItHappened:
        'Use ripens into an easement only when it stays within the doctrine’s limits. ' +
        'Building permanent structures over someone else’s corridor — even unknowingly, even ' +
        'for 15 years — doesn’t create a right; it creates a removal order.',
      couldItHappenToYou:
        'This is the prescriptive easement in both directions. A neighbor’s long-used path ' +
        'across your lot can become a permanent right you can’t remove (see Ditzian v. Unger ' +
        '(2019), where five-plus years of pathway use won an easement). And your own fence, ' +
        'shed, or driveway apron can turn out to sit on land that was never yours to build ' +
        'on. Either way the fix is the same: a survey before you build, and a title search ' +
        'that looks for use, not just paper.',
      sources: [
        {
          label: 'CA Supreme Court merits brief summarizing Kapner v. Meadowlark Ranch',
          url: 'https://supreme.courts.ca.gov/sites/default/files/supremecourt/default/documents/6-290-s275023-apps-answer-brief-merits-092722.pdf',
        },
        {
          label: 'First Tuesday Journal: prescriptive easement for a pathway (Ditzian v. Unger)',
          url: 'https://journal.firsttuesday.us/may-a-property-owner-obtain-a-private-easement-for-a-pathway-on-a-neighbors-property-that-the-owner-has-used-for-more-than-five-years/67335/',
        },
      ],
      illustrative: false,
    },
  }),
} satisfies Record<EasementType, GuideContent>;

/** Type guard for the dynamic route: unknown slugs 404. */
export function isGuideType(value: string): value is EasementType {
  return (EASEMENT_TYPES as readonly string[]).includes(value);
}

export function guideFor(type: EasementType): GuideContent {
  return GUIDE_BY_TYPE[type];
}
