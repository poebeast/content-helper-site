// "Save to repo": a pull request to the private repository with the offer file merged (app/merge.js).
// Runs in the browser with the participant's own GitHub token (kept in their localStorage, sent only to
// api.github.com). The token needs access to this one repository: Contents and Pull requests, read and write.
import { mergeOffer } from "./merge.js?v=127df33a";

export const REPO = "poebeast/content-helper";
const API = "https://api.github.com";
const b64 = (s) => { let bin = ""; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

async function gh(token, path, opts = {}) {
  const r = await fetch(API + path, {
    method: opts.method || "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (r.status === 404 && opts.allow404) return null;
  if (!r.ok) { const e = new Error(`GITHUB_${r.status}`); e.status = r.status; e.detail = (await r.json().catch(() => ({}))).message || ""; throw e; }
  return r.status === 204 ? null : r.json();
}

// path: offers/<game>/<slug>.md; exported: the .md Content-helper exports; who / whoId: the participant.
export async function saveOffer({ token, path, exported, title, who, whoId, slug }) {
  if (!token) throw new Error("NO_TOKEN");
  const repo = await gh(token, `/repos/${REPO}`);
  const base = repo.default_branch;
  const head = await gh(token, `/repos/${REPO}/git/ref/heads/${base}`);
  const file = await gh(token, `/repos/${REPO}/contents/${encodeURI(path)}?ref=${base}`, { allow404: true });
  const r = mergeOffer(file ? unb64(file.content) : "", exported, { who, date: new Date().toLocaleDateString("ru-RU") });
  if (!r.created && !r.changed.length) return { nothing: true };
  const branch = `content-helper/${whoId}-${slug}-${Date.now().toString(36)}`;
  await gh(token, `/repos/${REPO}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: head.object.sha } });
  await gh(token, `/repos/${REPO}/contents/${encodeURI(path)}`, { method: "PUT", body: { message: `${title}: правка в Content-helper (${who})`, content: b64(r.md), branch, ...(file ? { sha: file.sha } : {}) } });
  const body = [`Правка из Content-helper — ${who}.`, "", r.created ? `Новый оффер: \`${path}\`.` : `Изменено в \`${path}\`:`, ...(r.created ? [] : r.changed.map((c) => `- ${c}`)), "",
    "Тексты влиты в файл оффера; бриф, паспорт цифр и журнал сохранены, в журнал добавлена строка о правке.",
    "После merge сайт Content-helper обновляется командой `node tools/publish.mjs`."].join("\n");
  const pr = await gh(token, `/repos/${REPO}/pulls`, { method: "POST", body: { title: `${title} — правка из Content-helper (${who})`, head: branch, base, body } });
  return { url: pr.html_url, number: pr.number, changed: r.changed, created: !!r.created };
}

export function explainGithub(e) {
  if (e.message === "NO_TOKEN") return "Нет токена GitHub — добавьте его в «Настройки ИИ» → GitHub.";
  if (e.status === 401) return "Токен GitHub не подошёл или истёк — создайте новый в «Настройках ИИ» → GitHub.";
  if (e.status === 403) return "У токена нет прав: нужны Contents и Pull requests — Read and write для " + REPO + ".";
  if (e.status === 404) return "Токен не видит репозиторий " + REPO + " — при создании токена выберите его в Repository access.";
  if (e.status === 409 || e.status === 422) return "Файл в репозитории только что изменился — нажмите ещё раз. " + (e.detail || "");
  if (e instanceof TypeError) return "Нет связи с GitHub.";
  return "Не получилось сохранить: " + (e.detail || e.message);
}
