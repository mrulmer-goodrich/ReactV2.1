import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler() {
  try {
    const data = await redis.get("app-state");
    return Response.json({ data: data ?? null });
  } catch (e) {
    console.error("KV load failed", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
