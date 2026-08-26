import { createRouter, createWebHistory } from "vue-router";
import SessionListView from "./views/SessionListView.vue";
import ChatView from "./views/ChatView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: SessionListView },
    { path: "/chat/:id", name: "chat", component: ChatView, props: true },
  ],
});

export default router;
