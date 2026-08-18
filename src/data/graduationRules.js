// 졸업요건 상수. 사용자가 제공한 학칙/졸업기준학점조회 기준을 그대로 옮긴 것이므로,
// 학과 공지와 다르면 이 파일만 고치면 됩니다.

// 졸업요건 패널이 브라우저에 기억하는 값(학번/이름/전공 유형)의 저장 키.
// 로그아웃 때 지워야 해서 패널 밖에서도 참조합니다.
export const GRAD_STATE_STORAGE_KEY = "gradChecklistState";

export const TOTAL_CREDIT = 130;
export const PRE_2013_TOTAL_CREDIT = 140; // 2013학번 이전 입학자
export const LIBERAL_ARTS_CREDIT = 33;

export const MIN_GPA = { normal: 1.7, early: 4.0 };
export const MIN_SEMESTERS = { normal: 8, early: 6 }; // 조기졸업·학석사연계는 6학기

// majorAdvanced: 전공심화(전심)로 반드시 채워야 하는 학점. 0이면 심화/선택 구분 없음.
export const TRACK_RULES = {
  single: {
    label: "단일전공",
    liberalArts: LIBERAL_ARTS_CREDIT,
    majorPrimary: 60, // 전심 15 + 전선 45
    majorAdvanced: 15,
    majorSecondary: 0,
    description: "교양 33 + 전공 60(전심 15 포함)",
  },
  multi: {
    label: "다전공",
    liberalArts: LIBERAL_ARTS_CREDIT,
    majorPrimary: 36, // 전심 구분 없음
    majorAdvanced: 0,
    majorSecondary: 36,
    description: "교양 33 + 1전공 36 + 다전공 36",
  },
  minor: {
    label: "부전공",
    liberalArts: LIBERAL_ARTS_CREDIT,
    majorPrimary: 60,
    majorAdvanced: 15,
    majorSecondary: 21,
    description: "교양 33 + 1전공 60(전심 15 포함) + 부전공 21",
  },
};

// 학점으로 판정할 수 없어 본인이 확인해야 하는 요건.
export const MANUAL_REQUIREMENTS = [
  "포트폴리오 졸업인증(졸업논문 등) 심사 합격",
  "외국어졸업인증 (2006학년도 이후 입학생 및 2008학년도 3학년 편입생)",
  "한국어졸업인증 (외국인 특별전형 입학자)",
];
