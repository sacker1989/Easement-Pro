import type { ReactElement } from 'react';
import type { EasementType } from '@/lib/easements/easement-types';

/**
 * One simple inline SVG diagram per easement type.
 *
 * SVG is code, so there are no licensing issues, and it stays crisp on every
 * screen. Each diagram is deliberately schematic — a homeowner should grasp
 * the geometry in five seconds. Labels stay in plain language and never lead
 * with the word "easement".
 */

const LABEL = '#33414e';
const LOT = '#e6efdc';
const HOUSE = '#f3e9d2';
const HOUSE_ROOF = '#b98a5e';
const EASE = '#f7d774';
const EASE_EDGE = '#c99a2e';
const WATER = '#7fb8dd';
const DANGER = '#c0392b';

function Label({ x, y, children, size = 11 }: { x: number; y: number; children: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fill={LABEL} fontFamily="sans-serif">
      {children}
    </text>
  );
}

function House({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  // Simple house: body rect + roof triangle, anchored at bottom-left (x, y).
  const w = 64 * s;
  const h = 44 * s;
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={HOUSE} stroke={LABEL} strokeWidth="1.5" />
      <polygon
        points={`${x - 6 * s},${y - h} ${x + w / 2},${y - h - 30 * s} ${x + w + 6 * s},${y - h}`}
        fill={HOUSE_ROOF}
        stroke={LABEL}
        strokeWidth="1.5"
      />
      <rect x={x + w / 2 - 8 * s} y={y - 24 * s} width={16 * s} height={24 * s} fill="#8a6f4d" />
    </g>
  );
}

function OverheadDiagram() {
  return (
    <g>
      <rect x="0" y="150" width="400" height="90" fill={LOT} />
      {/* poles */}
      <rect x="76" y="40" width="8" height="115" fill="#7a5c3e" />
      <rect x="316" y="40" width="8" height="115" fill="#7a5c3e" />
      <rect x="60" y="52" width="40" height="6" fill="#7a5c3e" />
      <rect x="300" y="52" width="40" height="6" fill="#7a5c3e" />
      {/* sagging wires */}
      <path d="M64 58 Q 200 96 320 58" fill="none" stroke={LABEL} strokeWidth="2" />
      <path d="M64 72 Q 200 110 320 72" fill="none" stroke={LABEL} strokeWidth="2" />
      {/* clearance zone */}
      <rect x="60" y="76" width="280" height="74" fill={EASE} opacity="0.55" stroke={EASE_EDGE} strokeDasharray="6 4" />
      <Label x={200} y={112}>keep trees and buildings</Label>
      <Label x={200} y={126}>out of this zone</Label>
      <House x={20} y={232} s={0.8} />
      <Label x={200} y={34}>power lines</Label>
    </g>
  );
}

function UndergroundDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="110" fill="#f4f8fb" />
      <rect x="0" y="110" width="400" height="130" fill="#d9c9a8" />
      <line x1="0" y1="110" x2="400" y2="110" stroke={LABEL} strokeWidth="2" />
      <House x={30} y={108} s={0.9} />
      {/* buried cable */}
      <line x1="20" y1="180" x2="380" y2="180" stroke={DANGER} strokeWidth="4" strokeDasharray="10 6" />
      <Label x={200} y={205}>buried cable</Label>
      {/* shovel with red X */}
      <g transform="translate(330,60)">
        <rect x="-3" y="0" width="6" height="34" fill="#7a5c3e" transform="rotate(24)" />
        <ellipse cx="14" cy="34" rx="9" ry="6" fill="#9aa5ad" transform="rotate(24 14 34)" />
        <line x1="-16" y1="-6" x2="30" y2="40" stroke={DANGER} strokeWidth="4" />
        <line x1="30" y1="-6" x2="-16" y2="40" stroke={DANGER} strokeWidth="4" />
      </g>
      <Label x={330} y={112}>call 811</Label>
      <Label x={330} y={126}>before you dig</Label>
    </g>
  );
}

function SewerDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="170" fill={LOT} />
      <rect x="0" y="170" width="400" height="70" fill="#cfd6da" />
      <Label x={200} y={192}>street</Label>
      <House x={40} y={120} />
      {/* lateral */}
      <line x1="104" y1="130" x2="200" y2="185" stroke="#5b6b7a" strokeWidth="7" />
      {/* main */}
      <line x1="0" y1="205" x2="400" y2="205" stroke="#33414e" strokeWidth="9" />
      <Label x={120} y={150}>lateral —</Label>
      <Label x={120} y={164}>often yours</Label>
      <Label x={300} y={228}>main — usually the agency’s</Label>
    </g>
  );
}

function StormDrainDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="150" fill={LOT} />
      <rect x="0" y="150" width="400" height="90" fill="#cfd6da" />
      <House x={40} y={110} s={0.9} />
      {/* grate in street */}
      <rect x="180" y="160" width="44" height="12" fill="#5b6b7a" />
      <Label x={202} y={150} size={10}>grate</Label>
      {/* pipe to channel */}
      <line x1="202" y1="172" x2="202" y2="205" stroke="#5b6b7a" strokeWidth="7" />
      <line x1="202" y1="205" x2="340" y2="205" stroke="#5b6b7a" strokeWidth="7" />
      {/* water arrows */}
      <path d="M120 60 q 30 -14 60 0" fill="none" stroke={WATER} strokeWidth="3" markerEnd="url(#arr)" />
      <path d="M250 90 q 30 -14 60 0" fill="none" stroke={WATER} strokeWidth="3" markerEnd="url(#arr)" />
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <polygon points="0,0 8,4 0,8" fill={WATER} />
        </marker>
      </defs>
      <Label x={300} y={232}>rainwater carried away</Label>
    </g>
  );
}

function WaterLineDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="170" fill={LOT} />
      <rect x="0" y="170" width="400" height="70" fill="#cfd6da" />
      <Label x={200} y={192}>street</Label>
      <House x={40} y={120} />
      {/* main */}
      <line x1="0" y1="205" x2="400" y2="205" stroke={WATER} strokeWidth="9" />
      {/* meter box */}
      <rect x="150" y="140" width="26" height="18" fill="#9aa5ad" stroke={LABEL} />
      <Label x={163} y={132} size={10}>meter</Label>
      <line x1="163" y1="158" x2="163" y2="200" stroke={WATER} strokeWidth="4" strokeDasharray="6 4" />
      <Label x={300} y={228}>water main — the utility’s to fix</Label>
    </g>
  );
}

function PipelineDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="240" fill={LOT} />
      {/* corridor */}
      <rect x="170" y="0" width="70" height="240" fill={EASE} opacity="0.6" stroke={EASE_EDGE} strokeWidth="2" strokeDasharray="8 5" />
      {/* marker posts */}
      <rect x="163" y="60" width="8" height="34" fill="#e8e4da" stroke={LABEL} />
      <rect x="163" y="60" width="8" height="10" fill={DANGER} />
      <rect x="232" y="150" width="8" height="34" fill="#e8e4da" stroke={LABEL} />
      <rect x="232" y="150" width="8" height="10" fill={DANGER} />
      <Label x={167} y={110} size={10}>marker</Label>
      <House x={40} y={220} s={0.9} />
      <Label x={205} y={30}>pipeline corridor</Label>
      <Label x={205} y={44} size={10}>no digging or building here</Label>
    </g>
  );
}

function AccessDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="240" fill={LOT} />
      <line x1="200" y1="0" x2="200" y2="240" stroke={LABEL} strokeWidth="1.5" strokeDasharray="8 5" />
      <House x={50} y={120} s={0.9} />
      <House x={270} y={120} s={0.9} />
      {/* shared driveway */}
      <rect x="176" y="120" width="48" height="120" fill="#cfd6da" stroke={LABEL} />
      <path d="M200 220 L200 140" stroke={LABEL} strokeWidth="2" markerEnd="url(#arr2)" markerStart="url(#arr2s)" strokeDasharray="6 4" />
      <defs>
        <marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <polygon points="0,0 8,4 0,8" fill={LABEL} />
        </marker>
        <marker id="arr2s" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
          <polygon points="8,0 0,4 8,8" fill={LABEL} />
        </marker>
      </defs>
      <Label x={100} y={200}>your lot</Label>
      <Label x={310} y={200}>neighbor’s lot</Label>
      <Label x={200} y={112}>shared</Label>
      <Label x={200} y={100}>driveway</Label>
    </g>
  );
}

function RightOfWayDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="150" fill={LOT} />
      <rect x="0" y="150" width="400" height="34" fill="#dfe5e8" />
      <rect x="0" y="184" width="400" height="56" fill="#cfd6da" />
      <House x={150} y={130} />
      {/* ROW line set back from curb */}
      <line x1="0" y1="138" x2="400" y2="138" stroke={DANGER} strokeWidth="2" strokeDasharray="8 5" />
      <Label x={200} y={128} size={10}>the city’s strip often reaches this far back</Label>
      <Label x={200} y={176} size={10}>sidewalk</Label>
      <Label x={200} y={212}>street</Label>
    </g>
  );
}

function DrainageDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="200" height="240" fill={LOT} />
      <rect x="200" y="0" width="200" height="240" fill="#e9f0e2" />
      <line x1="200" y1="0" x2="200" y2="240" stroke={LABEL} strokeWidth="1.5" strokeDasharray="8 5" />
      <House x={40} y={110} s={0.85} />
      <House x={250} y={110} s={0.85} />
      {/* swale */}
      <path d="M20 190 Q 110 150 200 185 Q 290 215 380 180" fill="none" stroke={WATER} strokeWidth="6" />
      <path d="M60 178 l 18 -8 m -18 8 l 4 18" fill="none" stroke={WATER} strokeWidth="2.5" />
      <path d="M250 196 l 18 -8 m -18 8 l 4 18" fill="none" stroke={WATER} strokeWidth="2.5" />
      <Label x={200} y={40}>water’s path —</Label>
      <Label x={200} y={54}>don’t block it</Label>
      <Label x={100} y={222}>your lot</Label>
      <Label x={300} y={222}>neighbor’s lot</Label>
    </g>
  );
}

function SlopeDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="240" fill="#f4f8fb" />
      {/* hillside */}
      <polygon points="0,240 0,120 400,60 400,240" fill="#d9cfae" />
      <polygon points="60,214 60,132 340,80 340,214" fill={EASE} opacity="0.55" stroke={EASE_EDGE} strokeWidth="2" strokeDasharray="8 5" />
      <House x={230} y={105} s={0.9} />
      <Label x={200} y={190}>graded slope —</Label>
      <Label x={200} y={204} size={10}>who maintains it is in the document</Label>
    </g>
  );
}

function ConservationDiagram() {
  return (
    <g>
      <rect x="20" y="20" width="360" height="200" fill={LOT} stroke={LABEL} strokeWidth="2" />
      {/* protected area */}
      <rect x="130" y="20" width="250" height="200" fill="#bcd8a8" opacity="0.7" />
      <line x1="130" y1="20" x2="130" y2="220" stroke="#4a7c3a" strokeWidth="2" strokeDasharray="8 5" />
      {/* trees */}
      <g fill="#4a7c3a">
        <circle cx="200" cy="90" r="16" />
        <circle cx="260" cy="140" r="20" />
        <circle cx="320" cy="80" r="14" />
        <rect x="197" y="100" width="6" height="18" fill="#6b4f35" />
        <rect x="257" y="154" width="6" height="20" fill="#6b4f35" />
        <rect x="317" y="90" width="6" height="16" fill="#6b4f35" />
      </g>
      <House x={40} y={200} s={0.8} />
      <Label x={255} y={200}>no building here — permanent</Label>
      <Label x={75} y={150} size={10}>you can still</Label>
      <Label x={75} y={164} size={10}>use this part</Label>
    </g>
  );
}

function PrescriptiveDiagram() {
  return (
    <g>
      <rect x="0" y="0" width="400" height="240" fill={LOT} />
      <line x1="200" y1="0" x2="200" y2="240" stroke={LABEL} strokeWidth="1.5" strokeDasharray="8 5" />
      <House x={50} y={120} s={0.9} />
      <House x={270} y={120} s={0.9} />
      {/* worn path across the corner */}
      <path d="M200 240 Q 230 170 200 120 Q 175 70 200 0" fill="none" stroke="#8a6f4d" strokeWidth="10" strokeDasharray="14 8" opacity="0.8" />
      <text x={285} y={60} textAnchor="middle" fontSize={34} fill={DANGER} fontFamily="sans-serif">?</text>
      <Label x={285} y={200}>used for years —</Label>
      <Label x={285} y={214}>no paperwork</Label>
    </g>
  );
}

const DIAGRAMS = {
  'utility-overhead': OverheadDiagram,
  'utility-underground': UndergroundDiagram,
  sewer: SewerDiagram,
  'storm-drain': StormDrainDiagram,
  'water-line': WaterLineDiagram,
  pipeline: PipelineDiagram,
  'access-ingress-egress': AccessDiagram,
  'public-right-of-way': RightOfWayDiagram,
  drainage: DrainageDiagram,
  slope: SlopeDiagram,
  conservation: ConservationDiagram,
  prescriptive: PrescriptiveDiagram,
} satisfies Record<EasementType, () => ReactElement>;

export function EasementDiagram({ type, title }: { type: EasementType; title: string }) {
  const Diagram = DIAGRAMS[type];
  return (
    <figure className="diagram" role="img" aria-label={title}>
      <svg viewBox="0 0 400 240" width="100%" style={{ maxWidth: '520px', height: 'auto', display: 'block' }}>
        <Diagram />
      </svg>
    </figure>
  );
}
