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
    const elementTag = p.characterElement ? ` / 기운: ${p.characterElement}` : "";
    return `${p.n || "익명"} (캐릭터: ${p.characterName || p.c || ""}${elementTag} / MBTI: ${p.mbti || "미상"} / ${statsLine})`;
  }

  const signalsLine = Array.isArray(signals) && signals.length
    ? signals.map((s, i) => `${i + 1}) ${s}`).join("\n")
    : "(제공된 신호 없음 — 능력치 데이터만으로 직접 판단)";

  return `너는 관계 데이터 분석과 사주의 오행(五行) 기운 해석을 함께 다루는 전문 분석가야. 두 사람의 심리 성향 데이터와 각자가 타고난 "기운"을 결합해서, 마치 정밀 진단을 내리듯 확신 있고 구체적인 톤으로 리포트를 써. "~일 수도 있어요", "~일 것 같아요" 같은 애매하고 가벼운 표현은 최소화하고, 단정적이고 전문적인 문장을 써. 장난스럽거나 가벼운 말투는 쓰지 마.

[분석 대상]
A. ${describePerson(me)}
B. ${describePerson(partner)}

[궁합 데이터] 종합 ${compat && compat.overall != null ? compat.overall : "?"}점 / 끌림 ${compat?.scores?.attraction ?? "?"} / 대화 ${compat?.scores?.conversation ?? "?"} / 애정표현 ${compat?.scores?.affection ?? "?"} / 생활궁합 ${compat?.scores?.lifestyle ?? "?"} / 갈등위험 ${compat?.scores?.conflictRisk ?? "?"} / 장기연애 ${compat?.scores?.longTerm ?? "?"}

[무료 버전에서 아래 신호를 이미 예고했어. 유료 리포트에서는 이 신호를 반드시 더 깊이 파고들어서, 두 사람의 기운(오행) 조합을 근거로 왜 이 신호가 나타났는지, 관계의 어느 시기(예: 초반 1~3개월, 3~6개월, 6개월~1년, 1년 이상)에 두드러지는지 명시하고, 그 시기에 각자 무엇을 조심하고 어떻게 행동해야 하는지까지 알려줘:]
${signalsLine}

[글쓰기 규칙 — 반드시 지켜]
- 각 항목은 짧고 임팩트 있는 문장 2~3개로 구성해. 한 문장은 40자 내외로 짧게 끊어 써.
- 문장과 문장 사이에는 반드시 줄바꿈(\\n)을 넣어서 문단이 아니라 짧은 문장들이 나열되게 써 (예: "문장1.\\n문장2.\\n문장3.").
- 최소 한 군데 이상에서 두 사람의 기운(예: 불×물, 나무×쇠)을 직접 언급하며 그 조합이 관계에 미치는 영향을 설명해.
- personal_advice는 반드시 "OO님, ~해주세요" 같은 직접 화법의 한 문장으로, 지금 바로 실천할 수 있는 구체적 행동 하나만 제안해.

아래 JSON 형식으로만 답해. 다른 설명, 마크다운, 코드블록 없이 순수 JSON 객체 하나만 출력해:

{
  "conflict_pattern": "위 신호를 포함해 두 사람 사이에 반복될 갈등 패턴과, 그 패턴이 나타나는 구체적 시기 (짧은 문장 2~3개, \\n으로 구분)",
  "attraction_reason": "두 사람의 기운과 데이터에 근거한, 서로에게 끌리는 진짜 이유 (짧은 문장 2~3개, \\n으로 구분)",
  "affection_style_gap": "각자 원하는 애정표현 방식의 차이와, 그 차이가 문제로 불거지기 쉬운 시기 (짧은 문장 2~3개, \\n으로 구분)",
  "fight_behavior": "싸웠을 때 각자의 행동 패턴과 화해까지 걸리는 경향 (짧은 문장 2~3개, \\n으로 구분)",
  "who_tires_first": "둘 중 먼저 지칠 가능성이 있는 사람과 그 시기, 예방법 (짧은 문장 2~3개, \\n으로 구분)",
  "long_term_outlook": "장기 연애 가능성과, 관계를 지키기 위해 특히 주의해야 할 시기와 행동 (짧은 문장 2~3개, \\n으로 구분)",
  "personal_advice": {
    "me": "${me && me.n ? me.n : "A"}님에게 주는 한 줄 조언 — 직접 화법, 구체적 행동 하나",
    "partner": "${partner && partner.n ? partner.n : "B"}님에게 주는 한 줄 조언 — 직접 화법, 구체적 행동 하나"
  }
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
