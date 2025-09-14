import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  const hasURL = !!process.env.KV_REST_API_URL;
  const hasTOKEN = !!process.env.KV_REST_API_TOKEN;

  let kvOk = false, kvError = null;
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    const key = "kv-debug-key";
    await redis.set(key, "ok", { ex: 30 }); // set with 30s TTL
    const val = await redis.get(key);
    kvOk = (val === "ok");
  } catch (e) {
    kvError = String(e?.message || e);
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).end(JSON.stringify({
    env: { KV_REST_API_URL: hasURL, KV_REST_API_TOKEN: hasTOKEN },
    kvOk,
    kvError,
  }));
}
