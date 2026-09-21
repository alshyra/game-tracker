import type { Game } from "../domain/game";
import { buildGames } from "../domain/merge";
import type { StorePort } from "../domain/ports";

/** Lit le snapshot Steam et le local, puis fusionne. Pure lecture. */
export async function listGames(store: StorePort): Promise<Game[]> {
  const [snapshot, local] = await Promise.all([store.readSnapshot(), store.readLocal()]);
  return buildGames(snapshot?.entries ?? [], local, snapshot?.fetched_at ?? null);
}
