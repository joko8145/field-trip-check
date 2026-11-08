/*
 * 보안·개인정보
 * 이 파일에는 학생 이름, 학번, 연락처를 넣지 않습니다.
 * publicUrl은 학생 화면 주소만 담습니다.
 * blockedDates에 학교 금지일을 추가하면 그 날짜가 포함된 신청은 불가가 됩니다.
 */
(function (root) {
  var rules = {
    schoolName: "송내고등학교",
    maxDays: 20,
    leadDays: 3,
    reportDays: 3,
    domesticMaxConsecutive: 5,
    publicUrl: "https://joko8145.github.io/field-trip-check/index.html",
    blockedDates: [
      "2027-01-07"
    ],
    blockedNotes: {
      "2027-01-07": "졸업식"
    },
    skipDates: [
      "2026-12-25",
      "2027-01-01"
    ],
    skipNotes: {
      "2026-12-25": "크리스마스",
      "2027-01-01": "새해"
    },
    holidays: [
      "2026-01-01",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-03-01",
      "2026-03-02",
      "2026-05-01",
      "2026-05-05",
      "2026-05-24",
      "2026-05-25",
      "2026-06-03",
      "2026-06-06",
      "2026-07-17",
      "2026-08-15",
      "2026-08-17",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-10-03",
      "2026-10-05",
      "2026-10-09",
      "2026-12-25",
      "2027-01-01"
    ]
  };

  if (typeof module === "object" && module.exports) module.exports = rules;
  root.SCHOOL_RULES = rules;
})(typeof globalThis !== "undefined" ? globalThis : this);
