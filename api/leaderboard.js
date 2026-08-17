// Vercel Serverless Function — /api/leaderboard
// POST { pairId, nameA, charA, nameB, charB, score } -> records/updates this
//   couple's compat score on the single, app-wide leaderboard
// GET  ?pair=<pairId> -> { top: [...], myRank, total }
//
// This is a GLOBAL leaderboard: every couple who completes a compat test in
// LOVE DNA competes on the same ranking, regardless of which invite link
// they came in through.
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

// @upstash/redis auto-deserializes JSON-looking string values when reading
// them back (hget/hmget/hgetall etc. return an already-parsed object, not
// the raw string) — so we must NOT call JSON.parse() again on the result.
// This helper handles both that case and the raw-string fallback case
// safely, whichever the SDK gives us.
function safeParseMeta(v) {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch (e) {
      return {};
    }
  }
  return {};
}

var ZKEY = "lovedna:lb:global";
var MKEY = "lovedna:meta:global";

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
      const pairId = body.pairId;
      const score = Number(body.score);
      if (!pairId || Number.isNaN(score)) {
        res.status(400).json({ error: "missing_data" });
        return;
      }

      await redis.zadd(ZKEY, { score: score, member: pairId });
      await redis.hset(MKEY, {
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
      const pairId = (req.query && req.query.pair) || "";

      const raw = await redis.zrange(ZKEY, 0, 9, { rev: true, withScores: true });
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
        const metaList = await redis.hmget(MKEY, ...idsInOrder);
        idsInOrder.forEach(function (id) {
          metaById[id] = safeParseMeta(metaList ? metaList[id] : null);
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
        const rank = await redis.zrevrank(ZKEY, pairId);
        myRank = rank === null || rank === undefined ? null : rank + 1;
      }
      const total = await redis.zcard(ZKEY);

      res.status(200).json({ top: top, myRank: myRank, total: total });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
};
