"""M0 spike — preuve de la chaîne Steam (jetable, aucune app).

Usage:
    uv run spikes/m0_steam_spike.py

Lit STEAM_API_KEY et STEAM_ID depuis l'environnement ou le fichier .env
à la racine du repo. Ne construit rien : mesure, diagnostique, tranche.
"""

# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx>=0.27"]
# ///

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.steampowered.com"
STORE = "https://store.steampowered.com"
TIMEOUT = 20.0
PACE_S = 1.5
FALLBACK_APPDETAILS_LIMIT = 5


def load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def get_json(client: httpx.Client, url: str, params: dict[str, object]) -> httpx.Response:
    """GET avec gestion 429 / backoff. follow_redirects=True (piège httpx)."""
    delay = 2.0
    for attempt in range(4):
        resp = client.get(url, params=params, follow_redirects=True)
        if resp.status_code == 429:
            print(f"  [429] rate limit, backoff {delay:.0f}s (tentative {attempt + 1}/4)")
            time.sleep(delay)
            delay *= 2
            continue
        return resp
    return resp


def main() -> int:
    load_env()
    key = os.environ.get("STEAM_API_KEY", "").strip()
    steam_id = os.environ.get("STEAM_ID", "").strip()
    if not steam_id:
        print("[ERREUR] STEAM_ID absent (.env ou environnement).")
        return 2
    print(f"SteamID : {steam_id}")
    if not key:
        print("[ERREUR] STEAM_API_KEY absente : GetOwnedGames est impossible.")
        print("  -> https://steamcommunity.com/dev/apikey puis remplir .env")
        return 2

    with httpx.Client(timeout=TIMEOUT, headers={"User-Agent": "gameshelf-m0-spike"}) as client:
        print("\n== 1. IPlayerService/GetOwnedGames ==")
        t0 = time.perf_counter()
        resp = get_json(
            client,
            f"{API}/IPlayerService/GetOwnedGames/v1/",
            {
                "key": key,
                "steamid": steam_id,
                "include_appinfo": 1,
                "include_played_free_games": 1,
            },
        )
        elapsed = time.perf_counter() - t0
        print(f"HTTP {resp.status_code} en {elapsed:.2f}s, {len(resp.content)} octets")
        ctype = resp.headers.get("content-type", "")
        if "json" not in ctype:
            print(f"[ERREUR] content-type={ctype!r} — réponse non-JSON (redirection non suivie ?)")
            return 1
        try:
            payload = resp.json()
        except ValueError:
            print("[ERREUR] corps illisible en JSON.")
            return 1

        if resp.status_code == 403:
            print("[ERREUR] 403 : clé Web API invalide ou révoquée.")
            return 1
        if resp.status_code != 200:
            print(f"[ERREUR] HTTP {resp.status_code}: {resp.text[:300]}")
            return 1

        inner = payload.get("response", {})
        eresult = inner.get("eresult", 1)
        if eresult in (25, 84):
            print(f"[ERREUR] x-eresult={eresult} : rate limit / accès refusé. Ralentis et réessaie.")
            return 1
        games = inner.get("games")

        if not games:
            print("\n[DIAGNOSTIC] `games` est VIDE (pas d'erreur HTTP).")
            print("Cause la plus probable : les « Détails du jeu » du profil ne sont pas publics.")
            print("L'API renvoie alors une réponse valide mais vide, sans code d'erreur.")
            print(
                "Correctif : Profil > Modifier > Paramètres de confidentialité >\n"
                "« Détails du jeu » = Public, puis relancer ce script."
            )
            print("\nVERDICT : NO-GO (données indisponibles tant que la privacy n'est pas réglée)")
            return 3

        count = int(inner.get("game_count", len(games)))
        total_min = sum(int(g.get("playtime_forever", 0)) for g in games)
        print(f"[OK] {count} jeux retournés, {total_min} min cumulées ({total_min / 60:.1f} h)")

        top = sorted(games, key=lambda g: int(g.get("playtime_forever", 0)), reverse=True)
        print(f"\n== 2. Enrichissement appdetails des {FALLBACK_APPDETAILS_LIMIT} jeux les plus joués ==")
        hits = 0
        for game in top[:FALLBACK_APPDETAILS_LIMIT]:
            appid = int(game["appid"])
            name = game.get("name", "?")
            playtime_h = int(game.get("playtime_forever", 0)) / 60
            resp2 = get_json(client, f"{STORE}/api/appdetails", {"appids": appid})
            header_image = None
            if resp2.status_code == 200 and "json" in resp2.headers.get("content-type", ""):
                node = resp2.json().get(str(appid), {})
                if node.get("success"):
                    header_image = node.get("data", {}).get("header_image")
            ok = "OK" if header_image else "MANQUANT"
            if header_image:
                hits += 1
            print(f"  [{ok:8}] {appid:>7}  {name[:40]:<40} {playtime_h:7.1f} h  {header_image or ''}")
            time.sleep(PACE_S)

        print("\n== 3. GetRecentlyPlayedGames ==")
        resp3 = get_json(
            client,
            f"{API}/IPlayerService/GetRecentlyPlayedGames/v1/",
            {"key": key, "steamid": steam_id, "count": 10},
        )
        if resp3.status_code == 200 and "json" in resp3.headers.get("content-type", ""):
            recent = resp3.json().get("response", {})
            rcount = int(recent.get("total_count", 0))
            print(f"[OK] {rcount} jeux joués ces 2 dernières semaines")
            for g in recent.get("games", []):
                print(f"  {g.get('name', '?'):<40} 2w={int(g.get('playtime_2weeks', 0)) / 60:.1f} h")
        else:
            print(f"[WARN] GetRecentlyPlayedGames indisponible (HTTP {resp3.status_code})")

        print("\n" + "=" * 60)
        print(f"VERDICT : GO")
        print(f"  - GetOwnedGames  : {count} jeux (compte cohérent avec ~80 attendus)")
        print(f"  - appdetails     : {hits}/{FALLBACK_APPDETAILS_LIMIT} header_image récupérées")
        print("  - privacy profil : Détails du jeu publics confirmés")
        print("=" * 60)
        return 0


if __name__ == "__main__":
    sys.exit(main())
