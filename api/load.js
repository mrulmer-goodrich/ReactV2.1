import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const data = await redis.get("app-state");
    res.setHeader("Content-Type", "application/json");
    res.status(200).end(JSON.stringify({ data: data ?? null }));
  } catch (e) {
    console.error("KV load failed", e);
    res.setHeader("Content-Type", "application/json");
    res.status(500).end(JSON.stringify({ error: e.message }));
  }
}

