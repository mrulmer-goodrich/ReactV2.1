import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const data = await redis.get("app-state");
    return res.status(200).json({ data: data ?? null });
  } catch (e) {
    console.error("KV load failed", e);
    return res.status(500).json({ error: e.message });
  }
}
