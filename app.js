import { TYPES, GAMES, METHODS, TEMPLATE, GREEN, ORANGE, toHtml, toText, check, toMd, parseFaq, faqTitle } from "./rules.js?v=127df33a";
import { USERS, userById } from "./users.js?v=127df33a";
import { BRIEF_FIELDS, ARCHETYPES, SEGMENTS, SEGMENT_RENAMES, briefChecks, briefMd, suggestKeywords } from "./brief.js?v=127df33a";
import { MODELS, settings, useApi, DEFAULT_CHAT } from "./ai-settings.js?v=127df33a";
import { chatPrompt, composePrompt, composeBoxes as boxesFromAnswer, regenPrompt, regenVariants, factPrompt, factResult, factField, readJson } from "./prompts.js?v=127df33a";
import { DOCS } from "./docs.js?v=127df33a";
import { faqCandidates, lines as listLines } from "./faq.js?v=127df33a";
import { saveOffer, explainGithub, REPO } from "./github.js?v=127df33a";

const root = document.getElementById("app");
const ME = "content-helper:user";
const draftKey = (user, id) => `content-helper:${user}:draft:${id}`; // drafts are per user, so teammates on one machine don't clash
const lastKey = (user) => `content-helper:${user}:last`; // the offer the user opened last — "Продолжить" on the home page
const hiddenKey = (user) => `content-helper:${user}:hidden`; // repository offers the user removed from their list
const sentKey = (user, id) => `content-helper:${user}:sent:${id}`; // fields copied for the admin, marked ✓ until their text changes
let OFFERS = [];

// ---------- storage ----------
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};
const me = () => userById(ls.get(ME));
const drafts = (user) => ls.keys().filter((k) => k.startsWith(`content-helper:${user}:draft:`)).map((k) => ({ id: k.split(":draft:")[1], ...ls.get(k) }));
const hidden = () => (me() && ls.get(hiddenKey(me().id))) || [];

// ---------- tiny DOM helper ----------
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};
const ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11M14.5 11.5v6M11.5 14.5h6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4m0 0-4 4m4-4 4 4"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
};
const ai = () => import("./ai.js?v=127df33a"); // loads the Anthropic SDK only when someone generates
const explainError = async (e) => { if (e.message === "CANCELLED") return ""; if (!useApi()) return "Не получилось: " + e.message; const m = await ai().catch(() => null); return m ? m.explain(e) : "Не удалось загрузить модуль генерации (нет связи с cdn.jsdelivr.net)."; };

// then: the action that needed Claude (Build offer, Regenerate, Fact check) — it runs right after saving.
function aiSettingsDialog(then) {
  if (typeof then !== "function") then = null;
  let mode = settings.mode();
  const key = h("input", { type: "password", placeholder: "sk-ant-…", value: settings.key(), autocomplete: "off" });
  const model = h("select", {}, Object.entries(MODELS).map(([k, v]) => h("option", { value: k, selected: settings.model() === k }, v)));
  const chat = h("input", { placeholder: DEFAULT_CHAT, value: settings.chat() === DEFAULT_CHAT ? "" : settings.chat() });
  const pro = h("div", {},
    h("p", { class: "hint" }, "Достаточно подписки Claude Pro. Content-helper готовит запрос, вы вставляете его в чат claude.ai и возвращаете ответ — поля заполняются и проверяются сами. Ключ API не нужен, сверх подписки ничего не платится."),
    h("label", {}, "Куда ведёт «Open Claude» — ссылка на проект команды в Claude (необязательно)"), chat,
    h("p", { class: "mini" }, "Проект «Overgear offers» на claude.ai держит все чаты по офферам в одном месте. Как его завести — в «Под капотом» → «Работа по подписке Claude Pro»."));
  const api = h("div", {},
    h("p", { class: "hint" }, "Кнопки работают сами, без копирования. Ключ API Anthropic хранится только в этом браузере и отправляется только на api.anthropic.com. Это отдельный счёт от подписки: ключ создаётся на ",
      h("a", { href: "https://console.anthropic.com/settings/keys", target: "_blank", rel: "noopener" }, "console.anthropic.com"),
      ", баланс пополняется заранее. Ориентир на Opus 5.5: сборка оффера ≈ $0.2–0.4, перегенерация поля ≈ $0.05–0.1."),
    h("label", {}, "Ключ API"), key,
    h("label", {}, "Модель"), model,
    settings.key() ? h("button", { class: "btn", style: { marginTop: "10px" }, onclick: () => { settings.setKey(""); key.value = ""; toast("Ключ удалён из браузера"); } }, ic("trash"), "Удалить ключ") : null);
  const gh = h("input", { type: "password", placeholder: "github_pat_…", value: settings.ghToken(), autocomplete: "off" });
  const ghBox = h("div", { class: "gh-box" },
    h("label", {}, "GitHub — для «Save to repo»"), gh,
    h("p", { class: "hint" }, "Токен хранится только в этом браузере и уходит только на api.github.com. Создайте fine-grained токен на ",
      h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "github.com → Settings → Fine-grained tokens"),
      `: Repository access — только ${REPO}; Permissions — Contents и Pull requests: Read and write. Если вы не владелец репозитория, а приглашённый участник, fine-grained токен его не увидит — создайте classic token со scope «repo» (github.com → Settings → Tokens (classic)). Доступ к приватному репозиторию даёт его владелец.`));
  const show = () => { pro.hidden = mode !== "pro"; api.hidden = mode !== "api"; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode)); };
  const seg = h("div", { class: "seg", style: { width: "100%" } },
    h("button", { "data-mode": "pro", style: { flex: 1 }, onclick: () => { mode = "pro"; show(); } }, "Claude Pro — через чат"),
    h("button", { "data-mode": "api", style: { flex: 1 }, onclick: () => { mode = "api"; show(); } }, "API-ключ"));
  const dlg = h("dialog", {},
    dlgHead(then && mode === "api" ? "Вставить API-ключ" : "Настройки ИИ"),
    then ? h("p", { class: "banner info" }, "Для этого действия нужен Claude: вставьте ключ API или выберите работу через чат по подписке Claude Pro.") : null,
    seg, pro, api, ghBox,
    h("div", { class: "row", style: { justifyContent: "flex-end", marginTop: "18px" } },
      h("button", { class: "btn", onclick: () => dlg.close() }, "Отмена"),
      h("button", { class: "btn primary", onclick: () => {
        settings.setMode(mode); settings.setChat(chat.value); settings.setGhToken(gh.value);
        if (mode === "api") { settings.setKey(key.value); settings.setModel(model.value); }
        dlg.close(); toast("Сохранено");
        if (!then) route(); // with a pending action the page stays as it is, the action continues on it
        if (then && !needsKey()) then();
      } }, "Сохранить")));
  show();
  requestAnimationFrame(() => (mode === "api" ? key : chat).focus());
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}
// Overgear offer badges. "new" copies the site's own "New Offer" badge (#3cb9ff, sparkle icon);
// "rework" has no site counterpart, so it keeps the same shape in the brand violet with a refresh icon.
const STATUS = {
  new: { label: "New", title: "Новый оффер", icon: '<svg viewBox="0 0 16 16"><path d="M6.46955 4.1458C6.52914 3.95162 6.80403 3.95162 6.86363 4.1458L8.00354 7.85998C8.02359 7.92533 8.07475 7.97649 8.1401 7.99655L11.8543 9.13646C12.0485 9.19605 12.0485 9.47094 11.8543 9.53054L8.1401 10.6704C8.07475 10.6905 8.02359 10.7417 8.00354 10.807L6.86363 14.5212C6.80403 14.7154 6.52914 14.7154 6.46955 14.5212L5.32964 10.807C5.30958 10.7417 5.25842 10.6905 5.19307 10.6704L1.47889 9.53054C1.28471 9.47094 1.28471 9.19605 1.47889 9.13646L5.19307 7.99655C5.25842 7.97649 5.30958 7.92533 5.32964 7.85998L6.46955 4.1458Z" fill="currentColor"/><path d="M11.9014 1.40632C11.9312 1.30922 12.0686 1.30922 12.0984 1.40632L12.6684 3.2634C12.6784 3.29608 12.704 3.32166 12.7367 3.33169L14.5938 3.90164C14.6909 3.93144 14.6909 4.06888 14.5938 4.09868L12.7367 4.66864C12.704 4.67867 12.6784 4.70425 12.6684 4.73692L12.0984 6.59401C12.0686 6.6911 11.9312 6.6911 11.9014 6.59401L11.3314 4.73692C11.3214 4.70425 11.2958 4.67867 11.2632 4.66864L9.40607 4.09868C9.30898 4.06888 9.30898 3.93144 9.40607 3.90164L11.2632 3.33169C11.2958 3.32166 11.3214 3.29608 11.3314 3.2634L11.9014 1.40632Z" fill="currentColor"/></svg>' },
  rework: { label: "Rework", title: "Переделка существующего оффера", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 6.5A5.5 5.5 0 0 0 3.2 4.8M2.5 9.5a5.5 5.5 0 0 0 10.3 1.7"/><path d="M3 2.5v2.6h2.6M13 13.5v-2.6h-2.6"/></svg>' },
};
const statusBadge = (s, small = false) => (STATUS[s] ? h("span", { class: `og-badge ${s}${small ? " sm" : ""}`, title: STATUS[s].title }, h("i", { html: STATUS[s].icon }), STATUS[s].label) : null);
const ic = (name) => h("span", { html: ICON[name], style: { display: "inline-flex" } });
// Dialog title with a close cross that stays at the top while a long dialog scrolls.
const dlgHead = (title) => h("div", { class: "dlg-head" }, h("h2", {}, title),
  h("button", { class: "btn icon dlg-x", title: "Закрыть", "aria-label": "Закрыть", onclick: (e) => e.currentTarget.closest("dialog").close() }, ic("x")));
const avatar = (u, size = 24) => h("span", { title: u ? "Собирает: " + u.name : "никто не собирает", style: { width: size + "px", height: size + "px", borderRadius: "50%", flex: "none", display: "inline-grid", placeItems: "center", fontSize: size * 0.45 + "px", fontWeight: 700, color: "#07081a", background: u ? u.color : "#2e3568" } }, u ? u.name[0] : "?");
const gameName = (g) => (GAMES[g] || [g, g, g])[2];
const accentColor = (b) => (b.accent === "orange" ? ORANGE : GREEN);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Inside the offer everything is named in English, like the admin.
const NAME_EN = { "card-preview": "UVP preview", "usp-title": "UVP", "usp-tooltips": "Tooltips", "hero": "Hero line", "description": "Description", "h1": "H1", "page-title": "Meta title", "meta-description": "Meta description", "seo-footer": "SEO footer", "faq": "FAQ", "requirements": "Requirements", "feed-subtitle": "Feed subtitle", "feed-description": "Feed description" };
const SECTION_EN = { "Карточка в каталоге": "Catalog card", "UVP и тултипы": "UVP & tooltips", "Hero и Description": "Hero & Description", "Requirements": "Requirements", "H1, meta": "H1 & meta tags", "SEO-футер": "SEO footer", "FAQ": "FAQ", "Фид": "Feed" };
const METHOD_EN = { "self-play": "Self-play only", "piloted": "Piloted only", "both": "Self-play & Piloted" };
const nameEn = (kind) => NAME_EN[kind] || TYPES[kind][0];
const boxName = (b) => nameEn(b.kind) + (b.label ? " · " + b.label : "");
// Template lines ("### Your wins", "Q: ", "1. ") are scaffolding, not copy.
const hasCopy = (boxes) => boxes.some((b) => b.lines.some((l) => l.trim() && !/^(#{2,3}( .*)?|[QA]:|\d+\.)$/.test(l.trim())));

let toastTimer;
function toast(msg, bad = false) {
  let t = document.querySelector(".toast");
  if (!t) { t = h("div", { class: "toast" }); document.body.append(t); }
  t.textContent = msg; t.classList.toggle("bad", bad); t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}

// Clipboard: the copy event carries exactly our HTML and text, so no page styles leak into the admin editor.
async function copy(html, text, plainOnly, what) {
  let ok = false;
  const onCopy = (e) => { e.clipboardData.setData("text/plain", text); if (!plainOnly) e.clipboardData.setData("text/html", html); e.preventDefault(); ok = true; };
  document.addEventListener("copy", onCopy);
  try { document.execCommand("copy"); } catch {}
  document.removeEventListener("copy", onCopy);
  if (!ok) {
    try {
      if (plainOnly) await navigator.clipboard.writeText(text);
      else await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      ok = true;
    } catch {}
  }
  toast(ok ? `Скопировано: ${what}` : "Не удалось скопировать", !ok);
  return ok;
}

// ---------- offers ----------
function load(id) {
  const u = me();
  const d = u && ls.get(draftKey(u.id, id));
  return d || OFFERS.find((o) => o.id === id) || null;
}
function allOffers() {
  const u = me(), gone = hidden();
  const list = OFFERS.filter((o) => !gone.includes(o.id)).map((o) => ({ ...(u && ls.get(draftKey(u.id, o.id)) || o), id: o.id, inRepo: true, hasDraft: !!(u && ls.get(draftKey(u.id, o.id))) }));
  if (u) for (const d of drafts(u.id)) if (!OFFERS.find((o) => o.id === d.id)) list.push({ ...d, inRepo: false, hasDraft: true });
  return list;
}
// Rule checks plus brief checks, per box.
function review(o) {
  const r = check(o.boxes, o.game, o.method), bc = briefChecks(o);
  r.boxes.forEach((b, i) => { b.warn.push(...(bc.box[i] || [])); b.note.push(...(bc.notes[i] || [])); });
  const page = [...r.page, ...bc.page];
  if (!o.method) page.unshift("Выберите способ: от него зависят проверки текстов и пункты Requirements");
  // Fact check results: a wrong or outdated claim is an issue of its field while the claim is still in the text.
  const fc = o.factCheck;
  if (fc) {
    for (const f of fc.findings || []) {
      if (!["wrong", "outdated"].includes(f.verdict) || !f.claim) continue;
      const i = o.boxes.findIndex((b) => factField(b) === f.field && toText(b.kind, b.lines, o.method).toLowerCase().includes(f.claim.toLowerCase()));
      if (i >= 0) r.boxes[i].warn.push(`факт: «${f.claim}» — ${f.verdict === "outdated" ? "устарело" : "неверно"}: ${f.fix}`);
    }
    const cur = (fc.league || {}).current, league = (o.brief || {}).league || "";
    if (cur && league && !league.toLowerCase().includes(cur.toLowerCase())) page.push(`Актуальная лига — ${cur}${fc.league.patch ? " (" + fc.league.patch + ")" : ""}, а в брифе «${league}»`);
  }
  return { boxes: r.boxes, page };
}
// Field name as Claude sees it in the offer context (ai.js), to match fact-check findings back to fields.
// factField (prompts.js): the field name as Claude sees it, to match fact-check findings back to fields.
const problems = (o) => { const r = review(o); return r.boxes.reduce((a, b) => a + b.warn.length, 0) + r.page.length; };
// Editor rows: one field, or a UVP title together with its tooltips.
function units(boxes) {
  const out = [];
  boxes.forEach((b, i) => {
    if (b.kind === "usp-tooltips" && boxes[i - 1]?.kind === "usp-title") return;
    out.push(b.kind === "usp-title" && boxes[i + 1]?.kind === "usp-tooltips" ? [i, i + 1] : [i]);
  });
  return out;
}
const badUnits = (o) => { const r = review(o); return units(o.boxes).filter((u) => u.some((i) => r.boxes[i].warn.length)).map((u) => boxName(o.boxes[u[0]])); };
function exportMd(o) {
  let md = toMd(o.title, o.boxes, o.method);
  if (o.owner) md = md.replace(/^(# [^\n]+\n)/, `$1\n<!-- content-helper: owner=${o.owner} -->\n`);
  if (o.status) md = md.replace(/^(# [^\n]+\n)/, `$1\n<!-- content-helper: status=${o.status} -->\n`);
  const brief = briefMd(o);
  if (brief) md = md.replace(/\n## /, `\n${brief}\n## `);
  return md;
}
const templateBoxes = () => TEMPLATE.map(([section, kind, label, lines]) => ({ kind, label, section, accent: "green", lines: [...lines] }));
// Claude in one of two ways: the API with the participant's own key, or the claude.ai chat on a Claude Pro
// subscription (relay: the request is copied into the chat, the answer is pasted back).
const needsKey = () => useApi() && !settings.key();
const AI = {
  compose: (offer) => (useApi() ? ai().then((m) => m.composeOffer(offer)) : relay("compose", composePrompt(offer), (t) => boxesFromAnswer(readJson(t), offer))),
  regenerate: (offer, target, feedback) => {
    const isUvp = target.kind === "uvp";
    return useApi() ? ai().then((m) => m.regenerate(offer, target, feedback)) : relay(isUvp ? "uvp" : "lines", regenPrompt(offer, target, feedback), (t) => regenVariants(readJson(t), isUvp));
  },
  facts: (offer) => (useApi() ? ai().then((m) => m.factCheck(offer)) : relay("facts", factPrompt(offer), factResult)),
};

// Claude Pro relay: 1) copy the request, 2) send it in the claude.ai chat, 3) paste the answer back.
// Resolves with the parsed answer; a closed window rejects with CANCELLED (callers stay quiet then).
function relay(kind, user, parse) {
  const prompt = chatPrompt(kind, user);
  const TITLE = { compose: "Build offer", lines: "Regenerate", uvp: "Regenerate", facts: "Fact check" }[kind];
  return new Promise((resolve, reject) => {
    let done = false;
    const answer = h("textarea", { class: "plain relay-answer", placeholder: "Вставьте сюда ответ Claude целиком (Ctrl+V)" });
    const err = h("div", { class: "compose-status" });
    const apply = () => {
      try {
        const out = parse(answer.value);
        done = true; dlg.close(); resolve(out);
      } catch (e) {
        err.className = "compose-status warn";
        err.textContent = e instanceof SyntaxError || e.message === "EMPTY" ? "В ответе не нашёлся блок JSON — скопируйте ответ Claude целиком кнопкой Copy под ним." : "Не получилось разобрать ответ: " + e.message;
      }
    };
    const dlg = h("dialog", { class: "wide relay" },
      dlgHead(`${TITLE} · Claude Pro`),
      h("ol", { class: "relay-steps" },
        h("li", {}, h("b", {}, "Скопируйте запрос."), " В нём правила Overgear, бриф, эталон и все поля оффера.",
          h("div", { class: "row" }, h("button", { class: "btn primary", onclick: () => copy("", prompt, true, "запрос для Claude") }, ic("copy"), "Copy prompt"), h("span", { class: "mini" }, `${(prompt.length / 1000).toFixed(1)} тыс. символов`))),
        h("li", {}, h("b", {}, "Вставьте его в чат Claude и отправьте."), kind === "facts" ? " Перед отправкой включите в чате веб-поиск — без него лигу и механики не проверить." : " Удобнее в проекте команды — все чаты по офферам в одном месте.",
          h("div", { class: "row" }, h("a", { class: "btn", href: settings.chat(), target: "_blank", rel: "noopener" }, "Open Claude ↗"))),
        h("li", {}, h("b", {}, "Скопируйте ответ Claude"), " (кнопка Copy под ответом) и вставьте сюда — тексты сами встанут в поля и пройдут проверку.", answer)),
      err,
      h("div", { class: "row dlg-foot", style: { justifyContent: "flex-end" } }, h("button", { class: "btn", onclick: () => dlg.close() }, "Cancel"), h("button", { class: "btn primary", onclick: apply }, "Apply answer")));
    // Settle on every way out (Apply, Cancel, ×, Esc) without waiting for the async "close" event.
    let settled = false;
    const finish = () => { if (settled) return; settled = true; dlg.remove(); if (!done) reject(new Error("CANCELLED")); };
    const nativeClose = dlg.close.bind(dlg);
    dlg.close = () => { nativeClose(); finish(); };
    dlg.addEventListener("cancel", finish);
    dlg.addEventListener("close", finish);
    document.body.append(dlg);
    dlg.showModal();
  });
}

function duplicateOffer(o) {
  const u = me();
  if (!u) return pickUser();
  const src = structuredClone(load(o.id) || o);
  const id = `new:${src.game}/${(src.slug || "offer").replace(/-copy-\w+$/, "")}-copy-${Date.now().toString(36).slice(-4)}`;
  delete src.inRepo; delete src.hasDraft;
  ls.set(draftKey(u.id, id), { ...src, id, slug: id.split("/")[1], title: `${src.title} (copy)`, status: "new", owner: u.id });
  toast("Копия создана — она хранится в этом браузере");
  location.hash = `#/offer/${encodeURIComponent(id)}`;
}
function deleteOffer(o) {
  const u = me();
  if (!u) return pickUser();
  const inRepo = OFFERS.some((x) => x.id === o.id);
  if (!inRepo) {
    if (!confirm(`Удалить «${o.title}»?\n\nНовый оффер хранится только в этом браузере — вернуть его будет нельзя.`)) return;
    ls.del(draftKey(u.id, o.id));
  } else {
    if (!confirm(`Убрать «${o.title}» из вашего списка?\n\nВаши правки в браузере удалятся. Файл оффера останется в репозитории — удалить его оттуда можно через Claude в папке overgear-content. Вернуть оффер в список — ссылка на главной.`)) return;
    ls.del(draftKey(u.id, o.id));
    ls.set(hiddenKey(u.id), [...new Set([...hidden(), o.id])]);
  }
  toast("Оффер удалён");
  if (location.hash === "#/" || location.hash.startsWith("#/u/")) route(); else location.hash = "#/";
}
// Copy / delete icons for offer tiles and list rows (inside links, so they stop the navigation).
const offerActions = (o) => h("span", { class: "row offer-actions" },
  h("button", { class: "btn icon ghost", title: "Копировать оффер", onclick: (e) => { e.preventDefault(); e.stopPropagation(); duplicateOffer(o); } }, ic("dup")),
  h("button", { class: "btn icon ghost", title: "Удалить оффер", onclick: (e) => { e.preventDefault(); e.stopPropagation(); deleteOffer(o); } }, ic("trash")));

// ---------- layout ----------
function shell(active, main) {
  const u = me();
  const q = h("input", { class: "search", placeholder: "Поиск оффера", oninput: () => build(q.value) });
  const nav = h("nav", { class: "nav" });
  const build = (term = "") => {
    const t = term.toLowerCase(), list = allOffers().filter((o) => !t || o.title.toLowerCase().includes(t));
    const byGame = {};
    for (const o of list) (byGame[o.game] ||= []).push(o);
    nav.replaceChildren(...[
      u ? h("a", { href: `#/u/${u.id}`, class: active === `u:${u.id}` ? "on" : "" }, avatar(u, 20), h("span", {}, "Главная")) : null,
      h("a", { href: "#/all", class: active === "all" ? "on" : "" }, h("span", { class: "nav-ic" }, "▤"), h("span", {}, "Все офферы")),
      h("h6", {}, "Команда"),
      USERS.map((x) => h("a", { href: `#/u/${x.id}`, class: active === `u:${x.id}` ? "on" : "" }, avatar(x, 20), h("span", {}, x.name), h("span", { class: "mini" }, String(allOffers().filter((o) => o.owner === x.id).length)))),
      Object.keys(byGame).map((g) => [h("h6", {}, gameName(g)), byGame[g].map((o) => {
        const n = problems(o);
        return h("a", { href: `#/offer/${encodeURIComponent(o.id)}`, class: active === o.id ? "on" : "" },
          h("i", { class: `dot ${n ? "warn" : ""}`, title: n ? `${n} замечаний` : "правила пройдены" }),
          h("span", {}, o.title.replace(/^PoE 2 — |^PoE — /, "")),
          statusBadge(o.status, true),
          o.hasDraft ? h("span", { class: "mini draft", title: o.inRepo ? "есть правки в браузере" : "только в этом браузере" }, "●") : null);
      })]),
    ].flat(Infinity).filter(Boolean));
  };
  build();
  const side = h("aside", { class: "side" },
    h("a", { class: "logo", href: "#/" }, h("img", { class: "wm", src: "og-logo.svg", alt: "Overgear", width: 118, height: 26 }), h("img", { class: "ink", src: "og-logo-ink.svg", alt: "Overgear", width: 118, height: 26 }), h("small", {}, "Content-helper · конструктор офферов")),
    h("div", { class: "side-tools" }, q, h("button", { class: "btn primary icon", title: "Новый оффер", onclick: newOfferDialog }, ic("plus"))),
    h("div", { style: { padding: "0 14px 6px" } },
      h("label", { class: "mini", style: { display: "block", marginBottom: "4px" } }, "Кто я"),
      h("select", { class: "mini-select", style: { width: "100%" }, onchange: (e) => { ls.set(ME, e.target.value); location.hash = `#/u/${e.target.value}`; } },
        h("option", { value: "", disabled: true, selected: !u }, "выберите себя"),
        USERS.map((x) => h("option", { value: x.id, selected: u && u.id === x.id }, x.name)))),
    nav,
    h("div", { style: { padding: "10px 14px", borderTop: "1px solid var(--line)" } },
      h("button", { class: "btn", style: { width: "100%", justifyContent: "center" }, onclick: aiSettingsDialog }, "✦ Настройки ИИ", h("span", { class: "mini" }, useApi() ? (settings.key() ? "· API" : "· нет ключа") : "· Claude Pro"))));
  const burger = h("button", { class: "btn icon burger", onclick: () => side.classList.toggle("open") }, ic("menu"));
  const how = h("a", { class: `btn how-btn ${active === "how" ? "on" : ""}`, href: "#/how", title: "Как устроен Content-helper и чем он руководствуется" }, "Под капотом");
  root.replaceChildren(h("div", { class: "shell" }, side, h("section", { class: "main", onclick: (e) => { if (!e.target.closest(".burger")) side.classList.remove("open"); } }, main(burger))), how);
}

// "Под капотом": theses on how the tool is built and how it decides on the offer copy (app/docs.js).
function docsPage() {
  const md = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  shell("how", (burger) => h("div", {},
    h("div", { class: "head", style: { paddingBottom: "16px" } },
      h("div", { class: "row" }, burger, h("span", { class: "crumbs" }, "Content-helper")),
      h("div", { class: "title-row", style: { marginBottom: 0 } }, h("div", { class: "page-title" }, "Под капотом"))),
    h("div", { class: "content docs" },
      // Contents on the left, stays in view while the page scrolls; the section in view is highlighted.
      h("nav", { class: "docs-toc" }, h("div", { class: "mini" }, "Разделы"), h("ul", {}, DOCS.map(([t], n) => h("li", {},
        h("a", { href: "#", "data-n": n, class: n ? "" : "on", onclick: (e) => { e.preventDefault(); document.getElementById("d" + n).scrollIntoView({ block: "start" }); } }, t))))),
      h("div", { class: "docs-body" }, DOCS.map(([title, items], n) => h("section", { id: "d" + n }, h("h2", {}, title), h("ul", {}, items.map((t) => h("li", { html: md(t) })))))))));
  const main = document.querySelector(".main"), links = [...document.querySelectorAll(".docs-toc a")];
  main.addEventListener("scroll", () => {
    const atEnd = main.scrollTop + main.clientHeight >= main.scrollHeight - 4;
    let on = 0;
    DOCS.forEach((_, n) => { if (document.getElementById("d" + n).getBoundingClientRect().top < 160) on = n; });
    if (atEnd) on = DOCS.length - 1;
    links.forEach((a) => a.classList.toggle("on", +a.dataset.n === on));
  });
}

// ---------- pages ----------
function pickUser() {
  shell("", () => h("div", { class: "empty" }, h("div", {},
    h("h1", {}, "Кто вы?"),
    h("p", {}, "Выберите себя — откроется ваша главная с офферами и черновиками."),
    h("div", { class: "row", style: { justifyContent: "center", marginTop: "16px" } },
      USERS.map((u) => h("button", { class: "btn", onclick: () => { ls.set(ME, u.id); location.hash = `#/u/${u.id}`; } }, avatar(u, 22), u.name))),
    h("p", { class: "hint", style: { marginTop: "18px" } }, "Входа по паролю нет: выбор пользователя — для удобства, а не для защиты."))));
}

function offerTiles(list) {
  if (!list.length) return h("p", { class: "hint" }, "Пока пусто.");
  return h("div", { class: "tiles" }, list.map((o) => {
    const n = problems(o), owner = userById(o.owner);
    return h("a", { href: `#/offer/${encodeURIComponent(o.id)}`, class: "card tile-offer" },
      h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "mini" }, gameName(o.game)), h("span", { class: "row", style: { gap: "4px" } }, offerActions(o), avatar(owner, 22))),
      statusBadge(o.status) ? h("div", { style: { marginTop: "8px" } }, statusBadge(o.status)) : null,
      h("div", { class: "tile-title" }, o.title),
      h("div", { class: "row" },
        h("span", { class: `count ${n ? "" : "ok"}` }, n ? `${n} замечаний` : "✓ готово"),
        h("span", { class: "mini" }, METHODS[o.method] || "способ не выбран"),
        o.hasDraft ? h("span", { class: "mini draft" }, o.inRepo ? "черновик" : "новый, только в браузере") : null));
  }));
}

// Home of the current user: what to do right now — continue, start a new offer, finish a ready one.
function homePage(u) {
  const list = allOffers().filter((o) => o.owner === u.id || o.hasDraft);
  const last = ls.get(lastKey(u.id));
  const cont = list.find((o) => o.id === last) || list.find((o) => problems(o)) || list[0];
  const ready = list.filter((o) => !problems(o));
  const gone = hidden();
  shell(`u:${u.id}`, (burger) => h("div", {},
    h("div", { class: "head", style: { paddingBottom: "14px" } }, h("div", { class: "row" }, burger, h("span", { class: "crumbs" }, "Главная"))),
    h("div", { class: "content home" },
      h("div", { class: "hello" }, `Привет, ${u.name}`),
      cont ? (() => {
        const bad = badUnits(cont), n = problems(cont);
        return h("a", { class: "continue", href: `#/offer/${encodeURIComponent(cont.id)}` },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { class: "mini" }, cont.id === last ? "Продолжить, где остановились" : "Продолжить"),
            h("div", { class: "t" }, cont.title),
            h("div", { class: n ? "warn-text" : "ok-text" }, n ? `${n} замечаний${bad.length ? " · " + bad.slice(0, 3).join(", ") + (bad.length > 3 ? "…" : "") : ""}` : "✓ правила пройдены — можно копировать в админку")),
          h("span", { class: "btn primary" }, "Открыть →"));
      })() : null,
      h("div", { class: "tiles2" },
        h("button", { class: "tile", onclick: newOfferDialog }, h("b", {}, "✦ Новый оффер"), h("span", {}, "5 полей брифа — Build offer соберёт все тексты")),
        h("div", { class: "tile" }, h("b", {}, `Без замечаний · ${ready.length}`),
          ready.length ? ready.slice(0, 4).map((o) => h("a", { class: "tile-link", href: `#/offer/${encodeURIComponent(o.id)}` }, o.title, " →")) : h("span", {}, "Здесь появятся офферы без замечаний"))),
      h("div", { class: "group" }, h("h2", {}, "Мои офферы"),
        list.length ? h("div", { class: "olist" }, list.map((o) => {
          const n = problems(o);
          return h("a", { href: `#/offer/${encodeURIComponent(o.id)}` },
            h("i", { class: `dot ${n ? "warn" : ""}` }), h("span", { class: "olist-t" }, o.title), statusBadge(o.status, true),
            h("span", { class: n ? "warn-text" : "ok-text" }, n ? `${n} замечаний` : "✓ готово"), offerActions(o));
        })) : h("p", { class: "hint" }, "Пока пусто — начните с «Новый оффер».")),
      gone.length ? h("p", { class: "hint" }, `Убрано из списка: ${gone.length} · `,
        h("a", { href: "#", onclick: (e) => { e.preventDefault(); ls.del(hiddenKey(u.id)); toast("Офферы возвращены в список"); route(); } }, "вернуть")) : null)));
}

function userPage(id) {
  const u = userById(id);
  if (!u) return notFound();
  if (me() && me().id === id) return homePage(u);
  const mine = allOffers().filter((o) => o.owner === id);
  shell(`u:${id}`, (burger) => h("div", {},
    h("div", { class: "head", style: { paddingBottom: "16px" } },
      h("div", { class: "row" }, burger, h("span", { class: "crumbs" }, "Команда")),
      h("div", { class: "title-row", style: { marginBottom: 0 } }, avatar(u, 44), h("div", { class: "page-title" }, u.name))),
    h("div", { class: "content" },
      h("div", { class: "group" }, h("h2", {}, "Офферы"), offerTiles(mine)),
      h("p", { class: "hint" }, "Черновики хранятся в браузере каждого участника, здесь видны только офферы, закреплённые за ", u.name, " в репозитории."))));
}

function allPage() {
  shell("all", (burger) => h("div", {},
    h("div", { class: "head", style: { paddingBottom: "16px" } },
      h("div", { class: "row" }, burger, h("span", { class: "crumbs" }, "Каталог")),
      h("div", { class: "title-row", style: { marginBottom: 0 } }, h("div", { class: "page-title", style: { flex: 1 } }, "Все офферы"), h("button", { class: "btn primary", onclick: newOfferDialog }, ic("plus"), "Новый оффер"))),
    h("div", { class: "content" }, Object.entries(allOffers().reduce((a, o) => ((a[o.game] ||= []).push(o), a), {})).map(([g, list]) =>
      h("div", { class: "group" }, h("h2", {}, gameName(g)), offerTiles(list))))));
}

function notFound() {
  shell("", () => h("div", { class: "empty" }, h("div", {}, h("h1", {}, "Не найдено"), h("a", { href: "#/" }, "На главную"))));
}

// Page design: one light glass theme, «Утро» (style.css, data-theme on <html> in index.html).

// Brief form: the same fields in the "new offer" dialog and in the editor panel.
// opts.only — just these fields, in this order, in one grid; opts.except — all fields but these, by group.
// Product name for the search phrases: the brief field, else the working title without the game ("PoE 2 — Gold" → "Gold").
const productOf = (brief, title) => (brief.product || "").trim() || ((t) => (/\p{Script=Cyrillic}/u.test(t) ? "" : t))((title || "").replace(/^.*?\s[—–-]\s/, "").replace(/\(.*?\)/g, "").trim());
const phrasesOf = (brief) => String(brief.keywords || "").split("\n").map((s) => s.trim()).filter(Boolean);
function briefForm(brief, onChange, getGame, getTitle = () => "", opts = {}) {
  if (SEGMENT_RENAMES[brief.segment]) brief.segment = SEGMENT_RENAMES[brief.segment];
  const redraw = [];
  const input = ([key, label, kind, ph]) => {
    const set = (v) => { brief[key] = v; onChange(key); if (key === "archetype" || key === "product") redraw.forEach((f) => f()); };
    let el;
    if (kind.startsWith("select:")) {
      const opts = kind === "select:archetype" ? Object.entries(ARCHETYPES).map(([k, v]) => [k, v[0]]) : SEGMENTS.map((x) => [x, x]);
      el = h("select", { onchange: (e) => set(e.target.value) }, h("option", { value: "" }, "—"), opts.map(([v, t]) => h("option", { value: v, selected: brief[key] === v }, t)));
    } else if (kind === "keywords") {
      // Search phrases, most searched first: the archetype templates as a checklist, plus own phrases at the end.
      const list = h("div", { class: "kw-list" }), count = h("span", { class: "mini" });
      let all = [], lastTpl = null;
      const pick = (keep) => { set(all.filter(keep).join("\n")); draw(); };
      const draw = () => {
        const tpl = suggestKeywords(brief.archetype, productOf(brief, getTitle()), GAMES[getGame()] || []);
        let sel = phrasesOf(brief);
        // Game, product or archetype changed: ticked template phrases follow to the same template line.
        if (lastTpl && lastTpl.join() !== tpl.join()) {
          const moved = sel.map((s) => (lastTpl.includes(s) ? (lastTpl.length === tpl.length ? tpl[lastTpl.indexOf(s)] : null) : s)).filter(Boolean);
          if (moved.join("\n") !== sel.join("\n")) { sel = [...new Set(moved)]; brief[key] = sel.join("\n"); onChange(key); }
        }
        lastTpl = tpl;
        all = [...tpl, ...sel.filter((s) => !tpl.includes(s))];
        count.textContent = all.length ? `selected ${sel.length} of ${all.length}` : "";
        list.replaceChildren(...(all.length ? all.map((p, n) => h("label", { class: "kw" }, h("i", {}, n + 1),
          h("input", { type: "checkbox", checked: sel.includes(p), onchange: (e) => { const s = phrasesOf(brief); pick((x) => (x === p ? e.target.checked : s.includes(x))); } }),
          h("span", {}, p))) : [h("div", { class: "kw-empty" }, brief.archetype ? "Впишите название продукта — появится список фраз." : "Выберите архетип — появится список фраз.")]));
      };
      redraw.push(draw);
      const own = h("input", { placeholder: "own phrase + Enter", onkeydown: (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const v = e.target.value.trim(), s = phrasesOf(brief);
        e.target.value = "";
        if (v && !s.includes(v)) { set([...s, v].join("\n")); draw(); }
      } });
      draw();
      return h("div", { class: "wide kw-field" },
        h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", {}, label),
          h("span", { class: "row", style: { gap: "6px" } }, count,
            h("button", { type: "button", class: "chip", onclick: () => pick(() => true) }, "all"),
            h("button", { type: "button", class: "chip", onclick: () => pick(() => false) }, "reset"))),
        list, own,
        h("span", { class: "mini" }, "Каждая фраза — максимум одно упоминание в Description, SEO-футере и FAQ; между предложениями с ключом — минимум одно без ключа."));
    } else if (kind === "area") {
      el = h("textarea", { rows: 2, placeholder: ph, oninput: (e) => set(e.target.value) });
      el.value = brief[key] || "";
    } else {
      el = h("input", { placeholder: ph, value: brief[key] || "", inputmode: kind === "money" ? "decimal" : null, oninput: (e) => set(e.target.value) });
    }
    return h("label", { class: kind === "area" ? "wide" : "" }, h("span", {}, label), el);
  };
  let form;
  if (opts.only) {
    const fields = BRIEF_FIELDS.flatMap(([, f]) => f).filter(([k]) => opts.only.includes(k)).sort((a, b) => opts.only.indexOf(a[0]) - opts.only.indexOf(b[0]));
    form = h("div", { class: "brief-grid" }, fields.map(input));
  } else {
    const skip = opts.except || [];
    form = h("div", { class: "brief" }, BRIEF_FIELDS.map(([group, fields]) => fields.filter(([k]) => !skip.includes(k))).map((fields, n) =>
      fields.length ? h("fieldset", {}, h("legend", {}, BRIEF_FIELDS[n][0]), h("div", { class: "brief-grid" }, fields.map(input))) : null));
  }
  form.refresh = () => redraw.forEach((f) => f());
  return form;
}

// New offer: five fields, then Claude writes the whole offer ("Собрать оффер") — or an empty template.
const CORE = ["archetype", "product", "keywords", "time", "price"];
function newOfferDialog() {
  const u = me();
  const brief = {};
  const gameSel = h("select", { onchange: () => core.refresh() }, Object.entries(GAMES).map(([k, v]) => h("option", { value: k }, v[2])));
  const methodSel = h("select", {}, Object.entries(METHOD_EN).map(([k, v]) => h("option", { value: k, selected: k === "both" }, v)));
  const titleIn = h("input", { placeholder: "default: PoE 2 — product", oninput: () => core.refresh() });
  const ownerSel = h("select", {}, USERS.map((x) => h("option", { value: x.id, selected: u && u.id === x.id }, x.name)));
  const autoTitle = () => titleIn.value.trim() || (brief.product && brief.product.trim() ? `${GAMES[gameSel.value][0]} — ${brief.product.trim()}` : "");
  const hint = h("p", { class: "hint" });
  const core = briefForm(brief, (k) => { if (k === "archetype") hint.textContent = (ARCHETYPES[brief.archetype] || ["", ""])[1]; }, () => gameSel.value, autoTitle, { only: CORE });
  core.prepend(h("label", {}, h("span", {}, "Game"), gameSel), h("label", {}, h("span", {}, "Method"), methodSel));
  const more = h("details", { class: "more" },
    h("summary", {}, "More (optional)", h("span", { class: "mini" }, "главный ключ, сегмент, лига, результат, бонус, страх, отличие, требования, название, кто собирает")),
    h("div", { class: "brief-grid", style: { marginTop: "12px" } }, h("label", {}, h("span", {}, "Working title"), titleIn), h("label", {}, h("span", {}, "Built by"), ownerSel)),
    briefForm(brief, () => {}, () => gameSel.value, autoTitle, { except: CORE }));
  const status = h("div", { class: "compose-status" });

  const create = (boxes) => {
    const composed = !!boxes; // a built offer gets its facts checked as soon as the editor opens
    const owner = ownerSel.value;
    if (!me()) ls.set(ME, owner);
    const game = gameSel.value, title = autoTitle() || "New offer";
    // Main keyword (opens H1 / hero): the most searched ticked phrase without "buy / purchase / cheap".
    if (!brief.keyword) brief.keyword = phrasesOf(brief).find((p) => !/^(buy|purchase|cheap)\b/i.test(p)) || "";
    if (!brief.product) brief.product = productOf(brief, title);
    const id = `new:${game}/${slugify(title) || Date.now()}`;
    if (!boxes) {
      boxes = templateBoxes();
      const kw = brief.keyword.trim();
      for (const b of boxes) {
        if (kw && b.kind === "h1") b.lines = [kw];
        if (kw && (b.kind === "hero" || b.kind === "page-title")) b.lines = [kw + " — "];
        if (brief.requirements && b.kind === "requirements") b.lines = brief.requirements.split(/\n/);
      }
    }
    ls.set(draftKey(me().id, id), { id, game, slug: id.split("/")[1], title, owner, status: "new", method: methodSel.value, boxes, brief, ...(composed && useApi() ? { autoFact: true } : {}) });
    dlg.close();
    location.hash = `#/offer/${encodeURIComponent(id)}`;
  };
  const say = (cls, ...kids) => { status.className = "compose-status " + cls; status.replaceChildren(...kids); };
  const run = async () => {
    const miss = [!brief.archetype && "архетип", !productOf(brief, autoTitle()) && "продукт", !phrasesOf(brief).length && "хотя бы один ключ"].filter(Boolean);
    if (miss.length) return say("warn", `Для сборки нужны: ${miss.join(", ")}.`);
    if (needsKey()) return aiSettingsDialog(run);
    goBtn.disabled = emptyBtn.disabled = true; goBtn.textContent = "Building…";
    say("busy", "Claude пишет все поля по брифу и правилам — обычно до минуты.");
    try {
      if (!brief.keyword) brief.keyword = phrasesOf(brief).find((p) => !/^(buy|purchase|cheap)\b/i.test(p)) || "";
      const draft = { game: gameSel.value, title: autoTitle(), method: methodSel.value, brief, boxes: templateBoxes() };
      create(await AI.compose(draft));
      toast("Оффер собран — проверьте подсвеченные поля");
    } catch (e) {
      const msg = await explainError(e);
      msg ? say("warn", msg) : say("");
    } finally { goBtn.disabled = emptyBtn.disabled = false; goBtn.textContent = "✦ Build offer"; }
  };
  const emptyBtn = h("button", { class: "btn", title: "Шаблон без текстов", onclick: () => create(null) }, "Empty offer");
  const goBtn = h("button", { class: "btn primary", title: "Claude пишет все поля по брифу", onclick: run }, "✦ Build offer");
  const dlg = h("dialog", { class: "wide" },
    dlgHead("New offer"),
    h("p", { class: "hint" }, "Пять полей — и Claude соберёт все тексты оффера. Дальше остаётся поправить подсвеченное. Бриф на сайт не попадает."),
    core, hint, more, status,
    h("div", { class: "row dlg-foot", style: { justifyContent: "flex-end" } }, h("button", { class: "btn", onclick: () => dlg.close() }, "Cancel"), emptyBtn, goBtn));
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
}

// ---------- editor ----------
function previewFor(kind, b, offer) {
  const get = (k) => offer.boxes.find((x) => x.kind === k);
  const html = toHtml(kind, b.lines, accentColor(b), offer.method), text = toText(kind, b.lines, offer.method);
  if (kind === "card-preview") {
    const h1 = get("h1");
    return h("div", { class: "ogcard" }, h("div", { class: "art" }), h("div", { class: "body" },
      h("div", { class: "name" }, (h1 && toText("h1", h1.lines)) || offer.title), h("div", { html }), h("div", { class: "price" }, "From ", h("b", {}, "$—"))));
  }
  if (kind === "usp-title") return h("span", { class: "pill" }, text || "UVP");
  if (kind === "h1") return h("div", { style: { fontSize: "26px", fontWeight: 800, letterSpacing: "-.02em" } }, text);
  if (kind === "requirements") return h("details", { class: "spoiler", open: true }, h("summary", {}, "Requirements"), h("div", { html }));
  if (kind === "faq") {
    // As on the site: a block of its own after the SEO footer — the title field, then question / answer pairs.
    // In the admin the title, every question and every answer are separate fields, so each has its own Copy.
    const pairs = parseFaq(b.lines), title = faqTitle(b.lines);
    return h("div", { class: "faq-block" },
      h("div", { class: "faq-head" }, h("h3", { class: title ? "" : "faq-missing" }, title || "## {Game} {product} FAQ — заголовок блока"),
        title ? h("button", { class: "copy", onclick: () => copy("", title, true, "заголовок FAQ") }, ic("copy"), "Title") : null),
      pairs.length ? h("div", { class: "faq" }, pairs.map(({ q, a }, n) => h("details", { class: "spoiler", open: n === 0 },
        h("summary", {}, h("span", {}, q || "—"), h("span", { class: "row", style: { gap: "6px" } },
          h("button", { class: "copy", onclick: (e) => { e.preventDefault(); copy("", q, true, `вопрос ${n + 1}`); } }, ic("copy"), "Q"),
          h("button", { class: "copy", onclick: (e) => { e.preventDefault(); copy("", a, true, `ответ ${n + 1}`); } }, ic("copy"), "A"))),
        h("div", {}, a || "—")))) : h("div", { class: "hint" }, "Формат: первая строка «## {Game} {product} FAQ», дальше «Q: question?» и под ней «A: answer»."));
  }
  if (kind === "page-title") return h("div", { class: "browser-tab" }, h("i"), h("span", {}, text || "—"), text.length > 60 ? h("em", {}, ` · обрежется после 60 (${text.length})`) : null);
  if (kind === "feed-subtitle") return h("div", { class: "feed-sub" }, text || "—");
  if (kind === "meta-description") {
    const t = toText("page-title", (get("page-title") || { lines: [""] }).lines), d = toText("meta-description", (get("meta-description") || { lines: [""] }).lines);
    const cut = (s, n) => (s.length > n ? [s.slice(0, n), h("span", { class: "cut" }, s.slice(n))] : [s]);
    return h("div", { class: "serp" }, h("div", { class: "site" }, h("i"), "overgear.com › games › " + offer.game), h("div", { class: "t" }, ...cut(t, 60)), h("div", { class: "d" }, ...cut(d, 155)));
  }
  if (kind === "feed-description") {
    const s = toText("feed-subtitle", (get("feed-subtitle") || { lines: [""] }).lines), d = toText("feed-description", (get("feed-description") || { lines: [""] }).lines);
    return h("div", { class: "feed" }, h("div", { class: "img" }), h("div", {}, h("div", { class: "s" }, s), h("div", { class: "d" }, d)));
  }
  if (TYPES[kind] && TYPES[kind][2]) return h("div", {}, text);
  return h("div", { html });
}

const PV_LABEL = { "card-preview": "Catalog card", "usp-title": "Chip on the page", "page-title": "Browser tab", "meta-description": "Google snippet · title + description", "feed-subtitle": "Feed subtitle", "feed-description": "Feed item · subtitle + description", "requirements": "Block on the page", "h1": "Page heading", "faq": "FAQ block on the page · after the SEO footer" };

// Text under a rule warning is underlined right in the field: every «quoted fragment» of a warning that
// occurs in the text. The marks live in a layer behind a transparent textarea with the same metrics.
const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function markHtml(text, warns) {
  const frags = [...new Set(warns.flatMap((w) => [...w.matchAll(/«([^»]{3,})»/g)].map((m) => m[1].replace(/…$/, "").trim())))].filter((f) => f.length >= 3);
  const low = text.toLowerCase(), ranges = [];
  for (const f of frags.sort((a, b) => b.length - a.length)) {
    for (let at = low.indexOf(f.toLowerCase()); at >= 0; at = low.indexOf(f.toLowerCase(), at + f.length)) {
      const end = at + f.length;
      if (!ranges.some(([a, z]) => at < z && end > a)) ranges.push([at, end]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "", pos = 0;
  for (const [a, z] of ranges) { out += escHtml(text.slice(pos, a)) + "<mark>" + escHtml(text.slice(a, z)) + "</mark>"; pos = z; }
  return out + escHtml(text.slice(pos)) + "\n";
}

let pendingUndo = null; // boxes before "Собрать из брифа", for one undo after the re-render

function editorPage(id) {
  const base = OFFERS.find((o) => o.id === id);
  let offer = structuredClone(load(id));
  if (!offer) return notFound();
  if (!me()) return pickUser();
  const key = draftKey(me().id, id);
  ls.set(lastKey(me().id), id);
  // Every offer page has a FAQ block after the SEO footer; offers without one get an empty block to fill.
  if (!offer.boxes.some((b) => b.kind === "faq")) {
    const at = offer.boxes.findIndex((b) => b.kind === "seo-footer");
    const game = (GAMES[offer.game] || ["", ""])[1], product = productOf(offer.brief || {}, offer.title);
    offer.boxes.splice(at < 0 ? offer.boxes.length : at + 1, 0, { kind: "faq", label: "", section: "FAQ", accent: "green", lines: [`## ${[game, product].filter(Boolean).join(" ")} FAQ`, "Q: ", "A: ", "Q: ", "A: ", "Q: ", "A: "] });
  }
  const refs = [], rows = [], copyBtns = [];
  // Copied marks: a field copied for the admin shows ✓ on its Copy until its text changes.
  const sk = sentKey(me().id, id), sent = new Set(ls.get(sk) || []);
  const boxKey = (b) => `${b.kind}|${b.label}`;
  const markSent = (b, on) => { on ? sent.add(boxKey(b)) : sent.delete(boxKey(b)); ls.set(sk, [...sent]); };
  offer.brief ||= {};

  const save = () => { ls.set(key, offer); draft.replaceChildren(draftBanner()); };
  const draftBanner = () => {
    const d = ls.get(key);
    if (!d) return "";
    if (d.pr) return h("div", { class: "banner info" }, h("span", { style: { flex: 1 } }, `Сохранено в репозиторий: pull request #${d.pr.number} от ${new Date(d.pr.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. После merge и публикации сайта черновик можно сбросить.`), h("a", { class: "btn", href: d.pr.url, target: "_blank", rel: "noopener" }, "Open PR ↗"));
    return h("div", { class: "banner info" }, base ? "Черновик: правки есть только в этом браузере. «Save to repo» отправит их в репозиторий." : "Новый оффер хранится только в этом браузере — «Save to repo» добавит его в репозиторий.");
  };
  const draft = h("div", {}, draftBanner());
  const banners = h("div");
  // Fact check: current league and game mechanics, via web search; results are kept in the draft.
  const factBox = h("div");
  const factBtn = h("button", { class: "btn", title: "Claude ищет в патчноутах, на форуме и в вики: актуальная лига и механики из текста", onclick: () => runFacts() }, "✓ Fact check");
  const VERDICT = { wrong: ["неверно", "warn"], outdated: ["устарело", "warn"], unverified: ["не подтвердилось", "note"], ok: ["верно", "ok"] };
  const drawFacts = (busy) => {
    const fc = offer.factCheck;
    if (busy) return factBox.replaceChildren(h("div", { class: "facts busy" }, h("b", {}, "Fact check"), h("span", {}, "Claude проверяет лигу и механики по патчноутам и вики — обычно 1–2 минуты.")));
    if (!fc) return factBox.replaceChildren(...(hasCopy(offer.boxes) ? [h("div", { class: "facts hint-only" }, "Fact check ещё не запускался — нажмите «✓ Fact check», чтобы сверить актуальную лигу и механики.")] : []));
    const bad = fc.findings.filter((f) => ["wrong", "outdated"].includes(f.verdict)), ok = fc.findings.filter((f) => f.verdict === "ok");
    const link = (u) => (u ? h("a", { href: u, target: "_blank", rel: "noopener" }, new URL(u, location.href).hostname) : null);
    factBox.replaceChildren(h("details", { class: "facts", open: bad.length > 0 },
      h("summary", {}, h("b", {}, "Fact check"),
        h("span", { class: bad.length ? "warn-text" : "ok-text" }, bad.length ? `${bad.length} неверно или устарело` : "механики и лига подтвердились"),
        fc.league.current ? h("span", { class: "mini" }, `лига: ${fc.league.current}${fc.league.patch ? " · " + fc.league.patch : ""}`) : null,
        h("span", { class: "mini" }, new Date(fc.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))),
      h("div", { class: "facts-body" },
        fc.league.current ? h("div", { class: "fact ok" }, h("b", {}, "Актуальная лига"), h("span", {}, `${fc.league.current}${fc.league.patch ? " (" + fc.league.patch + ")" : ""}`), link(fc.league.source)) : null,
        fc.findings.filter((f) => f.verdict !== "ok").map((f) => h("div", { class: `fact ${(VERDICT[f.verdict] || ["", "note"])[1]}` },
          h("b", {}, `${f.field} · ${(VERDICT[f.verdict] || [f.verdict])[0]}`), h("span", {}, `«${f.claim}» — ${f.fix || ""}`), link(f.source))),
        ok.length ? h("div", { class: "fact ok" }, h("b", {}, `Верно: ${ok.length}`), h("span", {}, ok.map((f) => f.claim).join(" · "))) : null)));
  };
  const runFacts = async () => {
    if (needsKey()) return aiSettingsDialog(runFacts);
    factBtn.disabled = true; drawFacts(true);
    try {
      offer.factCheck = await AI.facts(offer);
      save(); update();
      toast("Fact check готов");
    } catch (e) {
      const msg = await explainError(e);
      factBtn.disabled = false; drawFacts();
      if (msg) factBox.replaceChildren(h("div", { class: "banner" }, "⚠", h("span", {}, "Fact check: " + msg)));
      return;
    }
    factBtn.disabled = false; drawFacts();
  };
  const progLabel = h("b"), progBar = h("i"), progNote = h("span", { class: "mini" }), copyNote = h("span", { class: "mini ok-text" });

  const update = () => {
    const r = review(offer);
    banners.replaceChildren(...r.page.map((p) => h("div", { class: "banner" }, "⚠", h("span", {}, p))));
    r.boxes.forEach((b, i) => {
      const ref = refs[i];
      if (!ref) return;
      ref.preview.replaceChildren(previewFor(b.kind, b, offer));
      if (ref.tip) ref.tip.innerHTML = toHtml("usp-tooltips", b.lines, GREEN, offer.method);
      if (ref.ta) ref.ta.back.innerHTML = markHtml(ref.ta.value, b.warn);
      const txt = toText(b.kind, b.lines, offer.method), lim = TYPES[b.kind][3];
      ref.count.textContent = ["seo-footer", "description"].includes(b.kind) ? `${txt.split(/\s+/).filter(Boolean).length} words`
        : lim.len ? `${txt.length} / ${lim.len[0]}–${lim.len[1]}` : lim.line ? `${txt.length} chars · ${lim.line[0]}–${lim.line[1]} per line` : lim.item ? "≤ 5 words per tooltip" : `${txt.length} chars`;
      ref.issues.replaceChildren(...b.warn.map((w) => h("div", { class: "issue" }, "⚠", h("span", {}, w))),
        ...b.note.map((n) => h("div", { class: "issue note" }, "·", h("span", {}, n))));
    });
    let done = 0;
    for (const row of rows) {
      const warns = row.idx.flatMap((i) => r.boxes[i].warn), empty = !hasCopy(row.idx.map((i) => offer.boxes[i]));
      const first = offer.boxes[row.idx[0]], line = toText(first.kind, first.lines, offer.method).split("\n").find((l) => l.trim()) || "";
      row.dot.className = `dot ${empty ? "blank" : warns.length ? "warn" : ""}`;
      row.snip.textContent = empty ? "empty" : line;
      // Count of issues and a "?" that shows them all on hover — the texts are too long for the row.
      row.state.className = `row-state ${warns.length ? "" : "ok"}`;
      row.state.replaceChildren(...(warns.length ? [
        h("span", { class: "issue-count" }, `${warns.length} ${warns.length === 1 ? "issue" : "issues"}`),
        h("span", { class: "qtip", tabindex: "0", "aria-label": "Что не так" }, "?",
          h("span", { class: "qtip-pop", role: "tooltip" }, h("b", {}, "Что не так"), h("ul", {}, warns.map((w) => h("li", {}, w)))))] : ["✓"]));
      row.wrap.classList.toggle("bad", warns.length > 0);
      row.bad = warns.length > 0 || empty;
      if (!row.bad) done++;
    }
    progLabel.textContent = `Ready ${done} of ${rows.length}`;
    progBar.style.width = `${Math.round((done / Math.max(rows.length, 1)) * 100)}%`;
    progNote.textContent = done === rows.length ? "всё чисто — можно копировать в админку" : `осталось ${rows.length - done}`;
    for (const { btn, text, label, b } of copyBtns) { const on = sent.has(boxKey(b)); btn.classList.toggle("copied", on); text.textContent = on ? `✓ ${label}` : label; btn.title = on ? "Уже скопировано — текст не менялся" : ""; }
    const copied = offer.boxes.filter((b) => sent.has(boxKey(b))).length;
    copyNote.textContent = copied ? `скопировано ${copied} из ${offer.boxes.length}` : "";
  };

  const fit = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
  const textarea = (b) => {
    const ta = h("textarea", { spellcheck: "true", class: b.lines.length < 2 ? "single" : "", oninput: (e) => { b.lines = e.target.value.replace(/\r/g, "").split("\n"); markSent(b, false); fit(e.target); save(); update(); } });
    ta.value = b.lines.join("\n");
    ta.back = h("div", { class: "hl-back", "aria-hidden": "true" });
    ta.box = h("div", { class: "hl" }, ta.back, ta);
    requestAnimationFrame(() => fit(ta));
    return ta;
  };
  const copyBtn = (b, what, label = "Copy") => {
    const text = h("span", {}, label);
    const btn = h("button", { class: "copy", onclick: async () => { if (await copy(toHtml(b.kind, b.lines, accentColor(b), offer.method), toText(b.kind, b.lines, offer.method), TYPES[b.kind][2], what)) { markSent(b, true); update(); } } }, ic("copy"), text);
    copyBtns.push({ btn, text, label, b });
    return btn;
  };

  // "Перегенерировать": feedback → 3 variants from Claude → each checked by our rules → apply (with undo).
  // boxes: the boxes the variant replaces (one field, or a UVP title + its tooltips); tas: their textareas.
  const CHIPS = ["shorter", "more specifics and numbers from the brief", "different angle", "more gamer language", "drop the clichés", "stronger Risk mechanism"];
  const regenPanel = (boxes, tas) => {
    const isUvp = boxes.length === 2;
    const fb = h("textarea", { class: "single plain", placeholder: "Что неверно / плохо / чего хотелось бы. Например: «слишком общо, нужен механизм риска, без слова FREE»" });
    const out = h("div", { class: "variants" });
    let undo = null;
    const apply = (v) => {
      undo = boxes.map((b) => [...b.lines]);
      if (isUvp) { boxes[0].lines = v.title; boxes[1].lines = v.tooltips; } else boxes[0].lines = v.lines;
      boxes.forEach((b, n) => { markSent(b, false); tas[n].value = b.lines.join("\n"); fit(tas[n]); });
      save(); update();
      toast("Вариант применён");
      undoBtn.hidden = false;
    };
    const undoBtn = h("button", { class: "btn", hidden: true, title: "Вернуть текст до варианта", onclick: () => { if (!undo) return; boxes.forEach((b, n) => { b.lines = undo[n]; markSent(b, false); tas[n].value = b.lines.join("\n"); fit(tas[n]); }); save(); update(); undoBtn.hidden = true; toast("Возвращено как было"); } }, ic("undo"), "Undo");
    const run = async () => {
      go.disabled = true; go.textContent = "Generating…";
      out.replaceChildren(h("div", { class: "hint" }, "Claude пишет 3 варианта и проверяет их по правилам…"));
      try {
        const target = isUvp ? { kind: "uvp", title: boxes[0], tooltips: boxes[1] } : boxes[0];
        const variants = await AI.regenerate(offer, target, fb.value.trim());
        out.replaceChildren(...variants.map((v, n) => {
          // check the variant in the context of the whole offer
          const trial = offer.boxes.map((x) => ({ ...x, lines: x === boxes[0] ? (isUvp ? v.title : v.lines) : x === boxes[1] ? v.tooltips : x.lines }));
          const r = review({ ...offer, boxes: trial });
          const warns = boxes.map((b) => offer.boxes.indexOf(b)).flatMap((i) => r.boxes[i].warn);
          const pv = isUvp ? h("div", {}, h("span", { class: "pill" }, v.title.join(" ")), h("div", { class: "tip", html: toHtml("usp-tooltips", v.tooltips) }))
            : previewFor(boxes[0].kind, { ...boxes[0], lines: v.lines }, { ...offer, boxes: trial });
          return h("div", { class: "variant" },
            h("div", { class: "row", style: { justifyContent: "space-between" } }, h("b", {}, `Variant ${n + 1}`),
              h("span", { class: `count ${warns.length ? "" : "ok"}` }, warns.length ? `${warns.length} issues` : "✓ rules passed"),
              h("button", { class: "btn primary", onclick: () => apply(v) }, "Apply")),
            h("div", { class: "pv" }, pv),
            v.why ? h("div", { class: "hint" }, v.why) : null,
            ...warns.map((w) => h("div", { class: "issue" }, "⚠", h("span", {}, w))));
        }));
      } catch (e) {
        const msg = await explainError(e);
        if (!msg) { out.replaceChildren(); return; }
        out.replaceChildren(h("div", { class: "banner" }, "⚠", h("span", {}, msg)), e.message === "NO_KEY" || /ключ/i.test(msg) ? h("button", { class: "btn", onclick: () => aiSettingsDialog(run) }, "Вставить API-ключ") : null);
      } finally { go.disabled = false; go.textContent = "Generate 3 variants"; }
    };
    const go = h("button", { class: "btn primary", onclick: () => (needsKey() ? aiSettingsDialog(run) : run()) }, "Generate 3 variants");
    const panel = h("div", { class: "regen", hidden: true },
      h("div", { class: "sub" }, h("b", {}, isUvp ? "Regenerate UVP & tooltips" : "Regenerate field"), h("span", {}, "Claude видит бриф, остальные поля и правила")),
      fb,
      h("div", { class: "row" }, CHIPS.map((c) => h("button", { class: "chip", onclick: () => { fb.value = fb.value ? `${fb.value.replace(/[.;\s]+$/, "")}; ${c}` : c; } }, c))),
      h("div", { class: "row" }, go, undoBtn),
      out);
    // No key yet → the "paste API key" window first, then the panel opens.
    const openPanel = () => { panel.hidden = !panel.hidden; if (!panel.hidden) fb.focus(); };
    const toggle = h("button", { class: "btn regen-btn", title: "Переписать поле с пожеланиями — Claude даст 3 варианта", onclick: () => (!needsKey() || !panel.hidden ? openPanel() : aiSettingsDialog(openPanel)) }, "✦ Regenerate");
    const ask = (text) => { fb.value = text; panel.hidden = false; needsKey() ? aiSettingsDialog(run) : run(); };
    return { panel, toggle, ask };
  };

  // One collapsed line per field: status, name, first line of the text, the first remark, Copy. Click opens it.
  const row = (idx, name, field, actions, body) => {
    const dot = h("i", { class: "dot" }), snip = h("span", { class: "row-snip" }), state = h("span", { class: "row-state" });
    const wrap = h("div", { class: "frow" });
    const open = (on = !wrap.classList.contains("open")) => {
      wrap.classList.toggle("open", on);
      if (on) requestAnimationFrame(() => wrap.querySelectorAll(".frow-body textarea").forEach((t) => { if (!t.closest(".regen")) fit(t); }));
    };
    wrap.append(
      h("div", { class: "row-head", onclick: (e) => { if (!e.target.closest("button, select, a, .qtip")) open(); } },
        dot, h("div", { class: "row-name" }, h("b", {}, name), h("span", { class: "row-field" }, field)), snip, state,
        h("div", { class: "row-actions" }, actions), h("span", { class: "chev" }, "⌄")),
      h("div", { class: "frow-body" }, body));
    const r = { idx, wrap, dot, snip, state, open };
    rows.push(r);
    return wrap;
  };

  const fieldRow = (b, i) => {
    const name = nameEn(b.kind), field = TYPES[b.kind][1];
    const preview = h("div"), issues = h("div", { class: "issues" }), count = h("span");
    const ta = textarea(b);
    const rg = regenPanel([b], [ta]);
    const accent = ["card-preview", "hero", "description"].includes(b.kind) ? h("select", { class: "mini-select", title: "Цвет выделения", onchange: (e) => { b.accent = e.target.value; save(); update(); } },
      h("option", { value: "green", selected: b.accent !== "orange" }, "green"), h("option", { value: "orange", selected: b.accent === "orange" }, "orange · bundles")) : null;
    refs[i] = { preview, issues, count, ta };
    const faqCopy = b.kind === "faq" ? h("button", { class: "copy", title: "Заголовок блока FAQ; вопросы и ответы — кнопками Q и A в превью", onclick: () => { const t = faqTitle(b.lines); t ? copy("", t, true, "заголовок FAQ") : toast("Нет заголовка блока — первая строка «## … FAQ»", true); } }, ic("copy"), "Title") : null;
    return row([i], name + (b.label ? " · " + b.label : ""), field, [faqCopy || copyBtn(b, name)], [
      tools(rg, accent),
      b.kind === "faq" ? faqPicker(b, ta, rg) : null,
      h("div", { class: "split" },
        h("div", { class: "edit" }, ta.box, h("div", { class: "sub" }, count),
          b.kind === "requirements" ? h("div", { class: "hint" }, "Контекст как удобно — справа то, что попадёт на сайт.") : null),
        h("div", { class: "pv" }, h("div", { class: "pv-label" }, PV_LABEL[b.kind] || "On the site"), preview)),
      issues, rg.panel]);
  };
  // FAQ questions to pick (faq.js): support questions from the brief, questions from Overgear pages, site forms.
  // Ticked ones are kept in the brief ("faqPicked"); Claude answers exactly them, or they go into the block as is.
  const faqDraws = [];
  const faqPicker = (b, ta, rg) => {
    const box = h("div", { class: "faq-pick" });
    const picked = () => listLines(offer.brief.faqPicked);
    const draw = () => {
      // product falls back to the working title ("PoE 2 — Ascension Trials" → "Ascension Trials"), as for search phrases
      const product = productOf(offer.brief, offer.title);
      const p = picked(), cands = faqCandidates({ ...offer, brief: { ...offer.brief, product } });
      const all = [...cands, ...p.filter((q) => !cands.some((c) => c.q === q)).map((q) => ({ q, kind: "own", from: "выбрано ранее" }))];
      const setPicked = (list) => { offer.brief.faqPicked = all.map((c) => c.q).filter((q) => list.includes(q)).join("\n"); save(); draw(); };
      box.replaceChildren(
        h("div", { class: "row", style: { justifyContent: "space-between" } },
          h("b", {}, "Questions"), h("span", { class: "mini" }, all.length ? `selected ${p.length} of ${all.length} · лучше 3–6` : "")),
        all.length ? h("div", { class: "kw-list" }, all.map((c) => h("label", { class: "kw" },
          h("input", { type: "checkbox", checked: p.includes(c.q), onchange: (e) => setPicked(e.target.checked ? [...picked(), c.q] : picked().filter((x) => x !== c.q)) }),
          h("span", { class: "faq-q" }, c.q), h("span", { class: `src ${c.kind}` }, c.from))))
          : h("div", { class: "kw-empty" }, "Впишите в бриф название продукта и архетип — появится набор вопросов."),
        h("div", { class: "row" },
          h("button", { class: "btn regen-btn", title: "Claude напишет ответы на отмеченные вопросы — 3 варианта на выбор", onclick: () => {
            const list = picked();
            if (!list.length) return toast("Отметьте вопросы", true);
            rg.ask(`Answer exactly these questions, in this order. Keep each question's meaning, fix only grammar:\n${list.map((q, n) => `${n + 1}. ${q}`).join("\n")}`);
          } }, "✦ Write answers"),
          h("button", { class: "btn", title: "Поставить отмеченные вопросы в блок, ответы — вручную", onclick: () => {
            const list = picked();
            if (!list.length) return toast("Отметьте вопросы", true);
            const have = parseFaq(b.lines), title = faqTitle(b.lines) || `${(GAMES[offer.game] || ["", ""])[1]} ${productOf(offer.brief, offer.title)} FAQ`.replace(/\s+/g, " ").trim();
            b.lines = [`## ${title}`, ...list.flatMap((q) => [`Q: ${q}`, `A: ${(have.find((x) => x.q === q) || { a: "" }).a}`])];
            ta.value = b.lines.join("\n"); markSent(b, false); fit(ta); save(); update();
          } }, "Insert questions"),
          h("span", { class: "hint" }, "Свои вопросы из саппорта — в брифе, поле «Questions from support»")));
    };
    faqDraws.push(draw);
    draw();
    return box;
  };
  // Top of every opened block: Regenerate first, so it is the first thing seen after a click.
  const tools = (rg, ...more) => h("div", { class: "frow-tools" }, rg.toggle, h("span", { class: "hint" }, "Claude перепишет блок с вашими пожеланиями — 3 варианта на выбор"), h("span", { style: { flex: 1 } }), ...more);

  // UVP title + its tooltips in one row, each with its own Copy.
  const uvpRow = (t, ti, tips, pi) => {
    const pPreview = h("div"), tip = h("div", { class: "tip" }), issues = h("div", { class: "issues" }), count = h("span"), issues2 = h("div", { class: "issues" }), count2 = h("span");
    const taT = textarea(t), taP = textarea(tips), rg = regenPanel([t, tips], [taT, taP]);
    refs[ti] = { preview: pPreview, issues, count, ta: taT };
    refs[pi] = { preview: h("div"), tip, issues: issues2, count: count2, ta: taP };
    return row([ti, pi], t.label || "UVP", "USP → Title + Short description", [copyBtn(t, "UVP", "UVP"), copyBtn(tips, "тултипы", "Tooltips")], [
      tools(rg, h("button", { class: "copy", title: "Удалить UVP вместе с тултипами", onclick: () => { offer.boxes = offer.boxes.filter((x) => !(x.label === t.label && ["usp-title", "usp-tooltips"].includes(x.kind))); save(); editorPage(id); } }, ic("trash"))),
      h("div", { class: "split" },
        h("div", { class: "edit" },
          h("div", { class: "sub" }, h("span", {}, "UVP · 12–32 chars")), taT.box, h("div", { class: "sub" }, count),
          h("div", { class: "sub", style: { marginTop: "6px" } }, h("span", {}, "Tooltips · exactly 3, up to 5 words")), taP.box,
          h("div", { class: "sub" }, count2)),
        h("div", { class: "pv" }, h("div", { class: "pv-label" }, "Chip and tooltip on the page"), pPreview, tip)),
      issues, issues2, rg.panel]);
  };

  const sections = [];
  let cur = null, group = null;
  offer.boxes.forEach((b, i) => {
    if (b.section !== cur) {
      cur = b.section;
      group = h("div", { class: "group", "data-section": cur }, h("h2", {}, SECTION_EN[cur] || cur || "Fields"));
      sections.push(group);
    }
    if (b.kind === "usp-tooltips" && offer.boxes[i - 1]?.kind === "usp-title") return;
    if (b.kind === "usp-title" && offer.boxes[i + 1]?.kind === "usp-tooltips") group.append(uvpRow(b, i, offer.boxes[i + 1], i + 1));
    else group.append(fieldRow(b, i));
    const lastUvp = b.kind === "usp-title" && !["usp-title"].includes(offer.boxes[i + 2]?.kind);
    if (lastUvp && offer.boxes.filter((x) => x.kind === "usp-title").length < 4)
      group.append(h("button", { class: "btn ghost add-uvp", onclick: () => {
        const n = offer.boxes.filter((x) => x.kind === "usp-title").length + 1, label = `UVP ${n} · Outcome`;
        offer.boxes.splice(i + 2, 0, { kind: "usp-title", label, section: b.section, accent: "green", lines: [""] }, { kind: "usp-tooltips", label, section: b.section, accent: "green", lines: ["", "", ""] });
        save(); editorPage(id);
      } }, ic("plus"), "Add UVP (up to 4)"));
  });

  // Next field that still needs work, after the one open now.
  const nextIssue = () => {
    const at = rows.findIndex((r) => r.wrap.classList.contains("open"));
    const next = rows.slice(at + 1).find((r) => r.bad) || rows.find((r) => r.bad);
    if (!next) return toast("Замечаний нет — можно копировать в админку");
    rows.forEach((r) => r !== next && r.open(false));
    next.open(true);
    next.wrap.scrollIntoView({ block: "start" });
    setTimeout(() => next.wrap.querySelector(".frow-body textarea")?.focus({ preventScroll: true }), 150);
  };

  const methodSeg = h("div", { class: "seg" }, Object.entries(METHOD_EN).map(([k, v]) => h("button", { class: offer.method === k ? "on" : "", onclick: (e) => {
    offer.method = k; methodSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === e.currentTarget)); save(); update();
  } }, v)));
  // "Save to repo": a pull request with the offer file merged (github.js, merge.js). The hover card says what and why.
  const saveBtn = h("button", { class: "btn primary", onclick: async () => {
    if (!settings.ghToken()) return aiSettingsDialog(() => settings.ghToken() && saveBtn.click());
    const n = problems(offer);
    if (n && !confirm(`В оффере ${n} замечаний. Всё равно сохранить в репозиторий?`)) return;
    const [game, slug] = (offer.id || "").replace(/^new:/, "").split("/");
    saveBtn.disabled = true; saveLabel.textContent = "Saving…";
    try {
      const r = await saveOffer({ token: settings.ghToken(), path: `offers/${game}/${slug}.md`, exported: exportMd(offer), title: offer.title, who: me().name, whoId: me().id, slug });
      if (r.nothing) toast("Изменений нет — в репозитории уже эта версия");
      else { offer.pr = { url: r.url, number: r.number, at: new Date().toISOString() }; save(); toast(`Pull request #${r.number} создан`); }
    } catch (e) { toast(explainGithub(e), true); }
    finally { saveBtn.disabled = false; saveLabel.textContent = "Save to repo"; }
  } }, ic("save"), h("span", {}, "Save to repo"));
  const saveLabel = saveBtn.lastChild;
  const saveWrap = h("span", { class: "hover-tip" }, saveBtn, h("span", { class: "hover-pop", role: "tooltip" },
    h("b", {}, "Сохранить в репозиторий"),
    h("span", {}, h("i", {}, "Что делает. "), `Создаёт pull request в ${REPO}: тексты оффера вливаются в его файл offers/…/*.md, бриф, паспорт цифр и журнал сохраняются, в журнал добавляется строка о правке.`),
    h("span", {}, h("i", {}, "Зачем. "), "Сейчас правки есть только в этом браузере. После принятия pull request они в репозитории — у всей команды, не пропадут при очистке браузера и попадут на сайт при публикации."),
    h("span", { class: "mini" }, settings.ghToken() ? "Токен GitHub подключён." : "Нужен токен GitHub — «Настройки ИИ» → GitHub.")));
  const ownerSel = h("select", { class: "mini-select", title: "Кто собирает оффер", onchange: (e) => { offer.owner = e.target.value || null; save(); } },
    h("option", { value: "" }, "nobody"), USERS.map((x) => h("option", { value: x.id, selected: offer.owner === x.id }, x.name)));

  // "Собрать из брифа": the whole offer again from the brief, with one undo.
  const composeBtn = h("button", { class: "btn", title: "Claude пишет все поля заново по брифу", onclick: async () => {
    if (needsKey()) return aiSettingsDialog(() => composeBtn.click());
    if (hasCopy(offer.boxes) && !confirm("Собрать оффер заново из брифа?\n\nВсе тексты заменятся. Вернуть их можно кнопкой «Undo rebuild» сразу после.")) return;
    composeBtn.disabled = true; composeBtn.textContent = "Building…";
    toast("Claude пишет все поля — обычно до минуты");
    try {
      const prev = offer.boxes;
      offer.boxes = await AI.compose(offer);
      pendingUndo = { id, boxes: prev };
      ls.del(sk);
      delete offer.factCheck; offer.autoFact = useApi(); // in the chat mode Fact check is one more copy-paste, so it waits for the button
      save(); editorPage(id); toast("Оффер собран — проверьте подсвеченные поля");
    } catch (e) {
      const msg = await explainError(e);
      if (msg) toast(msg, true);
    } finally { composeBtn.disabled = false; composeBtn.textContent = "✦ Rebuild from brief"; }
  } }, "✦ Rebuild from brief");
  const undoCompose = pendingUndo && pendingUndo.id === id ? h("div", { class: "banner info" }, h("span", { style: { flex: 1 } }, "Оффер собран заново из брифа."),
    h("button", { class: "btn", onclick: () => { offer.boxes = pendingUndo.boxes; pendingUndo = null; ls.del(sk); save(); editorPage(id); toast("Вернули тексты до сборки"); } }, ic("undo"), "Undo rebuild")) : null;
  if (pendingUndo && pendingUndo.id !== id) pendingUndo = null;

  const archHint = h("p", { class: "hint" }, (ARCHETYPES[offer.brief.archetype] || ["", ""])[1]);
  const filled = () => BRIEF_FIELDS.flatMap(([, f]) => f).filter(([k]) => offer.brief[k]).length;
  const briefCount = h("span", { class: "mini" });
  const briefPanel = h("details", { class: "card brief-panel", open: !hasCopy(offer.boxes) },
    h("summary", {}, h("b", {}, "Brief"), briefCount, h("span", { class: "hint" }, "факты для текстов и проверок · на сайт не попадает")),
    h("div", { style: { padding: "0 16px 14px" } }, archHint, briefForm(offer.brief, (k) => {
      if (k === "archetype") archHint.textContent = (ARCHETYPES[offer.brief.archetype] || ["", ""])[1];
      briefCount.textContent = `${filled()} of ${BRIEF_FIELDS.flatMap(([, f]) => f).length}`;
      save(); update();
      if (["product", "archetype", "faqSupport"].includes(k)) faqDraws.forEach((f) => f());
    }, () => offer.game, () => offer.title)));
  briefCount.textContent = `${filled()} of ${BRIEF_FIELDS.flatMap(([, f]) => f).length}`;

  shell(id, (burger) => h("div", {},
    h("div", { class: "head" },
      h("div", { class: "row", style: { justifyContent: "space-between" } },
        h("div", { class: "row" }, burger, h("span", { class: "crumbs" }, h("a", { href: "#/all" }, gameName(offer.game)), "›", offer.slug || "")),
        h("div", { class: "row" },
          h("span", { class: "mini" }, "Built by"), ownerSel,
          h("button", { class: "btn icon", title: "Скопировать оффер как .md", onclick: () => copy("", exportMd(offer), true, "оффер в формате .md") }, ic("copy")),
          saveWrap,
          h("button", { class: "btn icon", title: "Копировать оффер", onclick: () => duplicateOffer(offer) }, ic("dup")),
          base && ls.get(key) ? h("button", { class: "btn icon", title: "Сбросить правки до версии из репозитория", onclick: () => { if (confirm("Сбросить правки и вернуть версию из репозитория?")) { ls.del(key); editorPage(id); } } }, ic("undo")) : null,
          h("button", { class: "btn icon", title: "Удалить оффер", onclick: () => deleteOffer(offer) }, ic("trash")))),
      h("div", { class: "title-row" }, h("input", { class: "title-input", value: offer.title, oninput: (e) => { offer.title = e.target.value; save(); } }), methodSeg),
      h("div", { class: "progress" }, progLabel, h("span", { class: "pbar" }, progBar), progNote, copyNote, h("span", { style: { flex: 1 } }),
        h("button", { class: "btn", title: "Открыть следующее поле с замечанием", onclick: nextIssue }, "Next issue ↓"), factBtn, composeBtn)),
    h("div", { class: "content" }, undoCompose, draft, briefPanel, factBox, banners, sections)));
  update();
  drawFacts();
  if (offer.autoFact) { delete offer.autoFact; save(); runFacts(); }
}

// ---------- router ----------
function route() {
  const hsh = location.hash;
  let m;
  if ((m = hsh.match(/^#\/offer\/(.+)$/))) editorPage(decodeURIComponent(m[1]));
  else if ((m = hsh.match(/^#\/u\/([\w-]+)$/))) userPage(m[1]);
  else if (hsh === "#/all") allPage();
  else if (hsh === "#/how") docsPage();
  else if (me()) location.hash = `#/u/${me().id}`;
  else pickUser();
  document.querySelector(".main")?.scrollTo(0, 0);
}

fetch("data/offers.json")
  .then((r) => r.json())
  .then((data) => { OFFERS = data; window.addEventListener("hashchange", route); route(); })
  .catch((e) => root.replaceChildren(h("p", { style: { padding: "24px", color: "#ffb648" } }, "Не удалось загрузить data/offers.json: " + e.message)));
