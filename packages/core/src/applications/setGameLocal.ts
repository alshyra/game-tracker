import type { LocalPatch, StorePort } from "../domain/ports";
import { isStatus } from "../domain/status";

/**
 * Écrit des champs locaux (statut, note, notes, overrides) dans `games.yaml`.
 * Seuls les champs locaux passent par ici : l'API ne les écrase jamais.
 */
export async function setGameLocal(
  store: StorePort,
  key: string,
  patch: LocalPatch,
): Promise<void> {
  if (patch.status !== undefined && !isStatus(patch.status)) {
    throw new Error(`Statut inconnu : ${String(patch.status)}`);
  }
  await store.writeLocalFields(key, patch);
}
