import { isBookStatus } from "../domain/book";
import type { BookPatch, BookStorePort } from "../domain/bookPorts";

/** Écrit des champs locaux d'un livre/BD dans `books.yaml`. */
export async function setBookLocal(
  store: BookStorePort,
  key: string,
  patch: BookPatch,
): Promise<void> {
  if (patch.status !== undefined && !isBookStatus(patch.status)) {
    throw new Error(`Statut inconnu : ${String(patch.status)}`);
  }
  await store.writeBookFields(key, patch);
}
