/*
 * 보안·개인정보
 * 목적: 종이 신청서에 옮길 내용을 정리하고, 기간과 보고서가 규칙에 맞는지 확인한다.
 * 저장: 하지 않는다. 유의사항은 학생이 화면을 캡쳐한다.
 * 받지 않음: 학번, 반, 휴대폰, 예약 파일, 사진, 주민등록번호.
 * 전송: 서버와 외부 AI로 보내지 않는다.
 */
(function () {
  var rules = window.SCHOOL_RULES;
  var toolsApi = window.DateTools;
  var NOTES_KEY = "songnae-fieldtrip-notes";
  var app = document.getElementById("app");
  var today = new Date();

  var LEARNING = [
    ["family", "가족 여행"],
    ["relative", "친인척 방문"],
    ["visit", "답사·견학 활동"],
    ["experience", "체험 활동"]
  ];

  var INTRO = 1;

  var STEP_TITLES = ["안내", "계획", "신청서", "유의사항"];

  var state = blankState();

  function blankState() {
    return {
      step: 0,
      maxStep: 0,
      error: "",
      intro0: false,
      guide1: false,
      guide2: false,
      guide3: false,
      guide4: false,
      guide5: false,
      viewSaved: false,
      usedDays: "0",
      usedSet: false,
      startSet: false,
      reportStatus: "",
      pastEnd: "",
      reportAck: false,
      gapConfirm: false,
      planner: true,
      planStart: "",
      draftTrip: 1,
      draftGap: 1,
      pattern: [],
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
      samePerson: "",
      guardianName: "",
      guardianRel: "",
      chaperoneName: "",
      chaperoneRel: "",
      chaperoneAdult: false,
      showUsed: false,
      purpose: "",
      planText: "",
      dayPlans: {},
      safetyOk: false,
      view: {},
      tour: null
    };
  }

  var TOUR = [
    { id: "used", title: "이미 사용", text: "올해 사용한 수업일입니다. 기본은 0일이고, 남은 일수는 20일입니다." },
    { id: "region", title: "국내·국외", text: "국내인지 국외인지 고릅니다." },
    { id: "start", title: "출발일", text: "수업일만 셉니다. 오늘 다음 날부터 수업일 3일이 되는 날부터 고릅니다." },
    { id: "days", title: "체험 일수", text: "일수를 정하고 추가를 누릅니다. 주말과 공휴일은 빠집니다." },
    { id: "place", title: "장소", text: "학습 형태를 고르고, 여행장소를 적습니다." },
    { id: "stay", title: "숙박", text: "숙박이 있으면 이름과 주소를 적습니다." },
    { id: "people", title: "보호자", text: "보호자 이름과 관계를 적습니다. 인솔자는 성인입니다." }
  ];
  var placedTour = -1;

  function parseUsed(value) {
    var text = String(value == null ? "" : value).trim();
    if (!/^\d+$/.test(text)) return null;
    return Number(text);
  }

  function coverSchoolDays(tools, from, count) {
    var cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (!tools.isSchoolDay(cursor)) cursor = tools.addDays(cursor, 1);
    var start = cursor;
    var left = count;
    var blocked = [];
    while (left > 0) {
      if (tools.isSchoolDay(cursor)) {
        if (tools.isBlocked(cursor)) blocked.push(blockedLabel(tools, cursor));
        left -= 1;
        if (left === 0) break;
      }
      cursor = tools.addDays(cursor, 1);
    }
    return { start: start, end: cursor, blocked: blocked };
  }

  function shortDate(tools, date) {
    return (date.getMonth() + 1) + "/" + date.getDate() + "(" + tools.weekdayName(date) + ")";
  }

  function blockedLabel(tools, date) {
    var key = tools.ymd(date);
    var note = rules.blockedNotes && rules.blockedNotes[key];
    if (!note) {
      (rules.blockedRanges || []).forEach(function (range) {
        if (!note && range.note && key >= range.from && key <= range.to) note = range.note;
      });
    }
    return tools.formatKorean(date) + (note ? " " + note : "");
  }

  function spanText(tools, from, to, note) {
    if (!from) return "";
    var text = to ? shortDate(tools, from) + "~" + shortDate(tools, to) : shortDate(tools, from);
    return text + (note ? " " + note : "");
  }

  function excludeBox() {
    var tools = toolsApi.create(rules, { today: today });
    var lines = [];
    (rules.blockedRanges || []).forEach(function (range) {
      var text = spanText(tools, tools.parseYmd(range.from), tools.parseYmd(range.to), range.note);
      if (text) lines.push(text);
    });
    (rules.blockedDates || []).forEach(function (ymd) {
      var note = (rules.blockedNotes && rules.blockedNotes[ymd]) || "";
      var text = spanText(tools, tools.parseYmd(ymd), null, note);
      if (text) lines.push(text);
    });
    if (!lines.length) return "";
    var html = '<section class="exclude-box"><h2>체험학습 제외</h2>';
    lines.forEach(function (line) { html += "<p>" + esc(line) + "</p>"; });
    html += "</section>";
    return html;
  }

  function blockedGuide() {
    var tools = toolsApi.create(rules, { today: today });
    var html = "<ul>";
    var skips = rules.skipDates || [];
    if (skips.length) {
      var skipText = skips.map(function (ymd) {
        var date = tools.parseYmd(ymd);
        var note = (rules.skipNotes && rules.skipNotes[ymd]) || "";
        return esc(date ? shortDate(tools, date) : ymd) + (note ? " " + esc(note) : "");
      }).join(", ");
      html += "<li>" + skipText + " 미포함</li>";
    }
    (rules.notices || []).forEach(function (item) {
      var text = spanText(tools, tools.parseYmd(item.from || item.date), item.to ? tools.parseYmd(item.to) : null, item.note);
      if (text) html += "<li>" + esc(text) + "</li>";
    });
    html += "</ul>";
    return html;
  }

  function guideReady() {
    return state.guide1 && state.guide2 && state.guide3 && state.guide4 && state.guide5;
  }

  function rangeLabel(tools, start, end) {
    var text = shortDate(tools, start);
    if (tools.ymd(start) !== tools.ymd(end)) text += "~" + shortDate(tools, end);
    return text;
  }

  function describeBlock(tools, block) {
    var parts = [];
    var rests = [];
    var cursor = new Date(block.start.getFullYear(), block.start.getMonth(), block.start.getDate());
    var end = new Date(block.end.getFullYear(), block.end.getMonth(), block.end.getDate());
    while (cursor <= end) {
      var school = tools.isSchoolDay(cursor);
      var runStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      var runEnd = runStart;
      var next = tools.addDays(cursor, 1);
      while (next <= end && tools.isSchoolDay(next) === school) {
        runEnd = next;
        next = tools.addDays(next, 1);
      }
      if (school) parts.push(rangeLabel(tools, runStart, runEnd));
      else rests.push(rangeLabel(tools, runStart, runEnd));
      cursor = next;
    }
    var name = block.kind === "trip" ? "체험" : "등교";
    return {
      kind: block.kind,
      text: name + " " + parts.join(", ") + " · " + block.days + "일",
      rest: rests.length ? rests.join(", ") + "은 일수에서 빠집니다." : ""
    };
  }

  function buildPlan() {
    var tools = toolsApi.create(rules, { today: today });
    if (!state.planStart) state.planStart = tools.ymd(tools.earliestLeadDate());
    var start = tools.parseYmd(state.planStart) || tools.earliestLeadDate();
    var blocks = [];
    var blocked = [];
    var tripDays = 0;
    var warnings = [];
    state.pattern = state.pattern.filter(function (seg) { return seg.kind === "trip" && seg.days; });
    state.pattern.forEach(function (seg) { tripDays += seg.days; });
    if (!tools.leadOk(start)) {
      warnings.push("주말·공휴일은 뺍니다. 가장 빠른 출발일은 " + tools.formatKorean(tools.earliestLeadDate()) + "입니다.");
    }
    if (!tripDays) {
      warnings.push("체험 기간을 추가하세요.");
    } else {
      var span = coverSchoolDays(tools, start, tripDays);
      blocked = span.blocked;
      blocks.push({ kind: "trip", days: tripDays, start: span.start, end: span.end });
      if (state.region !== "overseas" && tripDays > rules.domesticMaxConsecutive) {
        warnings.push("국내는 연속 " + rules.domesticMaxConsecutive + "일까지입니다. 이번은 " + tripDays + "일입니다.");
      }
    }
    if (blocked.length) warnings.push("금지일이 들어 있습니다. " + blocked.join(", "));
    if (!state.startSet) warnings.push("출발일을 고르세요.");
    var used = parseUsed(state.usedDays);
    if (used === null) warnings.push("이미 사용한 일수를 확인하세요.");
    var counted = used > 0 ? used : 0;
    if (used > 0 && state.reportStatus !== "pass" && state.reportStatus !== "open") {
      warnings.push("보고서 제출 여부를 고르세요.");
    }
    if (used > 0 && state.reportStatus === "open" && !tools.parseYmd(state.pastEnd)) {
      warnings.push("지난 체험이 끝난 수업일을 적으세요.");
    }
    if (counted + tripDays > rules.maxDays) warnings.push("한 해 " + rules.maxDays + "일을 넘습니다.");
    var unique = [];
    warnings.forEach(function (item) {
      if (unique.indexOf(item) < 0) unique.push(item);
    });
    var end = blocks.length ? blocks[blocks.length - 1].end : start;
    return {
      tools: tools,
      blocks: blocks,
      tripDays: tripDays,
      counted: counted,
      total: counted + tripDays,
      remain: rules.maxDays - (counted + tripDays),
      segmentMax: tripDays,
      ok: unique.length === 0 && tripDays > 0,
      warnings: unique,
      startYmd: tools.ymd(start),
      endYmd: tools.ymd(end)
    };
  }

  function assess() {
    var plan = buildPlan();
    state._plan = plan;
    state.start = plan.startYmd;
    state.end = plan.endYmd;
    state.plannedDays = plan.tripDays;
    state.segmentMax = plan.segmentMax;
    state.planReady = plan.ok;
    state.planMessage = plan.warnings[0] || "";
    return toolsApi.assess(rules, state, today);
  }

  function stepper(key, label, min, max) {
    return '<div class="stepper"><button type="button" data-action="bump" data-key="' + key + '" data-dir="-1" data-min="' + min + '" data-max="' + max + '" aria-label="' + label + ' 줄이기">−</button><span>' + label + "</span><button type=\"button\" data-action=\"bump\" data-key=\"" + key + "\" data-dir=\"1\" data-min=\"" + min + "\" data-max=\"" + max + "\" aria-label=\"" + label + " 늘리기\">+</button></div>";
  }

  function plannerStep() {
    var plan = state._plan;
    var tools = plan.tools;
    var remainShown = Math.max(0, plan.remain);
    var html = hero("기간부터 계획까지", "날짜를 계산하고, 신청서에 적을 내용을 적습니다.");
    if (state.error) html += banner("no", esc(state.error));
    html += '<section class="guide-card status-line"><div data-tour="used"><p class="mini">이미 사용</p>' + stepper("usedDays", (parseUsed(state.usedDays) || 0) + "일", 0, rules.maxDays) + "</div>";
    html += '<div class="remain"><p class="mini">남은 일수</p><b>' + remainShown + "일</b></div></section>";
    if (parseUsed(state.usedDays) > 0) {
      html += '<div class="choice tight">';
      html += '<button type="button" data-action="report" data-status="pass" aria-pressed="' + (state.reportStatus === "pass" ? "true" : "false") + '">보고서를 기한 안에 냈습니다</button>';
      html += '<button type="button" data-action="report" data-status="open" aria-pressed="' + (state.reportStatus === "open" ? "true" : "false") + '">아직 안 냈습니다</button></div>';
      if (state.reportStatus === "open") {
        html += '<label class="field">지난 체험이 끝난 수업일<input type="date" data-field="pastEnd" value="' + esc(state.pastEnd) + '"></label>';
      }
    }
    html += '<section class="guide-card"><h2>패턴으로 계획 만들기</h2>';
    html += '<div class="toggle" data-tour="region">';
    html += '<button type="button" data-action="region" data-region="domestic" aria-pressed="' + (state.region === "domestic" ? "true" : "false") + '">국내</button>';
    html += '<button type="button" data-action="region" data-region="overseas" aria-pressed="' + (state.region === "overseas" ? "true" : "false") + '">국외</button></div>';
    html += '<label class="field" data-tour="start">출발일<input type="date" data-field="planStart" value="' + esc(state.planStart) + '"></label>';
    html += '<div class="steppers" data-tour="days">' + stepper("draftTrip", "체험 " + state.draftTrip + "일", 1, rules.maxDays) + "</div>";
    html += '<div class="pchips">';
    state.pattern.forEach(function (seg, index) {
      html += '<button type="button" class="pchip trip" data-action="drop" data-index="' + index + '">체험 ' + seg.days + "일</button>";
    });
    html += "</div>";
    html += '<div class="actions slim"><button type="button" data-action="add-seg">추가</button><button type="button" class="secondary" data-action="pop-seg">삭제</button></div>';
    if (!plan.ok && plan.warnings.length) {
      html += '<div class="alert-big">' + plan.warnings.map(function (item) { return esc(item); }).join("<br>") + "</div>";
    }
    html += "</section>";
    html += '<section class="score' + (plan.ok ? "" : " warn") + '"><div><p class="label">이번 계획</p><p class="big">' + plan.tripDays + '</p></div><div><p>누적 <b>' + plan.total + " / " + rules.maxDays + "</b></p><p>남은 <b>" + remainShown + "일</b></p></div></section>";
    html += '<section class="guide-card" data-tour="place"><h2>장소</h2>';
    html += '<div class="choice tight">';
    LEARNING.forEach(function (item) {
      html += '<button type="button" data-action="learning" data-learning="' + item[0] + '" aria-pressed="' + (state.learning === item[0] ? "true" : "false") + '">' + esc(item[1]) + "</button>";
    });
    html += "</div>";
    html += '<label class="field">여행장소<input data-field="place" value="' + esc(state.place) + '" autocomplete="off" placeholder="경주 불국사 또는 태국 방콕"></label>';
    html += '<div class="choice tight" data-tour="stay">';
    html += '<button type="button" data-action="stay" data-stay="yes" aria-pressed="' + (state.stay === "yes" ? "true" : "false") + '">숙박이 있습니다</button>';
    html += '<button type="button" data-action="stay" data-stay="no" aria-pressed="' + (state.stay === "no" ? "true" : "false") + '">숙박이 없습니다</button></div>';
    if (state.stay === "yes") {
      html += '<label class="field">숙박 이름<input data-field="lodgeName" value="' + esc(state.lodgeName) + '" autocomplete="off" placeholder="예: 호텔 이름"></label>';
      html += '<label class="field">숙박 주소<input data-field="lodgeAddress" value="' + esc(state.lodgeAddress) + '" autocomplete="off" placeholder="도시와 도로명"></label>';
    }
    html += "</section>";
    html += '<section class="guide-card" data-tour="people"><h2>보호자와 인솔자</h2>';
    html += '<div class="choice tight">';
    html += '<button type="button" data-action="same-person" data-same="same" aria-pressed="' + (state.samePerson === "same" ? "true" : "false") + '">같은 사람</button>';
    html += '<button type="button" data-action="same-person" data-same="diff" aria-pressed="' + (state.samePerson === "diff" ? "true" : "false") + '">다른 사람</button></div>';
    html += '<label class="field">보호자 이름<input data-field="guardianName" value="' + esc(state.guardianName) + '" autocomplete="off" placeholder="이름"></label>';
    html += '<label class="field">보호자와의 관계<input data-field="guardianRel" value="' + esc(state.guardianRel) + '" autocomplete="off" placeholder="예: 부모"></label>';
    if (state.samePerson === "diff") {
      html += '<label class="field">인솔자 이름<input data-field="chaperoneName" value="' + esc(state.chaperoneName) + '" autocomplete="off" placeholder="이름"></label>';
      html += '<label class="field">인솔자와의 관계<input data-field="chaperoneRel" value="' + esc(state.chaperoneRel) + '" autocomplete="off" placeholder="예: 삼촌"></label>';
    }
    html += checkLine("chaperoneAdult", "인솔자는 성인입니다.");
    html += "</section>";
    html += actions(!inputMessage(), "신청서");
    return html;
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
      if (!tools.leadOk(date)) classes.push("is-soon");
      if (value === todayYmd) classes.push("is-today");
      if (mode === "range" && start && end && value > start && value < end) classes.push("is-range");
      if (value === start || (mode === "range" && value === end && end)) classes.push("is-selected");
      var label = tools.formatKorean(date);
      if (tools.isHoliday(date)) label += " 공휴일";
      else if (tools.isWeekend(date)) label += " 주말";
      else label += " 수업일";
      if (tools.isBlocked(date)) label += " 사용불가" + (rules.blockedNotes && rules.blockedNotes[value] ? " " + rules.blockedNotes[value] : "");
      html += '<button type="button" class="' + classes.join(" ") + '" data-action="pick" data-cal="' + esc(key) + '" data-ymd="' + value + '" aria-label="' + esc(label) + '">' + date.getDate() + "</button>";
    });
    html += '</div><div class="legend"><span><i class="swatch school"></i>수업일</span><span><i class="swatch rest"></i>주말·공휴일</span><span><i class="swatch block"></i>사용불가</span><span><i class="swatch pick"></i>선택한 날</span></div></div>';
    return html;
  }

  function pick(key, ymd) {
    var tools = toolsApi.create(rules, { today: today });
    var date = tools.parseYmd(ymd);
    function tooSoon() {
      if (tools.leadOk(date)) return false;
      state.error = "그 날은 안 됩니다.";
      return true;
    }
    if (state.mode === "half") {
      if (tooSoon()) return;
      state.halfDate = ymd;
      return;
    }
    if (!state.start || state.end) {
      if (tooSoon()) return;
      state.start = ymd;
      state.end = "";
    } else if (ymd < state.start) {
      if (tooSoon()) return;
      state.end = state.start;
      state.start = ymd;
    } else {
      state.end = ymd;
    }
  }

  function banner(kind, text) {
    return '<div class="banner banner-' + kind + '">' + text + "</div>";
  }

  function actions(showNext, nextLabel) {
    if (!showNext) return "";
    return '<div class="actions"><button type="button" data-action="next">' + esc(nextLabel || "다음") + "</button></div>";
  }

  function hero(title, sub) {
    var html = '<header class="hero"><div class="hero-row"><p class="hero-kicker">' + esc(rules.schoolName) + "</p>";
    html += '<p class="progress">' + (state.step + 1) + " / " + STEP_TITLES.length + "</p></div>";
    html += "<h1>" + esc(title) + "</h1>";
    if (sub) html += '<p class="hero-sub">' + sub + "</p>";
    html += "</header>";
    return html;
  }

  function shell(body) {
    var last = STEP_TITLES.length - 1;
    var head = hero(STEP_TITLES[state.step] || "", "");
    if (state.error) head += banner("no", esc(state.error));
    var note = state.step === last
      ? '<p class="footer-note">이 화면에만 있습니다. 저장·전송하지 않습니다.</p>'
      : "";
    return head + body + note;
  }

  function guideCard(title, body) {
    return '<section class="guide-card"><h2>' + title + "</h2>" + body + "</section>";
  }

  function checkLine(field, label) {
    return '<label class="check"><input type="checkbox" data-field="' + field + '"' + (state[field] ? " checked" : "") + "><span>" + esc(label) + "</span></label>";
  }

  function checkRich(field, html) {
    return '<label class="check"><input type="checkbox" data-field="' + field + '"' + (state[field] ? " checked" : "") + "><span>" + html + "</span></label>";
  }

  function mark(text) {
    return '<b class="em">' + esc(text) + "</b>";
  }

  function weekChips() {
    var html = '<div class="chips" aria-label="월요일부터 금요일은 체험, 다음 주 월요일은 보고서">';
    ["월", "화", "수", "목", "금"].forEach(function (day) {
      html += '<span class="chip">' + day + "</span>";
    });
    html += '<span class="chip chip-next">다음 주 월요일</span></div>';
    html += '<p class="ex">월~금 체험이면 다음 주 월요일은 보고서를 내는 날입니다. 사용은 화요일부터입니다. 목·금만 써도 같습니다.</p>';
    return html;
  }

  function guidePage() {
    var order = "<ol>";
    order += "<li>이 화면에서 체험학습 가능 기간과 작성내용을 확인합니다.</li>";
    order += "<li>종이 신청서를 쓰고 보호자가 서명합니다.</li>";
    order += "<li>출발 3일 전(주말·공휴일 제외)까지 담임에게 냅니다.</li>";
    order += "<li>담임 통보서를 받고 체험학습을 시작합니다.</li>";
    order += "<li>끝난 뒤 3일 이내에 보고서를 냅니다.</li>";
    order += "</ol>";

    var days = '<p class="punch">최대 <b>' + esc(String(rules.maxDays)) + "</b>일</p>";
    days += '<p class="quiet">한 해 평일 기준입니다. 주말과 공휴일은 빠집니다.</p>';
    days += '<p class="ex">예: 금·토·일·월이면 수업일은 금요일과 월요일, 2일입니다.</p>';

    var gap = '<p class="punch">국내 연속 <b>' + esc(String(rules.domesticMaxConsecutive)) + "</b>일</p>";
    gap += '<p class="quiet">그다음 등교일은 출석입니다. 해외는 연속 제한이 없습니다.</p>';
    gap += weekChips();

    var blocked = blockedGuide();

    var remember = checkRich("guide1", "서류가 부족하면 " + mark("미인정 결석으로") + " 처리됩니다.");
    remember += checkRich("guide2", "사진자료 " + mark("AI 생성 불가") + " 합니다.");
    remember += checkRich("guide3", "사진에 포함되어야 하는 내용을 숙지합니다." +
      '<span class="line-punch">누구나 알 수 있는 여행 장소</span>' +
      '<span class="line-punch">납득이 가능한 복장</span>' +
      '<span class="line-punch">보고서에 기록된 활동</span>');
    remember += checkRich("guide4", mark("성인") + "과 함께 갑니다");
    remember += checkRich("guide5", mark("제출기한") + "을 지켜야 합니다." +
      '<span class="break">신청서 제출 기한 ' + mark("( " + rules.leadDays + " )") + "일 이전</span>" +
      '<span class="break">보고서 제출 기한 ' + mark("( " + rules.reportDays + " )") + "일 이내</span>");

    var html = hero("교외체험학습 안내", "읽고 확인하면 다음으로 갑니다.");
    if (state.error) html += banner("no", esc(state.error));
    html += excludeBox();
    html += guideCard("1. 신청 순서", order);
    html += guideCard("2. 쓸 수 있는 일수", days);
    html += guideCard("3. 연속 사용 제한", gap);
    html += guideCard("4. 체험학습 참고일", blocked);
    html += guideCard("5. 꼭 기억하세요", remember);
    html += actions(guideReady(), "다음");
    html += '<p class="footer-note">이 화면에만 있습니다. 저장·전송하지 않습니다.</p>';
    return html;
  }

  function pastStep() {
    var html = '<label class="field">올해 쓴 수업일<input data-field="usedDays" inputmode="numeric" value="' + esc(state.usedDays) + '" autocomplete="off" placeholder="없으면 0"></label>';
    return shell(html + actions(true));
  }

  function reportStep(result) {
    var days = parseUsed(state.usedDays);
    var html = "";
    if (days === 0) {
      html += banner("ok", "해당 없음.");
    } else {
      html += '<div class="choice">';
      html += '<button type="button" data-action="report" data-status="pass" aria-pressed="' + (state.reportStatus === "pass" ? "true" : "false") + '">기한 안에 냈습니다</button>';
      html += '<button type="button" data-action="report" data-status="fail" aria-pressed="' + (state.reportStatus === "fail" ? "true" : "false") + '">늦거나 부족합니다</button></div>';
      if (state.reportStatus === "fail") {
        html += checkLine("reportAck", "미인정. 20일에 넣지 않습니다.");
      }
    }
    var ready = !days || state.reportStatus === "pass" || (state.reportStatus === "fail" && state.reportAck);
    return shell(html + actions(ready));
  }

  function periodStep(result) {
    var html = '<div class="choice">';
    html += '<button type="button" data-action="mode" data-mode="range" aria-pressed="' + (state.mode === "range" ? "true" : "false") + '">하루 이상</button>';
    html += '<button type="button" data-action="mode" data-mode="half" aria-pressed="' + (state.mode === "half" ? "true" : "false") + '">반일, 4시간 미만</button></div>';
    html += '<p class="help">주말을 뺀 가장 빠른 출발일은 ' + esc(result.tools.formatKorean(result.tools.earliestLeadDate())) + "입니다.</p>";
    if (state.mode === "half") {
      html += "<p class=\"summary\">반일 " + esc(state.halfDate || "날짜를 고르세요") + "</p>";
      html += calendar("apply", "single", state.halfDate, "");
      html += checkLine("halfUnder4", "4시간 미만입니다.");
      html += checkLine("halfAttended", "당일 수업에도 참여합니다.");
    } else {
      html += "<p class=\"summary\">" + rangeSummary(result) + "</p>";
      html += calendar("apply", "range", state.start, state.end);
    }
    return shell(html + actions(true));
  }

  function rangeSummary(result) {
    if (!result.current.start) return "시작일을 누르세요.";
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
    return shell(html + actions(!!state.region && result.regionOk));
  }

  function docsStep() {
    var html = '<div class="choice">';
    html += '<button type="button" data-action="stay" data-stay="yes" aria-pressed="' + (state.stay === "yes" ? "true" : "false") + '">숙박이 있습니다</button>';
    html += '<button type="button" data-action="stay" data-stay="no" aria-pressed="' + (state.stay === "no" ? "true" : "false") + '">숙박이 없습니다</button></div>';
    if (state.region === "domestic" && state.stay === "yes") {
      html += checkLine("docStay", "숙박 예약 정보를 냅니다.");
    }
    if (state.region === "overseas") {
      html += checkLine("docTicket", "항공권에 학생 이름이 있습니다.");
      if (state.stay === "yes") {
        html += checkLine("docStayName", "숙박 예약 이름은 인솔자입니다.");
      }
    }
    if (state.stay === "no") html += banner("info", "숙박 없음.");
    if (state.stay && !docsOk()) html += banner("no", "확인 칸을 선택해야 다음으로 갑니다.");
    return shell(html + actions(true));
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
      return shell(banner("ok", "숙박 없음.") + actions(true));
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

  function planSchoolDays(tools) {
    var days = [];
    var plan = state._plan;
    if (!plan) return days;
    plan.blocks.forEach(function (block) {
      if (!block.start || !block.end) return;
      var cursor = new Date(block.start.getFullYear(), block.start.getMonth(), block.start.getDate());
      var end = new Date(block.end.getFullYear(), block.end.getMonth(), block.end.getDate());
      while (cursor <= end) {
        if (tools.isSchoolDay(cursor)) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
        cursor = tools.addDays(cursor, 1);
      }
    });
    return days;
  }

  function reportKind(index) {
    return index === 0 ? "보고서(첫날)" : "보고서(둘째날부터)";
  }

  function planStep() {
    var tools = state._plan.tools;
    var days = planSchoolDays(tools);
    var html = hero("날짜별 계획", "수업일마다 보고서 한 장입니다.");
    if (state.error) html += banner("no", esc(state.error));
    if (!days.length) html += banner("no", "체험 기간을 먼저 만드세요.");
    var ready = days.length > 0;
    days.forEach(function (date, index) {
      var ymd = tools.ymd(date);
      var text = state.dayPlans[ymd] || "";
      if (!String(text).trim()) ready = false;
      html += '<section class="day-sheet">';
      html += '<p class="sheet-kicker">' + (index + 1) + "일차 · " + reportKind(index) + "</p>";
      html += "<h2>" + esc(shortDate(tools, date)) + " · 1일</h2>";
      html += '<label class="field">학습 내용<textarea data-field="dayPlan" data-ymd="' + ymd + '" autocomplete="off" placeholder="이 날짜에 어디서 무엇을 하는지">' + esc(text) + "</textarea></label>";
      html += '<p class="photo-box">매일 사진 2장. 장소+여행단체, 여행단체+활동. AI 생성 불가. 종이에 붙입니다.</p>';
      html += "</section>";
    });
    html += actions(ready, "다음");
    return html;
  }

  function safetyStep(result) {
    var html = "";
    if (result.current.days >= 5) {
      html += '<p class="help">주 1회 학생이 담임과 통화합니다. 없으면 관계 기관에 통보될 수 있습니다.</p>';
      html += checkLine("safetyOk", "통화에 동의합니다.");
    } else {
      html += checkLine("safetyOk", "확인했습니다.");
    }
    return shell(html + actions(state.safetyOk, "적을 내용"));
  }

  function syncSamePerson() {
    if (state.samePerson !== "same") return;
    state.chaperoneName = state.guardianName.trim();
    state.chaperoneRel = state.guardianRel.trim();
  }

  function peopleStep() {
    var html = hero("보호자와 인솔자", "같은 사람인지 고르면 다음으로 갑니다.");
    if (state.error) html += banner("no", esc(state.error));
    html += '<div class="note">보호자는 신청서에 서명하는 사람입니다. 인솔자는 학생과 함께 가는 성인입니다.</div>';
    html += '<div class="choice">';
    html += '<button type="button" data-action="same-person" data-same="same" aria-pressed="' + (state.samePerson === "same" ? "true" : "false") + '">같은 사람</button>';
    html += '<button type="button" data-action="same-person" data-same="diff" aria-pressed="' + (state.samePerson === "diff" ? "true" : "false") + '">다른 사람</button></div>';
    if (state.samePerson === "same") {
      html += '<label class="field">이름<input data-field="guardianName" value="' + esc(state.guardianName) + '" autocomplete="off" placeholder="이름"></label>';
      html += '<label class="field">관계<input data-field="guardianRel" value="' + esc(state.guardianRel) + '" autocomplete="off" placeholder="예: 부모"></label>';
      html += checkLine("chaperoneAdult", "이 분이 성인 인솔자입니다.");
    } else if (state.samePerson === "diff") {
      html += '<label class="field">보호자 이름<input data-field="guardianName" value="' + esc(state.guardianName) + '" autocomplete="off" placeholder="이름"></label>';
      html += '<label class="field">보호자와의 관계<input data-field="guardianRel" value="' + esc(state.guardianRel) + '" autocomplete="off" placeholder="예: 부모"></label>';
    }
    var ready = false;
    if (state.samePerson === "same") ready = !!(state.guardianName.trim() && state.guardianRel.trim() && state.chaperoneAdult);
    if (state.samePerson === "diff") ready = !!(state.guardianName.trim() && state.guardianRel.trim());
    html += actions(ready, "다음");
    return html;
  }

  function chaperoneStep() {
    var html = hero("인솔자", "보호자와 다른 성인입니다.");
    if (state.error) html += banner("no", esc(state.error));
    html += '<label class="field">이름<input data-field="chaperoneName" value="' + esc(state.chaperoneName) + '" autocomplete="off" placeholder="이름"></label>';
    html += '<label class="field">관계<input data-field="chaperoneRel" value="' + esc(state.chaperoneRel) + '" autocomplete="off" placeholder="예: 삼촌"></label>';
    html += checkLine("chaperoneAdult", "성인입니다.");
    var ready = !!(state.chaperoneName.trim() && state.chaperoneRel.trim() && state.chaperoneAdult);
    html += actions(ready, "다음");
    return html;
  }

  function resultStep(result) {
    syncSamePerson();
    var block = finalBlocker(result);
    if (block) return shell(banner("no", esc(block)) + actions(false));
    if (state.showUsed) return usedStep(result);
    var plan = state._plan;
    var tools = result.tools;
    var remainShown = plan.remain < 0 ? 0 : plan.remain;
    var days = planSchoolDays(tools);
    var backDate = result.current.end ? tools.nextSchoolDayAfter(result.current.end) : null;
    var html = hero("확인 결과", "날짜마다 보고서 한 장입니다.");
    html += '<div class="note">종이 신청서를 작성해서 제출하세요.</div>';
    html += '<section class="guide-card"><h2>신청서에 옮겨 적을 내용</h2>';
    html += "<p>" + esc(state.region === "overseas" ? "해외" : "국내") + " · " + esc(learningLabel(state.learning)) + " · 수업일 " + days.length + "일</p>";
    html += '<table class="plan-table"><thead><tr><th></th><th>기간</th><th>평일</th><th>복귀</th></tr></thead><tbody>';
    days.forEach(function (date, index) {
      var backCell = index === days.length - 1 && backDate ? shortDate(tools, backDate) : "다음날도 체험";
      html += "<tr><td>" + (index + 1) + "</td><td>" + esc(shortDate(tools, date)) + "</td><td>1일</td><td>" + esc(backCell) + "</td></tr>";
    });
    html += "</tbody></table>";
    plan.blocks.forEach(function (item) {
      var line = describeBlock(tools, item);
      if (line.rest) html += '<p class="range-rest">' + esc(line.rest) + "</p>";
    });
    html += '<p class="score-line">이번 <b>' + days.length + "일</b> · 누적 <b>" + plan.total + " / " + rules.maxDays + "</b> · 남은 <b>" + remainShown + "일</b></p>";
    html += '<p class="judge"><span class="flag flag-ok">가능</span>수업일 ' + days.length + "일이 규칙 안입니다.</p>";
    var papers = prepText() === "없음" ? "숙박·항공 서류는 없습니다" : prepText();
    html += '<p class="judge"><span class="flag flag-doc">서류</span>' + esc(papers) + ". 날짜마다 사진 1장. 보호자 서명.</p>";
    html += "</section>";
    if (backDate) {
      html += '<div class="callout">복귀 ' + esc(shortDate(tools, backDate)) + ". 체험이 끝난 다음 수업일입니다. 그 전 수업일까지 담임 연락을 확인합니다.</div>";
    }
    days.forEach(function (date, index) {
      var ymd = tools.ymd(date);
      html += '<section class="day-sheet">';
      html += '<p class="sheet-kicker">' + (index + 1) + "일차 · " + reportKind(index) + "</p>";
      html += "<h2>" + esc(shortDate(tools, date)) + " · 1일</h2>";
      html += '<dl class="sheet-rows">';
      html += "<dt>기간</dt><dd>" + esc(tools.formatKorean(date)) + " · 1일</dd>";
      if (index === 0) {
        html += "<dt>목적지</dt><dd>" + esc(state.place.trim()) + " · " + esc(state.country.trim()) + " " + esc(state.city.trim()) + "</dd>";
        html += "<dt>학습 형태</dt><dd>" + esc(learningLabel(state.learning)) + "</dd>";
        html += "<dt>목적</dt><dd>" + esc(state.purpose.trim()) + "</dd>";
        if (state.samePerson === "same") {
          html += "<dt>동반자</dt><dd>" + esc(state.guardianName.trim()) + " / " + esc(state.guardianRel.trim()) + " · 보호자이자 인솔자</dd>";
        } else {
          html += "<dt>보호자</dt><dd>" + esc(state.guardianName.trim()) + " / " + esc(state.guardianRel.trim()) + "</dd>";
          html += "<dt>인솔자</dt><dd>" + esc(state.chaperoneName.trim()) + " / " + esc(state.chaperoneRel.trim()) + " · 성인</dd>";
        }
        html += "<dt>숙박</dt><dd>" + (state.stay === "no" ? "숙박 없음" : esc(state.lodgeName.trim())) + "</dd>";
      }
      html += "<dt>학습 내용</dt><dd>" + esc((state.dayPlans[ymd] || "").trim()) + "</dd>";
      html += "</dl>";
      html += '<p class="photo-box">매일 사진 2장. 장소+여행단체, 여행단체+활동. AI 생성 불가.</p>';
      html += "</section>";
    });
    html += '<section class="guide-card"><h2>신청 유의사항</h2>';
    html += "<h3>신청서 낼 때</h3><ul>";
    html += "<li>출발 " + rules.leadDays + "일 전(주말·공휴일 제외)까지 담임에게 냅니다.</li>";
    html += "<li>보호자가 서명합니다.</li>";
    html += "<li>목적과 날짜별 학습 내용을 적습니다.</li></ul>";
    html += "<h3>다시 확인</h3><ul>";
    html += "<li>날짜가 바뀌면 이 화면에서 다시 계산합니다.</li>";
    html += "<li>일수를 늘리면 연속 " + rules.domesticMaxConsecutive + "일과 한 해 " + rules.maxDays + "일을 다시 봅니다.</li>";
    html += "<li>국내와 국외가 바뀌면 서류가 달라집니다.</li></ul></section>";
    html += '<section class="guide-card warn-card"><h2>인정되지 않을 수 있습니다</h2><ul>';
    html += "<li>종이 신청서를 내지 않으면</li>";
    html += "<li>증빙이 부족하면</li>";
    html += "<li>국내는 한 번에 연속 " + rules.domesticMaxConsecutive + "일까지입니다.</li>";
    html += "<li>보고서를 끝난 뒤 " + rules.reportDays + "일 안에 내지 않으면</li></ul></section>";
    html += '<section class="guide-card"><h2>다음에 할 일</h2><ol class="next-steps">';
    html += "<li>위 날짜를 확인합니다.</li>";
    html += "<li>종이 신청서를 쓰고 보호자가 서명한 뒤, 출발 " + rules.leadDays + "일 전(주말·공휴일 제외)까지 담임에게 냅니다.</li>";
    html += "<li>다녀온 뒤 " + rules.reportDays + "일 안에 날짜마다 보고서와 사진을 냅니다.</li>";
    html += "<li>이 화면의 숫자는 저장되지 않습니다.</li></ol></section>";
    html += '<div class="actions">';
    html += '<button type="button" class="secondary" data-action="goto" data-step="1">계획 다시 계산</button>';
    html += '<button type="button" data-action="used-view">내 누적 일수</button></div>';
    html += '<p class="footer-note">이 화면에만 있습니다. 저장·전송하지 않습니다.</p>';
    return html;
  }

  function usedStep(result) {
    var plan = state._plan;
    var tools = result.tools;
    var days = planSchoolDays(tools);
    var used = parseUsed(state.usedDays) || 0;
    var remainShown = plan.remain < 0 ? 0 : plan.remain;
    var width = Math.max(0, Math.min(100, Math.round((plan.total / rules.maxDays) * 100)));
    var html = hero("내 체험학습 누적 일수", "지금 적어 둔 이번 계획만 보여 줍니다.");
    html += '<section class="guide-card"><p class="mini">누적</p><p class="big-total">' + plan.total + " / " + rules.maxDays + "일</p>";
    html += '<div class="meter" aria-hidden="true"><span style="width:' + width + '%"></span></div>';
    html += '<p class="break-row"><span>이미 사용</span><b>' + used + "일</b></p>";
    html += '<p class="break-row"><span>이번</span><b>' + days.length + "일</b></p>";
    html += '<p class="break-row"><span>남은 일수</span><b>' + remainShown + "일</b></p></section>";
    html += '<section class="guide-card"><h2>이번 기록</h2>';
    days.forEach(function (date, index) {
      var ymd = tools.ymd(date);
      html += '<article class="record"><div><b>' + esc(shortDate(tools, date)) + "</b>";
      html += "<p>" + esc(state.region === "overseas" ? "해외" : "국내") + " · 1일</p>";
      html += "<p>" + esc((state.dayPlans[ymd] || "").trim()) + "</p></div>";
      html += '<span class="tag tag-after">' + (index + 1) + "일차</span></article>";
    });
    html += '<p class="range-rest">지난 신청 목록은 저장하지 않습니다. 종이 신청서를 담임에게 내야 일수에 들어갑니다.</p></section>';
    html += '<div class="actions">';
    html += '<button type="button" class="secondary" data-action="used-view">확인 결과</button>';
    html += '<button type="button" data-action="goto" data-step="1">계획 다시 계산</button></div>';
    html += '<p class="footer-note">이 화면에만 있습니다. 저장·전송하지 않습니다.</p>';
    return html;
  }

  function row(label, value) {
    return "<dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd>";
  }

  function prepText() {
    if (state.region === "domestic" && state.stay === "yes") return "숙박 예약";
    if (state.region === "overseas" && state.stay === "yes") return "항공권, 숙박 예약";
    if (state.region === "overseas") return "항공권";
    return "없음";
  }

  function finalBlocker(result) {
    if (!state.intro0) return "안내를 확인하세요.";
    if (parseUsed(state.usedDays) === null) return "사용 일수를 적으세요. 없으면 0.";
    if (parseUsed(state.usedDays) > 0 && result.pastResults.some(function (item) { return !item.complete; })) return "보고서 결과를 고르세요.";
    if (state.reportStatus === "fail" && !state.reportAck) return "미인정을 확인하세요.";
    if (result.current.incomplete) return result.current.message || "기간을 다시 고르세요.";
    if (!result.capOk) return result.capMessage;
    if (!result.leadOk) return result.leadMessage;
    if (!result.gapOk) return result.gapMessage;
    if (!state.region || !result.regionOk) return result.regionMessage || "국내 또는 해외를 고르세요.";
    if (!docsOk()) return "서류를 확인하세요.";
    if (!state.learning) return "학습 형태를 고르세요.";
    if (!state.place.trim() || !state.country.trim() || !state.city.trim()) return "목적지, 나라, 도시를 적으세요.";
    if (state.stay === "yes" && (!state.lodgeName.trim() || !state.lodgeAddress.trim())) return "숙박 이름과 주소를 적으세요.";
    if (!state.samePerson) return "보호자와 인솔자가 같은지 고르세요.";
    if (!state.guardianName.trim() || !state.guardianRel.trim()) return "보호자 이름과 관계를 적으세요.";
    if (state.samePerson === "diff" && (!state.chaperoneName.trim() || !state.chaperoneRel.trim())) return "인솔자 이름과 관계를 적으세요.";
    if (!state.chaperoneAdult) return "성인 인솔자를 확인하세요.";
    if (!state.purpose.trim()) return "목적을 적으세요.";
    if (missingDayPlan(result.tools)) return missingDayPlan(result.tools) + " 학습 내용을 적으세요.";
    if (!state.safetyOk) return "안전 안내를 확인하세요.";
    return "";
  }

  function validate(step) {
    if (step <= 0) return guideReady() ? "" : "안내 항목을 모두 확인하세요.";
    if (step === 1) return inputMessage();
    if (step === 2) return inputMessage();
    return "";
  }

  function tabs() {
    if (state.maxStep < 2) return "";
    var items = [[2, "신청서"], [3, "유의사항"]];
    var html = '<nav class="tabs" aria-label="화면 이동">';
    items.forEach(function (item) {
      var locked = item[0] > state.maxStep;
      html += '<button type="button" class="tab' + (item[0] === state.step ? " on" : "") + '" data-action="tab" data-step="' + item[0] + '"' + (locked ? " disabled" : "") + ">" + esc(item[1]) + "</button>";
    });
    html += "</nav>";
    return html;
  }

  function holdScroll(y) {
    window.scrollTo(0, y);
    requestAnimationFrame(function () { window.scrollTo(0, y); });
    setTimeout(function () { window.scrollTo(0, y); }, 0);
  }

  function render(keepPlace) {
    if (state.step === 1 && state.tour === null) state.tour = 0;
    var y = keepPlace ? window.scrollY : 0;
    var tourStep = state.step === 1 && state.tour >= 0 ? state.tour : -1;
    var tourMoved = tourStep !== placedTour;
    assess();
    var html;
    if (state.step <= 0) html = guidePage();
    else if (state.step === 1) html = plannerStep();
    else if (state.step === 2) html = formPage();
    else html = evidencePage();
    app.innerHTML = html + tabs();
    if (tourMoved && tourStep >= 0) {
      var target = app.querySelector('[data-tour="' + TOUR[tourStep].id + '"]');
      if (target) {
        var box = target.getBoundingClientRect();
        var topLimit = 72;
        var bottomLimit = window.innerHeight - 210;
        if (box.top < topLimit || box.bottom > bottomLimit) window.scrollBy(0, box.top - topLimit);
      }
    } else if (keepPlace) holdScroll(y);
    else window.scrollTo(0, 0);
    placedTour = tourStep;
    placeTour();
  }

  function placeTour() {
    var old = document.getElementById("tour-layer");
    if (old) old.remove();
    if (state.step !== 1 || state.tour < 0 || state.tour >= TOUR.length) return;
    var item = TOUR[state.tour];
    var el = app.querySelector('[data-tour="' + item.id + '"]');
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var pad = 6;
    var top = window.scrollY + rect.top - pad;
    var left = window.scrollX + rect.left - pad;
    var width = rect.width + pad * 2;
    var height = rect.height + pad * 2;
    var docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    var docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    var layer = document.createElement("div");
    layer.id = "tour-layer";
    layer.innerHTML =
      '<div class="tour-block" style="top:0;left:0;width:' + docW + "px;height:" + Math.max(0, top) + 'px"></div>' +
      '<div class="tour-block" style="top:' + top + "px;left:0;width:" + Math.max(0, left) + "px;height:" + height + 'px"></div>' +
      '<div class="tour-block" style="top:' + top + "px;left:" + (left + width) + "px;width:" + Math.max(0, docW - left - width) + "px;height:" + height + 'px"></div>' +
      '<div class="tour-block" style="top:' + (top + height) + "px;left:0;width:" + docW + "px;height:" + Math.max(0, docH - top - height) + 'px"></div>' +
      '<div class="tour-ring" style="top:' + top + "px;left:" + left + "px;width:" + width + "px;height:" + height + 'px"></div>' +
      '<section class="tour-card">' +
      "<h2>" + esc(item.title) + "</h2><p>" + esc(item.text) + "</p>" +
      '<p class="tour-count">' + (state.tour + 1) + " / " + TOUR.length + "</p>" +
      '<div class="actions"><button type="button" class="secondary" data-tour-action="skip">건너뛰기</button>' +
      '<button type="button" data-tour-action="next">' + (state.tour === TOUR.length - 1 ? "알겠습니다" : "다음") + "</button></div></section>";
    document.body.appendChild(layer);
  }

  function inputMessage() {
    syncSamePerson();
    var plan = state._plan;
    if (!plan || !plan.ok) return (plan && plan.warnings[0]) || "기간을 확인하세요.";
    if (!state.region) return "국내인지 국외인지 고르세요.";
    if (!state.learning) return "학습 형태를 고르세요.";
    if (!state.place.trim()) return "여행장소를 적으세요. 예: 경주 불국사";
    if (!state.stay) return "숙박이 있는지 고르세요.";
    if (state.stay === "yes" && (!state.lodgeName.trim() || !state.lodgeAddress.trim())) return "숙박 이름과 주소를 적으세요.";
    if (!state.samePerson) return "보호자와 인솔자가 같은지 고르세요.";
    if (!state.guardianName.trim() || !state.guardianRel.trim()) return "보호자 이름과 관계를 적으세요.";
    if (state.samePerson === "diff" && (!state.chaperoneName.trim() || !state.chaperoneRel.trim())) return "인솔자 이름과 관계를 적으세요.";
    if (!state.chaperoneAdult) return "성인 인솔자를 확인하세요.";
    return "";
  }

  function samplePlace() {
    var typed = state.place.trim();
    if (typed) return typed;
    return state.region === "overseas" ? "태국 방콕" : "경주 불국사";
  }

  function purposeLine() {
    var place = samplePlace();
    if (state.learning === "family") return "가족과 함께 " + place + " 견학, 문화 체험하기";
    if (state.learning === "relative") return "친인척 방문, " + place + " 견학하기";
    if (state.learning === "experience") return place + " 체험하기";
    return place + " 견학하기";
  }

  function planBody(index, total, place) {
    var overseas = state.region === "overseas";
    var stay = state.stay === "yes";
    var first = index === 0;
    var last = index === total - 1;
    if (total === 1) {
      if (overseas) return "10시 공항 출발, " + place + " 도착, 주요 장소 견학 후 귀국";
      return "08시 출발, 10시 " + place + " 도착, 경내 견학, 14시 주변 관람, 16시 복귀";
    }
    if (first) {
      if (overseas) return "10시 공항 출발, " + place + " 도착, 입국 후 숙소 이동, 오후 주변 견학";
      return "08시 출발, 10시 " + place + " 도착, 경내 견학" + (stay ? ", 숙소 체크인" : "");
    }
    if (last) {
      if (overseas) return "09시 " + place + " 견학, 공항으로 이동, 출발하여 귀국";
      return "09시 " + place + " 견학, 14시 출발하여 복귀";
    }
    var middles = overseas ? [
      "09시 " + place + " 주요 장소 견학, 오후 현지 문화 체험",
      "09시 " + place + " 박물관·사원 견학, 13시 시장과 생활 모습 관찰",
      "09시 근교로 이동, 자연·역사 장소 견학, 오후 " + place + " 복귀"
    ] : [
      "09시 " + place + " 재방문, 안내 자료와 실물을 보며 견학, 14시 주변 유적 관람",
      "09시 박물관 견학, 13시 " + place + " 일대 문화 체험",
      "09시 " + place + "에서 오늘 볼 장소를 돌며 견학"
    ];
    return middles[(index - 1) % middles.length];
  }

  function planLines(tools, days) {
    var place = samplePlace();
    return days.map(function (date, index) {
      return shortDate(tools, date) + " " + planBody(index, days.length, place);
    });
  }

  function exampleBlock(tools) {
    var days = planSchoolDays(tools);
    if (!days.length) return '<p class="quiet">체험 일수를 정하면 예시가 나옵니다.</p>';
    var html = '<div class="example"><p class="mini">목적</p><p>' + esc(purposeLine()) + "</p>";
    html += '<p class="mini">교외체험 학습계획 · ' + days.length + "일</p>";
    planLines(tools, days).forEach(function (line) {
      html += "<p>" + esc(line) + "</p>";
    });
    html += "</div>";
    return html;
  }

  function periodText(days) {
    if (!days.length) return "";
    var start = days[0];
    var end = days[days.length - 1];
    var from = start.getFullYear() + "년 " + (start.getMonth() + 1) + "월 " + start.getDate() + "일";
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate()) return from;
    var to = (start.getFullYear() === end.getFullYear() ? "" : end.getFullYear() + "년 ") + (end.getMonth() + 1) + "월 " + end.getDate() + "일";
    return from + " ~ " + to;
  }

  function learningMarks() {
    return LEARNING.map(function (item) {
      return item[1] + "(" + (state.learning === item[0] ? "○" : " ") + ")";
    }).join(" · ");
  }

  function formPage() {
    syncSamePerson();
    var plan = state._plan;
    var tools = plan.tools;
    var days = planSchoolDays(tools);
    var chaperoneName = state.samePerson === "same" ? state.guardianName.trim() : state.chaperoneName.trim();
    var chaperoneRel = state.samePerson === "same" ? state.guardianRel.trim() : state.chaperoneRel.trim();
    var lodge = state.stay === "yes" ? (state.lodgeName.trim() + " " + state.lodgeAddress.trim()).trim() : "해당 없음";
    var safety = days.length >= 5 ? "□ 동의함" : "□";
    var html = hero("신청서", "노란 칸을 종이에 적습니다.");
    html += '<div class="note">목적과 교외체험 학습계획은 예시입니다. 종이에 적을 때 고쳐도 됩니다.</div>';
    html += '<p class="quiet">성명, 학년, 반, 번, 휴대폰은 종이에만 적습니다. 이 화면에는 받지 않습니다.</p>';
    html += '<section class="paper sheet-scroll"><table class="form-sheet">';
    html += "<caption>학교장허가 교외체험학습 신청서</caption>";
    html += '<tr><th>성명</th><td class="ink">종이에 직접</td></tr>';
    html += '<tr><th>학년 반 번</th><td class="ink">종이에 직접</td></tr>';
    html += '<tr><th>휴대폰</th><td class="ink">종이에 직접</td></tr>';
    html += '<tr><th>본교 출석인정기간 연간(20)일</th><td class="calc">1일 기준 ' + esc(periodText(days)) + "<br>총 (" + days.length + ')일간<br><span class="ink">반일 기준(4시간 미만) 해당 없음</span></td></tr>';
    html += '<tr><th>세부 규칙·불허기간 확인</th><td class="calc">담임 사전 협의 ○</td></tr>';
    html += '<tr><th>학습형태</th><td class="write">' + esc(learningMarks()) + "</td></tr>";
    html += '<tr><th>목적지</th><td class="write">' + esc(samplePlace()) + "</td></tr>";
    html += '<tr><th>숙박장소</th><td class="write">' + esc(lodge) + "</td></tr>";
    html += '<tr><th>보호자명</th><td class="write">' + esc(state.guardianName.trim()) + "</td></tr>";
    html += '<tr><th>관계</th><td class="write">' + esc(state.guardianRel.trim()) + "</td></tr>";
    html += '<tr><th>보호자 휴대폰</th><td class="ink">종이에 직접</td></tr>';
    html += '<tr><th>인솔자명</th><td class="write">' + esc(chaperoneName) + "</td></tr>";
    html += '<tr><th>관계</th><td class="write">' + esc(chaperoneRel) + "</td></tr>";
    html += '<tr><th>인솔자 휴대폰</th><td class="ink">종이에 직접</td></tr>';
    html += '<tr><th>목적</th><td class="write">' + esc(purposeLine()) + "</td></tr>";
    html += '<tr><th>교외체험 학습계획</th><td class="write plan-cell">';
    planLines(tools, days).forEach(function (line) { html += "<p>" + esc(line) + "</p>"; });
    html += "</td></tr>";
    html += "<tr><th>학생안전</th><td" + (days.length >= 5 ? ' class="write"' : "") + ">5일 이상 연속이면 주 1회 이상 학생이 담임과 직접 통화합니다. " + esc(safety) + "</td></tr>";
    html += '<tr><td class="closing" colspan="2"><p>위와 같이 「학교장허가 교외체험학습」을 신청합니다.</p>';
    html += '<p class="calc">' + esc(tools.formatKorean(tools.today)) + "</p>";
    html += '<p class="ink">보호자 (인) · 학생 (인) 은 종이에 서명합니다.</p>';
    html += "<p class=\"sheet-to\">" + esc(rules.schoolName) + "장 귀하</p></td></tr>";
    html += "</table></section>";
    html += '<p class="block-rule">신청서를 낸 뒤 담임 통보서를 받아야 체험학습이 됩니다.</p>';
    return html;
  }

  function loadNotes() {
    try {
      var data = JSON.parse(localStorage.getItem(NOTES_KEY) || "null");
      if (!data || !data.due || !data.days || !data.days.length) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function saveNotes(snapshot) {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(snapshot));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clearNotes() {
    try {
      localStorage.removeItem(NOTES_KEY);
    } catch (err) {}
  }

  function savedNotesCard() {
    var saved = loadNotes();
    if (!saved) return "";
    return '<section class="guide-card"><h2>저장된 유의사항</h2><p>이 폰에 보고서 날짜가 남아 있습니다. 이름과 휴대폰은 저장하지 않습니다.</p><div class="actions"><button type="button" data-action="open-saved">유의사항 보기</button><button type="button" class="secondary" data-action="clear-saved">지우기</button></div></section>';
  }

  function applicationDue(tools, start) {
    if (!start) return null;
    var cursor = tools.addDays(start, -1);
    var left = rules.leadDays;
    var guard = 0;
    while (guard < 400) {
      if (tools.isSchoolDay(cursor)) {
        left -= 1;
        if (left === 0) return cursor;
      }
      cursor = tools.addDays(cursor, -1);
      guard += 1;
    }
    return null;
  }

  function reportDue(tools, end) {
    if (!end) return null;
    var due = tools.addDays(end, 3);
    while (due && !tools.isSchoolDay(due)) due = tools.addDays(due, 1);
    return due;
  }

  function notesKeep(tools, days, end, counted, due) {
    var html = '<section class="guide-card"><h2>꼭 기억하세요</h2>';
    html += "<p>서류가 부족하면 " + mark("미인정 결석으로") + " 처리됩니다.</p>";
    html += "<p>" + mark("성인") + "과 함께 갑니다.</p></section>";
    var applyDue = applicationDue(tools, days.length ? days[0] : null);
    var pastDue = state.reportStatus === "open" ? reportDue(tools, tools.parseYmd(state.pastEnd)) : null;
    html += '<section class="guide-card">';
    if (pastDue) html += '<p class="due-line">지난 보고서는 <span class="due">' + esc(shortDate(tools, pastDue)) + "</span> 까지 제출하세요.</p>";
    html += '<p class="due-line">신청서를 ' + (applyDue ? '<span class="due">' + esc(shortDate(tools, applyDue)) + "</span>" : "") + " 전에 제출하세요.</p>";
    html += '<p class="due-line">보고서는 ' + (due ? '<span class="due">' + esc(shortDate(tools, due)) + "</span>" : "") + " 까지 제출하세요.</p>";
    html += "<p>이번은 보고서 <b>" + days.length + "</b>장, 사진 <b>" + (days.length * 2) + "</b>장입니다.</p>";
    if (days.length) {
      html += "<ul>";
      days.forEach(function (date) {
        html += "<li>" + esc(shortDate(tools, date)) + " 보고서 1장, 사진 2장</li>";
      });
      html += "</ul>";
    }
    html += "</section>";
    html += '<section class="guide-card"><h2>추가 인정 서류(날짜, 이름 포함)</h2>';
    html += "<p>입장권, 숙박권, 교통권</p></section>";
    html += '<section class="guide-card warn-card"><h2>증빙사진(AI생성 불가)</h2><ul>';
    html += "<li>누구나 알 수 있는 여행 장소</li>";
    html += "<li>납득이 가능한 복장</li>";
    html += "<li>보고서에 기록된 활동</li></ul></section>";
    return html;
  }

  function saveHow(stored) {
    if (!stored) return '<section class="guide-card"><h2>저장</h2><p>이 브라우저에는 남지 않습니다. 화면을 닫으면 사라집니다.</p></section>';
    var html = '<section class="guide-card"><h2>저장 방법</h2>';
    html += "<p>저장 버튼은 없습니다. 이 화면을 보면 보고서 날짜가 이 폰에 남습니다.</p><ol>";
    html += "<li>이 화면을 한 번 봅니다.</li>";
    html += "<li>나중에 QR을 다시 찍습니다.</li>";
    html += "<li>안내 위의 「유의사항 보기」를 누릅니다.</li></ol>";
    html += "<p>이름과 휴대폰은 저장하지 않습니다. 브라우저 데이터를 지우면 사라집니다.</p></section>";
    return html;
  }

  function evidencePage() {
    var plan = state._plan;
    var tools = plan.tools;
    var days = planSchoolDays(tools);
    var end = days.length ? days[days.length - 1] : null;
    var due = reportDue(tools, end);
    var html = hero("유의사항", "신청서와 이 화면을 오갈 수 있습니다.");
    html += notesKeep(tools, days, end, null, due);
    html += '<p class="capture">캡쳐하세요.</p>';
    return html;
  }

  function savedEvidencePage() {
    var saved = loadNotes();
    var tools = toolsApi.create(rules, { today: today });
    if (!saved) {
      state.viewSaved = false;
      state.step = 0;
      return guidePage();
    }
    var days = saved.days.map(function (ymd) { return tools.parseYmd(ymd); }).filter(Boolean);
    var html = hero("신청서,유의사항", "이 폰에 저장된 내용입니다.");
    html += notesKeep(tools, days, tools.parseYmd(saved.end), tools.parseYmd(saved.counted), tools.parseYmd(saved.due));
    html += saveHow(true);
    html += '<div class="actions"><button type="button" data-action="close-saved">안내로</button><button type="button" class="secondary" data-action="clear-saved">저장 지우기</button></div>';
    return html;
  }

  function missingDayPlan(tools) {
    var days = planSchoolDays(tools);
    var i;
    for (i = 0; i < days.length; i += 1) {
      var ymd = tools.ymd(days[i]);
      if (!String(state.dayPlans[ymd] || "").trim()) return shortDate(tools, days[i]);
    }
    return "";
  }

  function readField(target) {
    var key = target.getAttribute("data-field");
    if (!key) return;
    if (key === "dayPlan") {
      state.dayPlans[target.getAttribute("data-ymd")] = target.value;
      return;
    }
    if (target.type === "checkbox") state[key] = target.checked;
    else state[key] = target.value;
    if (key === "planStart") state.startSet = true;
    syncSamePerson();
  }

  app.addEventListener("input", function (event) {
    readField(event.target);
  });

  app.addEventListener("change", function (event) {
    var target = event.target;
    if (target.getAttribute("data-field")) {
      readField(target);
      state.error = "";
      render(true);
    }
  });

  app.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    var action = button.getAttribute("data-action");
    state.error = "";
    if (action === "month") {
      shiftMonth(button.getAttribute("data-cal"), Number(button.getAttribute("data-dir")));
      render(true);
      return;
    }
    if (action === "pick") {
      pick(button.getAttribute("data-cal"), button.getAttribute("data-ymd"));
      render(true);
      return;
    }
    if (action === "mode") {
      state.mode = button.getAttribute("data-mode");
      render(true);
      return;
    }
    if (action === "region") {
      state.region = button.getAttribute("data-region");
      render(true);
      return;
    }
    if (action === "stay") {
      state.stay = button.getAttribute("data-stay");
      render(true);
      return;
    }
    if (action === "learning") {
      state.learning = button.getAttribute("data-learning");
      render(true);
      return;
    }
    if (action === "bump") {
      var key = button.getAttribute("data-key");
      var dir = Number(button.getAttribute("data-dir"));
      var min = Number(button.getAttribute("data-min"));
      var max = Number(button.getAttribute("data-max"));
      if (key === "tripDays") {
        var tripNow = state._plan ? state._plan.tripDays : 1;
        var tripNext = Math.min(max, Math.max(min, tripNow + dir));
        state.pattern = [{ kind: "trip", days: tripNext }];
        state.draftTrip = tripNext;
        render(true);
        return;
      }
      var current = key === "usedDays" ? (parseUsed(state.usedDays) || 0) : Number(state[key]);
      var nextValue = Math.min(max, Math.max(min, current + dir));
      if (key === "usedDays") {
        state.usedSet = true;
        state.usedDays = String(nextValue);
        if (!nextValue) {
          state.reportStatus = "";
          state.pastEnd = "";
          state.reportAck = false;
          state.gapConfirm = false;
        }
      } else state[key] = nextValue;
      render(true);
      return;
    }
    if (action === "add-seg") {
      if (state.pattern.length < 12) state.pattern.push({ kind: "trip", days: state.draftTrip });
      render(true);
      return;
    }
    if (action === "pop-seg") {
      state.pattern.pop();
      render(true);
      return;
    }
    if (action === "drop") {
      state.pattern.splice(Number(button.getAttribute("data-index")), 1);
      render(true);
      return;
    }
    if (action === "report") {
      state.reportStatus = button.getAttribute("data-status");
      if (state.reportStatus !== "fail") state.reportAck = false;
      render(true);
      return;
    }
    if (action === "same-person") {
      var picked = button.getAttribute("data-same");
      state.samePerson = picked;
      if (picked === "diff") {
        state.chaperoneName = "";
        state.chaperoneRel = "";
        state.chaperoneAdult = false;
      }
      render(true);
      return;
    }
    if (action === "goto") {
      state.showUsed = false;
      state.step = Number(button.getAttribute("data-step"));
      render();
      return;
    }
    if (action === "used-view") {
      state.showUsed = !state.showUsed;
      render(true);
      return;
    }
    if (action === "tab") {
      var tabStep = Number(button.getAttribute("data-step"));
      if (tabStep >= 2 && tabStep <= state.maxStep) {
        state.viewSaved = false;
        state.step = tabStep;
        state.error = "";
        render();
      }
      return;
    }
    if (action === "back") {
      state.step = Math.max(0, state.step - 1);
      render();
      return;
    }
    if (action === "open-saved") {
      if (loadNotes()) {
        state.viewSaved = true;
        state.step = 3;
        render();
      }
      return;
    }
    if (action === "close-saved") {
      state.viewSaved = false;
      state.step = 0;
      render();
      return;
    }
    if (action === "clear-saved") {
      clearNotes();
      state.viewSaved = false;
      if (!state._plan || !state._plan.ok) {
        state.step = 0;
        state.maxStep = 0;
      }
      render();
      return;
    }
    if (action === "reset") {
      state = blankState();
      render();
      return;
    }
    if (action === "next") {
      var message = validate(state.step, assess());
      if (message) {
        state.error = message;
        render(true);
        return;
      }
      state.step = Math.min(STEP_TITLES.length - 1, state.step + 1);
      state.maxStep = Math.max(state.maxStep, state.step);
      if (state.step >= 2) state.maxStep = Math.max(state.maxStep, 3);
      render();
    }
  });

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-tour-action]");
    if (!button) return;
    var tourAction = button.getAttribute("data-tour-action");
    if (tourAction === "skip" || (tourAction === "next" && state.tour >= TOUR.length - 1)) state.tour = -2;
    else if (tourAction === "next") state.tour += 1;
    render(true);
  });

  render();
})();
