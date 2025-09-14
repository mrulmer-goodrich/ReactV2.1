// /api/save.js — Vercel Serverless Function (Node.js)
// Saves the entire app state into Vercel KV under the key 'seating-monitor-v7-1'.
// Body: { "data": <object> }

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { data } = req.body || {};
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: expected { data: <object> }' });
    }
    await kv.set('seating-monitor-v7-1', data);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('KV save error:', err);
    return res.status(500).json({ error: 'KV save error' });
  }
};
