import { type Static, Type } from "@sinclair/typebox";

/**
 * Entrée du catalogue BD local : métadonnées d'un album scrapées depuis un
 * éditeur (aujourd'hui Soleil). Le catalogue sert d'index de recherche et de
 * source de préremplissage — il ne remplace pas `books.yaml`, qui reste la
 * source de vérité de la collection.
 */
export const CatalogEntrySchema = Type.Object({
  /** Clé stable : `<source>:<slug>` (ex. `soleil:elfes-t11`). */
  key: Type.String(),
  /** Nom lisible de la série (ex. `Elfes`). */
  series: Type.String(),
  /** Slug canonique de la série (ex. `elfes`). */
  series_slug: Type.String(),
  /** Univers de rattachement (ex. `Les Terres d'Arran`), ou null. */
  collection: Type.Union([Type.String(), Type.Null()]),
  /** Numéro de tome, si identifiable. */
  tome: Type.Union([Type.Number(), Type.Null()]),
  title: Type.String(),
  authors: Type.Array(Type.String()),
  isbn: Type.Union([Type.String(), Type.Null()]),
  year: Type.Union([Type.Number(), Type.Null()]),
  pages: Type.Union([Type.Number(), Type.Null()]),
  publisher: Type.Union([Type.String(), Type.Null()]),
  /** URL locale servie par l'app (ex. `/covers/9782302047457.webp`). */
  cover_url: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  /** URL source de l'album chez l'éditeur. */
  url: Type.String(),
  /** Identifiant de la source (ex. `soleil`). */
  source: Type.String(),
});
export type CatalogEntry = Static<typeof CatalogEntrySchema>;
