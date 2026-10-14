import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";
import { router } from "./router";

createApp(App).use(VueQueryPlugin).use(router).mount("#app");
