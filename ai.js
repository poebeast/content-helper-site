// "Build offer", "Regenerate" and "Fact check" through the API, with the participant's own key
// (kept in their localStorage, sent only to api.anthropic.com). The requests themselves live in prompts.js.
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm";
import { jsonSchemaOutputFormat } from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/helpers/json-schema/+esm";
import { settings } from "./ai-settings.js?v=127df33a";
import { SYSTEM, regenPrompt, variantSchema, regenVariants, composePrompt, COMPOSE_SCHEMA, composeBoxes, factPrompt, factResult } from "./prompts.js?v=127df33a";

const client = () => {
  const apiKey = settings.key();
  if (!apiKey) throw new Error("NO_KEY");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
};
const system = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
const beta = { headers: { "anthropic-beta": "server-side-fallback-2026-07-01" } }; // server-side fallback when a safety classifier declines

async function parse(user, schema) {
  const msg = await client().messages.parse(
    { model: settings.model(), max_tokens: 16000, output_config: { effort: "medium", format: jsonSchemaOutputFormat(schema) }, system, messages: [{ role: "user", content: user }], fallbacks: "default" },
    beta,
  );
  if (msg.stop_reason === "refusal") throw new Error("REFUSAL");
  if (msg.stop_reason === "max_tokens") throw new Error("TRUNCATED");
  if (!msg.parsed_output) throw new Error("EMPTY");
  return msg.parsed_output;
}

// target: {kind, label, lines} or {kind: "uvp", title: box, tooltips: box}
export async function regenerate(offer, target, feedback) {
  const isUvp = target.kind === "uvp";
  return regenVariants(await parse(regenPrompt(offer, target, feedback), variantSchema(isUvp)), isUvp);
}

export async function composeOffer(offer) {
  return composeBoxes(await parse(composePrompt(offer), COMPOSE_SCHEMA), offer);
}

export async function factCheck(offer) {
  const c = client(), messages = [{ role: "user", content: factPrompt(offer) }];
  let content = [], msg;
  // Server-side search may pause a long turn; send the partial answer back and the server continues.
  for (let n = 0; n < 4; n++) {
    msg = await c.messages.create(
      { model: settings.model(), max_tokens: 16000, output_config: { effort: "medium" }, system,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
        messages: content.length ? [...messages, { role: "assistant", content }] : messages, fallbacks: "default" },
      beta,
    );
    content = [...content, ...msg.content];
    if (msg.stop_reason !== "pause_turn") break;
  }
  if (msg.stop_reason === "refusal") throw new Error("REFUSAL");
  return factResult(content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

export function explain(err) {
  if (err instanceof SyntaxError) return "Ответ пришёл в неверном формате — попробуйте ещё раз.";
  if (err instanceof Anthropic.BadRequestError && /web_search/i.test(err.message)) return "Веб-поиск недоступен для этого ключа — администратор организации включает его в настройках на console.anthropic.com.";
  if (err.message === "EMPTY") return "Ответ пришёл пустым — попробуйте ещё раз.";
  if (err.message === "NO_KEY") return "Нет ключа API — добавьте его в «Настройки ИИ».";
  if (err.message === "REFUSAL") return "Модель отказалась отвечать на этот запрос — переформулируйте пожелание.";
  if (err.message === "TRUNCATED") return "Ответ оборвался — попробуйте ещё раз.";
  if (err instanceof Anthropic.AuthenticationError) return "Ключ API не подошёл — проверьте его в «Настройках ИИ».";
  if (err instanceof Anthropic.PermissionDeniedError) return "У ключа нет доступа к выбранной модели.";
  if (err instanceof Anthropic.RateLimitError) return "Слишком много запросов — подождите минуту.";
  if (err instanceof Anthropic.APIConnectionError) return "Нет связи с API Anthropic.";
  if (err instanceof Anthropic.APIError) return `Ошибка API (${err.status}): ${err.message}`;
  return "Не получилось: " + err.message;
}
