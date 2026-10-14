import { createRouter, createWebHashHistory } from "vue-router";
import Landing from "./views/Landing.vue";
import Library from "./views/Library.vue";
import Tracker from "./views/Tracker.vue";
import Wishlist from "./views/Wishlist.vue";

/**
 * Hash history : aucune config serveur requise (le conteneur sert la SPA
 * statique), et les routes restent partageables (`/#/wishlist`).
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "landing", component: Landing },
    { path: "/wishlist", name: "wishlist", component: Wishlist },
    { path: "/app", name: "app", component: Tracker },
    { path: "/library", name: "library", component: Library },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
