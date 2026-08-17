// Vercel Serverless Function — GET /api/notify-rank
// Triggered once a day by Vercel Cron (see vercel.json). Checks the top 3
// couples on the global leaderboard and sends each one a Web Push
// notification if they subscribed, e.g. "아직 1등이에요!".
//
// NOTE: Vercel's free "Hobby" plan only allows cron jobs to run once a day
// (and the exact minute can drift by up to ~59 minutes) — this is a daily
// check, not a real-time one. Running more often requires the Pro plan.

let Redis;
try {
  Redis = require("@upstash/redis").Redis;
} catch (e) {
  Redis = null;
}
let webpush;
try {
  webpush = require("web-push");
} catch (e) {
  webpush = null;
}

function getRedis() {
  if (!Redis) return null;
  try {
    return Redis.fromEnv();
  } catch (e) {
    return null;
  }
}

var ZKEY = "lovedna:lb:global";
var RANK_LABEL = ["🥇 1등", "🥈 2등", "🥉 3등"];

// Public VAPID key — not a secret, safe to hardcode (must match the one used
// client-side in result.js). Only the PRIVATE key needs to be a Vercel env var.
var VAPID_PUBLIC_KEY = "BMMcNDB9qakIvKU1We5XC-1mkuA6bccFMCX7IQU3A31iSaIQ6I1aPwDT-0iFIKDXydahmZeHUYEOrqGIY2draAw";
var VAPID_SUBJECT = "mailto:cksgh890@gmail.com";

module.exports = async function handler(req, res) {
  // optional extra protection: if the owner sets a CRON_SECRET env var,
  // only requests carrying it are accepted. Safe to leave unset for now.
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"] || "";
    if (auth !== "Bearer " + process.env.CRON_SECRET) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  }

  const redis = getRedis();
  if (!redis) {
    res.status(500).json({ error: "db_not_configured" });
    return;
  }
  if (!webpush) {
    res.status(500).json({ error: "web_push_not_installed" });
    return;
  }
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPrivate) {
    res.status(500).json({ error: "vapid_not_configured", message: "VAPID_PRIVATE_KEY 환경변수가 없어요." });
    return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivate);

  try {
    const raw = await redis.zrange(ZKEY, 0, 2, { rev: true, withScores: true });
    const top3 = [];
    for (let i = 0; i < raw.length; i += 2) top3.push({ pairId: raw[i], score: Number(raw[i + 1]) });

    let sent = 0;
    let removed = 0;

    for (let i = 0; i < top3.length; i++) {
      const pairId = top3[i].pairId;
      const key = "lovedna:push:" + pairId;
      const members = await redis.smembers(key);
      if (!members || !members.length) continue;

      for (const m of members) {
        // @upstash/redis auto-deserializes JSON-looking strings on read, so
        // `m` may already be an object here rather than a JSON string —
        // handle both, same as api/leaderboard.js.
        let entry = null;
        if (m && typeof m === "object") entry = m;
        else if (typeof m === "string") {
          try {
            entry = JSON.parse(m);
          } catch (e) {
            entry = null;
          }
        }
        if (!entry || !entry.subscription) continue;
        const payload = JSON.stringify({
          title: RANK_LABEL[i] + "이에요! 🏆",
          body: (entry.nameA || "우리") + " ♥ " + (entry.nameB || "") + " 커플, LOVE DNA 전체 순위 " + (i + 1) + "위 유지 중이에요!",
          url: "/",
        });
        try {
          await webpush.sendNotification(entry.subscription, payload);
          sent++;
        } catch (err) {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await redis.srem(key, m);
            removed++;
          }
        }
      }
    }

    res.status(200).json({ ok: true, sent: sent, removedExpired: removed });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
};
