import type { Source } from "./game";
import type { Status } from "./status";

/** Erreurs métier remontées par les adapters, traduites en messages clairs par l'UI. */
export class SteamPrivacyError extends Error {
  constructor() {
    super(
      "La bibliothèque Steam est vide : les « Détails du jeu » du profil ne sont pas publics. " +
        "Profil > Modifier > Paramètres de confidentialité > « Détails du jeu » = Public.",
    );
    this.name = "SteamPrivacyError";
  }
}

export class SteamAuthError extends Error {
  constructor(message = "Clé Web API Steam invalide ou refusée.") {
    super(message);
    this.name = "SteamAuthError";
  }
}

export class SteamRateLimitError extends Error {
  constructor(
    message = "Steam limite les requêtes (429 / x-eresult 25 ou 84). Réessaie plus tard.",
  ) {
    super(message);
    this.name = "SteamRateLimitError";
  }
}

/** Données brutes issues de Steam, avant fusion avec le local. */
export interface LibraryEntry {
  appid: number;
  title: string;
  header_url: string | null;
  cover_url: string | null;
  playtime_forever_min: number;
  playtime_2weeks_min: number | null;
  last_played_at: string | null;
}

export interface Snapshot {
  fetched_at: string;
  entries: LibraryEntry[];
}

/** Champs locaux : écrits par l'utilisateur, jamais écrasés par l'API. */
export interface LocalRecord {
  key: string;
  steam_appid: number | null;
  title: string | null;
  cover_url: string | null;
  header_url: string | null;
  status: Status;
  rating: number | null;
  notes: string | null;
  source: Source;
  online: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export type LocalPatch = Partial<
  Pick<LocalRecord, "title" | "cover_url" | "header_url" | "status" | "rating" | "notes" | "online">
>;

export interface SteamPort {
  fetchLibrary(): Promise<LibraryEntry[]>;
}

/** Métadonnées publiques du magasin (aucune clé requise). */
export interface AppDetails {
  genres: string[];
  categories: string[];
  release_date: string | null;
}

export interface SteamStorePort {
  fetchAppDetails(appid: number): Promise<AppDetails>;
}

export interface StorePort {
  readLocal(): Promise<Map<string, LocalRecord>>;
  writeLocalFields(key: string, patch: LocalPatch): Promise<void>;
  readSnapshot(): Promise<Snapshot | null>;
  writeSnapshot(snapshot: Snapshot): Promise<void>;
}
