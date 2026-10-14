/** Slug stable pour les clés `manual:<slug>` (sans accents, kebab-case). */
export function slugify(value: string, fallback = "item"): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}
