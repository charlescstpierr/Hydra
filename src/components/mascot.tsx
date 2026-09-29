import Image from 'next/image';

export const MASCOTS = [
  { id: 'preset-hydra', label: 'Hydre' },
  { id: 'preset-ingenieur', label: 'Robot' },
  { id: 'preset-analyste', label: 'Hibou' },
  { id: 'preset-plume', label: 'Renard' },
  { id: 'preset-compagnon', label: 'Chat' },
  { id: 'preset-conteur', label: 'Ours' },
  { id: 'preset-coach', label: 'Loup' },
  { id: 'preset-zen', label: 'Panda' },
  { id: 'preset-tuteur', label: 'Tortue' },
  { id: 'preset-avocat-du-diable', label: 'Lutin' },
  { id: 'persona-default', label: 'Orbe' },
] as const;

const KNOWN = new Set(MASCOTS.map((m) => m.id));

export function mascotSrc(avatar: string | null | undefined): string {
  const id = avatar && KNOWN.has(avatar as (typeof MASCOTS)[number]['id']) ? avatar : 'persona-default';
  return `/mascots/${id}.webp`;
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
  return (
    <Image
      src={mascotSrc(avatar)}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 self-start rounded-full border border-[var(--border)] object-cover ${className}`}
    />
  );
}
