import type { CatalogEntry } from "../../domain/catalog";
import type { CatalogSourcePort } from "../../domain/catalogPorts";
import { slugify } from "../../domain/slug";
import type { FetchLike } from "../steam/client";

const BASE = "https://www.editions-soleil.fr";
const SITEMAP = `${BASE}/sitemap.xml`;
/** Dérivé webp déjà compressé (~530×733, ~80 Ko) servi par Drupal. */
const COVER_STYLE = "/sites/default/files/styles/image_list_retinafy_/public/product";
const UA = "gameshelf/0.1 (+https://gameshelf.alshyra.fr)";

type JsonLdNode = {
  "@type"?: string;
  name?: string;
  url?: string;
  description?: string;
  image?: { url?: string } | string;
  author?: { name?: string }[] | { name?: string };
  isbn?: string;
  datePublished?: string;
  numberOfPages?: number;
  publisher?: { name?: string };
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Extrait le nom de fichier produit (EAN) depuis une URL d'image Soleil. */
export function eanFromImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/product\/(\d+)\.(?:jpg|jpeg|png|webp)$/i);
  return match?.[1] ?? null;
}

/** Numéro de tome depuis un slug d'album (ex. `elfes-t11` → 11). */
export function tomeFromSlug(albumSlug: string): number | null {
  const match = albumSlug.match(/-t(\d+)(?:-|$)/i);
  return match?.[1] ? Number(match[1]) : null;
}

function parseJsonLdBook(html: string): JsonLdNode | null {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { "@graph"?: JsonLdNode[] } | JsonLdNode;
      const nodes =
        "@graph" in parsed && Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed as JsonLdNode];
      const book = nodes.find((n) => n["@type"] === "Book");
      if (book) return book;
    } catch {
      // bloc JSON-LD illisible → on continue
    }
  }
  return null;
}

function authorsOf(node: JsonLdNode): string[] {
  const list = Array.isArray(node.author) ? node.author : node.author ? [node.author] : [];
  return list
    .map((a) => asString(a?.name))
    .filter((name): name is string => name !== null)
    .map((name) => name.replace(/\s+/g, " ").trim());
}

export interface SoleilClientOptions {
  fetchImpl?: FetchLike;
  /** Délai poli entre deux requêtes (ms). */
  delayMs?: number;
  /** Nombre de tentatives supplémentaires en cas de 429/5xx ou de timeout. */
  retries?: number;
  /** Attente de base du backoff exponentiel (ms). */
  backoffMs?: number;
  /** Délai maximum par requête (ms) — évite un blocage sur une connexion qui traîne. */
  timeoutMs?: number;
}

/**
 * Catalogue Éditions Soleil : énumère les albums via `sitemap.xml`, puis extrait
 * les métadonnées du JSON-LD `schema.org/Book` de chaque page album. Les
 * couvertures sont servies par Drupal en webp déjà compressé.
 *
 * Le site est derrière un cache Varnish qui renvoie **429** quand on va trop
 * vite : chaque requête est espacée, bornée par un timeout, et réessayée avec un
 * backoff exponentiel.
 */
export class SoleilClient implements CatalogSourcePort {
  private readonly doFetch: FetchLike;
  private readonly delayMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly timeoutMs: number;
  private sitemapCache: string | null = null;

  constructor(options: SoleilClientOptions = {}) {
    this.doFetch = options.fetchImpl ?? fetch;
    this.delayMs = options.delayMs ?? 400;
    this.retries = options.retries ?? 4;
    this.backoffMs = options.backoffMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async sleep(ms: number): Promise<void> {
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }

  /** Requête GET : espacement + timeout + retry/backoff sur 429, 5xx et erreurs. */
  private async get(url: string): Promise<Response> {
    let last: Response | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      await this.sleep(this.delayMs);
      let res: Response;
      try {
        res = await this.doFetch(url, {
          redirect: "follow",
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        // erreur réseau / timeout → backoff puis retry
        await this.sleep(this.backoffMs * 2 ** attempt);
        continue;
      }
      if (res.status !== 429 && res.status < 500) return res;
      last = res;
      const retryAfter = Number(res.headers.get("retry-after") ?? "");
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : this.backoffMs * 2 ** attempt;
      await this.sleep(wait);
    }
    return last ?? new Response(null, { status: 503 });
  }

  private async loadSitemap(): Promise<string> {
    if (this.sitemapCache !== null) return this.sitemapCache;
    const res = await this.get(SITEMAP);
    this.sitemapCache = res.ok ? await res.text() : "";
    return this.sitemapCache;
  }

  async listSeriesAlbums(seriesSlug: string): Promise<string[]> {
    const xml = await this.loadSitemap();
    if (!xml) return [];
    const prefix = `/series/serie-${seriesSlug}/album-`;
    const urls = new Set<string>();
    const re = /<loc>([^<]+)<\/loc>/g;
    for (const match of xml.matchAll(re)) {
      const loc = match[1];
      if (!loc || !loc.includes(prefix)) continue;
      urls.add(loc.trim());
    }
    return [...urls];
  }

  async fetchAlbum(url: string): Promise<CatalogEntry | null> {
    const res = await this.get(url);
    if (!res.ok) return null;
    const html = await res.text();
    const book = parseJsonLdBook(html);
    if (!book) return null;

    const title = asString(book.name);
    if (!title) return null;

    const albumSlug = url.split("/album-")[1] ?? "";
    const seriesSlug = url.match(/\/serie-([a-z0-9-]+)\//)?.[1] ?? "";
    const tome = tomeFromSlug(albumSlug);

    const imageUrl =
      typeof book.image === "string" ? book.image : (asString(book.image?.url) ?? null);
    const ean = eanFromImageUrl(imageUrl);
    const cover_url = ean ? `/covers/${ean}.webp` : null;

    const year = book.datePublished ? Number(book.datePublished.slice(0, 4)) : null;
    const key = tome
      ? `soleil:${slugify(seriesSlug)}-t${String(tome).padStart(2, "0")}`
      : `soleil:${slugify(albumSlug)}`;

    return {
      key,
      series: seriesSlug,
      series_slug: seriesSlug,
      collection: null,
      tome,
      title,
      authors: authorsOf(book),
      isbn: asString(book.isbn),
      year: year !== null && Number.isFinite(year) ? year : null,
      pages: typeof book.numberOfPages === "number" ? book.numberOfPages : null,
      publisher: asString(book.publisher?.name),
      cover_url,
      description: asString(book.description),
      url,
      source: "soleil",
    };
  }

  /** Télécharge le dérivé webp compressé de la couverture (par EAN). */
  async fetchCover(ean: string): Promise<Uint8Array | null> {
    if (!/^\d+$/.test(ean)) return null;
    const res = await this.get(`${BASE}${COVER_STYLE}/${ean}.webp`);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("image")) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
}
