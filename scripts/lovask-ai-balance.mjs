// Read-only balance check for the AI providers used by bot conversations.
const money = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "bilinmiyor";

async function getJson(url, key) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function balances(keys = process.env, request = getJson) {
  const lines = ["Lovask bot konuşmaları · AI bakiyesi"];
  if (keys.OPENROUTER_API_KEY) {
    try {
      const { data } = await request("https://openrouter.ai/api/v1/key", keys.OPENROUTER_API_KEY);
      lines.push(data?.limit_remaining == null
        ? `OpenRouter: anahtar limiti yok; kullanım $${money(data?.usage)}`
        : `OpenRouter: anahtar kalan $${money(data.limit_remaining)}; kullanım $${money(data.usage)}`);
    } catch (error) { lines.push(`OpenRouter: okunamadı (${error.message})`); }
  }
  if (keys.OPENROUTER_MANAGEMENT_KEY) {
    try {
      const { data } = await request("https://openrouter.ai/api/v1/credits", keys.OPENROUTER_MANAGEMENT_KEY);
      lines.push(`OpenRouter hesap bakiyesi: $${money(Number(data?.total_credits) - Number(data?.total_usage))}`);
    } catch (error) { lines.push(`OpenRouter hesap bakiyesi: okunamadı (${error.message})`); }
  } else if (keys.OPENROUTER_API_KEY) lines.push("OpenRouter hesap bakiyesi: yönetim anahtarı gerekli.");
  if (keys.DEEPSEEK_API_KEY) {
    try {
      const data = await request("https://api.deepseek.com/user/balance", keys.DEEPSEEK_API_KEY);
      const balances = Array.isArray(data.balance_infos) ? data.balance_infos : [];
      lines.push(...balances.map((item) => `DeepSeek: kalan ${money(item.total_balance)} ${item.currency}`));
      if (!balances.length) lines.push("DeepSeek: bakiye bilgisi yok");
    } catch (error) { lines.push(`DeepSeek: okunamadı (${error.message})`); }
  }
  if (keys.GEMINI_API_KEY) lines.push("Gemini: bakiye Google AI Studio Billing ekranından görülebilir.");
  if (keys.OPENAI_API_KEY) lines.push("OpenAI: bakiye API anahtarıyla doğrudan sorgulanamıyor; Usage/Billing ekranına bak.");
  if (lines.length === 1) lines.push("Yapılandırılmış AI anahtarı bulunamadı.");
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("lovask-ai-balance.mjs")) {
  if (process.argv.includes("--self-test")) {
    const result = await balances({ OPENROUTER_API_KEY: "test", DEEPSEEK_API_KEY: "test" }, async (url) => url.includes("openrouter") ? { data: { limit_remaining: 12.5, usage: 3 } } : { balance_infos: [{ total_balance: "7.25", currency: "USD" }] });
    if (!result.includes("$12.50") || !result.includes("7.25 USD")) process.exitCode = 1;
  } else console.log(await balances());
}
