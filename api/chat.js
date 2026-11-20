export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const provider = (req.body?.provider || "").toLowerCase();

  // Pilih endpoint upstream berdasarkan provider yang dipilih di UI
  const targetUrl =
    provider === "bykitsune"
      ? "https://api.bykitsune.com/v1/chat/completions"
      : "https://bandelbanget.xyz/v1/chat/completions";

  // Ambil key dari env Vercel sesuai provider, atau fallback ke key yang diisi
  const bykitsuneKey =
    process.env.BYKITSUNE_API_KEY || "Ask-kts-14e84739b88db996ceaa620cec9f3eb2";
  const bbtokenKey =
    process.env.BBTOKEN_API_KEY ||
    "sk-qwen-35d49aad7d69d30bcdbe5d05c9bbf205463ca54b9ddbc0f5";

  const selectedKey = provider === "bykitsune" ? bykitsuneKey : bbtokenKey;
  const authHeader = `Bearer ${selectedKey}`;

  // Bersihkan field 'provider' agar payload ke upstream tetap standar OpenAI-compatible
  const forwardBody = { ...(req.body || {}) };
  delete forwardBody.provider;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110000);

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(forwardBody),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err) {
    clearTimeout(timer);
    return res.status(502).json({
      error: { message: `Server proxy timeout / gagal terhubung: ${err.message}` },
    });
  }
}
