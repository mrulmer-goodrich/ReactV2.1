export default async function handler(req, res) {
  try {
    const r = await fetch(`${process.env.KV_REST_API_URL}/get/demo`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
      }
    });

    if (!r.ok) throw new Error("KV read failed");
    const { result } = await r.json();
    res.json({ data: result ? JSON.parse(result) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
