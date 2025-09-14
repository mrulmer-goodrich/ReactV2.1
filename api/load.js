// api/load.js
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    const data = await redis.get("appState");
    return res.status(200).json({ data: data ? JSON.parse(data) : null });
  } catch (e) {
    console.error("Load failed", e);
    return res.status(500).json({ error: "Load failed" });
  }
}
