// api/save.js
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(req.body);
    await redis.set("appState", JSON.stringify(body.data));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Save failed", e);
    return res.status(500).json({ error: "Save failed" });
  }
}
