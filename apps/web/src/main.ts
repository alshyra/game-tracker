import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";

createApp(App).use(VueQueryPlugin).mount("#app");
