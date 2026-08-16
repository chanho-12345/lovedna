(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  var partnerCode = qs.get("partner");
  var partnerData = partnerCode ? window.LoveDNA.decodeResult(partnerCode) : null;

  var stage = document.getElementById("stage");
  var progressFill = document.getElementById("progressFill");
  var progressLabel = document.getElementById("progressLabel");
  var partnerBanner = document.getElementById("partnerBanner");

  var TOTAL_STEPS = 1 + window.LoveDNA.QUESTIONS.length; // info form + questions
  var step = 0; // 0 = info form, 1..18 = questions
  var answers = new Array(window.LoveDNA.QUESTIONS.length).fill(null);
  var info = { name: "", gender: "", birth: "", mbti: "", status: "" };

  if (partnerData) {
    partnerBanner.innerHTML =
      '<div class="banner">💕 ' + escapeHtml(partnerData.n || "상대방") + ' 님이 보낸 링크예요! 테스트를 마치면 궁합 결과를 바로 볼 수 있어요.</div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function updateProgress() {
    var pct = Math.round((step / TOTAL_STEPS) * 100);
    progressFill.style.width = pct + "%";
    progressLabel.textContent = step + " / " + TOTAL_STEPS;
  }

  function renderInfoForm() {
    stage.innerHTML =
      '<div class="q-index">STEP 1</div>' +
      '<div class="q-text">먼저 간단한 정보를 알려주세요</div>' +
      '<div class="field"><label>이름 (닉네임 가능)</label><input id="f-name" type="text" placeholder="예: 김러브" maxlength="10"/></div>' +
      '<div class="field"><label>성별</label><div class="pill-group" id="f-gender">' +
        pill("male", "남성") + pill("female", "여성") + pill("other", "선택안함") +
      '</div></div>' +
      '<div class="field"><label>생년월일</label><input id="f-birth" type="date"/></div>' +
      '<div class="field"><label>MBTI</label><input id="f-mbti" type="text" placeholder="예: INFP" maxlength="4" style="text-transform:uppercase"/></div>' +
      '<div class="field"><label>현재 연애 상태</label><div class="pill-group" id="f-status">' +
        pill("solo", "솔로") + pill("some", "썸") + pill("dating", "연애 중") + pill("breakup", "이별") +
      '</div></div>' +
      '<button class="btn btn-primary" id="f-next" style="margin-top:10px;">다음으로 →</button>';

    bindPillGroup("f-gender", function (v) { info.gender = v; });
    bindPillGroup("f-status", function (v) { info.status = v; });

    document.getElementById("f-next").addEventListener("click", function () {
      var name = document.getElementById("f-name").value.trim();
      var birth = document.getElementById("f-birth").value;
      var mbti = document.getElementById("f-mbti").value.trim().toUpperCase();
      if (!name) { toast("이름을 입력해주세요"); return; }
      if (!info.gender) { toast("성별을 선택해주세요"); return; }
      if (!birth) { toast("생년월일을 입력해주세요"); return; }
      if (!info.status) { toast("연애 상태를 선택해주세요"); return; }
      info.name = name;
      info.birth = birth;
      info.mbti = mbti;
      step = 1;
      updateProgress();
      renderQuestion();
    });
  }

  function pill(value, label) {
    return '<button type="button" class="pill" data-value="' + value + '">' + label + "</button>";
  }
  function bindPillGroup(containerId, onSelect) {
    var container = document.getElementById(containerId);
    var buttons = container.querySelectorAll(".pill");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        onSelect(btn.getAttribute("data-value"));
      });
    });
  }

  function renderQuestion() {
    var qIdx = step - 1;
    var q = window.LoveDNA.QUESTIONS[qIdx];
    var optsHtml = q.options
      .map(function (opt, i) {
        return '<button type="button" class="opt" data-score="' + i + '">' + opt + "</button>";
      })
      .join("");
    stage.innerHTML =
      '<div class="q-index">Q' + step + ' / ' + window.LoveDNA.QUESTIONS.length + "</div>" +
      '<div class="q-text">' + q.text + "</div>" +
      '<div class="opt-list">' + optsHtml + "</div>";

    stage.querySelectorAll(".opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        answers[qIdx] = parseInt(btn.getAttribute("data-score"), 10);
        step += 1;
        updateProgress();
        if (step - 1 < window.LoveDNA.QUESTIONS.length) {
          renderQuestion();
        } else {
          finish();
        }
      });
    });
  }

  function finish() {
    stage.innerHTML =
      '<div style="text-align:center;padding:20px 0;">' +
      '<div style="font-size:40px;">🧬</div>' +
      '<div class="q-text" style="margin-top:10px;">결과 분석 중...</div>' +
      "</div>";

    setTimeout(function () {
      var stats = window.LoveDNA.computeStats(answers);
      var character = window.LoveDNA.assignCharacter(stats);
      var code = window.LoveDNA.encodeResult({
        n: info.name,
        c: character.key,
        mbti: info.mbti,
        s: window.LoveDNA.STAT_KEYS.map(function (k) { return stats[k]; }),
      });
      var url = "./result.html?d=" + encodeURIComponent(code);
      if (partnerCode) url += "&p=" + encodeURIComponent(partnerCode);
      location.href = url;
    }, 700);
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
    }, 1800);
  }

  updateProgress();
  renderInfoForm();
})();
