import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./style.css";
import { installHtmlFrameAutoResize } from "./utils/htmlFrame";
import { useTheme } from "./utils/theme";

useTheme().init();
installHtmlFrameAutoResize();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
