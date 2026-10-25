// FAQ questions to pick from: the support team's questions (brief "faqSupport") first, then questions already on
// Overgear pages for this game and product (faq-bank.js), then the question forms the site uses, filled with
// this offer's game and product. The content manager ticks the ones that go into the FAQ block.
import { FAQ_BANK } from "./faq-bank.js?v=127df33a";
import { GAMES } from "./rules.js?v=127df33a";

// Question forms that recur on Overgear pages. {be} is/are, {do} does/do, {much} much/many — by the product's number.
const FORMS = {
  service: [
    "What is included in {game} {product} Boost?",
    "How long does {game} {product} Boost take?",
    "What do I need before ordering {game} {product} Boost?",
    "How does {game} {product} Boost work?",
    "What level is required for {product} in {game}?",
    "What rewards {do} {product} give in {game}?",
    "How hard {be} {product} in {game}?",
    "Can I play my character during {game} {product} Boost?",
    "What happens after {product} {be} done in {game}?",
    "Is {product} worth doing solo in {game}?",
  ],
  trade: [
    "What {be} {product} used for in {game}?",
    "How do you get {product} in {game}?",
    "How fast is {game} {product} delivery?",
    "How does the {game} {product} trade work?",
    "How {much} {product} do I need in {game}?",
    "How much {be} {product} worth in {game}?",
    "How do players farm {product} in {game}?",
    "Which league or server can I get {game} {product} on?",
    "Do I need to be online to receive {game} {product}?",
    "Can I get {game} {product} on PC and console?",
  ],
};
const TRADE = ["currency", "item"];
// Questions that invite self-praise ("What is the best site…") never make a useful FAQ.
const SELLING = /\b(best|safest|cheapest|trusted|legit|reliable)\b/i;

const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9']{3,}/g)?.map((w) => w.replace(/s$/, "")) || []);
export const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

function fill(form, game, product) {
  const plural = /[^s]s$/i.test(product);
  return form.replace("{game}", game).replace("{product}", product)
    .replace("{be}", plural ? "are" : "is").replace("{do}", plural ? "do" : "does").replace("{much}", plural ? "many" : "much");
}

export function faqCandidates(offer, n = 10) {
  const b = offer.brief || {}, product = (b.product || "").trim();
  const game = (GAMES[offer.game] || [offer.game, offer.game])[1];
  const out = [], seen = new Set();
  // A form that asks what a site question already asks ("What is Divine Orb used for" after "What are Divine Orbs used for") is skipped.
  const same = (a, c) => { const x = words(a), y = words(c), inter = [...x].filter((w) => y.has(w)).length; return inter / new Set([...x, ...y]).size >= 0.7; };
  const add = (q, kind, from) => {
    const k = q.toLowerCase().replace(/\s+/g, " ");
    if (!q || seen.has(k) || out.length >= n || out.some((x) => same(x.q, q))) return;
    seen.add(k); out.push({ q, kind, from });
  };
  for (const q of lines(b.faqSupport)) add(q.endsWith("?") ? q : q + "?", "support", "саппорт");
  // From the site: questions of this very offer page, or ones that name every word of the product.
  const want = words(product);
  const bank = (FAQ_BANK[offer.game] || []).filter((x) => !SELLING.test(x.q)).filter((x) => {
    const own = offer.slug && x.from.endsWith("/" + offer.slug), has = words(x.q);
    return own || (want.size > 0 && [...want].every((w) => has.has(w)));
  });
  for (const x of bank) add(x.q, "site", x.from);
  if (product) for (const f of FORMS[TRADE.includes(b.archetype) ? "trade" : "service"]) add(fill(f, game, product), "form", "форма с сайта");
  return out;
}
