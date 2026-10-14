import { ref } from "vue";

/** État d'auth partagé (SSO Authentik via forward-auth). */
const isAuthenticated = ref(false);
const checked = ref(false);

/**
 * Détecte l'état de connexion. `/api/auth/check` est protégé par Authentik :
 * non connecté → redirection (opaque en `redirect: "manual"`) ; connecté → 200 JSON.
 */
async function refresh(): Promise<void> {
  try {
    const res = await fetch("/api/auth/check", { redirect: "manual" });
    if (res.ok) {
      const data = (await res.json()) as { authenticated?: boolean };
      isAuthenticated.value = data.authenticated ?? false;
    } else {
      isAuthenticated.value = false;
    }
  } catch {
    isAuthenticated.value = false;
  }
  checked.value = true;
}

/** Lance le flow SSO Authentik puis revient sur le tracker. */
function login(): void {
  window.location.href = "/api/auth/check?redirect=/app";
}

export function useAuth() {
  async function ensure(): Promise<void> {
    if (!checked.value) await refresh();
  }
  return { isAuthenticated, checked, refresh, ensure, login };
}
