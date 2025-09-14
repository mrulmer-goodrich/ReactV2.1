export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { data } = JSON.parse(req.body || "{}");
    if (!data) return res.status(400).json({ error: "Missing data" });

    const r = await fetch(`${process.env.KV_REST_API_URL}/set/demo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value: JSON.stringify(data) })
    });

    if (!r.ok) throw new Error("KV write failed");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
