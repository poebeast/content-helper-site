// Claude settings of this browser. Separate from ai.js so the settings dialog opens without loading the SDK.
// mode "pro": requests go through the claude.ai chat (Claude Pro subscription, copy → paste);
// mode "api": straight to the API with the participant's own key and model.
export const MODELS = { "claude-opus-5-5": "Claude Opus 5.5 — лучше тексты", "claude-sonnet-5-5": "Claude Sonnet 5.5 — быстрее и дешевле" };
const GH = "content-helper:github-token";
const KEY = "content-helper:anthropic-key", MODEL = "content-helper:model", MODE = "content-helper:ai-mode", CHAT = "content-helper:chat-url";
const get = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
export const DEFAULT_CHAT = "https://claude.ai/new";
export const settings = {
  key: () => get(KEY), setKey: (v) => put(KEY, (v || "").trim()),
  model: () => get(MODEL) || "claude-opus-5-5", setModel: (v) => put(MODEL, v),
  // GitHub token for "Save to repo" (github.js): sent only to api.github.com
  ghToken: () => get(GH), setGhToken: (v) => put(GH, (v || "").trim()),
  mode: () => get(MODE) || (get(KEY) ? "api" : "pro"), setMode: (v) => put(MODE, v),
  // where "Open Claude" leads: a new chat, or the team's Claude project
  chat: () => get(CHAT) || DEFAULT_CHAT, setChat: (v) => put(CHAT, /^https:\/\/claude\.ai\//.test((v || "").trim()) ? v.trim() : ""),
};
export const useApi = () => settings.mode() === "api";
