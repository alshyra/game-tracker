import { type OnlineTier, classifyOnline } from "../domain/online";
import type { SteamStorePort, StorePort } from "../domain/ports";

export interface DetectOnlineDeps {
  store: StorePort;
  steamStore: SteamStorePort;
}

export interface OnlineCandidate {
  key: string;
  appid: number;
  title: string;
  tier: OnlineTier;
  reasons: string[];
  alreadyOnline: boolean;
}

export interface DetectOnlineResult {
  applied: boolean;
  scanned: number;
  candidates: OnlineCandidate[];
  marked: number;
  mixed: number;
  failed: number;
}

export interface DetectOnlineOptions {
  apply?: boolean;
  /** Inclut les jeux solo+multi (tier `mixed`) dans l'application. */
  includeMixed?: boolean;
}

/**
 * Détecte les jeux en ligne via les métadonnées du magasin Steam. Ne marque
 * jamais rien silencieusement : la simulation liste les candidats, `--apply`
 * (éventuellement `--include-mixed`) écrit le champ local `online`.
 */
export async function detectOnline(
  deps: DetectOnlineDeps,
  options: DetectOnlineOptions = {},
): Promise<DetectOnlineResult> {
  const apply = options.apply ?? false;
  const includeMixed = options.includeMixed ?? false;

  const [snapshot, local] = await Promise.all([deps.store.readSnapshot(), deps.store.readLocal()]);
  const entries = snapshot?.entries ?? [];

  const candidates: OnlineCandidate[] = [];
  let failed = 0;

  for (const entry of entries) {
    let check: ReturnType<typeof classifyOnline>;
    try {
      const details = await deps.steamStore.fetchAppDetails(entry.appid);
      if (details.genres.length === 0 && details.categories.length === 0) {
        failed++;
        continue;
      }
      check = classifyOnline(details);
    } catch {
      failed++;
      continue;
    }

    if (check.online || check.tier === "mixed") {
      candidates.push({
        key: String(entry.appid),
        appid: entry.appid,
        title: entry.title,
        tier: check.tier,
        reasons: check.reasons,
        alreadyOnline: local.get(String(entry.appid))?.online ?? false,
      });
    }
  }

  const toMark = candidates.filter(
    (candidate) => !candidate.alreadyOnline && (candidate.tier !== "mixed" || includeMixed),
  );

  if (apply) {
    for (const candidate of toMark) {
      await deps.store.writeLocalFields(candidate.key, { online: true });
    }
  }

  return {
    applied: apply,
    scanned: entries.length,
    candidates,
    marked: apply ? toMark.length : 0,
    mixed: candidates.filter((candidate) => candidate.tier === "mixed").length,
    failed,
  };
}
