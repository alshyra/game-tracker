import { type Static, Type } from "@sinclair/typebox";

/** Type de média : livre ou bande dessinée. */
export const BookKindSchema = Type.Union([Type.Literal("livre"), Type.Literal("bd")]);
export type BookKind = Static<typeof BookKindSchema>;

export const BookStatusSchema = Type.Union([
  Type.Literal("a_lire"),
  Type.Literal("en_cours"),
  Type.Literal("lu"),
  Type.Literal("abandonne"),
  Type.Literal("wishlist"),
]);
export type BookStatus = Static<typeof BookStatusSchema>;

export const BOOK_STATUSES: readonly BookStatus[] = [
  "a_lire",
  "en_cours",
  "lu",
  "abandonne",
  "wishlist",
];

export const BookSourceSchema = Type.Union([Type.Literal("openlibrary"), Type.Literal("manual")]);
export type BookSource = Static<typeof BookSourceSchema>;

export const BookSchema = Type.Object({
  key: Type.String(),
  title: Type.String(),
  authors: Type.Array(Type.String()),
  kind: BookKindSchema,
  cover_url: Type.Union([Type.String(), Type.Null()]),
  status: BookStatusSchema,
  rating: Type.Union([Type.Number(), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  isbn: Type.Union([Type.String(), Type.Null()]),
  year: Type.Union([Type.Number(), Type.Null()]),
  source: BookSourceSchema,
  created_at: Type.Union([Type.String(), Type.Null()]),
  updated_at: Type.Union([Type.String(), Type.Null()]),
});
export type Book = Static<typeof BookSchema>;

export function isBookStatus(value: unknown): value is BookStatus {
  return typeof value === "string" && (BOOK_STATUSES as readonly string[]).includes(value);
}
