/*
 * 보안·개인정보
 * 목적: 종이 신청서에 옮길 내용을 정리하고, 기간과 보고서가 규칙에 맞는지 확인한다.
 * 저장: 하지 않는다. 이름, 목적지, 계획은 이 화면의 메모리에만 있다.
 * 받지 않음: 학번, 반, 휴대폰, 예약 파일, 사진, 주민등록번호.
 * 전송: 서버와 외부 AI로 보내지 않는다. 브라우저를 닫으면 입력이 사라진다.
 */
(function () {
  var rules = window.SCHOOL_RULES;
  var toolsApi = window.DateTools;
  var app = document.getElementById("app");
  var today = new Date();
  var nextPastId = 2;

  var LEARNING = [
    ["family", "가족 여행"],
    ["relative", "친인척 방문"],
    ["visit", "답사·견학 활동"],
    ["experience", "체험 활동"]
  ];

  var STEP_TITLES = [
    "먼저 읽어 주세요",
    "지금까지의 사용 기간",
    "보고서 제출 판정",
    "이번 신청 기간",
    "20일 이내",
    "신청 3일 전",
    "연속 신청",
    "국내 또는 해외",
    "준비서류",
    "학습 형태",
    "목적지",
    "숙박 장소",
    "보호자",
    "인솔자",
    "목적",
    "학습 계획",
    "학생 안전",
    "수기 작성"
  ];

  var state = blankState();

  function blankState() {
    return {
      step: 0,
      error: "",
      guideOk: false,
      noPast: false,
      pastAck: false,
      past: [{ id: 1, start: "", end: "", report: "" }],
      mode: "range",
      start: "",
      end: "",
      halfDate: "",
      halfUnder4: false,
      halfAttended: false,
      region: "",
      stay: "",
      docStay: false,
      docTicket: false,
      docStayName: false,
      learning: "",
      place: "",
      country: "",
      city: "",
      lodgeName: "",
      lodgeAddress: "",
      guardianName: "",
      guardianRel: "",
      chaperoneName: "",
      chaperoneRel: "",
      chaperoneAdult: false,
      purpose: "",
      planText: "",
      safetyOk: false,
      view: {}
    };
  }

  function assess() {
    return toolsApi.assess(rules, state, today);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function learningLabel(id) {
    var found = LEARNING.filter(function (item) { return item[0] === id; })[0];
    return found ? found[1] : "";
  }

  function viewOf(key, selectedYmd) {
    if (state.view[key]) return state.view[key];
    var base = selectedYmd || toolsApi.ymd(today);
    var parts = base.split("-");
    state.view[key] = { y: Number(parts[0]), m: Number(parts[1]) - 1 };
    return state.view[key];
  }

  function shiftMonth(key, dir) {
    var view = state.view[key] || viewOf(key);
    var next = new Date(view.y, view.m + dir, 1);
    state.view[key] = { y: next.getFullYear(), m: next.getMonth() };
  }

  function calendar(key, mode, start, end) {
    var selected = start || end || "";
    var view = viewOf(key, selected);
    var matrix = [];
    var first = new Date(view.y, view.m, 1);
    var count = new Date(view.y, view.m + 1, 0).getDate();
    var i;
    for (i = 0; i < first.getDay(); i += 1) matrix.push(null);
    for (i = 1; i <= count; i += 1) matrix.push(new Date(view.y, view.m, i));
    var tools = toolsApi.create(rules, { today: today });
    var todayYmd = tools.ymd(today);
    var html = '<div class="card calendar">';
    html += '<div class="cal-head"><button type="button" class="secondary" data-action="month" data-cal="' + esc(key) + '" data-dir="-1" aria-label="이전 달">이전달</button>';
    html += "<h2>" + view.y + "년 " + (view.m + 1) + "월</h2>";
    html += '<button type="button" class="secondary" data-action="month" data-cal="' + esc(key) + '" data-dir="1" aria-label="다음 달">다음달</button></div>';
    html += '<div class="week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="days">';
    matrix.forEach(function (date) {
      if (!date) {
        html += "<span></span>";
        return;
      }
      var value = tools.ymd(date);
      var classes = [];
      if (tools.isWeekend(date) || tools.isHoliday(date)) classes.push("is-weekend");
      if (tools.isHoliday(date)) classes.push("is-holiday");
      if (tools.isBlocked(date)) classes.push("is-blocked");
      if (value === todayYmd) classes.push("is-today");
      if (mode === "range" && start && end && value > start && value < end) classes.push("is-range");
      if (value === start || (mode === "range" && value === end && end)) classes.push("is-selected");
      var label = tools.formatKorean(date);
      if (tools.isHoliday(date)) label += " 공휴일";
      else if (tools.isWeekend(date)) label += " 주말";
      else label += " 수업일";
      if (tools.isBlocked(date)) label += " 금지일";
      html += '<button type="button" class="' + classes.join(" ") + '" data-action="pick" data-cal="' + esc(key) + '" data-ymd="' + value + '" aria-label="' + esc(label) + '">' + date.getDate() + "</button>";
    });
    html += '</div><div class="legend"><span><i class="swatch school"></i>수업일</span><span><i class="swatch rest"></i>주말·공휴일</span><span><i class="swatch pick"></i>선택한 날</span></div></div>';
    return html;
  }

  function pick(key, ymd) {
    if (key === "apply") {
      if (state.mode === "half") {
        state.halfDate = ymd;
        return;
      }
      if (!state.start || state.end) {
        state.start = ymd;
        state.end = "";
      } else if (ymd < state.start) {
        state.end = state.start;
        state.start = ymd;
      } else {
        state.end = ymd;
      }
      return;
    }
    var parts = key.split(":");
    var period = state.past.filter(function (item) { return String(item.id) === parts[0]; })[0];
    if (!period) return;
    var field = parts[1];
    if (field === "report") {
      period.report = ymd;
      return;
    }
    if (!period.start || period.end) {
      period.start = ymd;
      period.end = "";
    } else if (ymd < period.start) {
      period.end = period.start;
      period.start = ymd;
    } else {
      period.end = ymd;
    }
  }

  function banner(kind, text) {
    return '<div class="banner banner-' + kind + '">' + text + "</div>";
  }

  function actions(showNext, nextLabel) {
    var html = '<div class="actions">';
    if (state.step > 0) html += '<button type="button" class="secondary" data-action="back">이전</button>';
    if (showNext) html += '<button type="button" data-action="next">' + esc(nextLabel || "다음") + "</button>";
    html += "</div>";
    return html;
  }

  function shell(body) {
    var head = '<header class="top"><p class="school">' + esc(rules.schoolName) + "</p><p class=\"progress\">" + (state.step + 1) + " / " + STEP_TITLES.length + "</p></header>";
    if (state.step !== 0) head += "<h1>" + esc(STEP_TITLES[state.step]) + "</h1>";
    if (state.error) head += banner("no", esc(state.error));
    return head + body + '<p class="footer-note">입력은 이 휴대폰 화면에만 있고, 학교를 포함한 어디에도 저장되거나 전송되지 않습니다. 화면을 닫으면 지워집니다.</p>';
  }

  function guideStep() {
    var html = '<section class="official"><p class="kicker">출결 서류</p>';
    html += "<h1>출결 서류는 학교의 공문서입니다</h1>";
    html += "<p><strong>신청서, 결과보고서, 거기에 붙이는 증빙은 출결을 정하는 학교 공문서입니다.</strong></p>";
    html += "<p><strong>보고서의 증빙서류가 부족하면 그 체험 기간은 미인정 결석으로 처리됩니다.</strong></p>";
    html += "<ul>";
    html += "<li>하루 1장, 학생·보호자·장소가 함께 나온 컬러 사진입니다. 장소 사진은 누가 보아도 그곳이 여행을 간 지역임을 알 수 있어야 합니다.</li>";
    html += "<li>AI로 만들거나 AI로 고친 사진은 사용할 수 없습니다.</li>";
    html += "<li>입장권, 국외 출입국사실증명서 등이 빠지거나 기준에 못 미치면 부족한 증빙입니다.</li>";
    html += "</ul></section>";
    html += banner("no", "<strong>체험학습 연속 신청은 불가합니다.</strong> 목·금을 쓰면 다음 주 월요일은 보고서를 내는 날이라 사용할 수 없고, 사용은 화요일부터 가능합니다. 신청서는 출발 3일 전에 미리 낼 수 있습니다.");
    html += '<div class="pair"><section class="card"><span class="tag tag-before">체험학습 전</span><h2>신청서</h2><ul>';
    html += "<li>출발 3일 전까지 종이 신청서를 담임에게 냅니다.</li>";
    html += "<li>목적, 장소, 세부 활동을 구체적으로 적습니다.</li>";
    html += "<li>보호자인 성인 가족과 함께 갑니다. 학생 혼자는 불가합니다.</li>";
    html += "</ul></section><section class=\"card\"><span class=\"tag tag-after\">체험학습 후</span><h2>결과보고서</h2><ul>";
    html += "<li>끝난 뒤 3일 이내에 보고서를 담임에게 냅니다.</li>";
    html += "<li>학생·보호자·장소가 함께 나온 사진을 날짜별로 붙입니다.</li>";
    html += "<li>기한을 넘기거나 증빙이 부족하면 그 기간은 미인정 결석입니다.</li>";
    html += "</ul></section></div>";
    html += '<section class="card"><p>이 화면은 날짜와 작성 내용을 확인하는 곳입니다. 신청은 종이 신청서에 수기로 작성합니다. 담임 통보 또는 문자를 받기 전에는 출발하지 않습니다.</p>';
    html += '<label class="check"><input type="checkbox" data-field="guideOk"' + (state.guideOk ? " checked" : "") + '><span>공문서 안내, 증빙이 부족하면 미인정이라는 점, 연속 신청 불가를 읽었습니다.</span></label></section>';
    return shell(html + actions(true, "확인하고 시작"));
  }

  function pastStep() {
    var html = '<p class="help">이미 사용한 기간이 있으면 캘린더로 기간과 보고서 제출일을 고릅니다. 없으면 아래를 선택하세요.</p>';
    html += '<label class="check"><input type="checkbox" data-field="noPast"' + (state.noPast ? " checked" : "") + "><span>올해 사용한 교외체험학습이 없습니다.</span></label>";
    if (!state.noPast) {
      state.past.forEach(function (period, index) {
        html += '<section class="card period"><h2>' + (index + 1) + "번째 사용 기간</h2>";
        html += "<p class=\"summary\">기간 " + (period.start || "시작일") + " ~ " + (period.end || "종료일") + "</p>";
        html += calendar(period.id + ":range", "range", period.start, period.end);
        html += "<p class=\"summary\">보고서 제출일 " + (period.report || "선택 전") + "</p>";
        html += calendar(period.id + ":report", "single", period.report, "");
        if (state.past.length > 1) html += '<button type="button" class="ghost" data-action="remove-past" data-id="' + period.id + '">이 기간 빼기</button>';
        html += "</section>";
      });
      html += '<button type="button" class="secondary" data-action="add-past">사용 기간 추가</button>';
    }
    return shell(html + actions(true));
  }

  function reportStep(result) {
    var html = "";
    if (state.noPast) {
      html += banner("ok", "사용한 기간이 없어 보고서 판정은 해당하지 않습니다. 이번 신청만 확인합니다.");
    } else {
      var needsAck = false;
      result.pastResults.forEach(function (item, index) {
        html += '<section class="card"><h2>' + (index + 1) + "번째 기간</h2>";
        html += banner(item.onTime ? "ok" : "no", esc(item.message));
        if (item.start && item.end) {
          html += "<p>" + esc(result.tools.formatKorean(item.start)) + " ~ " + esc(result.tools.formatKorean(item.end)) + "</p>";
        }
        if (!item.onTime) needsAck = true;
        html += "</section>";
      });
      if (needsAck) {
        html += '<label class="check"><input type="checkbox" data-field="pastAck"' + (state.pastAck ? " checked" : "") + "><span>보고서가 늦거나 기준에 못 미친 기간은 미인정 결석이고, 20일에 넣지 않는 것을 확인했습니다.</span></label>";
      }
    }
    return shell(html + actions(true));
  }

  function periodStep(result) {
    var html = '<div class="choice">';
    html += '<button type="button" data-action="mode" data-mode="range" aria-pressed="' + (state.mode === "range" ? "true" : "false") + '">하루 이상</button>';
    html += '<button type="button" data-action="mode" data-mode="half" aria-pressed="' + (state.mode === "half" ? "true" : "false") + '">반일, 4시간 미만</button></div>';
    if (!rules.blockedDates.length) {
      html += banner("info", "학교 금지일은 아직 이 화면에 없습니다. 시험일처럼 가지 못하는 날은 담임에게 확인하세요.");
    }
    if (state.mode === "half") {
      html += "<p class=\"summary\">반일 " + esc(state.halfDate || "날짜를 선택하세요") + "</p>";
      html += calendar("apply", "single", state.halfDate, "");
      html += '<label class="check"><input type="checkbox" data-field="halfUnder4"' + (state.halfUnder4 ? " checked" : "") + "><span>4시간 미만입니다.</span></label>";
      html += '<label class="check"><input type="checkbox" data-field="halfAttended"' + (state.halfAttended ? " checked" : "") + "><span>당일 수업에도 참여합니다.</span></label>";
    } else {
      html += '<p class="help">시작일을 누른 다음 종료일을 누르세요. 주말과 공휴일도 기간에는 넣을 수 있고, 출석 일수에서는 빠집니다.</p>';
      html += "<p class=\"summary\">" + rangeSummary(result) + "</p>";
      html += calendar("apply", "range", state.start, state.end);
    }
    return shell(html + actions(true));
  }

  function rangeSummary(result) {
    if (!result.current.start) return "신청 기간을 캘린더에서 선택하세요.";
    if (!result.current.end) return esc(result.tools.formatKorean(result.current.start)) + "부터. 종료일을 누르세요.";
    var text = result.tools.formatKorean(result.current.start) + " ~ " + result.tools.formatKorean(result.current.end);
    text += " · 수업일 " + result.tools.formatDays(result.current.days) + "일";
    return esc(text);
  }

  function judgmentStep(ok, message, extra) {
    return shell(banner(ok ? "ok" : "no", esc(message)) + (extra || "") + actions(ok));
  }

  function regionStep(result) {
    var html = '<div class="choice">';
    html += '<button type="button" data-action="region" data-region="domestic" aria-pressed="' + (state.region === "domestic" ? "true" : "false") + '">국내</button>';
    html += '<button type="button" data-action="region" data-region="overseas" aria-pressed="' + (state.region === "overseas" ? "true" : "false") + '">해외</button></div>';
    if (state.region && result.regionMessage) html += banner(result.regionOk ? "ok" : "no", esc(result.regionMessage));
    if (result.current.days >= 5) html += banner("info", "5일 이상이면 주 1회 이상 학생이 담임과 직접 통화하는 동의 칸이 신청서에 필요합니다.");
    return shell(html + actions(!!state.region && result.regionOk));
  }

  function docsStep() {
    var html = "<p class=\"help\">예약 파일은 이 화면에 올리지 않습니다. 종이 신청서와 함께 낼 서류만 확인합니다.</p>";
    html += '<div class="choice">';
    html += '<button type="button" data-action="stay" data-stay="yes" aria-pressed="' + (state.stay === "yes" ? "true" : "false") + '">숙박이 있습니다</button>';
    html += '<button type="button" data-action="stay" data-stay="no" aria-pressed="' + (state.stay === "no" ? "true" : "false") + '">숙박이 없습니다</button></div>';
    if (state.region === "domestic" && state.stay === "yes") {
      html += '<label class="check"><input type="checkbox" data-field="docStay"' + (state.docStay ? " checked" : "") + "><span>국내: 숙박 예약 정보를 준비했습니다.</span></label>";
    }
    if (state.region === "overseas") {
      html += '<label class="check"><input type="checkbox" data-field="docTicket"' + (state.docTicket ? " checked" : "") + "><span>해외: 항공권에 학생 본인 이름이 나옵니다.</span></label>";
      if (state.stay === "yes") {
        html += '<label class="check"><input type="checkbox" data-field="docStayName"' + (state.docStayName ? " checked" : "") + "><span>해외: 숙박 예약의 이름은 인솔자입니다.</span></label>";
      }
    }
    if (state.stay === "no") html += banner("info", "숙박이 없으면 숙박 예약 정보는 내지 않습니다. 숙박 장소 칸에는 숙박 없음으로 적습니다.");
    return shell(html + actions(docsOk()));
  }

  function docsOk() {
    if (!state.stay) return false;
    if (state.region === "domestic" && state.stay === "yes") return state.docStay;
    if (state.region === "overseas" && state.stay === "yes") return state.docTicket && state.docStayName;
    if (state.region === "overseas" && state.stay === "no") return state.docTicket;
    return state.stay === "no";
  }

  function learningStep() {
    var html = '<div class="choice">';
    LEARNING.forEach(function (item) {
      html += '<button type="button" data-action="learning" data-learning="' + item[0] + '" aria-pressed="' + (state.learning === item[0] ? "true" : "false") + '">' + esc(item[1]) + "</button>";
    });
    html += "</div>";
    return shell(html + actions(true));
  }

  function textStep(fields) {
    var html = "";
    fields.forEach(function (field) {
      html += '<label class="field">' + esc(field.label);
      html += '<input data-field="' + field.key + '" value="' + esc(state[field.key]) + '" autocomplete="off" placeholder="' + esc(field.placeholder || "") + '"></label>';
    });
    return shell(html + actions(true));
  }

  function lodgingStep() {
    if (state.stay === "no") {
      return shell(banner("ok", "숙박 없음으로 확인했습니다. 신청서 숙박 칸에는 숙박 없음이라고 적습니다.") + actions(true));
    }
    return textStep([
      { key: "lodgeName", label: "숙박 장소 이름", placeholder: "예: 호텔 이름" },
      { key: "lodgeAddress", label: "숙박 장소 주소", placeholder: "예: 도시와 도로명" }
    ]);
  }

  function purposeStep() {
    var html = '<label class="field">목적<input data-field="purpose" value="' + esc(state.purpose) + '" autocomplete="off" placeholder="이번 체험에서 배우려는 점"></label>';
    return shell(html + actions(true));
  }

  function planStep() {
    var html = '<section class="card"><h2>작성 요령</h2><ul>';
    html += "<li>목적, 장소, 세부 활동을 날짜별로 구체적으로 적습니다.</li>";
    html += "<li>보호자인 성인 가족과 함께하는 일정만 적습니다. 학생 혼자 하는 활동은 허가되지 않습니다.</li>";
    html += "<li>장소는 누가 보아도 그 지역임을 알 수 있게 적습니다.</li></ul></section>";
    html += '<label class="field">교외체험학습 계획<textarea data-field="planText" autocomplete="off" placeholder="날짜마다 어디서 무엇을 하는지 적으세요.">' + esc(state.planText) + "</textarea></label>";
    return shell(html + actions(true));
  }

  function safetyStep(result) {
    var html = '<section class="card"><p>교외체험학습이 5일 이상 연속될 경우 학생의 건강과 안전을 위하여 주 1회 이상 학생이 담임교사와 직접 통화하겠습니다.</p>';
    html += "<p>실시 중에는 보호자와 담임이 연락을 유지하고, 사고가 나면 보호자가 담임에게 알립니다.</p>";
    html += "<p>5일 이상인데 학생이 통화를 하지 않으면 시·군·구 아동복지과 또는 수사기관에 통보될 수 있습니다.</p></section>";
    if (result.current.days >= 5) {
      html += banner("info", "이번 기간은 수업일 " + esc(result.tools.formatDays(result.current.days)) + "일입니다. 신청서의 통화 동의 칸을 표시합니다.");
      html += '<label class="check"><input type="checkbox" data-field="safetyOk"' + (state.safetyOk ? " checked" : "") + "><span>주 1회 이상 담임과 직접 통화하는 것에 동의합니다.</span></label>";
    } else {
      html += '<label class="check"><input type="checkbox" data-field="safetyOk"' + (state.safetyOk ? " checked" : "") + "><span>학생 안전 안내를 확인했습니다.</span></label>";
    }
    return shell(html + actions(state.safetyOk, "작성 내용 보기"));
  }

  function resultStep(result) {
    var block = finalBlocker(result);
    if (block) return shell(banner("no", esc(block)) + actions(false));
    var html = banner("ok", "<strong>신청서는 이 화면을 보고 종이에 수기로 작성하세요. 이 화면은 허가가 아닙니다.</strong> 담임 통보 또는 문자를 받은 뒤에 출발합니다.");
    html += '<dl class="copy-block">';
    html += row("구분", state.region === "overseas" ? "해외" : "국내");
    html += row("학습 형태", learningLabel(state.learning));
    if (state.mode === "half") {
      html += row("기간", "반일 기준 " + result.tools.formatKorean(result.current.start) + " (4시간 미만, 당일 수업 참여)");
    } else {
      html += row("기간", "1일 기준 " + result.tools.formatKorean(result.current.start) + " ~ " + result.tools.formatKorean(result.current.end) + ", 총 " + result.tools.formatDays(result.current.days) + "일");
    }
    html += row("사용 일수", "지난 일수 " + result.tools.formatDays(result.recognizedPast) + "일 + 이번 " + result.tools.formatDays(result.current.days) + "일 = " + result.tools.formatDays(result.total) + " / " + rules.maxDays + "일");
    html += row("목적지", state.place.trim());
    html += row("나라", state.country.trim());
    html += row("도시", state.city.trim());
    html += row("숙박 장소", state.stay === "no" ? "숙박 없음" : state.lodgeName.trim());
    html += row("숙박 주소", state.stay === "no" ? "숙박 없음" : state.lodgeAddress.trim());
    html += row("보호자", state.guardianName.trim() + " / " + state.guardianRel.trim());
    html += row("인솔자", state.chaperoneName.trim() + " / " + state.chaperoneRel.trim() + " / 성인");
    html += row("목적", state.purpose.trim());
    html += row("교외체험학습 계획", state.planText.trim());
    html += row("준비서류", prepText());
    if (result.gapInfo) {
      html += row("이번 기간 다음 사용", result.tools.formatKorean(result.tools.nextSchoolDayAfter(result.current.end)) + "에 보고서를 내고, 그다음 날부터 다음 체험을 사용할 수 있습니다.");
    } else if (result.current.end) {
      var reportDay = result.tools.nextSchoolDayAfter(result.current.end);
      html += row("끝난 뒤", result.tools.formatKorean(reportDay) + "에 보고서를 냅니다. 그 등교일에는 다음 체험을 시작할 수 없습니다.");
    }
    html += "</dl>";
    html += '<section class="official"><p class="kicker">결과보고서</p><h2>보고서에 넣을 내용</h2><ul>';
    html += "<li>체험이 끝난 뒤 3일 이내에 결과보고서를 담임에게 냅니다.</li>";
    html += "<li>하루 1장, 학생·보호자·장소가 함께 나온 컬러 사진을 날짜별로 붙입니다.</li>";
    html += "<li>장소 사진은 누가 보아도 그곳이 여행을 간 지역임을 알 수 있는 실제 사진이어야 합니다.</li>";
    html += "<li>AI로 만들거나 AI로 고친 사진은 사용할 수 없습니다.</li>";
    html += "<li>동반인이 없거나 학생 본인만 나온 사진, 장소가 보이지 않거나 불분명한 사진은 인정하지 않습니다.</li>";
    html += "<li>기타 증빙으로 입장권을 붙입니다. 해외는 출입국사실증명서도 붙입니다.</li>";
    html += "<li>기한을 넘기거나 증빙서류가 부족하면 그 체험 기간 전체는 미인정 결석입니다. 이 서류는 출결을 정하는 학교 공문서입니다.</li>";
    html += "<li>사진은 이 화면에 올리지 않고 보고서 별지에 붙입니다.</li></ul></section>";
    html += '<button type="button" class="ghost" data-action="reset">입력 지우기</button>';
    return shell(html);
  }

  function row(label, value) {
    return "<dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd>";
  }

  function prepText() {
    if (state.region === "domestic" && state.stay === "yes") return "숙박 예약 정보를 신청서와 함께 냅니다.";
    if (state.region === "overseas" && state.stay === "yes") return "학생 본인 이름이 나온 항공권, 인솔자 이름의 숙박 예약 정보를 신청서와 함께 냅니다.";
    if (state.region === "overseas") return "학생 본인 이름이 나온 항공권을 신청서와 함께 냅니다.";
    return "숙박이 없어 숙박 예약 정보는 해당 없습니다.";
  }

  function finalBlocker(result) {
    if (!state.guideOk) return "첫 안내를 확인해야 작성 내용을 볼 수 있습니다.";
    if (!state.noPast && result.pastResults.some(function (item) { return !item.complete; })) return "지난 사용 기간과 보고서 제출일을 마쳐 주세요.";
    if (result.current.incomplete) return result.current.message || "신청 기간을 다시 확인해 주세요.";
    if (!result.capOk) return result.capMessage;
    if (!result.leadOk) return result.leadMessage;
    if (!result.gapOk) return result.gapMessage;
    if (!state.region || !result.regionOk) return result.regionMessage || "국내 또는 해외를 선택하세요.";
    if (!docsOk()) return "준비서류를 확인하세요.";
    if (!state.learning) return "학습 형태를 선택하세요.";
    if (!state.place.trim() || !state.country.trim() || !state.city.trim()) return "목적지, 나라, 도시를 적으세요.";
    if (state.stay === "yes" && (!state.lodgeName.trim() || !state.lodgeAddress.trim())) return "숙박 장소 이름과 주소를 적으세요.";
    if (!state.guardianName.trim() || !state.guardianRel.trim()) return "보호자 이름과 관계를 적으세요.";
    if (!state.chaperoneName.trim() || !state.chaperoneRel.trim() || !state.chaperoneAdult) return "성인 인솔자의 이름과 관계를 확인하세요.";
    if (!state.purpose.trim() || !state.planText.trim()) return "목적과 학습 계획을 적으세요.";
    if (!state.safetyOk) return "학생 안전 안내를 확인하세요.";
    return "";
  }

  function validate(step, result) {
    if (step === 0) return state.guideOk ? "" : "안내를 읽고 확인 칸을 선택해야 다음으로 갑니다.";
    if (step === 1) {
      if (state.noPast) return "";
      var missing = result.pastResults.some(function (item) { return !item.complete; });
      return missing ? "각 사용 기간과 보고서 제출일을 캘린더에서 선택하세요." : "";
    }
    if (step === 2) {
      if (state.noPast) return "";
      var late = result.pastResults.some(function (item) { return !item.onTime; });
      return late && !state.pastAck ? "미인정으로 처리되는 기간을 확인하세요." : "";
    }
    if (step === 3) return result.current.incomplete ? (result.current.message || "신청 기간을 선택하세요.") : "";
    if (step === 4) return result.capOk ? "" : result.capMessage;
    if (step === 5) return result.leadOk ? "" : result.leadMessage;
    if (step === 6) return result.gapOk ? "" : result.gapMessage;
    if (step === 7) {
      if (!state.region) return "국내 또는 해외를 선택하세요.";
      return result.regionOk ? "" : result.regionMessage;
    }
    if (step === 8) return docsOk() ? "" : "준비서류 확인 칸을 선택하세요.";
    if (step === 9) return state.learning ? "" : "학습 형태를 선택하세요.";
    if (step === 10) return state.place.trim() && state.country.trim() && state.city.trim() ? "" : "장소명, 나라명, 도시명을 모두 적으세요.";
    if (step === 11) {
      if (state.stay === "no") return "";
      return state.lodgeName.trim() && state.lodgeAddress.trim() ? "" : "숙박 장소 이름과 주소를 적으세요.";
    }
    if (step === 12) return state.guardianName.trim() && state.guardianRel.trim() ? "" : "보호자 이름과 관계를 적으세요.";
    if (step === 13) {
      if (!state.chaperoneAdult) return "인솔자는 성인이어야 합니다. 성인 확인 칸을 선택하세요.";
      return state.chaperoneName.trim() && state.chaperoneRel.trim() ? "" : "인솔자 이름과 관계를 적으세요.";
    }
    if (step === 14) return state.purpose.trim() ? "" : "목적을 적으세요.";
    if (step === 15) return state.planText.trim() ? "" : "작성 요령을 보고 학습 계획을 적으세요.";
    if (step === 16) return state.safetyOk ? "" : "학생 안전 안내를 확인하세요.";
    return "";
  }

  function render() {
    var result = assess();
    var html;
    if (state.step === 0) html = guideStep();
    else if (state.step === 1) html = pastStep();
    else if (state.step === 2) html = reportStep(result);
    else if (state.step === 3) html = periodStep(result);
    else if (state.step === 4) html = judgmentStep(result.capOk, result.capMessage);
    else if (state.step === 5) html = judgmentStep(result.leadOk, result.leadMessage);
    else if (state.step === 6) html = judgmentStep(result.gapOk, result.gapMessage, exampleCard());
    else if (state.step === 7) html = regionStep(result);
    else if (state.step === 8) html = docsStep();
    else if (state.step === 9) html = learningStep();
    else if (state.step === 10) html = textStep([
      { key: "place", label: "장소명", placeholder: "예: 불국사" },
      { key: "country", label: "나라명", placeholder: "예: 대한민국" },
      { key: "city", label: "도시명", placeholder: "예: 경주" }
    ]);
    else if (state.step === 11) html = lodgingStep();
    else if (state.step === 12) html = textStep([
      { key: "guardianName", label: "보호자 이름", placeholder: "이름" },
      { key: "guardianRel", label: "보호자와의 관계", placeholder: "예: 부모" }
    ]);
    else if (state.step === 13) {
      html = textStep([
        { key: "chaperoneName", label: "인솔자 이름", placeholder: "보호자와 달라도 됩니다" },
        { key: "chaperoneRel", label: "인솔자와의 관계", placeholder: "예: 부모, 삼촌" }
      ]);
      html = html.replace(actions(true), '<label class="check"><input type="checkbox" data-field="chaperoneAdult"' + (state.chaperoneAdult ? " checked" : "") + "><span>인솔자는 성인입니다. 보호자와 이름이 달라도 됩니다.</span></label>" + actions(true));
    } else if (state.step === 14) html = purposeStep();
    else if (state.step === 15) html = planStep();
    else if (state.step === 16) html = safetyStep(result);
    else html = resultStep(result);
    app.innerHTML = html;
  }

  function exampleCard() {
    return '<section class="card"><h2>연속 신청 예</h2><ul><li>목·금을 쓰면 다음 주 월요일부터 사용할 수 없습니다.</li><li>월요일은 보고서를 내는 날입니다.</li><li>사용은 화요일부터 가능합니다.</li><li>신청서는 출발 3일 전에 미리 낼 수 있습니다. 화요일에 시작하려면 그 전 토요일에 신청할 수 있습니다.</li></ul></section>';
  }

  function readField(target) {
    var key = target.getAttribute("data-field");
    if (!key) return;
    if (target.type === "checkbox") state[key] = target.checked;
    else state[key] = target.value;
    if (key === "noPast") {
      state.error = "";
      render();
    }
  }

  app.addEventListener("input", function (event) {
    readField(event.target);
  });

  app.addEventListener("change", function (event) {
    var target = event.target;
    if (target.type === "checkbox") {
      readField(target);
      if (target.getAttribute("data-field") !== "noPast") {
        state.error = "";
        render();
      }
    }
  });

  app.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    var action = button.getAttribute("data-action");
    state.error = "";
    if (action === "month") {
      shiftMonth(button.getAttribute("data-cal"), Number(button.getAttribute("data-dir")));
      render();
      return;
    }
    if (action === "pick") {
      pick(button.getAttribute("data-cal"), button.getAttribute("data-ymd"));
      render();
      return;
    }
    if (action === "mode") {
      state.mode = button.getAttribute("data-mode");
      render();
      return;
    }
    if (action === "region") {
      state.region = button.getAttribute("data-region");
      render();
      return;
    }
    if (action === "stay") {
      state.stay = button.getAttribute("data-stay");
      render();
      return;
    }
    if (action === "learning") {
      state.learning = button.getAttribute("data-learning");
      render();
      return;
    }
    if (action === "add-past") {
      state.past.push({ id: nextPastId, start: "", end: "", report: "" });
      nextPastId += 1;
      render();
      return;
    }
    if (action === "remove-past") {
      var id = Number(button.getAttribute("data-id"));
      state.past = state.past.filter(function (item) { return item.id !== id; });
      render();
      return;
    }
    if (action === "back") {
      state.step = Math.max(0, state.step - 1);
      render();
      return;
    }
    if (action === "reset") {
      state = blankState();
      nextPastId = 2;
      render();
      return;
    }
    if (action === "next") {
      var message = validate(state.step, assess());
      if (message) {
        state.error = message;
        render();
        return;
      }
      state.step += 1;
      render();
    }
  });

  render();
})();
