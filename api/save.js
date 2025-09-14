import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    // Handle both string and parsed bodies safely
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const { data } = JSON.parse(raw || "{}");

    await redis.set("app-state", data ?? {});
    res.setHeader("Content-Type", "application/json");
    return res.status(200).end(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error("KV save failed", e);
    res.setHeader("Content-Type", "application/json");
    return res.status(500).end(JSON.stringify({ error: e.message }));
  }
}
