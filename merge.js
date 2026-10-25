// Merge an offer exported from Content-helper into its file in the repository. Used by the "Save to repository"
// button (app.js → GitHub) and by `node tools/apply.mjs`, so both change the file the same way:
// copy blocks are matched by type + label and replaced, new ones go before the journal, the method / owner /
// status tags are updated, and a row about the change is added to the journal. Briefs, notes and the rest stay.
import { parseMd } from "./rules.js?v=127df33a";

const key = (kind, label) => `${kind}|${label.replace(/accent=\w+/, "").trim()}`;
const info = (b) => [b.kind, b.label, b.accent === "orange" ? "accent=orange" : ""].filter(Boolean).join(" ");
// template scaffolding ("### Your wins", "Q: ", "1. ") is not copy — an empty new block is not added
const hasCopy = (b) => b.lines.some((l) => l.trim() && !/^(#{2,3}( .*)?|[QA]:|\d+\.)$/.test(l.trim()));
const tag = (md, name, value, re) => {
  const t = `<!-- content-helper: ${name}=${value} -->`;
  return re.test(md) ? md.replace(re, t) : md.replace(/^(# [^\n]+\n)/, `$1\n${t}\n`);
};

// existing: the current file (or "" for a new offer); exported: the .md Content-helper exports.
// opts: { who, date } for the journal row. Returns { md, changed: [labels], added, removed }.
export function mergeOffer(existing, exported, opts = {}) {
  exported = exported.replace(/\r\n?/g, "\n");
  if (!existing || !existing.trim()) return { md: exported, changed: ["весь оффер"], added: 0, removed: 0, created: true };
  let md = existing.replace(/\r\n?/g, "\n");
  const exp = parseMd(exported);
  const fresh = new Map(exp.boxes.map((b) => [key(b.kind, b.label), b]));
  const used = new Set(), changed = [];
  let removed = 0;

  md = md.replace(/^```copy ([a-z0-9-]+)([^\n]*)\n([\s\S]*?)^```\n?/gm, (whole, kind, rest, body) => {
    const k = key(kind, rest), b = fresh.get(k);
    if (!b) { removed++; changed.push(`${kind} ${rest.trim()}`.trim() + " (убран)"); return ""; }
    used.add(k);
    const next = b.lines.join("\n");
    if (next !== body.replace(/\n$/, "")) changed.push(`${kind}${b.label ? " · " + b.label : ""}`);
    return "```copy " + info(b) + "\n" + next + "\n```\n";
  });

  const added = exp.boxes.filter((b) => !used.has(key(b.kind, b.label)) && hasCopy(b));
  if (added.length) {
    const block = ["## Копибоксы: добавлено в content-helper", ""].concat(...added.map((b) => ["```copy " + info(b), ...b.lines, "```", ""])).join("\n");
    md = md.includes("\n## Журнал") ? md.replace("\n## Журнал", "\n" + block + "\n## Журнал") : md + "\n" + block;
    for (const b of added) changed.push(`${b.kind}${b.label ? " · " + b.label : ""} (новый)`);
  }

  if (exp.method) md = tag(md, "method", exp.method, /<!-- content-helper: method=[\w-]+ -->/);
  const owner = (exported.match(/<!-- content-helper: owner=([\w-]+) -->/) || [])[1];
  if (owner) md = tag(md, "owner", owner, /<!-- content-helper: owner=[\w-]+ -->/);
  const status = (exported.match(/<!-- content-helper: status=(new|rework) -->/) || [])[1];
  if (status) md = tag(md, "status", status, /<!-- content-helper: status=\w+ -->/);

  // every change of an offer is logged in its journal (CLAUDE.md)
  if (changed.length && opts.who) md = journal(md, opts.date || new Date().toLocaleDateString("ru-RU"), changed, opts.who);
  return { md, changed, added: added.length, removed };
}

function journal(md, date, changed, who) {
  const at = md.indexOf("\n## Журнал");
  const what = changed.length > 4 ? `${changed.slice(0, 4).join(", ")} и ещё ${changed.length - 4}` : changed.join(", ");
  if (at < 0) return md.trimEnd() + `\n\n## Журнал\n| Дата | Блок | Было | Стало | Причина |\n|---|---|---|---|---|\n| ${date} | ${what} | — | правка в Content-helper | ${who} |\n`;
  const lines = md.slice(at + 1).split("\n");
  const head = lines.findIndex((l) => l.startsWith("|"));
  if (head < 0) return md;
  const cols = lines[head].split("|").length - 2;
  let last = head;
  while (lines[last + 1] && lines[last + 1].startsWith("|")) last++;
  const cells = [date, what.replace(/\|/g, "/"), "—", "правка в Content-helper", who];
  while (cells.length < cols) cells.push("—");
  lines.splice(last + 1, 0, `| ${cells.slice(0, Math.max(cols, 5)).join(" | ")} |`);
  return md.slice(0, at + 1) + lines.join("\n");
}
