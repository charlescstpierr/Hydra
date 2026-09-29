'use client';

import { useId } from 'react';

/**
 * Original geometric robot mascots: colorful shapes, no mouth, two small eyes
 * that blink. Rendered as inline SVG so every bot gets a distinct silhouette,
 * palette and eye style without any raster asset.
 */

type Shape = 'round' | 'square' | 'capsule' | 'hex' | 'drop' | 'wide' | 'tall' | 'bean';
type Eyes = 'dots' | 'pills' | 'lenses' | 'visor' | 'wide';
type Accessory = 'antenna' | 'ears' | 'bolts' | 'twin-antenna' | 'fin' | 'ring' | 'none';

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
  { id: 'preset-hydra', label: 'Hydra', shape: 'round', eyes: 'dots', accessory: 'twin-antenna', primary: '#0a84ff', secondary: '#5ac8fa', face: '#0f2a4d', eye: '#e8f4ff' },
  { id: 'preset-ingenieur', label: 'Boulon', shape: 'square', eyes: 'lenses', accessory: 'bolts', primary: '#ff9f0a', secondary: '#ffd60a', face: '#3a2400', eye: '#fff4d6' },
  { id: 'preset-analyste', label: 'Prisme', shape: 'hex', eyes: 'pills', accessory: 'antenna', primary: '#bf5af2', secondary: '#da8fff', face: '#2b0f3d', eye: '#f6e8ff' },
  { id: 'preset-plume', label: 'Plume', shape: 'drop', eyes: 'dots', accessory: 'fin', primary: '#ff375f', secondary: '#ff8fa3', face: '#3d0a1a', eye: '#ffe8ee' },
  { id: 'preset-compagnon', label: 'Bulle', shape: 'bean', eyes: 'wide', accessory: 'ears', primary: '#30d158', secondary: '#7ee49a', face: '#0c2e18', eye: '#e9ffef' },
  { id: 'preset-conteur', label: 'Lanterne', shape: 'wide', eyes: 'pills', accessory: 'ring', primary: '#ffd60a', secondary: '#ffe873', face: '#332a00', eye: '#fffbe0' },
  { id: 'preset-coach', label: 'Sprint', shape: 'tall', eyes: 'visor', accessory: 'fin', primary: '#ff453a', secondary: '#ff8a80', face: '#3b0b08', eye: '#ffe9e7' },
  { id: 'preset-zen', label: 'Galet', shape: 'capsule', eyes: 'dots', accessory: 'none', primary: '#64d2ff', secondary: '#a8e6ff', face: '#0b2a38', eye: '#eaf9ff' },
  { id: 'preset-tuteur', label: 'Cube', shape: 'square', eyes: 'wide', accessory: 'antenna', primary: '#5e5ce6', secondary: '#9d9bff', face: '#171645', eye: '#ecebff' },
  { id: 'preset-avocat-du-diable', label: 'Pique', shape: 'hex', eyes: 'visor', accessory: 'twin-antenna', primary: '#ac8e68', secondary: '#d9c3a3', face: '#2c2115', eye: '#fff5e8' },
  { id: 'persona-default', label: 'Orbe', shape: 'round', eyes: 'lenses', accessory: 'ring', primary: '#8e8e93', secondary: '#c7c7cc', face: '#222226', eye: '#f2f2f7' },
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

/* Body outlines in a 100x100 box. Face plate is the darker inset. */
function bodyPath(shape: Shape): { body: string; face: string } {
  switch (shape) {
    case 'square':
      return { body: 'M20 12h60a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10V22a10 10 0 0 1 10-10z', face: 'M26 30h48a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z' };
    case 'capsule':
      return { body: 'M30 10h40a20 20 0 0 1 20 20v40a20 20 0 0 1-20 20H30a20 20 0 0 1-20-20V30a20 20 0 0 1 20-20z', face: 'M32 30h36a12 12 0 0 1 12 12v12a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12V42a12 12 0 0 1 12-12z' };
    case 'hex':
      return { body: 'M50 8l36 21v42L50 92 14 71V29z', face: 'M50 30l22 13v18L50 74 28 61V43z' };
    case 'drop':
      return { body: 'M50 8C70 30 88 44 88 62a38 38 0 0 1-76 0C12 44 30 30 50 8z', face: 'M50 40a20 20 0 0 1 20 20v4a20 20 0 0 1-40 0v-4a20 20 0 0 1 20-20z' };
    case 'wide':
      return { body: 'M18 24h64a14 14 0 0 1 14 14v28a14 14 0 0 1-14 14H18A14 14 0 0 1 4 66V38a14 14 0 0 1 14-14z', face: 'M24 38h52a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8V46a8 8 0 0 1 8-8z' };
    case 'tall':
      return { body: 'M32 6h36a12 12 0 0 1 12 12v64a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12V18A12 12 0 0 1 32 6z', face: 'M32 26h36a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6z' };
    case 'bean':
      return { body: 'M34 12c22-8 54 4 56 30 2 24-14 50-42 50S6 76 8 50C10 30 20 17 34 12z', face: 'M50 32a22 18 0 0 1 22 18 22 18 0 0 1-44 0 22 18 0 0 1 22-18z' };
    case 'round':
    default:
      return { body: 'M50 8a42 42 0 1 1 0 84 42 42 0 0 1 0-84z', face: 'M50 30a24 20 0 0 1 24 20 24 20 0 0 1-48 0 24 20 0 0 1 24-20z' };
  }
}

function EyesGroup({ kind, color, cx = 50, cy = 50 }: { kind: Eyes; color: string; cx?: number; cy?: number }) {
  const gap = 11;
  switch (kind) {
    case 'pills':
      return (
        <>
          <rect x={cx - gap - 3} y={cy - 6} width={6} height={12} rx={3} fill={color} />
          <rect x={cx + gap - 3} y={cy - 6} width={6} height={12} rx={3} fill={color} />
        </>
      );
    case 'lenses':
      return (
        <>
          <circle cx={cx - gap} cy={cy} r={6.5} fill={color} />
          <circle cx={cx + gap} cy={cy} r={6.5} fill={color} />
          <circle cx={cx - gap} cy={cy} r={2.6} fill="#111" opacity={0.85} />
          <circle cx={cx + gap} cy={cy} r={2.6} fill="#111" opacity={0.85} />
        </>
      );
    case 'visor':
      return (
        <>
          <rect x={cx - gap - 6} y={cy - 3} width={12} height={6} rx={3} fill={color} />
          <rect x={cx + gap - 6} y={cy - 3} width={12} height={6} rx={3} fill={color} />
        </>
      );
    case 'wide':
      return (
        <>
          <circle cx={cx - gap - 3} cy={cy} r={5} fill={color} />
          <circle cx={cx + gap + 3} cy={cy} r={5} fill={color} />
          <circle cx={cx - gap - 1.5} cy={cy - 1.5} r={1.4} fill="#fff" />
          <circle cx={cx + gap + 4.5} cy={cy - 1.5} r={1.4} fill="#fff" />
        </>
      );
    case 'dots':
    default:
      return (
        <>
          <circle cx={cx - gap} cy={cy} r={4.2} fill={color} />
          <circle cx={cx + gap} cy={cy} r={4.2} fill={color} />
        </>
      );
  }
}

function Accessory({ kind, secondary, shape }: { kind: Accessory; secondary: string; shape: Shape }) {
  const top = shape === 'tall' ? 6 : shape === 'wide' ? 24 : shape === 'hex' || shape === 'drop' || shape === 'round' ? 8 : 12;
  switch (kind) {
    case 'antenna':
      return (
        <>
          <rect x={48.5} y={top - 10} width={3} height={12} rx={1.5} fill={secondary} />
          <circle cx={50} cy={top - 12} r={4.5} fill={secondary} />
        </>
      );
    case 'twin-antenna':
      return (
        <>
          <path d={`M36 ${top + 2} l-6 -12`} stroke={secondary} strokeWidth={3} strokeLinecap="round" />
          <path d={`M64 ${top + 2} l6 -12`} stroke={secondary} strokeWidth={3} strokeLinecap="round" />
          <circle cx={29} cy={top - 11} r={4} fill={secondary} />
          <circle cx={71} cy={top - 11} r={4} fill={secondary} />
        </>
      );
    case 'ears':
      return (
        <>
          <rect x={2} y={40} width={10} height={20} rx={5} fill={secondary} />
          <rect x={88} y={40} width={10} height={20} rx={5} fill={secondary} />
        </>
      );
    case 'bolts':
      return (
        <>
          <circle cx={20} cy={22} r={3.5} fill={secondary} />
          <circle cx={80} cy={22} r={3.5} fill={secondary} />
          <circle cx={20} cy={78} r={3.5} fill={secondary} />
          <circle cx={80} cy={78} r={3.5} fill={secondary} />
        </>
      );
    case 'fin':
      return <path d={`M42 ${top + 4} Q50 ${top - 14} 58 ${top + 4} Z`} fill={secondary} />;
    case 'ring':
      return <ellipse cx={50} cy={80} rx={30} ry={5} fill={secondary} opacity={0.55} />;
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
  const { body, face } = bodyPath(s.shape);
  const seed = hash(s.id);
  const period = 3.8 + (seed % 23) / 10;
  const delay = (seed % 17) / 10;
  const faceCy = s.shape === 'square' ? 49 : s.shape === 'drop' ? 62 : s.shape === 'wide' ? 53 : s.shape === 'tall' ? 43 : s.shape === 'capsule' ? 48 : 50;
  const gradId = useId();

  return (
    <svg
      viewBox="-2 -14 104 118"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 self-start overflow-visible ${className}`}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={s.secondary} />
          <stop offset="1" stopColor={s.primary} />
        </linearGradient>
      </defs>
      <g className={animate ? 'mascot-float' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <Accessory kind={s.accessory} secondary={s.secondary} shape={s.shape} />
        <path d={body} fill={`url(#${gradId})`} />
        <path d={body} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={2} />
        <path d={face} fill={s.face} />
        <g
          className={animate ? 'mascot-eyes' : undefined}
          style={{ ['--blink-period' as string]: `${period}s`, ['--blink-delay' as string]: `${delay}s` }}
        >
          <EyesGroup kind={s.eyes} color={s.eye} cy={faceCy} />
        </g>
        <ellipse cx={40} cy={26} rx={10} ry={4} fill="#fff" opacity={0.18} transform="rotate(-25 40 26)" />
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
