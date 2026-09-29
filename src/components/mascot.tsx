'use client';

import { useId, type ReactNode } from 'react';

/**
 * Original "little ant" mascots: pastel body, big head with a dark visor, two
 * antennae, tiny legs, no mouth and expressive eyes that blink. Rendered as
 * inline SVG so every bot gets its own head shape, palette, eyes and antennae.
 */

type Shape = 'round' | 'square' | 'triangle' | 'hexagon' | 'long';
type Eyes = 'happy' | 'dots' | 'wink' | 'sleepy' | 'curious';
type Antenna = 'classic' | 'curved' | 'ball' | 'heart' | 'star' | 'wavy';

interface MascotSpec {
  id: string;
  label: string;
  shape: Shape;
  eyes: Eyes;
  antenna: Antenna;
  /** Saturated brand color, used for UI tints. */
  primary: string;
  /** Pastel body color. */
  secondary: string;
}

const INK = '#1e1e23';

export const MASCOT_SPECS: readonly MascotSpec[] = [
  { id: 'preset-hydra', label: 'Hydra', shape: 'round', eyes: 'happy', antenna: 'classic', primary: '#0a84ff', secondary: '#bcd9ff' },
  { id: 'preset-ingenieur', label: 'Boulon', shape: 'square', eyes: 'dots', antenna: 'classic', primary: '#ff9f0a', secondary: '#ffe08a' },
  { id: 'preset-analyste', label: 'Prisme', shape: 'hexagon', eyes: 'curious', antenna: 'ball', primary: '#bf5af2', secondary: '#dcc8ff' },
  { id: 'preset-plume', label: 'Plume', shape: 'round', eyes: 'wink', antenna: 'heart', primary: '#ff375f', secondary: '#ffc4cc' },
  { id: 'preset-compagnon', label: 'Bulle', shape: 'long', eyes: 'happy', antenna: 'curved', primary: '#30d158', secondary: '#c6efd2' },
  { id: 'preset-conteur', label: 'Lanterne', shape: 'long', eyes: 'dots', antenna: 'star', primary: '#ffd60a', secondary: '#ffd9a8' },
  { id: 'preset-coach', label: 'Sprint', shape: 'triangle', eyes: 'dots', antenna: 'classic', primary: '#ff453a', secondary: '#ffb8ad' },
  { id: 'preset-zen', label: 'Galet', shape: 'round', eyes: 'sleepy', antenna: 'curved', primary: '#64d2ff', secondary: '#cfe9ff' },
  { id: 'preset-tuteur', label: 'Cube', shape: 'square', eyes: 'happy', antenna: 'ball', primary: '#5e5ce6', secondary: '#c9c8ff' },
  { id: 'preset-avocat-du-diable', label: 'Pique', shape: 'hexagon', eyes: 'wink', antenna: 'wavy', primary: '#8e8e93', secondary: '#c8c8cf' },
  { id: 'persona-default', label: 'Orbe', shape: 'round', eyes: 'dots', antenna: 'classic', primary: '#8e8e93', secondary: '#f2f2f4' },
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

/* Head centred on (50, 42) in a 100x100 box. `top` is the head apex y. */
const HEADS: Record<Shape, { path: string; top: number; visor: { x: number; y: number; w: number; h: number; r: number } }> = {
  round: {
    path: 'M50 12a30 30 0 1 1 0 60 30 30 0 0 1 0-60z',
    top: 12,
    visor: { x: 30, y: 30, w: 40, h: 28, r: 14 },
  },
  square: {
    path: 'M50 14c22 0 29 7 29 28s-7 28-29 28-29-7-29-28 7-28 29-28z',
    top: 14,
    visor: { x: 30, y: 31, w: 40, h: 26, r: 12 },
  },
  triangle: {
    path: 'M50 12c4 0 7 2 9 6l20 36c3 6-1 14-8 14H29c-7 0-11-8-8-14l20-36c2-4 5-6 9-6z',
    top: 12,
    visor: { x: 32, y: 36, w: 36, h: 24, r: 12 },
  },
  hexagon: {
    path: 'M46 13c3-1 5-1 8 0l20 12c3 2 4 4 4 7v20c0 3-1 5-4 7L54 71c-3 1-5 1-8 0L26 59c-3-2-4-4-4-7V32c0-3 1-5 4-7z',
    top: 13,
    visor: { x: 30, y: 30, w: 40, h: 26, r: 13 },
  },
  long: {
    path: 'M50 16c24 0 36 12 36 26S74 68 50 68 14 56 14 42s12-26 36-26z',
    top: 16,
    visor: { x: 26, y: 30, w: 48, h: 24, r: 12 },
  },
};

function EyesGroup({ kind, cy }: { kind: Eyes; cy: number }) {
  const gap = 9;
  const stroke = { stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  const smile = (cx: number) => <path d={`M${cx - 5} ${cy + 1} q5 -7 10 0`} {...stroke} />;
  const closed = (cx: number) => <path d={`M${cx - 5} ${cy - 1} q5 5 10 0`} {...stroke} />;
  const dot = (cx: number, r = 3.2) => <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.25} fill="#fff" />;
  switch (kind) {
    case 'happy':
      return (
        <>
          {smile(50 - gap)}
          {smile(50 + gap)}
        </>
      );
    case 'wink':
      return (
        <>
          {dot(50 - gap)}
          {smile(50 + gap)}
        </>
      );
    case 'sleepy':
      return (
        <>
          {closed(50 - gap)}
          {closed(50 + gap)}
        </>
      );
    case 'curious':
      return (
        <>
          {dot(50 - gap, 2.6)}
          {dot(50 + gap, 3.8)}
        </>
      );
    case 'dots':
    default:
      return (
        <>
          {dot(50 - gap)}
          {dot(50 + gap)}
        </>
      );
  }
}

function Antennae({ kind, top, color }: { kind: Antenna; top: number; color: string }) {
  const y = top + 6;
  const line = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, fill: 'none' };
  const tips = (left: [number, number], right: [number, number], tip: (x: number, y: number) => ReactNode) => (
    <>
      {tip(left[0], left[1])}
      {tip(right[0], right[1])}
    </>
  );
  const ball = (x: number, yy: number) => <circle cx={x} cy={yy} r={3.6} fill={color} />;
  switch (kind) {
    case 'curved':
      return (
        <>
          <path d={`M40 ${y} C34 ${y - 10} 26 ${y - 12} 22 ${y - 6}`} {...line} />
          <path d={`M60 ${y} C66 ${y - 10} 74 ${y - 12} 78 ${y - 6}`} {...line} />
          {tips([22, y - 6], [78, y - 6], ball)}
        </>
      );
    case 'ball':
      return (
        <>
          <path d={`M50 ${y} V${y - 16}`} {...line} />
          <circle cx={50} cy={y - 20} r={4.5} fill="none" stroke={color} strokeWidth={2.4} />
        </>
      );
    case 'heart':
      return (
        <>
          <path d={`M42 ${y} L36 ${y - 14}`} {...line} />
          <path d={`M58 ${y} L64 ${y - 14}`} {...line} />
          {tips([36, y - 16], [64, y - 16], (x, yy) => (
            <path d={`M${x} ${yy + 3} l-4 -4 a2.3 2.3 0 0 1 4 -2.5 a2.3 2.3 0 0 1 4 2.5 z`} fill={color} />
          ))}
        </>
      );
    case 'star':
      return (
        <>
          <path d={`M42 ${y} L36 ${y - 14}`} {...line} />
          <path d={`M58 ${y} L64 ${y - 14}`} {...line} />
          {tips([36, y - 17], [64, y - 17], (x, yy) => (
            <path d={`M${x} ${yy - 4} l1.3 2.8 3 .3 -2.2 2 .7 3 -2.8 -1.6 -2.8 1.6 .7 -3 -2.2 -2 3 -.3z`} fill={color} />
          ))}
        </>
      );
    case 'wavy':
      return (
        <>
          <path d={`M42 ${y} q-5 -4 -1 -8 t-2 -8`} {...line} />
          <path d={`M58 ${y} q5 -4 1 -8 t2 -8`} {...line} />
        </>
      );
    case 'classic':
    default:
      return (
        <>
          <path d={`M42 ${y} L34 ${y - 14}`} {...line} />
          <path d={`M58 ${y} L66 ${y - 14}`} {...line} />
          {tips([33, y - 16], [67, y - 16], ball)}
        </>
      );
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
  const { path, top, visor } = HEADS[s.shape];
  const seed = hash(s.id);
  const period = 3.8 + (seed % 23) / 10;
  const delay = (seed % 17) / 10;
  const uid = useId();
  const eyeCy = visor.y + visor.h / 2 + 1;

  return (
    <svg
      viewBox="-6 -14 112 124"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 self-start overflow-visible ${className}`}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        <radialGradient id={uid} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="0.6" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g className={animate ? 'mascot-float' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <ellipse cx={52} cy={102} rx={24} ry={3.5} fill={INK} opacity={0.12} />
        {/* legs + arms */}
        <path d="M46 92 L44 101" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d="M62 92 L66 101" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d="M70 80 q6 2 8 6" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
        <path d="M40 78 q-6 2 -7 7" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
        {/* body */}
        <ellipse cx={55} cy={80} rx={17} ry={14} fill={s.secondary} />
        <ellipse cx={55} cy={80} rx={17} ry={14} fill={`url(#${uid})`} />
        <Antennae kind={s.antenna} top={top} color={INK} />
        {/* head */}
        <path d={path} fill={s.secondary} />
        <path d={path} fill={`url(#${uid})`} />
        <rect x={visor.x} y={visor.y} width={visor.w} height={visor.h} rx={visor.r} fill={INK} />
        <g
          className={animate ? 'mascot-eyes' : undefined}
          style={{ ['--blink-period' as string]: `${period}s`, ['--blink-delay' as string]: `${delay}s` }}
        >
          <EyesGroup kind={s.eyes} cy={eyeCy} />
        </g>
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
