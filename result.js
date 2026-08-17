(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  var dCode = qs.get("d");
  var pCode = qs.get("p");
  var app = document.getElementById("app");

  if (!dCode) {
    app.innerHTML = emptyState();
  } else {
    var me = window.LoveDNA.decodeResult(dCode);
    if (!me) {
      app.innerHTML = emptyState();
    } else if (pCode) {
      var partner = window.LoveDNA.decodeResult(pCode);
      if (partner) renderCompat(me, partner, dCode, pCode);
      else renderPersonal(me, dCode);
    } else {
      renderPersonal(me, dCode);
    }
  }

  function emptyState() {
    return (
      '<div class="card" style="text-align:center;">' +
      '<div style="font-size:40px;">🧭</div>' +
      '<div class="q-text" style="margin-top:8px;">결과를 찾을 수 없어요</div>' +
      '<p style="color:var(--ink-2);font-size:14px;">링크가 잘못되었거나 테스트를 아직 안 하셨나 봐요.</p>' +
      '<a class="btn btn-primary" href="./test.html">테스트 하러 가기 →</a>' +
      "</div>"
    );
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildInviteText(name, ch) {
    return (name || "친구") + "님의 유형은 [" + ch.name + "]예요! 연인이든 썸이든 친구든, 케미 궁합이 궁금하면 👉 테스트 시작하기";
  }

  function buildInviteUrl(code) {
    // routes through /api/invite so KakaoTalk / iMessage link previews can
    // show a per-person title instead of a generic one (see api/invite.js)
    return location.origin + "/api/invite?p=" + encodeURIComponent(code);
  }

  // ---- Web Push (rank alerts) ----
  // Public VAPID key — not a secret, safe to keep in client code. Must match
  // the one hardcoded in api/notify-rank.js.
  var VAPID_PUBLIC_KEY = "BMMcNDB9qakIvKU1We5XC-1mkuA6bccFMCX7IQU3A31iSaIQ6I1aPwDT-0iFIKDXydahmZeHUYEOrqGIY2draAw";

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function subscribeToRankAlerts(pairId, nameA, nameB, btn) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast("이 브라우저는 알림 기능을 지원하지 않아요.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "설정 중...";
    navigator.serviceWorker
      .register("/sw.js")
      .then(function (reg) {
        return Notification.requestPermission().then(function (perm) {
          if (perm !== "granted") throw new Error("permission_denied");
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        });
      })
      .then(function (sub) {
        return fetch("./api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pairId: pairId, nameA: nameA, nameB: nameB, subscription: sub }),
        });
      })
      .then(function () {
        btn.textContent = "🔔 알림 신청 완료!";
        toast("1~3등이면 하루에 한 번 알림을 보내드릴게요!");
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = "🔔 순위 알림 받기";
        if (err && err.message === "permission_denied") toast("알림 권한을 허용해주세요.");
        else toast("알림 설정에 실패했어요.");
      });
  }

  function statBarsHtml(stats) {
    return window.LoveDNA.STAT_KEYS
      .map(function (k) {
        var v = stats[k];
        return (
          '<div class="stat-row">' +
          '<div class="stat-label">' + window.LoveDNA.STAT_LABELS[k] + "</div>" +
          '<div class="stat-track"><div class="stat-fill" style="width:' + v + '%"></div></div>' +
          '<div class="stat-val">' + v + "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderPersonal(me, dCode) {
    var ch = window.LoveDNA.assignCharacter(me.s);
    var radarSvg = window.LoveDNARadar.renderRadar({
      labels: window.LoveDNA.STAT_KEYS.map(function (k) { return window.LoveDNA.STAT_LABELS[k]; }),
      series: [{ label: escapeHtml(me.n || "나"), color: "#e8447d", values: window.LoveDNA.STAT_KEYS.map(function (k) { return me.s[k]; }) }],
      size: 300,
    });

    document.title = (me.n || "나") + "님의 연애 DNA — " + ch.name;

    app.innerHTML =
      '<div class="char-card card">' +
      '<div class="char-emoji">' + ch.emoji + "</div>" +
      '<div class="char-type">' + ch.type + "</div>" +
      '<div class="char-name">' + ch.name + "</div>" +
      '<div class="char-desc">' + ch.desc + "</div>" +
      '<div class="char-sub">' + escapeHtml(me.n || "나") + (me.mbti ? " · " + escapeHtml(me.mbti) : "") + " · " + ch.secondaryLabel + " 성향도 강한 편이에요 (" + ch.secondaryScore + "점)</div>" +
      "</div>" +
      '<div class="section-title">📊 나의 연애 능력치</div>' +
      '<div class="card">' + radarSvg + '<div style="margin-top:14px;">' + statBarsHtml(me.s) + "</div></div>" +
      '<div class="section-title">💌 링크로 궁합 확인하기</div>' +
      '<div class="card" style="text-align:center;">' +
      '<p style="font-size:14px;color:var(--ink-2);margin-top:0;">연인이든 썸이든 친구든, 이 링크를 보내보세요.<br/>상대방이 테스트를 마치면 둘의 궁합이 바로 나와요.</p>' +
      '<button class="btn btn-primary" id="shareBtn">궁합 테스트 링크 공유하기 →</button>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="saveCardBtn">🖼️ 캐릭터 카드 저장</button><a class="btn btn-ghost" href="./test.html">🔁 다시 테스트</a></div>' +
      "</div>" +
      '<p class="footer-note">본 테스트는 재미를 위한 콘텐츠이며 과학적 근거를 기반으로 하지 않습니다.</p>';

    document.getElementById("shareBtn").addEventListener("click", function () {
      shareOrCopy(buildInviteUrl(dCode), buildInviteText(me.n, ch), onShareDone);
    });
    document.getElementById("saveCardBtn").addEventListener("click", function () {
      drawCard(me, ch);
    });
  }

  function pctToClosenessLabel(v) {
    if (v >= 80) return "찰떡같이 잘 맞아요";
    if (v >= 60) return "꽤 잘 맞는 편이에요";
    if (v >= 40) return "노력하면 맞춰갈 수 있어요";
    return "서로 많이 다른 편이에요";
  }

  function renderCompat(me, partner, dCode, pCode) {
    var chA = window.LoveDNA.assignCharacter(me.s);
    var chB = window.LoveDNA.assignCharacter(partner.s);
    var compat = window.LoveDNA.computeCompatibility(me.s, partner.s);
    var signals = window.LoveDNA.computeRiskSignals(me.s, partner.s, compat);
    var pairId = [dCode, pCode].sort().join("_");

    var radarSvg = window.LoveDNARadar.renderRadar({
      labels: window.LoveDNA.STAT_KEYS.map(function (k) { return window.LoveDNA.STAT_LABELS[k]; }),
      series: [
        { label: escapeHtml(me.n || "나"), color: "#e8447d", values: window.LoveDNA.STAT_KEYS.map(function (k) { return me.s[k]; }) },
        { label: escapeHtml(partner.n || "상대"), color: "#6c4ce0", values: window.LoveDNA.STAT_KEYS.map(function (k) { return partner.s[k]; }) },
      ],
      size: 300,
    });

    document.title = (me.n || "나") + " ♥ " + (partner.n || "상대") + " 궁합 — LOVE DNA";

    var subRows = [
      ["attraction", "끌림 지수"],
      ["conversation", "대화 궁합"],
      ["affection", "애정표현 궁합"],
      ["lifestyle", "생활 궁합"],
      ["longTerm", "장기연애 가능성"],
    ]
      .map(function (row) {
        var v = compat.scores[row[0]];
        return (
          '<div class="stat-row">' +
          '<div class="stat-label" style="width:104px;">' + row[1] + "</div>" +
          '<div class="stat-track"><div class="stat-fill" style="width:' + v + '%"></div></div>' +
          '<div class="stat-val">' + v + "</div>" +
          "</div>"
        );
      })
      .join("") +
      '<div class="stat-row">' +
      '<div class="stat-label" style="width:104px;">갈등 위험도</div>' +
      '<div class="stat-track"><div class="stat-fill" style="width:' + compat.scores.conflictRisk + '%;background:linear-gradient(90deg,#f4b56b,#d03b3b);"></div></div>' +
      '<div class="stat-val">' + compat.scores.conflictRisk + "</div>" +
      "</div>";

    app.innerHTML =
      '<div class="card">' +
      '<div class="two-char">' +
      '<div class="who"><div class="e">' + chA.emoji + '</div><div class="n">' + escapeHtml(me.n || "나") + '<br/>' + chA.name + "</div></div>" +
      '<div class="heart">💞</div>' +
      '<div class="who"><div class="e">' + chB.emoji + '</div><div class="n">' + escapeHtml(partner.n || "상대") + '<br/>' + chB.name + "</div></div>" +
      "</div>" +
      '<div class="score-big"><div class="num">' + compat.overall + "</div><div class=\"cap\">종합 궁합 점수 · " + pctToClosenessLabel(compat.overall) + "</div></div>" +
      "</div>" +
      '<div class="section-title">🏆 전체 커플 순위</div><div class="card" id="leaderboardSection"><div class="lb-loading">순위 불러오는 중...</div></div>' +
      '<div class="section-title">🗺️ 관계 지도</div>' +
      '<div class="card">' + radarSvg + "</div>" +
      '<div class="section-title">📈 세부 궁합 점수</div>' +
      '<div class="card">' + subRows + '<p style="font-size:12px;color:var(--ink-muted);margin:12px 0 0;">* 갈등 위험도는 낮을수록 좋아요</p></div>' +
      '<div class="section-title">🔮 위험 신호 감지</div>' +
      '<div class="signal-card card" id="lockedSection">' +
      '<div class="signal-badge">' + escapeHtml(chA.element) + ' × ' + escapeHtml(chB.element) + ' 조합 분석</div>' +
      '<div class="signal-headline">⚠️ ' + escapeHtml(signals[0]) + '!</div>' +
      (signals.length > 1 ? '<div class="signal-more">신호가 <b>1개 더</b> 있어요 🔒</div>' : "") +
      '<div class="locked-teaser">' +
      '<div class="locked-teaser-text">왜 이 신호가 나타났는지, 이 시기에 무엇을 조심해야 하는지<br/>두 사람의 기운과 데이터를 정밀 분석한 리포트에서 확인하세요</div>' +
      '<div class="price-row" id="priceRow"><span class="price-tag" id="priceTag">2,900원</span></div>' +
      '<button class="btn btn-primary unlock-btn" id="unlockBtn">지금 정밀 분석 결과 확인하기</button>' +
      '<div class="locked-note">🔒 결제 후 즉시 확인 가능</div>' +
      "</div>" +
      "</div>" +
      '<div class="section-title">🔗 내 캐릭터로 다른 친구도 초대하기</div>' +
      '<div class="card" style="text-align:center;">' +
      '<p style="font-size:13.5px;color:var(--ink-2);margin-top:0;">' + escapeHtml(me.n || "나") + '님의 [' + chA.name + '] 결과로, 다른 친구나 썸 상대에게도 보내보세요.<br/>친구도 궁합 테스트하고 전체 순위표에 함께 도전해보세요.</p>' +
      '<button class="btn btn-primary" id="inviteFriendBtn">🔗 내 링크로 친구 초대하기</button>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:20px;"><a class="btn btn-ghost" href="./test.html">🔁 새로 테스트</a><button class="btn btn-ghost" id="shareResultBtn">이 결과 공유</button></div>' +
      '<p class="footer-note">본 테스트는 재미를 위한 콘텐츠이며 과학적 근거를 기반으로 하지 않습니다.</p>';

    document.getElementById("unlockBtn").addEventListener("click", function () {
      unlockReport(me, chA, partner, chB, compat, signals);
    });
    document.getElementById("inviteFriendBtn").addEventListener("click", function () {
      shareOrCopy(buildInviteUrl(dCode), buildInviteText(me.n, chA), onShareDone);
    });
    document.getElementById("shareResultBtn").addEventListener("click", function () {
      shareOrCopy(location.href, "우리 궁합 결과 확인해봐 💘", onShareDone);
    });

    submitAndRenderLeaderboard(pairId, me, chA, partner, chB, compat.overallPrecise);
  }

  function submitAndRenderLeaderboard(pairId, me, chA, partner, chB, score) {
    var box = document.getElementById("leaderboardSection");
    if (!box) return;

    fetch("./api/leaderboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pairId: pairId, score: score,
        nameA: me.n, charA: chA.name, nameB: partner.n, charB: chB.name,
      }),
    })
      .then(function () {
        return fetch("./api/leaderboard?pair=" + encodeURIComponent(pairId));
      })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) { renderLeaderboardError(box, result.data); return; }
        renderLeaderboard(box, result.data, pairId, me.n, partner.n);
      })
      .catch(function () {
        renderLeaderboardError(box, {});
      });
  }

  function renderLeaderboardError(box, data) {
    var msg = "순위를 불러오지 못했어요.";
    if (data && data.error === "db_not_configured") msg = "랭킹 서버가 아직 준비되지 않았어요.";
    box.innerHTML = '<div class="lb-loading">' + escapeHtml(msg) + "</div>";
  }

  function renderLeaderboard(box, data, myPairId, nameA, nameB) {
    var top = (data && data.top) || [];
    if (!top.length) {
      box.innerHTML = '<div class="lb-loading">아직 궁합을 본 커플이 없어요. 첫 번째가 되어보세요!</div>';
      return;
    }
    var medals = ["🥇", "🥈", "🥉"];
    var rowsHtml = top
      .map(function (row, i) {
        var isMe = row.pairId === myPairId;
        return (
          '<div class="lb-row' + (isMe ? " lb-row-me" : "") + '">' +
          '<div class="lb-rank">' + (medals[i] || i + 1 + "위") + "</div>" +
          '<div class="lb-names">' + escapeHtml(row.nameA) + "(" + escapeHtml(row.charA) + ") × " + escapeHtml(row.nameB) + "(" + escapeHtml(row.charB) + ")" + (isMe ? " <b>← 우리</b>" : "") + "</div>" +
          '<div class="lb-score">' + Number(row.score).toFixed(2) + "점</div>" +
          "</div>"
        );
      })
      .join("");

    var rankNote = "";
    if (data.myRank) {
      if (data.myRank > top.length) {
        rankNote = '<div class="lb-my-rank">현재 우리 순위: ' + data.myRank + " / " + (data.total || "?") + "위</div>";
      }
    }

    box.innerHTML =
      '<div class="lb-list">' + rowsHtml + "</div>" +
      rankNote +
      '<div class="lb-total">LOVE DNA 전체 커플 총 ' + (data.total || top.length) + "쌍 중</div>" +
      '<button class="btn btn-ghost btn-sm" id="rankAlertBtn" style="margin-top:10px;">🔔 순위 알림 받기</button>';

    var alertBtn = document.getElementById("rankAlertBtn");
    if (alertBtn) {
      alertBtn.addEventListener("click", function () {
        subscribeToRankAlerts(myPairId, nameA, nameB, alertBtn);
      });
    }
  }

  function onShareDone() {
    toast("공유됐어요! 💌");
  }

  function unlockReport(me, chA, partner, chB, compat, signals) {
    var box = document.getElementById("lockedSection");
    box.className = "card analyzing-card";
    box.innerHTML =
      '<div class="analyzing">' +
      '<div class="analyzing-spinner"></div>' +
      '<div class="analyzing-title">🔮 두 사람의 관계 기운을 정밀 분석하는 중</div>' +
      '<div class="analyzing-sub">궁합 패턴 · 감정 신호 · 관계 타이밍을 계산하고 있어요</div>' +
      "</div>";

    var payload = {
      me: { n: me.n, mbti: me.mbti, s: me.s, characterName: chA.name, characterElement: chA.element },
      partner: { n: partner.n, mbti: partner.mbti, s: partner.s, characterName: chB.name, characterElement: chB.element },
      compat: compat,
      signals: signals,
    };

    fetch("./api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          renderReportError(box, result.data, function () { unlockReport(me, chA, partner, chB, compat, signals); });
          return;
        }
        renderReport(box, result.data.report, me.n || "나", partner.n || "상대");
      })
      .catch(function (err) {
        renderReportError(box, { message: err.message }, function () { unlockReport(me, chA, partner, chB, compat, signals); });
      });
  }

  function renderReportError(box, data, onRetry) {
    var msg = "지금 분석 결과를 불러오지 못했어요. 다시 시도해주세요.";
    if (data && data.error === "server_not_configured") msg = "분석 엔진이 아직 준비되지 않았어요. (관리자: Vercel에 ANTHROPIC_API_KEY를 등록해주세요)";
    box.className = "card";
    box.innerHTML =
      '<div style="text-align:center;padding:10px 0;">' +
      '<div style="font-size:28px;">😥</div>' +
      '<div style="margin-top:6px;color:var(--ink-2);font-size:14px;">' + escapeHtml(msg) + "</div>" +
      '<button class="btn btn-ghost btn-sm" id="retryUnlock" style="margin-top:12px;">다시 시도</button>' +
      "</div>";
    document.getElementById("retryUnlock").addEventListener("click", onRetry);
  }

  function renderMultilineHtml(text) {
    var lines = String(text || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length === 0) return '<p style="margin:0;">-</p>';
    return lines.map(function (l) { return '<p style="margin:0 0 8px;">' + escapeHtml(l) + "</p>"; }).join("");
  }

  function renderReport(box, report, meName, partnerName) {
    var sections = [
      ["conflict_pattern", "🌀 반복되는 갈등 패턴"],
      ["attraction_reason", "✨ 서로에게 끌리는 이유"],
      ["affection_style_gap", "💌 원하는 애정표현 방식 차이"],
      ["fight_behavior", "🥊 싸웠을 때 행동 패턴"],
      ["who_tires_first", "🔋 먼저 지치는 사람은?"],
      ["long_term_outlook", "🔭 장기 연애 가능성"],
    ];
    box.className = "card";
    box.id = "";

    var sectionsHtml = sections
      .map(function (s) {
        var text = report && report[s[0]] ? report[s[0]] : "-";
        return (
          '<div class="report-section">' +
          '<div class="report-section-title">' + s[1] + "</div>" +
          '<div class="report-section-body">' + renderMultilineHtml(text) + "</div>" +
          "</div>"
        );
      })
      .join("");

    var advice = report && report.personal_advice;
    var adviceHtml = "";
    if (advice && (advice.me || advice.partner)) {
      adviceHtml =
        '<div class="section-title" style="margin-top:6px;">💬 두 사람에게 보내는 한마디</div>' +
        (advice.me ? '<div class="advice-bubble advice-me"><span class="advice-name">' + escapeHtml(meName) + "</span>" + escapeHtml(advice.me) + "</div>" : "") +
        (advice.partner ? '<div class="advice-bubble advice-partner"><span class="advice-name">' + escapeHtml(partnerName) + "</span>" + escapeHtml(advice.partner) + "</div>" : "");
    }

    box.innerHTML = '<div class="report-done-badge">✅ 정밀 분석 완료</div>' + sectionsHtml;
    if (adviceHtml) box.insertAdjacentHTML("afterend", adviceHtml);
  }

  function shareOrCopy(url, text, onSuccess) {
    if (navigator.share) {
      // the promise only resolves if the user actually picked an app and
      // completed the share sheet — it rejects (AbortError) on cancel, so
      // this is a real "did they actually send it" signal, not just a click
      navigator.share({ title: "LOVE DNA", text: text, url: url }).then(function () {
        if (onSuccess) onSuccess();
      }).catch(function () {});
    } else if (navigator.clipboard) {
      // no share-sheet to confirm completion here, so we can't verify the
      // link was actually sent anywhere — treat a successful copy as a
      // good-faith "share" since it's the best signal this path has
      navigator.clipboard.writeText(url).then(function () {
        toast("링크가 복사됐어요!");
        if (onSuccess) onSuccess();
      });
    } else {
      window.prompt("아래 링크를 복사하세요:", url);
      if (onSuccess) onSuccess();
    }
  }

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 250);
    }, 2200);
  }

  function drawCard(me, ch) {
    var canvas = document.getElementById("cardCanvas");
    var ctx = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;

    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#ff8fb3");
    grad.addColorStop(1, "#6c4ce0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // card panel
    var pad = 60;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    roundRect(ctx, pad, 220, W - pad * 2, H - 350, 40);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle = "#2c1f2a";
    ctx.font = "700 40px sans-serif";
    ctx.fillText("LOVE DNA", W / 2, 130);

    ctx.font = "120px sans-serif";
    ctx.fillText(ch.emoji, W / 2, 400);

    ctx.fillStyle = "#6c4ce0";
    ctx.font = "700 34px sans-serif";
    ctx.fillText(ch.type, W / 2, 470);

    ctx.fillStyle = "#2c1f2a";
    ctx.font = "900 58px sans-serif";
    ctx.fillText(ch.name, W / 2, 545);

    ctx.fillStyle = "#6b5a65";
    ctx.font = "400 30px sans-serif";
    wrapText(ctx, ch.desc, W / 2, 610, W - pad * 2 - 80, 42);

    // stat bars
    var keys = window.LoveDNA.STAT_KEYS;
    var startY = 820;
    keys.forEach(function (k, i) {
      var y = startY + i * 60;
      var label = window.LoveDNA.STAT_LABELS[k];
      var v = me.s[k];
      ctx.textAlign = "left";
      ctx.fillStyle = "#6b5a65";
      ctx.font = "700 26px sans-serif";
      ctx.fillText(label, pad + 40, y);

      var barX = pad + 220, barW = W - pad * 2 - 300, barH = 18;
      ctx.fillStyle = "#f0dfe8";
      roundRect(ctx, barX, y - barH + 2, barW, barH, 9);
      ctx.fill();
      var fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      fillGrad.addColorStop(0, "#e8447d");
      fillGrad.addColorStop(1, "#6c4ce0");
      ctx.fillStyle = fillGrad;
      roundRect(ctx, barX, y - barH + 2, barW * (v / 100), barH, 9);
      ctx.fill();

      ctx.textAlign = "right";
      ctx.fillStyle = "#2c1f2a";
      ctx.font = "700 24px sans-serif";
      ctx.fillText(String(v), W - pad - 40, y);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 26px sans-serif";
    ctx.fillText((me.n || "나") + " 님의 연애 DNA", W / 2, H - 60);

    canvas.toBlob(function (blob) {
      var link = document.createElement("a");
      link.download = "lovedna-card.png";
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split("");
    var line = "";
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    lines.push(line);
    lines = lines.slice(0, 3);
    ctx.textAlign = "center";
    lines.forEach(function (l, i) {
      ctx.fillText(l, x, y + i * lineHeight);
    });
  }
})();
