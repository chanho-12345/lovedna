// Vercel Serverless Function — POST /api/report
// Generates the paid "심층 관계 리포트" using the Claude API.
// Requires the ANTHROPIC_API_KEY environment variable to be set in the
// Vercel project settings (Project -> Settings -> Environment Variables).
// The key is only ever used here, on the server — it is never sent to the browser.

function buildPrompt(me, partner, compat) {
  const STAT_LABELS = { ae: "애정표현", jl: "질투", in: "독립성", cm: "헌신", es: "감정민감도", ca: "갈등회피" };

  function describePerson(p) {
    const statsLine = Object.keys(STAT_LABELS)
      .map((k) => `${STAT_LABELS[k]}:${p.s && p.s[k] != null ? p.s[k] : "?"}`)
      .join(", ");
    return `이름:${p.n || "익명"} / 캐릭터:${p.characterName || p.c || ""} / MBTI:${p.mbti || "미상"} / 능력치(${statsLine})`;
  }

  return `너는 재미있고 통찰력 있는 연애 심리 코치야. 아래 두 사람의 연애 성향 테스트 결과를 보고, 실제 커플 상담처럼 구체적이고 공감 가는 톤으로(과하게 진지하지 않게, 하지만 가볍지도 않게) 분석 리포트를 써줘.

[사람 A]
${describePerson(me)}

[사람 B]
${describePerson(partner)}

[궁합 점수] 종합 ${compat && compat.overall != null ? compat.overall : "?"}점 / 끌림 ${compat?.scores?.attraction ?? "?"} / 대화 ${compat?.scores?.conversation ?? "?"} / 애정표현 ${compat?.scores?.affection ?? "?"} / 생활궁합 ${compat?.scores?.lifestyle ?? "?"} / 갈등위험 ${compat?.scores?.conflictRisk ?? "?"} / 장기연애 ${compat?.scores?.longTerm ?? "?"}

아래 JSON 형식으로만 답해. 다른 설명이나 마크다운 없이 순수 JSON 객체 하나만 출력해. 각 값은 한국어로 2~4문장, 두 사람의 이름과 능력치 수치를 자연스럽게 언급하면서 구체적으로 작성해:

{
  "conflict_pattern": "두 사람이 반복될 것 같은 갈등 패턴",
  "attraction_reason": "서로에게 끌리는 이유",
  "affection_style_gap": "각자 원하는 애정표현 방식의 차이",
  "fight_behavior": "싸웠을 때 각자의 행동 패턴",
  "who_tires_first": "둘 중 먼저 지칠 가능성이 있는 사람과 이유",
  "long_term_outlook": "장기 연애 가능성과 관계에서 주의해야 할 부분"
}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "server_not_configured", message: "ANTHROPIC_API_KEY가 Vercel 환경변수에 설정되어 있지 않아요." });
    return;
  }

  try {
    const { me, partner, compat } = req.body || {};
    if (!me || !partner) {
      res.status(400).json({ error: "missing_data" });
      return;
    }

    const prompt = buildPrompt(me, partner, compat);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: "upstream_error", detail: detail.slice(0, 500) });
      return;
    }

    const data = await upstream.json();
    const raw = data && data.content && data.content[0] && data.content[0].text;
    if (!raw) {
      res.status(502).json({ error: "empty_response", debug: JSON.stringify(data).slice(0, 800) });
      return;
    }

    let report;
    try {
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      report = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    } catch (parseErr) {
      res.status(502).json({ error: "parse_error", raw: raw.slice(0, 500) });
      return;
    }

    res.status(200).json({ report });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: e.message });
  }
};
