// 동기화된 성적으로 졸업요건 충족 여부를 계산합니다.
//
// 기준 (사용자 제공, 통합정보시스템 [학생기본]-[졸업]-[졸업기준학점조회] 기준):
//   총 이수학점 130학점 (2013학번 이전 140학점)
//   교양 33학점
//   단일전공 : 전공 60학점 = 전심 15 + 전선 45   (전심 15학점은 필수)
//   다전공   : 1전공 36학점(전심 구분 없음) + 다전공 36학점 = 72학점
//   부전공   : 1전공 60학점(전심 15학점 필수) + 부전공 21학점
//   전학년 총 평점평균 1.7 이상 (조기졸업 4.0)
//   8학기 이상 등록 (조기졸업·학석사연계 6학기)
//
// 학점은 신청학점이 아니라 취득학점으로 셉니다. F/NP처럼 학점을 못 받은 과목은 제외합니다.

import { TRACK_RULES, TOTAL_CREDIT, PRE_2013_TOTAL_CREDIT, MIN_GPA, MIN_SEMESTERS } from "../data/graduationRules.js";

// 이수구분 문자열 -> 계산 카테고리.
//   교필/교선          -> liberalArts
//   1전심              -> majorAdvanced
//   1전선              -> majorElective
//   연선/연필          -> secondaryMajor (다전공·부전공 쪽 학점)
//   그 외(일선 등)     -> freeElective
export function classifyKind(kind) {
  if (!kind) return "freeElective";
  const text = String(kind).trim();
  if (text.startsWith("교")) return "liberalArts";
  if (text.startsWith("연")) return "secondaryMajor";
  if (text.includes("전심")) return "majorAdvanced";
  if (text.includes("전선") || text.includes("전필")) return "majorElective";
  return "freeElective";
}

// 재수강은 졸업학점상 한 번만 인정되므로 과목번호(없으면 과목명) 기준으로 중복을 제거하고,
// 학점을 받지 못한 기록보다 받은 기록을 우선합니다.
export function dedupeSubjects(semesters) {
  const byKey = new Map();
  for (const semester of semesters || []) {
    for (const subject of semester.subjects || []) {
      const key = subject.subjectNo || subject.subjectName;
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing || (!isEarned(existing) && isEarned(subject))) {
        byKey.set(key, subject);
      }
    }
  }
  return [...byKey.values()];
}

const FAILING_GRADES = new Set(["F", "NP", "U", "W"]);

export function isEarned(subject) {
  if ((Number(subject.credit) || 0) <= 0) return false;

  const grade = (subject.grade || "").trim().toUpperCase();
  if (grade) return !FAILING_GRADES.has(grade);

  // 등급 컬럼을 못 읽었을 때의 안전장치: 평점이 0이면 F로 본다. P 과목도 평점이 0이라
  // 오분류 여지가 있지만, 등급이 있으면 위에서 이미 판정되므로 여기까지 오는 경우는 드물다.
  // 평점 정보 자체가 없으면 판별이 불가능하므로 이수한 것으로 본다(과소 계산 방지).
  const raw = subject.gradePoints;
  if (raw === null || raw === undefined || raw === "") return true;
  const points = Number(raw);
  return !Number.isFinite(points) || points > 0;
}

export function creditsByCategory(semesters) {
  const totals = {
    liberalArts: 0,
    majorAdvanced: 0,
    majorElective: 0,
    secondaryMajor: 0,
    freeElective: 0,
  };
  for (const subject of dedupeSubjects(semesters)) {
    if (!isEarned(subject)) continue;
    totals[classifyKind(subject.kindCode)] += Number(subject.credit) || 0;
  }
  return totals;
}

const shortfall = (done, required) => Math.max(required - done, 0);

/**
 * @param {object} grades  /api/grades 응답 ({ summary, semesters })
 * @param {object} options { track: "single"|"multi"|"minor", isPre2013, isEarlyGraduation }
 */
export function auditGraduation(grades, options) {
  const { track = "single", isPre2013 = false, isEarlyGraduation = false } = options || {};
  const semesters = grades?.semesters || [];
  const rule = TRACK_RULES[track];
  const totals = creditsByCategory(semesters);

  const totalRequired = isPre2013 ? PRE_2013_TOTAL_CREDIT : TOTAL_CREDIT;
  const majorPrimaryDone = totals.majorAdvanced + totals.majorElective;
  const subjectTotal =
    totals.liberalArts + majorPrimaryDone + totals.secondaryMajor + totals.freeElective;

  // 총 이수학점은 시스템이 계산한 취득학점을 그대로 씁니다. 편입 인정학점처럼 학기별
  // 과목 목록에 안 나오는 학점이 있어서, 과목을 더한 값과 다를 수 있습니다.
  const reportedTotal = Number(grades?.summary?.totalEarnedCredit);
  const totalDone = Number.isFinite(reportedTotal) ? reportedTotal : subjectTotal;
  const unlistedCredits = totalDone - subjectTotal;

  const requirements = [
    {
      id: "liberalArts",
      label: "교양",
      done: totals.liberalArts,
      required: rule.liberalArts,
    },
    {
      id: "majorPrimary",
      label: track === "single" ? "전공" : "1전공",
      done: majorPrimaryDone,
      required: rule.majorPrimary,
      // 단일전공·부전공은 전공심화 15학점이 따로 필수입니다.
      sub:
        rule.majorAdvanced > 0
          ? {
              id: "majorAdvanced",
              label: "전공심화(전심)",
              done: totals.majorAdvanced,
              required: rule.majorAdvanced,
            }
          : null,
    },
  ];

  if (rule.majorSecondary > 0) {
    requirements.push({
      id: "majorSecondary",
      label: track === "multi" ? "다전공" : "부전공",
      done: totals.secondaryMajor,
      required: rule.majorSecondary,
    });
  }

  requirements.push({
    id: "total",
    label: "총 이수학점",
    done: totalDone,
    required: totalRequired,
  });

  for (const item of requirements) {
    item.short = shortfall(item.done, item.required);
    item.met = item.short === 0;
    if (item.sub) {
      item.sub.short = shortfall(item.sub.done, item.sub.required);
      item.sub.met = item.sub.short === 0;
      if (!item.sub.met) item.met = false;
    }
  }

  const gpa = Number(grades?.summary?.totalGpa);
  const minGpa = isEarlyGraduation ? MIN_GPA.early : MIN_GPA.normal;
  const gpaCheck = {
    id: "gpa",
    label: `전학년 총 평점평균 ${minGpa} 이상`,
    value: Number.isFinite(gpa) ? gpa : null,
    required: minGpa,
    met: Number.isFinite(gpa) && gpa >= minGpa,
  };

  // 계절수업은 등록학기로 치지 않으므로 정규학기(1·2학기)만 셉니다.
  const registered = semesters.filter((item) => !isSeasonal(item)).length;
  const minSemesters = isEarlyGraduation ? MIN_SEMESTERS.early : MIN_SEMESTERS.normal;
  const semesterCheck = {
    id: "semesters",
    label: `${minSemesters}학기 이상 등록`,
    value: registered,
    required: minSemesters,
    met: registered >= minSemesters,
  };

  // 자유선택으로 잉여 학점이 남아도 총 학점만 채우면 되므로, 남은 필요 학점은
  // 항목별 부족분의 합이 아니라 총 부족분과 비교해 더 큰 쪽을 씁니다.
  const categoryShortfall = requirements
    .filter((item) => item.id !== "total")
    .reduce((sum, item) => sum + item.short + (item.sub ? item.sub.short : 0), 0);
  const remainingCredits = Math.max(shortfall(totalDone, totalRequired), categoryShortfall);

  const unmet = [
    ...requirements.filter((item) => !item.met),
    ...(gpaCheck.met ? [] : [gpaCheck]),
    ...(semesterCheck.met ? [] : [semesterCheck]),
  ];

  return {
    totals,
    requirements,
    gpaCheck,
    semesterCheck,
    totalDone,
    totalRequired,
    subjectTotal,
    unlistedCredits,
    remainingCredits,
    unmet,
    allMet: unmet.length === 0,
  };
}

export function isSeasonal(semester) {
  const name = semester.semesterName || "";
  return name.includes("계절");
}
