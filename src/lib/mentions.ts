const SLUG = /(?:^|\s)\/([a-z0-9]+(?:-[a-z0-9]+)*)/g;
const AT = /(?:^|\s)@([^\s@]{1,40})/g;

export function slashTokens(text: string): string[] {
  return [...text.matchAll(SLUG)].map((match) => match[1]).filter((slug): slug is string => Boolean(slug));
}

export function atTokens(text: string): string[] {
  return [...text.matchAll(AT)].map((match) => match[1]).filter((name): name is string => Boolean(name));
}

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'competence';
}
