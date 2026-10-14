import type { Book } from "../domain/book";
import type { BookRecord, BookStorePort } from "../domain/bookPorts";

function toBook(rec: BookRecord): Book {
  return { ...rec };
}

/** Liste les livres/BD, triés par titre. */
export async function listBooks(store: BookStorePort): Promise<Book[]> {
  const records = await store.readBooks();
  return [...records.values()].map(toBook).sort((a, b) => a.title.localeCompare(b.title));
}
