// Vercel Serverless Function — POST /api/report
// Generates the paid "심층 관계 리포트" using the Claude API.
// Requires the ANTHROPIC_API_KEY environment variable to be set in the
// Vercel project settings (Project -> Settings -> Environment Variables).
// The key is only ever used here, on the server — it is never sent to the browser.

function buildPrompt(me, partner, compat, signals) {
  const STAT_LABELS = { ae: "애정표현", jl: "질투", in: "독립성", cm: "헌신", es: "감정민감도", ca: "갈등회피" };

  function describePerson(p) {
    const statsLine = Object.keys(STAT_LABELS)
      .map((k) => `${STAT_LABELS[k]} ${p.s && p.s[k] != null ? p.s[k] : "?"}점`)
      .join(", ");
    return `${p.n || "익명"} (캐릭터: ${p.characterName || p.c || ""} / MBTI: ${p.mbti || "미상"} / ${statsLine})`;
  }

  const signalsLine = Array.isArray(signals) && signals.length
    ? signals.map((s, i) => `${i + 1}) ${s}`).join("\n")
    : "(제공된 신호 없음 — 능력치 데이터만으로 직접 판단)";

  return `너는 수천 커플의 성향 데이터를 분석해온 전문 관계 데이터 분석가야. 심리 성향 데이터와 통계 패턴에 근거해서, 마치 정밀 진단을 내리듯 확신 있고 구체적인 톤으로 리포트를 써. "~일 수도 있어요", "~일 것 같아요" 같은 애매하고 가벼운 표현은 최소화하고, 데이터에 기반한 단정적이고 전문적인 문장을 써. 장난스럽거나 가벼운 말투는 쓰지 마.

[분석 대상]
A. ${describePerson(me)}
B. ${describePerson(partner)}

[궁합 데이터] 종합 ${compat && compat.overall != null ? compat.overall : "?"}점 / 끌림 ${compat?.scores?.attraction ?? "?"} / 대화 ${compat?.scores?.conversation ?? "?"} / 애정표현 ${compat?.scores?.affection ?? "?"} / 생활궁합 ${compat?.scores?.lifestyle ?? "?"} / 갈등위험 ${compat?.scores?.conflictRisk ?? "?"} / 장기연애 ${compat?.scores?.longTerm ?? "?"}

[무료 버전에서 아래 신호를 이미 예고했어. 유료 리포트에서는 이 신호를 반드시 더 깊이 파고들어서 왜 이 신호가 나타났는지, 관계의 어느 시기(예: 초반 1~3개월, 3~6개월, 6개월~1년, 1년 이상)에 두드러지는지 명시하고, 그 시기에 각자 무엇을 조심하고 어떻게 행동해야 하는지까지 알려줘:]
${signalsLine}

아래 JSON 형식으로만 답해. 다른 설명, 마크다운, 코드블록 없이 순수 JSON 객체 하나만 출력해. 각 값은 한국어 3~5문장, 두 사람의 이름과 능력치 수치를 근거로 자연스럽게 언급하면서, 구체적인 시기와 행동 지침을 포함해서 작성해:

{
  "conflict_pattern": "위 신호를 포함해 두 사람 사이에 반복될 갈등 패턴과, 그 패턴이 나타나는 구체적 시기",
  "attraction_reason": "데이터에 근거한, 서로에게 끌리는 진짜 이유",
  "affection_style_gap": "각자 원하는 애정표현 방식의 차이와, 그 차이가 문제로 불거지기 쉬운 시기",
  "fight_behavior": "싸웠을 때 각자의 행동 패턴과 화해까지 걸리는 경향",
  "who_tires_first": "둘 중 먼저 지칠 가능성이 있는 사람과 그 시기, 예방하려면 어떻게 해야 하는지",
  "long_term_outlook": "장기 연애 가능성과, 관계를 지키기 위해 특히 주의해야 할 시기와 행동"
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
    const { me, partner, compat, signals } = req.body || {};
    if (!me || !partner) {
      res.status(400).json({ error: "missing_data" });
      return;
    }

    const prompt = buildPrompt(me, partner, compat, signals);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: "upstream_error", detail: detail.slice(0, 500) });
      return;
    }

    const data = await upstream.json();
    const textBlock = data && Array.isArray(data.content) ? data.content.find((b) => b && b.type === "text") : null;
    const raw = textBlock && textBlock.text;
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
