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
    (rules.blockedRanges || []).forEach(function (range) {
      var cursor = parseYmd(range.from);
      var end = parseYmd(range.to);
      while (cursor && end && cursor <= end) {
        blockedSet.add(ymd(cursor));
        cursor = addDays(cursor, 1);
      }
    });
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
        if (isBlocked(date)) {
          var note = rules.blockedNotes && rules.blockedNotes[ymd(date)];
          found.push(formatKorean(date) + (note ? " " + note : ""));
        }
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

    function leadSpan(start) {
      if (!start) return 0;
      var from = addDays(today, 1);
      if (start < from) return 0;
      return schoolDaysInRange(from, start);
    }

    function leadOk(start) {
      return leadSpan(start) >= rules.leadDays;
    }

    function earliestLeadDate() {
      var cursor = addDays(today, 1);
      var guard = 0;
      while (!leadOk(cursor) && guard < 400) {
        cursor = addDays(cursor, 1);
        guard += 1;
      }
      return cursor;
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
      earliestLeadDate: earliestLeadDate
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
        message: "숫자를 적으세요. 없으면 0."
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
            ? "기한 안에 냈습니다."
            : "미인정 결석입니다.")
          : "결과를 고르세요."
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

    if (input.planner) {
      var plannedStart = tools.parseYmd(input.start);
      var plannedEnd = tools.parseYmd(input.end);
      current.start = plannedStart;
      current.end = plannedEnd || plannedStart;
      current.days = Number(input.plannedDays) || 0;
      if (!input.planReady) {
        current.message = input.planMessage || "계획을 확인하세요.";
      } else if (!current.days) {
        current.message = "체험 기간을 추가하세요.";
      } else {
        current.incomplete = false;
      }
    } else if (input.mode === "half") {
      var half = tools.parseYmd(input.halfDate);
      current.start = half;
      current.end = half;
      if (!half) {
        current.message = "날짜를 고르세요.";
      } else if (!tools.isSchoolDay(half)) {
        current.message = "수업일만 됩니다.";
      } else if (!input.halfUnder4) {
        current.message = "4시간 미만인지 확인하세요.";
      } else if (!input.halfAttended) {
        current.message = "당일 수업에도 참여해야 합니다.";
      } else {
        current.blocked = tools.blockedInRange(half, half);
        if (current.blocked.length) {
          current.message = "금지일입니다. " + current.blocked.join(", ");
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
        current.message = "시작일, 그다음 종료일을 누르세요.";
      } else if (end < start) {
        current.message = "종료일이 더 앞입니다.";
      } else {
        current.days = tools.schoolDaysInRange(start, end);
        current.blocked = tools.blockedInRange(start, end);
        if (current.blocked.length) {
          current.message = "금지일이 들어 있습니다. " + current.blocked.join(", ");
        } else if (current.days === 0) {
          current.message = "수업일이 없습니다.";
        } else {
          current.incomplete = false;
        }
      }
    }

    var total = recognizedPast + (current.incomplete ? 0 : current.days);
    var capOk = current.incomplete ? false : total <= rules.maxDays + 0.001;
    var capMessage = capOk
      ? tools.formatDays(total) + "일. " + rules.maxDays + "일 이내입니다."
      : rules.maxDays + "일을 넘습니다. " + tools.formatDays(total) + "일입니다.";

    var leadOk = !current.incomplete && tools.leadOk(current.start);
    var leadMessage = leadOk
      ? "가능합니다."
      : "주말·공휴일은 뺍니다. 가장 빠른 출발일은 " + tools.formatKorean(tools.earliestLeadDate()) + "입니다.";

    var gapInfo = null;
    var gapOk = true;
    var gapMessage = "해당 없음.";
    if (usedDays > 0 && !input.planner) {
      gapOk = input.gapConfirm === true;
      gapMessage = gapOk ? "가능합니다." : "보고서 다음 날 이후인지 확인하세요.";
    }

    var regionOk = true;
    var regionMessage = "";
    var consecutive = input.planner ? Number(input.segmentMax) || 0 : current.days;
    if (!current.incomplete && input.region === "domestic" && consecutive > rules.domesticMaxConsecutive) {
      regionOk = false;
      regionMessage = "국내는 연속 " + rules.domesticMaxConsecutive + "일까지입니다.";
    } else if (!current.incomplete && input.region === "overseas") {
      regionMessage = "해외는 연속 제한이 없습니다.";
    } else if (!current.incomplete && input.region === "domestic") {
      regionMessage = tools.formatDays(consecutive) + "일. " + rules.domesticMaxConsecutive + "일 이내입니다.";
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
