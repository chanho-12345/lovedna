// Vercel Serverless Function — GET /api/invite?p=<code>
// KakaoTalk / iMessage / etc. build their link-preview card from the
// target URL's static Open Graph meta tags, NOT from the text passed to
// navigator.share() — and they don't run JavaScript, so a plain static
// page can never show a per-person title. This function renders a tiny
// HTML page with the sharer's name + character baked into the og:title
// / og:description server-side, then immediately sends real visitors on
// to the actual interactive test page.

const LoveDNA = require("../logic.js");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

module.exports = async function handler(req, res) {
  const code = (req.query && req.query.p) || "";
  const scoreRaw = (req.query && req.query.s) || "";
  const score = scoreRaw && !isNaN(parseFloat(scoreRaw)) ? parseFloat(scoreRaw) : null;
  let data = null;
  try {
    data = code ? LoveDNA.decodeResult(code) : null;
  } catch (e) {
    data = null;
  }

  let title = "LOVE DNA — 나의 연애 유형 테스트";
  let desc = "18문항으로 알아보는 나의 연애 캐릭터. 궁합까지 확인해보세요 💘";

  if (data && data.s) {
    const ch = LoveDNA.assignCharacter(data.s);
    const name = data.n || "친구";
    if (score !== null) {
      // this link came from a couple's compat page — frame it as a challenge
      title = name + "님과의 궁합 점수는 " + score.toFixed(2) + "점!";
      desc = "나랑은 몇 점일까? 지금 도전하고 확인해보세요 🔥";
    } else {
      title = name + "님의 유형은 [" + ch.name + "]예요!";
      desc = "연인이든 썸이든 친구든, 케미 궁합이 궁금하면 지금 테스트해보세요 💘";
    }
  }

  const redirectUrl =
    "/test.html" +
    (code ? "?partner=" + encodeURIComponent(code) : "") +
    (score !== null ? (code ? "&" : "?") + "score=" + encodeURIComponent(score.toFixed(2)) : "");
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(desc);
  const safeRedirect = escapeHtml(redirectUrl);

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.status(200).send(
    "<!DOCTYPE html>" +
    '<html lang="ko"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>" + safeTitle + "</title>" +
    '<meta property="og:title" content="' + safeTitle + '">' +
    '<meta property="og:description" content="' + safeDesc + '">' +
    '<meta property="og:type" content="website">' +
    '<meta name="twitter:card" content="summary">' +
    '<meta http-equiv="refresh" content="0; url=' + safeRedirect + '">' +
    "<script>location.replace(" + JSON.stringify(redirectUrl) + ");</script>" +
    "</head><body>" +
    '<p>이동 중입니다... <a href="' + safeRedirect + '">여기를 눌러주세요</a></p>' +
    "</body></html>"
  );
};
