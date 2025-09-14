import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req) {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { data } = await req.json();
    await redis.set("app-state", data ?? {});
    return Response.json({ ok: true });
  } catch (e) {
    console.error("KV save failed", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
