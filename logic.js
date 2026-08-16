/* LOVE DNA - core logic (no dependencies, runs in browser or Node) */
(function (root) {
  "use strict";

  // ---- 6 stats, fixed order (also the fixed radar-axis / legend order) ----
  var STAT_KEYS = ["ae", "jl", "in", "cm", "es", "ca"];
  var STAT_LABELS = {
    ae: "애정표현",
    jl: "질투",
    in: "독립성",
    cm: "헌신",
    es: "감정민감도",
    ca: "갈등회피",
  };

  // ---- 18 questions, 3 per stat, each answer worth 0-3 points on that stat ----
  var QUESTIONS = [
    // 애정표현 (ae)
    { stat: "ae", text: "좋아하는 사람이 생기면 나는…", options: [
      "티가 안 나게 숨긴다", "은근히 챙겨주는 걸로 표현한다", "자주 연락하고 마음을 표현한다", "대놓고 좋아한다고 말한다"
    ]},
    { stat: "ae", text: "연인에게 애정표현을 할 때 나는…", options: [
      "손발이 오그라들어서 잘 못한다", "행동으로 보여주는 편이다", "\"사랑해\" 같은 말을 자주 한다", "스킨십·말·선물 등 모든 방식으로 표현한다"
    ]},
    { stat: "ae", text: "SNS에 연인과 찍은 사진을 올리는 것에 대해…", options: [
      "절대 안 올린다, 사생활은 비공개", "가끔 은근슬쩍 올린다", "자랑하고 싶어서 종종 올린다", "매번 인증샷을 남기고 싶다"
    ]},
    // 질투 (jl)
    { stat: "jl", text: "연인이 이성 친구와 연락하는 걸 보면…", options: [
      "전혀 신경 안 쓴다", "조금 신경 쓰이지만 티는 안 낸다", "은근히 물어보게 된다", "바로 누구냐고 캐묻는다"
    ]},
    { stat: "jl", text: "연인의 SNS에 낯선 사람이 댓글을 달면…", options: [
      "신경도 안 쓴다", "살짝 눈여겨본다", "누군지 찾아본다", "바로 연인에게 물어본다"
    ]},
    { stat: "jl", text: "연인이 다른 사람과 즐겁게 대화하는 모습을 보면…", options: [
      "잘 어울려서 다행이라고 생각한다", "별생각 없다", "살짝 불안해진다", "마음이 복잡해지고 신경 쓰인다"
    ]},
    // 독립성 (in)
    { stat: "in", text: "연애를 해도 나는…", options: [
      "연인 중심으로 스케줄을 맞춘다", "웬만하면 같이 하려고 한다", "내 시간과 연애 둘 다 챙긴다", "내 개인 시간과 취미가 훨씬 중요하다"
    ]},
    { stat: "in", text: "친구들과의 약속과 연인과의 데이트가 겹치면…", options: [
      "무조건 연인을 먼저 챙긴다", "웬만하면 연인 쪽을 우선한다", "상황 봐서 정한다", "미리 잡은 약속이면 그대로 진행한다"
    ]},
    { stat: "in", text: "연인이 없을 때 나의 삶은…", options: [
      "좀 허전하고 불안하다", "그래도 잘 지내는 편이다", "혼자서도 충분히 만족스럽다", "오히려 자유롭고 편하다"
    ]},
    // 헌신 (cm)
    { stat: "cm", text: "연애를 시작하면 나는…", options: [
      "아직 좀 더 지켜본다", "천천히 마음을 열어간다", "이 사람에게 집중하기로 마음먹는다", "이 사람만 바라보고 최선을 다한다"
    ]},
    { stat: "cm", text: "연인과의 미래 계획(결혼·동거 등)에 대해…", options: [
      "아직 생각해본 적 없다", "나중 일이라 생각한다", "종종 진지하게 생각해본다", "구체적으로 그려보곤 한다"
    ]},
    { stat: "cm", text: "연애 중 힘든 시기가 와도 나는…", options: [
      "관계를 다시 생각해본다", "시간을 갖고 고민한다", "웬만하면 극복하려고 노력한다", "끝까지 함께하려고 노력한다"
    ]},
    // 감정민감도 (es)
    { stat: "es", text: "연인의 말투가 평소와 조금만 달라도…", options: [
      "전혀 눈치채지 못한다", "나중에서야 알아챈다", "바로 느낌이 온다", "미세한 변화까지 다 캐치한다"
    ]},
    { stat: "es", text: "연인과 다투고 나면 나는…", options: [
      "금방 잊고 훌훌 털어낸다", "하루 정도 지나면 괜찮아진다", "며칠 동안 계속 생각난다", "감정이 오래 남고 자꾸 곱씹는다"
    ]},
    { stat: "es", text: "슬픈 영화나 드라마를 볼 때 나는…", options: [
      "거의 감정 동요가 없다", "약간 뭉클한 정도다", "자주 눈물이 난다", "감정이입이 심해서 며칠 여운이 남는다"
    ]},
    // 갈등회피 (ca)
    { stat: "ca", text: "연인과 의견이 다를 때 나는…", options: [
      "바로 내 생각을 확실히 말한다", "대화로 풀어보려 한다", "굳이 부딪히지 않으려 한다", "그냥 넘어가는 게 편하다"
    ]},
    { stat: "ca", text: "화가 나는 일이 생겨도 나는…", options: [
      "바로 표현하는 편이다", "차분히 얘기한다", "웬만하면 참는 편이다", "갈등이 싫어서 그냥 넘긴다"
    ]},
    { stat: "ca", text: "연인과 다툴 것 같은 상황이 오면…", options: [
      "할 말은 하고 넘어간다", "대화로 오해를 풀려고 한다", "일단 자리를 피하고 본다", "아예 그 주제를 꺼내지 않는다"
    ]},
  ];

  // ---- scoring: answers = array of 18 ints (0-3), in QUESTIONS order ----
  function computeStats(answers) {
    var sums = { ae: 0, jl: 0, in: 0, cm: 0, es: 0, ca: 0 };
    var counts = { ae: 0, jl: 0, in: 0, cm: 0, es: 0, ca: 0 };
    QUESTIONS.forEach(function (q, i) {
      var v = answers[i];
      if (typeof v !== "number") return;
      sums[q.stat] += v;
      counts[q.stat] += 1;
    });
    var stats = {};
    STAT_KEYS.forEach(function (k) {
      var max = counts[k] * 3;
      stats[k] = max > 0 ? Math.round((sums[k] / max) * 100) : 0;
    });
    return stats; // {ae,jl,in,cm,es,ca} each 0-100
  }

  // ---- character archetypes, one per "dominant stat" ----
  var CHARACTERS = {
    ae: { key: "ae", emoji: "🌻", name: "표현왕 해바라기", type: "올인 표현형",
      desc: "마음을 숨기지 못하는 해바라기 타입. 좋아하면 좋아한다고, 사랑하면 사랑한다고 바로바로 표현해요. 연인은 늘 사랑받고 있다는 확신이 들어요." },
    jl: { key: "jl", emoji: "🐱", name: "레이더 고양이", type: "촉촉 안테나형",
      desc: "관심 가는 사람의 사소한 변화까지 다 잡아내는 예민한 촉을 가졌어요. 좋아하는 만큼 신경도 많이 쓰는, 관심이 곧 사랑인 타입이에요." },
    in: { key: "in", emoji: "🦋", name: "자유로운 나비", type: "마이웨이 독립형",
      desc: "연애를 해도 나의 삶과 취향은 확실히 챙기는 타입. 얽매이지 않는 편안한 연애를 추구하고, 혼자서도 충분히 잘 지내요." },
    cm: { key: "cm", emoji: "🐶", name: "일편단심 리트리버", type: "찐헌신형",
      desc: "한번 마음을 주면 끝까지 최선을 다하는 타입. 힘든 순간이 와도 쉽게 포기하지 않고 이 사람과 함께하는 미래를 진지하게 그려요." },
    es: { key: "es", emoji: "🦦", name: "감성 젖은 수달", type: "몰입 공감형",
      desc: "감정의 물결에 풍덩 빠지는 섬세한 타입. 연인의 기분 변화를 누구보다 빨리 캐치하고, 함께 울고 웃는 깊은 교감을 나눠요." },
    ca: { key: "ca", emoji: "🐼", name: "평화주의 판다", type: "무드메이커 조율형",
      desc: "다툼보다는 평화를 택하는 타입. 갈등 상황에서 먼저 물러서더라도 관계의 편안한 분위기를 지키는 걸 더 중요하게 생각해요." },
  };

  function assignCharacter(stats) {
    var order = STAT_KEYS.slice().sort(function (a, b) { return stats[b] - stats[a]; });
    var primary = order[0];
    var secondary = order[1];
    var base = CHARACTERS[primary];
    return {
      key: base.key,
      emoji: base.emoji,
      name: base.name,
      type: base.type,
      desc: base.desc,
      secondaryLabel: STAT_LABELS[secondary],
      secondaryScore: stats[secondary],
    };
  }

  // ---- compact encode/decode for shareable URLs ----
  function b64encode(str) {
    if (typeof window !== "undefined" && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return Buffer.from(str, "utf-8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64decode(str) {
    var s = str.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    if (typeof window !== "undefined" && window.atob) {
      return decodeURIComponent(escape(window.atob(s)));
    }
    return Buffer.from(s, "base64").toString("utf-8");
  }

  function encodeResult(payload) {
    // payload: {n: name, s: [ae,jl,in,cm,es,ca], c: characterKey, mbti: string}
    var compact = [payload.n || "", payload.c, payload.mbti || "", payload.s.join(",")].join("|");
    return b64encode(compact);
  }
  function decodeResult(code) {
    try {
      var raw = b64decode(code);
      var parts = raw.split("|");
      var n = parts[0];
      var c = parts[1];
      var mbti = parts[2];
      var s = parts[3].split(",").map(function (x) { return parseInt(x, 10); });
      var stats = {};
      STAT_KEYS.forEach(function (k, i) { stats[k] = s[i]; });
      return { n: n, c: c, mbti: mbti, s: stats };
    } catch (e) {
      return null;
    }
  }

  // ---- compatibility scoring between two stat sets ----
  function closeness(a, b) { return 100 - Math.abs(a - b); }
  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  function computeCompatibility(A, B) {
    var attraction = 0.4 * closeness(A.ae, B.ae) + 0.3 * closeness(A.es, B.es) + 0.3 * (100 - closeness(A.in, B.in));
    var conversation = 0.6 * (100 - (A.ca + B.ca) / 2) + 0.4 * closeness(A.es, B.es);
    var affection = closeness(A.ae, B.ae);
    var lifestyle = 0.5 * closeness(A.in, B.in) + 0.5 * closeness(A.cm, B.cm);
    var conflictRisk = 0.4 * ((A.jl + B.jl) / 2) + 0.3 * (100 - closeness(A.ca, B.ca)) + 0.3 * (100 - closeness(A.es, B.es));
    var longTerm = 0.5 * ((A.cm + B.cm) / 2) + 0.5 * closeness(A.cm, B.cm);

    var scores = {
      attraction: clamp(attraction),
      conversation: clamp(conversation),
      affection: clamp(affection),
      lifestyle: clamp(lifestyle),
      conflictRisk: clamp(conflictRisk),
      longTerm: clamp(longTerm),
    };
    var overall = clamp(
      (scores.attraction + scores.conversation + scores.affection + scores.lifestyle + (100 - scores.conflictRisk) + scores.longTerm) / 6
    );
    return { scores: scores, overall: overall };
  }

  var LoveDNA = {
    STAT_KEYS: STAT_KEYS,
    STAT_LABELS: STAT_LABELS,
    QUESTIONS: QUESTIONS,
    CHARACTERS: CHARACTERS,
    computeStats: computeStats,
    assignCharacter: assignCharacter,
    encodeResult: encodeResult,
    decodeResult: decodeResult,
    computeCompatibility: computeCompatibility,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = LoveDNA;
  } else {
    root.LoveDNA = LoveDNA;
  }
})(typeof window !== "undefined" ? window : global);
