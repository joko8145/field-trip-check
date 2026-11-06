/*
 * 출석 일수와 연속 신청 판정.
 * 학생 인적사항은 다루지 않습니다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DateTools = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function ymd(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseYmd(value) {
    var matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!matched) return null;
    var date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
    if (ymd(date) !== value) return null;
    return date;
  }

  function dayStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  }

  function diffDays(from, to) {
    var ms = 24 * 60 * 60 * 1000;
    return Math.round((dayStart(to) - dayStart(from)) / ms);
  }

  function weekdayName(date) {
    return "일월화수목금토"[date.getDay()];
  }

  function formatKorean(date) {
    if (!date) return "";
    return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일 (" + weekdayName(date) + ")";
  }

  function formatDays(value) {
    if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value));
    return value.toFixed(1);
  }

  function create(rules, options) {
    var holidaySet = new Set(rules.holidays || []);
    var blockedSet = new Set(rules.blockedDates || []);
    var today = dayStart(options && options.today ? options.today : new Date());

    function isWeekend(date) {
      var day = date.getDay();
      return day === 0 || day === 6;
    }

    function isHoliday(date) {
      return holidaySet.has(ymd(date));
    }

    function isBlocked(date) {
      return blockedSet.has(ymd(date));
    }

    function isSchoolDay(date) {
      return !isWeekend(date) && !isHoliday(date);
    }

    function eachDate(from, to, visit) {
      var cursor = dayStart(from);
      var last = dayStart(to);
      while (cursor <= last) {
        visit(cursor);
        cursor = addDays(cursor, 1);
      }
    }

    function schoolDaysInRange(from, to) {
      if (!from || !to || to < from) return 0;
      var count = 0;
      eachDate(from, to, function (date) {
        if (isSchoolDay(date)) count += 1;
      });
      return count;
    }

    function blockedInRange(from, to) {
      var found = [];
      if (!from || !to || to < from) return found;
      eachDate(from, to, function (date) {
        if (isBlocked(date)) found.push(formatKorean(date));
      });
      return found;
    }

    function nextSchoolDayAfter(date) {
      var cursor = addDays(date, 1);
      while (!isSchoolDay(cursor)) cursor = addDays(cursor, 1);
      return cursor;
    }

    function reportOnTime(end, report) {
      if (!end || !report) return false;
      var gap = diffDays(end, report);
      return gap >= 0 && gap <= rules.reportDays;
    }

    function leadOk(start) {
      return !!start && diffDays(today, start) >= rules.leadDays;
    }

    return {
      today: today,
      ymd: ymd,
      parseYmd: parseYmd,
      addDays: addDays,
      diffDays: diffDays,
      formatKorean: formatKorean,
      formatDays: formatDays,
      weekdayName: weekdayName,
      isWeekend: isWeekend,
      isHoliday: isHoliday,
      isBlocked: isBlocked,
      isSchoolDay: isSchoolDay,
      schoolDaysInRange: schoolDaysInRange,
      blockedInRange: blockedInRange,
      nextSchoolDayAfter: nextSchoolDayAfter,
      reportOnTime: reportOnTime,
      leadOk: leadOk,
      earliestLeadDate: function () {
        return addDays(today, rules.leadDays);
      }
    };
  }

  function parseUsedDays(value) {
    if (value === "" || value === null || typeof value === "undefined") return null;
    var text = String(value).trim();
    if (!/^\d+$/.test(text)) return null;
    return Number(text);
  }

  function assess(rules, input, today) {
    var tools = create(rules, { today: today });
    var pastResults = [];
    var recognizedPast = 0;
    var usedDays = parseUsedDays(input.usedDays);

    if (usedDays === null) {
      pastResults.push({
        complete: false,
        onTime: false,
        schoolDays: 0,
        counted: 0,
        message: "이미 사용한 수업일 수를 숫자로 적으세요. 없으면 0입니다."
      });
    } else if (usedDays > 0) {
      var onTime = input.reportStatus === "pass";
      var decided = onTime || input.reportStatus === "fail";
      var counted = onTime ? usedDays : 0;
      recognizedPast = counted;
      pastResults.push({
        complete: decided,
        onTime: onTime,
        schoolDays: usedDays,
        counted: counted,
        message: decided
          ? (onTime
            ? "보고서를 기한 안에 냈습니다. 수업일 " + tools.formatDays(usedDays) + "일을 사용 일수에 넣습니다."
            : "보고서가 늦거나 증빙이 부족합니다. 이 " + tools.formatDays(usedDays) + "일은 미인정 결석이며 20일에 넣지 않습니다.")
          : "보고서 제출 결과를 선택하세요."
      });
    }

    var current = {
      incomplete: true,
      start: null,
      end: null,
      days: 0,
      blocked: [],
      overlap: false,
      message: ""
    };

    if (input.mode === "half") {
      var half = tools.parseYmd(input.halfDate);
      current.start = half;
      current.end = half;
      if (!half) {
        current.message = "반일 날짜를 캘린더에서 선택하세요.";
      } else if (!tools.isSchoolDay(half)) {
        current.message = "반일은 수업일에만 가능합니다. 주말과 공휴일은 출석으로 세지 않습니다.";
      } else if (!input.halfUnder4) {
        current.message = "4시간 미만인지 확인하세요.";
      } else if (!input.halfAttended) {
        current.message = "반일은 당일 수업에 참여한 경우에만 가능합니다.";
      } else {
        current.blocked = tools.blockedInRange(half, half);
        if (current.blocked.length) {
          current.message = "학교 금지일입니다. " + current.blocked.join(", ");
        } else {
          current.incomplete = false;
          current.days = 0.5;
        }
      }
    } else {
      var start = tools.parseYmd(input.start);
      var end = tools.parseYmd(input.end);
      current.start = start;
      current.end = end;
      if (!start || !end) {
        current.message = "신청 기간을 캘린더에서 선택하세요. 시작일을 누른 다음 종료일을 누르세요.";
      } else if (end < start) {
        current.message = "종료일이 시작일보다 앞섭니다.";
      } else {
        current.days = tools.schoolDaysInRange(start, end);
        current.blocked = tools.blockedInRange(start, end);
        if (current.blocked.length) {
          current.message = "학교 금지일이 포함되어 있습니다. " + current.blocked.join(", ");
        } else if (current.days === 0) {
          current.message = "이 기간에는 수업일이 없습니다. 주말과 공휴일은 출석 일수에서 빠집니다.";
        } else {
          current.incomplete = false;
        }
      }
    }

    var total = recognizedPast + (current.incomplete ? 0 : current.days);
    var capOk = current.incomplete ? false : total <= rules.maxDays + 0.001;
    var capMessage = capOk
      ? "사용 일수 " + tools.formatDays(total) + "일로, 연간 " + rules.maxDays + "일 이내입니다."
      : "연간 " + rules.maxDays + "일을 넘습니다. 보고서가 통과한 지난 일수 " + tools.formatDays(recognizedPast) + "일과 이번 " + tools.formatDays(current.days) + "일을 더하면 " + tools.formatDays(total) + "일입니다.";

    var leadOk = !current.incomplete && tools.leadOk(current.start);
    var leadMessage = leadOk
      ? "출발일 " + tools.formatKorean(current.start) + "은 오늘보다 " + tools.diffDays(tools.today, current.start) + "일 뒤입니다. 신청 기한 " + rules.leadDays + "일 전을 지킵니다."
      : "신청서는 출발일보다 " + rules.leadDays + "일 전에 내야 합니다. 오늘 기준 가장 빠른 출발일은 " + tools.formatKorean(tools.addDays(tools.today, rules.leadDays)) + "입니다.";

    var gapInfo = null;
    var gapOk = true;
    var gapMessage = "앞서 사용한 기간이 없습니다. 연속 신청 제한에는 걸리지 않습니다.";
    if (usedDays > 0) {
      gapOk = input.gapConfirm === true;
      gapMessage = gapOk
        ? "이번 출발일은 직전 체험의 보고서를 낸 다음 날 이후입니다."
        : "연속 신청은 불가합니다. 목·금 다음은 월요일에 보고서를 내고, 사용은 화요일부터입니다. 이번 출발일이 그다음 날 이후인지 확인하세요.";
    }

    var regionOk = true;
    var regionMessage = "";
    if (!current.incomplete && input.region === "domestic" && current.days > rules.domesticMaxConsecutive) {
      regionOk = false;
      regionMessage = "국내는 한 기간의 연속 수업일이 " + rules.domesticMaxConsecutive + "일까지입니다. 이 기간은 수업일 " + tools.formatDays(current.days) + "일입니다.";
    } else if (!current.incomplete && input.region === "overseas") {
      regionMessage = "해외는 한 기간의 " + rules.domesticMaxConsecutive + "일 상한을 두지 않습니다. 연속 신청 제한과 보고서 다음 날 규칙은 국내와 같습니다.";
    } else if (!current.incomplete && input.region === "domestic") {
      regionMessage = "국내 연속 수업일 " + tools.formatDays(current.days) + "일로, " + rules.domesticMaxConsecutive + "일 이내입니다.";
    }

    return {
      tools: tools,
      pastResults: pastResults,
      recognizedPast: recognizedPast,
      current: current,
      total: total,
      capOk: capOk,
      capMessage: capMessage,
      leadOk: leadOk,
      leadMessage: leadMessage,
      gapOk: gapOk,
      gapMessage: gapMessage,
      gapInfo: gapInfo,
      regionOk: regionOk,
      regionMessage: regionMessage
    };
  }

  return {
    create: create,
    assess: assess,
    parseYmd: parseYmd,
    ymd: ymd,
    formatKorean: formatKorean,
    formatDays: formatDays
  };
});
