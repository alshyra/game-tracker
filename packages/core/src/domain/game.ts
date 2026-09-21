import { type Static, Type } from "@sinclair/typebox";
import { StatusSchema } from "./status";

export const SourceSchema = Type.Union([Type.Literal("steam"), Type.Literal("manual")]);
export type Source = Static<typeof SourceSchema>;

export const GameSchema = Type.Object({
  key: Type.String(),
  steam_appid: Type.Union([Type.Number(), Type.Null()]),
  title: Type.String(),
  cover_url: Type.Union([Type.String(), Type.Null()]),
  header_url: Type.Union([Type.String(), Type.Null()]),
  release_date: Type.Union([Type.String(), Type.Null()]),
  genres: Type.Array(Type.String()),
  playtime_forever_min: Type.Number(),
  playtime_2weeks_min: Type.Union([Type.Number(), Type.Null()]),
  last_played_at: Type.Union([Type.String(), Type.Null()]),
  status: StatusSchema,
  rating: Type.Union([Type.Number(), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  source: SourceSchema,
  created_at: Type.Union([Type.String(), Type.Null()]),
  updated_at: Type.Union([Type.String(), Type.Null()]),
});

export type Game = Static<typeof GameSchema>;
