// 2026학년도 입학자 기준 단과대/학(부)과/전공별 졸업이수학점표.
// 사용자가 제공한 교무처 자료를 그대로 옮긴 것으로, 매년 개정될 수 있으니
// 학과 사무실 공지와 다르면 이 파일을 갱신해야 합니다.
//
// singleAdvanced/singleElective: 단일전공(전공심화/전공선택)
// singleMerged: true인 경우 심화/선택 구분 없이 전공 합계 학점만 존재(융합경영학과)
// multiPrimary/multiSecondary: 다전공(연계·융합) 선택 시 1전공/다전공 학점
// minorPrimary/minorSecondary: 부전공 선택 시 1전공/부전공 학점
// note: 괄호 표기(예: "45(50)")처럼 계산에 쓰지 않는 원문 각주를 그대로 보여줄 때 사용
export const CREDIT_REQUIREMENTS = [
  { department: "인문사회과학대학", group: "인문콘텐츠학부", major: "역사콘텐츠전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "인문사회과학대학", group: "인문콘텐츠학부", major: "지적재산권전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "인문사회과학대학", group: "인문콘텐츠학부", major: "문헌정보학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "45(50)/36(50)" },
  { department: "인문사회과학대학", group: "인문콘텐츠학부", major: "한일문화콘텐츠전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "인문사회과학대학", group: null, major: "공간환경학부", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "인문사회과학대학", group: null, major: "행정학부", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "인문사회과학대학", group: null, major: "가족복지학과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "인문사회과학대학", group: null, major: "국가안보학과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },

  { department: "사범대학", group: null, major: "국어교육과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 50, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "1전공 50 / 다전공 36(50)" },
  { department: "사범대학", group: null, major: "영어교육과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 50, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "1전공 50 / 다전공 36(50)" },
  { department: "사범대학", group: null, major: "교육학과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 50, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "1전공 50 / 다전공 36(50)" },
  { department: "사범대학", group: null, major: "수학교육과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 50, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "1전공 50 / 다전공 36(50)" },

  { department: "경영경제대학", group: null, major: "경제금융학부", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "경영경제대학", group: null, major: "경영학부", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "경영경제대학", group: null, major: "글로벌경영학과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "경영경제대학", group: null, major: "융합경영학과", liberalArts: 33, singleMerged: true, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },

  { department: "융합공과대학", group: "지능·데이터융합학부", major: "휴먼AI공학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "지능·데이터융합학부", major: "핀테크전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "지능·데이터융합학부", major: "빅데이터융합전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "지능·데이터융합학부", major: "스마트생산전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "SW융합학부", major: "컴퓨터과학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 45, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "1전공 45(50) / 다전공 45(50). ABEEK 인증 별도 확인 필요(공학교육혁신센터 내선 7129)" },
  { department: "융합공과대학", group: "SW융합학부", major: "전기공학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "SW융합학부", major: "게임전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "SW융합학부", major: "애니메이션전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "생명화학공학부", major: "생명공학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "생명화학공학부", major: "화학에너지공학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "생명화학공학부", major: "화공신소재전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "융합공과대학", group: "생명화학공학부", major: "식품영양학전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130, multiNote: "45(50)/36(50)" },

  { department: "문화예술대학", group: null, major: "의류학과", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "문화예술대학", group: "스포츠무용학부", major: "스포츠건강관리전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "문화예술대학", group: "스포츠무용학부", major: "무용예술전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "문화예술대학", group: "미술학부", major: "조형예술전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "문화예술대학", group: "미술학부", major: "생활예술전공", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
  { department: "문화예술대학", group: null, major: "음악학부", liberalArts: 33, singleAdvanced: 15, singleElective: 60, multiPrimary: 45, multiSecondary: 36, minorPrimary: 60, minorSecondary: 21, total: 130 },
];

// 연계·융합전공: 자기 소속 없이 다전공(+일부 부전공) 형태로만 추가 이수하는 과정.
// 위 CREDIT_REQUIREMENTS 목록에서 주전공을 고른 뒤 참고용으로만 노출합니다.
export const LINKED_MAJORS = [
  { department: "인문사회과학대학", major: "문화콘텐츠연계전공", multiSecondary: 36 },
  { department: "인문사회과학대학", major: "빅데이터과학연계전공", multiSecondary: 36 },
  { department: "인문사회과학대학", major: "공간정보빅데이터연계전공", multiSecondary: 36 },
  { department: "인문사회과학대학", major: "영유아체육과건강교육연계전공", multiSecondary: 36 },
  { department: "인문사회과학대학", major: "아동·청소년상담연계전공", multiSecondary: 36 },
  { department: "인문사회과학대학", major: "콘텐츠제작연계전공", multiSecondary: 36 },
  { department: "경영경제대학", major: "핀테크인텔리전스융합전공", multiSecondary: 36 },
  { department: "경영경제대학", major: "빅데이터애널리틱스융합전공", multiSecondary: 36 },
  { department: "경영경제대학", major: "공동체혁신융합전공", multiSecondary: 36 },
  { department: "융합공과대학", major: "인공지능융합전공", multiSecondary: 36 },
  { department: "융합공과대학", major: "게임애니메이션AI융합전공", multiSecondary: 36 },
  { department: "융합공과대학", major: "바이오헬스디바이스융합전공", multiSecondary: 36 },
  { department: "융합공과대학", major: "바이오헬스인공지능융합전공", multiSecondary: 42, minorSecondary: 21 },
  { department: "융합공과대학", major: "바이오헬스디자인융합전공", multiSecondary: 42, minorSecondary: 21 },
  { department: "융합공과대학", major: "바이오헬스첨단바이오테크융합전공", multiSecondary: 42, minorSecondary: 21 },
];

// 2013학번 이전 입학자는 졸업이수학점 총량 자체가 다릅니다(위 표는 2026학년도 입학자 기준).
export const PRE_2013_TOTAL_CREDIT = 140;

// 입학년도별 교양교육과정 이수 기준 (나. 표)
export const LIBERAL_ARTS_BY_YEAR = [
  {
    id: "2020-2025",
    label: "2020~2025학번",
    from: 2020,
    to: 2025,
    basics: [
      { name: "사고와표현", requirement: "필수" },
      { name: "기초영어 또는 기초수학", requirement: "필수" },
      { name: "컴퓨팅사고와데이터의이해(컴퓨터1)", requirement: "필수" },
      { name: "알고리즘과게임콘텐츠(컴퓨터2)", requirement: "필수" },
    ],
    backbone: "상명핵심역량교양 2개 이상 영역 각 1과목",
    balance: "균형교양: 본인 소속 영역 제외 3개 영역 각 1과목",
    breadth: "일반교양: 제한 없음",
    total: 33,
  },
  {
    id: "2018-2019",
    label: "2018~2019학번",
    from: 2018,
    to: 2019,
    basics: [
      { name: "사고와표현", requirement: "필수" },
      { name: "기초영어 또는 기초수학", requirement: "필수" },
      { name: "컴퓨터1", requirement: "선택 1개" },
      { name: "컴퓨터2", requirement: "필수" },
    ],
    backbone: "상명핵심역량교양 2개 이상 영역 각 1과목",
    balance: "균형교양: 본인 소속 영역 제외 3개 영역 각 1과목",
    breadth: "일반교양: 제한 없음",
    total: 33,
  },
  {
    id: "2017",
    label: "2017학번",
    from: 2017,
    to: 2017,
    basics: [
      { name: "사고와표현", requirement: "필수" },
      { name: "기초영어 또는 기초수학", requirement: "필수" },
      { name: "컴퓨터1", requirement: "선택 1개" },
      { name: "컴퓨터2", requirement: "필수" },
    ],
    backbone: "상명핵심역량교양 2개 이상 영역 각 1과목",
    balance: "균형교양: 본인 소속 영역 제외 3개 영역 각 1과목",
    breadth: "일반교양: 제한 없음",
    total: 36,
  },
  {
    id: "2016",
    label: "2016학번",
    from: 2016,
    to: 2016,
    basics: [
      { name: "사고와표현", requirement: "필수" },
      { name: "기초영어 또는 기초수학", requirement: "필수" },
      { name: "컴퓨터1", requirement: "경영경제대학만 필수 (타 대학은 필수 아님)" },
      { name: "컴퓨터2", requirement: "필수" },
    ],
    backbone: "상명핵심역량교양 2개 이상 영역 각 1과목",
    balance: "균형교양: 본인 소속 영역 제외 3개 영역 각 1과목",
    breadth: "일반교양: 제한 없음",
    total: 36,
  },
  {
    id: "2013-2015",
    label: "2013~2015학번",
    from: 2013,
    to: 2015,
    basics: [
      { name: "사고와표현", requirement: "필수" },
      { name: "기초영어 또는 기초수학", requirement: "필수" },
      { name: "컴퓨터1", requirement: "해당 없음" },
      { name: "컴퓨터2", requirement: "필수" },
    ],
    backbone: "상명핵심역량교양 2개 이상 영역 각 1과목",
    balance: "균형교양: 본인 소속 영역 제외 3개 영역 각 1과목",
    breadth: "일반교양: 제한 없음",
    total: 36,
  },
];

export const LIBERAL_ARTS_EXCEPTIONS = [
  "외국인특별전형 입학생: 기초교양 컴퓨터1·컴퓨터2 이수 면제",
  "장애학생(장애인복지법 제32조 등록 청각장애): 기초영어/기초수학, 컴퓨터1·2 이수 면제",
  "융합경영학과: 균형교양 3개 영역 이수 면제",
  "※ 위 면제로 교양 전체학점(33~36)이 줄어드는 것은 아닙니다",
  "일반/학사 편입생: 교양 이수 의무 없음",
  "사범대 및 비사범계 교직과정 이수자: 교직 교과목 학점을 교양 이수 학점으로 인정 가능",
];

// 학칙 제79조(졸업요건). 학점 계산과 무관하게 별도로 충족해야 하는 항목.
export const GRADUATION_RULE_ARTICLES = [
  {
    id: "portfolio",
    label: "포트폴리오 졸업인증(졸업논문 등) 심사 합격",
    detail: "입학년도 또는 복학학년 소정의 교육과정(다전공·부전공 포함)을 이수한 자",
  },
  {
    id: "certification",
    label: "졸업인증제(학칙 제51조) 요건 충족",
    detail: "외국어졸업인증 등. 2006학년도 이후 입학생 및 2008학년도 3학년 편입생 대상 (체육특기자·특수교육대상자·외국인특별전형·계약학과·특성화고졸 재직자전형 제외). 외국인 학위과정 입학생은 한국어졸업인증 요건 적용",
  },
  {
    id: "semesters",
    label: "8학기 이상 등록",
    detail: "조기졸업자 및 학·석사연계과정자는 6학기",
  },
  {
    id: "gpa",
    label: "전학년 총 평점평균 1.7 이상",
    detail: "조기졸업자는 4.0 이상",
    minGpa: 1.7,
  },
];
