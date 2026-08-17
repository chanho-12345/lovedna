// Vercel Serverless Function — POST /api/subscribe
// Body: { pairId, nameA, nameB, subscription } -> stores a Web Push
// subscription for this couple, so /api/notify-rank can alert them once a
// day if they're in the top 3 of the global leaderboard.

let Redis;
try {
  Redis = require("@upstash/redis").Redis;
} catch (e) {
  Redis = null;
}

function getRedis() {
  if (!Redis) return null;
  try {
    return Redis.fromEnv();
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res.status(500).json({ error: "db_not_configured" });
    return;
  }

  try {
    const body = req.body || {};
    const pairId = body.pairId;
    const subscription = body.subscription;
    if (!pairId || !subscription || !subscription.endpoint) {
      res.status(400).json({ error: "missing_data" });
      return;
    }

    const key = "lovedna:push:" + pairId;
    await redis.sadd(
      key,
      JSON.stringify({
        subscription: subscription,
        nameA: String(body.nameA || "").slice(0, 40),
        nameB: String(body.nameB || "").slice(0, 40),
      })
    );

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
};
