// Vercel Serverless Function — /api/leaderboard
// POST { room, pairId, nameA, charA, nameB, charB, score } -> records/updates
//   this couple's compat score in their viral-chain "room"
// GET  ?room=<id>&pair=<pairId> -> { top: [...], myRank, total }
//
// Requires a Redis database connected to this Vercel project (Storage tab ->
// Upstash for Redis). Vercel injects KV_REST_API_URL / KV_REST_API_TOKEN
// (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) automatically once
// that's connected — no manual env var typing needed for this one.

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

function clip(s) {
  return String(s || "").slice(0, 40);
}

module.exports = async function handler(req, res) {
  const redis = getRedis();
  if (!redis) {
    res.status(500).json({
      error: "db_not_configured",
      message: "Redis가 아직 연결되지 않았어요. (관리자: Vercel Storage 탭에서 Upstash Redis를 연결해주세요)",
    });
    return;
  }

  try {
    if (req.method === "POST") {
      const body = req.body || {};
      const room = body.room;
      const pairId = body.pairId;
      const score = Number(body.score);
      if (!room || !pairId || Number.isNaN(score)) {
        res.status(400).json({ error: "missing_data" });
        return;
      }

      const zkey = "lovedna:lb:" + room;
      const mkey = "lovedna:meta:" + room;

      await redis.zadd(zkey, { score: score, member: pairId });
      await redis.hset(mkey, {
        [pairId]: JSON.stringify({
          nameA: clip(body.nameA),
          charA: clip(body.charA),
          nameB: clip(body.nameB),
          charB: clip(body.charB),
          ts: Date.now(),
        }),
      });

      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "GET") {
      const room = (req.query && req.query.room) || "";
      const pairId = (req.query && req.query.pair) || "";
      if (!room) {
        res.status(400).json({ error: "missing_room" });
        return;
      }

      const zkey = "lovedna:lb:" + room;
      const mkey = "lovedna:meta:" + room;

      const raw = await redis.zrange(zkey, 0, 9, { rev: true, withScores: true });
      // @upstash/redis returns a flat [member, score, member, score, ...] array
      const idsInOrder = [];
      const scoreById = {};
      for (let i = 0; i < raw.length; i += 2) {
        const id = raw[i];
        idsInOrder.push(id);
        scoreById[id] = Number(raw[i + 1]);
      }

      let metaById = {};
      if (idsInOrder.length) {
        const metaList = await redis.hmget(mkey, ...idsInOrder);
        idsInOrder.forEach(function (id) {
          try {
            metaById[id] = JSON.parse(metaList[id] || "{}");
          } catch (e) {
            metaById[id] = {};
          }
        });
      }

      const top = idsInOrder.map(function (id) {
        const meta = metaById[id] || {};
        return {
          pairId: id,
          score: scoreById[id],
          nameA: meta.nameA || "",
          charA: meta.charA || "",
          nameB: meta.nameB || "",
          charB: meta.charB || "",
        };
      });

      let myRank = null;
      if (pairId) {
        const rank = await redis.zrevrank(zkey, pairId);
        myRank = rank === null || rank === undefined ? null : rank + 1;
      }
      const total = await redis.zcard(zkey);

      res.status(200).json({ top: top, myRank: myRank, total: total });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
};
