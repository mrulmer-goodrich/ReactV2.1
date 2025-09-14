// /api/load.js — Vercel Serverless Function (Node.js)
// Returns the latest saved app state from Vercel KV.
// Requires @vercel/kv and project-linked KV (see README).

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const data = await kv.get('seating-monitor-v7-1');
    return res.status(200).json({ data: data || null });
  } catch (err) {
    console.error('KV load error:', err);
    return res.status(500).json({ error: 'KV load error' });
  }
};
