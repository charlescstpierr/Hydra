'use client';

import { useId } from 'react';

/**
 * Original robot mascots: soft colorful bodies, a glossy visor, no mouth and two
 * glowing eyes that blink. Rendered as inline SVG so every bot gets a distinct
 * silhouette, palette and eye style without any raster asset.
 */

type Shape = 'egg' | 'squircle' | 'pebble' | 'bell' | 'pill' | 'blob';
type Eyes = 'oval' | 'round' | 'tall' | 'tilted' | 'sleepy';
type Accessory = 'antenna' | 'ears' | 'twin-antenna' | 'fin' | 'band' | 'bow' | 'none';

interface MascotSpec {
  id: string;
  label: string;
  shape: Shape;
  eyes: Eyes;
  accessory: Accessory;
  primary: string;
  secondary: string;
  face: string;
  eye: string;
}

export const MASCOT_SPECS: readonly MascotSpec[] = [
  { id: 'preset-hydra', label: 'Hydra', shape: 'egg', eyes: 'oval', accessory: 'twin-antenna', primary: '#0a84ff', secondary: '#7fd0ff', face: '#0b1e3a', eye: '#9fe0ff' },
  { id: 'preset-ingenieur', label: 'Boulon', shape: 'squircle', eyes: 'round', accessory: 'band', primary: '#ff9f0a', secondary: '#ffd66b', face: '#2a1a00', eye: '#ffe9b3' },
  { id: 'preset-analyste', label: 'Prisme', shape: 'bell', eyes: 'tall', accessory: 'antenna', primary: '#bf5af2', secondary: '#e4b4ff', face: '#22082f', eye: '#f1d6ff' },
  { id: 'preset-plume', label: 'Plume', shape: 'pill', eyes: 'tilted', accessory: 'fin', primary: '#ff375f', secondary: '#ffa3b8', face: '#33081a', eye: '#ffd9e3' },
  { id: 'preset-compagnon', label: 'Bulle', shape: 'blob', eyes: 'round', accessory: 'ears', primary: '#30d158', secondary: '#9cf0b3', face: '#062a12', eye: '#d6ffe1' },
  { id: 'preset-conteur', label: 'Lanterne', shape: 'pebble', eyes: 'sleepy', accessory: 'bow', primary: '#ffd60a', secondary: '#fff0a0', face: '#2b2300', eye: '#fff7c8' },
  { id: 'preset-coach', label: 'Sprint', shape: 'bell', eyes: 'tilted', accessory: 'band', primary: '#ff453a', secondary: '#ffa199', face: '#330806', eye: '#ffe3e0' },
  { id: 'preset-zen', label: 'Galet', shape: 'pebble', eyes: 'sleepy', accessory: 'none', primary: '#64d2ff', secondary: '#c2ecff', face: '#082330', eye: '#e2f7ff' },
  { id: 'preset-tuteur', label: 'Cube', shape: 'squircle', eyes: 'oval', accessory: 'antenna', primary: '#5e5ce6', secondary: '#b4b2ff', face: '#12113a', eye: '#e4e3ff' },
  { id: 'preset-avocat-du-diable', label: 'Pique', shape: 'egg', eyes: 'tall', accessory: 'twin-antenna', primary: '#c39a6b', secondary: '#eddcc3', face: '#241a0f', eye: '#fff1de' },
  { id: 'persona-default', label: 'Orbe', shape: 'blob', eyes: 'round', accessory: 'antenna', primary: '#8e8e93', secondary: '#d1d1d6', face: '#1c1c1f', eye: '#f2f2f7' },
];

export const MASCOTS = MASCOT_SPECS.map(({ id, label }) => ({ id, label }));

const BY_ID = new Map(MASCOT_SPECS.map((m) => [m.id, m]));

function spec(avatar: string | null | undefined): MascotSpec {
  return (avatar && BY_ID.get(avatar)) || BY_ID.get('persona-default')!;
}

export function mascotPalette(avatar: string | null | undefined): {
  primary: string;
  secondary: string;
  glow: string;
} {
  const s = spec(avatar);
  return { primary: s.primary, secondary: s.secondary, glow: `${s.primary}26` };
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/* Bodies in a 100x100 box; `top` is the y of the head apex, `visor` the face ellipse. */
const BODIES: Record<Shape, { path: string; top: number; visor: { cy: number; rx: number; ry: number } }> = {
  egg: {
    path: 'M50 6C74 6 90 32 90 58C90 80 72 94 50 94S10 80 10 58C10 32 26 6 50 6z',
    top: 6,
    visor: { cy: 48, rx: 27, ry: 19 },
  },
  squircle: {
    path: 'M50 8c30 0 42 12 42 42s-12 42-42 42S8 80 8 50 20 8 50 8z',
    top: 8,
    visor: { cy: 47, rx: 28, ry: 19 },
  },
  pebble: {
    path: 'M50 16c28 0 46 14 46 34S78 86 50 86 4 70 4 50 22 16 50 16z',
    top: 16,
    visor: { cy: 50, rx: 31, ry: 17 },
  },
  bell: {
    path: 'M50 6C76 6 90 30 90 60v18a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V60C10 30 24 6 50 6z',
    top: 6,
    visor: { cy: 46, rx: 27, ry: 19 },
  },
  pill: {
    path: 'M50 4a30 30 0 0 1 30 30v32a30 30 0 0 1-60 0V34A30 30 0 0 1 50 4z',
    top: 4,
    visor: { cy: 42, rx: 22, ry: 20 },
  },
  blob: {
    path: 'M48 8c26-4 46 18 44 42-2 26-16 46-44 44S4 78 6 50 24 12 48 8z',
    top: 8,
    visor: { cy: 48, rx: 28, ry: 19 },
  },
};

function EyesGroup({ kind, color, cy }: { kind: Eyes; color: string; cy: number }) {
  const gap = 13;
  const eye = (cx: number, rx: number, ry: number, rotate = 0) => (
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy} rx={rx + 3} ry={ry + 3} fill={color} opacity={0.22} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} />
      <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.4} rx={rx * 0.3} ry={ry * 0.22} fill="#fff" opacity={0.9} />
    </g>
  );
  switch (kind) {
    case 'round':
      return (
        <>
          {eye(50 - gap, 7.5, 7.5)}
          {eye(50 + gap, 7.5, 7.5)}
        </>
      );
    case 'tall':
      return (
        <>
          {eye(50 - gap, 5.5, 9)}
          {eye(50 + gap, 5.5, 9)}
        </>
      );
    case 'tilted':
      return (
        <>
          {eye(50 - gap, 6, 8.5, -14)}
          {eye(50 + gap, 6, 8.5, 14)}
        </>
      );
    case 'sleepy':
      return (
        <>
          {eye(50 - gap, 7.5, 5)}
          {eye(50 + gap, 7.5, 5)}
        </>
      );
    case 'oval':
    default:
      return (
        <>
          {eye(50 - gap, 6.5, 8)}
          {eye(50 + gap, 6.5, 8)}
        </>
      );
  }
}

function Accessory({ kind, primary, secondary, top }: { kind: Accessory; primary: string; secondary: string; top: number }) {
  switch (kind) {
    case 'antenna':
      return (
        <>
          <rect x={48.25} y={top - 9} width={3.5} height={12} rx={1.75} fill={primary} />
          <circle cx={50} cy={top - 11} r={5} fill={secondary} />
          <circle cx={48.5} cy={top - 12.5} r={1.6} fill="#fff" opacity={0.8} />
        </>
      );
    case 'twin-antenna':
      return (
        <>
          <path d={`M38 ${top + 3} Q34 ${top - 6} 30 ${top - 9}`} stroke={primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <path d={`M62 ${top + 3} Q66 ${top - 6} 70 ${top - 9}`} stroke={primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <circle cx={29} cy={top - 10} r={4.5} fill={secondary} />
          <circle cx={71} cy={top - 10} r={4.5} fill={secondary} />
        </>
      );
    case 'ears':
      return (
        <>
          <ellipse cx={30} cy={top + 4} rx={9} ry={12} fill={primary} />
          <ellipse cx={70} cy={top + 4} rx={9} ry={12} fill={primary} />
          <ellipse cx={30} cy={top + 5} rx={4.5} ry={7} fill={secondary} />
          <ellipse cx={70} cy={top + 5} rx={4.5} ry={7} fill={secondary} />
        </>
      );
    case 'fin':
      return <path d={`M44 ${top + 6} Q50 ${top - 16} 56 ${top + 6} Z`} fill={secondary} />;
    case 'band':
      return (
        <>
          <path d={`M18 ${top + 26} Q50 ${top - 2} 82 ${top + 26}`} stroke={secondary} strokeWidth={6} strokeLinecap="round" fill="none" />
          <circle cx={18} cy={top + 30} r={7} fill={secondary} />
          <circle cx={82} cy={top + 30} r={7} fill={secondary} />
        </>
      );
    case 'bow':
      return (
        <>
          <ellipse cx={64} cy={top + 1} rx={8} ry={5} fill={primary} transform={`rotate(-20 64 ${top + 1})`} />
          <ellipse cx={80} cy={top + 3} rx={8} ry={5} fill={primary} transform={`rotate(25 80 ${top + 3})`} />
          <circle cx={72} cy={top + 3} r={3.5} fill={secondary} />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

export function MascotFigure({
  avatar,
  size = 28,
  className = '',
  alt = '',
  animate = true,
}: {
  avatar: string | null | undefined;
  size?: number;
  className?: string;
  alt?: string;
  animate?: boolean;
}) {
  const s = spec(avatar);
  const { path, top, visor } = BODIES[s.shape];
  const seed = hash(s.id);
  const period = 3.8 + (seed % 23) / 10;
  const delay = (seed % 17) / 10;
  const uid = useId();
  const bodyGrad = `${uid}-b`;
  const visorGrad = `${uid}-v`;
  const glossGrad = `${uid}-g`;

  return (
    <svg
      viewBox="-4 -16 108 122"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 self-start overflow-visible ${className}`}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        <radialGradient id={bodyGrad} cx="0.35" cy="0.25" r="0.85">
          <stop offset="0" stopColor={s.secondary} />
          <stop offset="0.65" stopColor={s.primary} />
          <stop offset="1" stopColor={s.primary} stopOpacity={0.85} />
        </radialGradient>
        <linearGradient id={visorGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.face} />
          <stop offset="1" stopColor="#000" stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id={glossGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g className={animate ? 'mascot-float' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <ellipse cx={50} cy={99} rx={26} ry={4} fill="#000" opacity={0.22} />
        {s.accessory !== 'band' && <Accessory kind={s.accessory} primary={s.primary} secondary={s.secondary} top={top} />}
        <path d={path} fill={`url(#${bodyGrad})`} />
        {s.accessory === 'band' && <Accessory kind={s.accessory} primary={s.primary} secondary={s.secondary} top={top} />}
        <path d={path} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1.5} />
        <ellipse cx={50} cy={visor.cy} rx={visor.rx} ry={visor.ry} fill={`url(#${visorGrad})`} />
        <ellipse cx={50} cy={visor.cy} rx={visor.rx} ry={visor.ry} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={1.5} />
        <g
          className={animate ? 'mascot-eyes' : undefined}
          style={{ ['--blink-period' as string]: `${period}s`, ['--blink-delay' as string]: `${delay}s` }}
        >
          <EyesGroup kind={s.eyes} color={s.eye} cy={visor.cy} />
        </g>
        <ellipse
          cx={50}
          cy={visor.cy - visor.ry * 0.45}
          rx={visor.rx * 0.8}
          ry={visor.ry * 0.5}
          fill={`url(#${glossGrad})`}
        />
        <circle cx={50 - visor.rx - 4} cy={visor.cy + visor.ry * 0.7} r={4} fill="#fff" opacity={0.28} />
        <circle cx={50 + visor.rx + 4} cy={visor.cy + visor.ry * 0.7} r={4} fill="#fff" opacity={0.28} />
        <ellipse cx={34} cy={top + 14} rx={9} ry={4} fill="#fff" opacity={0.35} transform={`rotate(-30 34 ${top + 14})`} />
      </g>
    </svg>
  );
}

export function Mascot({
  avatar,
  size = 28,
  className = '',
  alt = '',
}: {
  avatar: string | null | undefined;
  size?: number;
  className?: string;
  alt?: string;
}) {
  if (avatar?.startsWith('upload:')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/${avatar.slice('upload:'.length)}`}
        alt={alt}
        style={{ width: size, height: size }}
        className={`shrink-0 self-start rounded-full border border-[var(--border)] object-cover ${className}`}
      />
    );
  }
  return <MascotFigure avatar={avatar} size={size} className={className} alt={alt} />;
}
