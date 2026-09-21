import { type Static, Type } from "@sinclair/typebox";

export const StatusSchema = Type.Union([
  Type.Literal("backlog"),
  Type.Literal("en_cours"),
  Type.Literal("en_pause"),
  Type.Literal("termine"),
  Type.Literal("abandonne"),
  Type.Literal("wishlist"),
]);

export type Status = Static<typeof StatusSchema>;

export const STATUSES: readonly Status[] = [
  "backlog",
  "en_cours",
  "en_pause",
  "termine",
  "abandonne",
  "wishlist",
];

export const DEFAULT_STATUS: Status = "backlog";

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
