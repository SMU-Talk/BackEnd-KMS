// 학생 제보 기반 캠퍼스 내부 이동 지름길(엘리베이터·계단·에스컬레이터·징검다리) 그래프.
// 좌표 기반 카카오맵 경로는 실외 도로를 따라가지만, 여기서는 건물 내부 고저차와
// 지름길을 반영한 실제 체감 소요 시간(초)으로 최단 경로를 계산합니다.
//
// 명시되지 않은 "같은 건물 내부 층간 이동"은 계단 15초/층, 엘리베이터
// (R·G·U·N관만 보유) 고정 40초로 가정했습니다. 실측치가 생기면 EDGES를 갱신하세요.

export const BUILDING_TO_NODE = {
  "경영경제대학관(구 밀레니엄관)": "T_ESC",
  "미술관": "ESC_TOP",
  "가정관": "C_HOME",
  "미래백년관": "R_B1",
  "사범대학관": "A_3F",
  "학술정보관": "L_4F",
  "제1공학관": "G_3F",
  "인문사회과학대학관(자하관)": "N_3F",
  "월해관(문화예술대학관 1관)": "M_4F",
  // 제2교수회관은 월해관과 같은 건물로 취급(제보 기준)
  "제2교수회관": "M_4F",
  "학군단": "E_BLD",
  "생활예술관": "D_BLD",
  "체육관": "F_BLD",
  "상명아트센터(문화예술관)": "U_BLD",
};

// 지도상 미술관(B)보다 위쪽 구역 건물. 이 건물들이 목적지면, 다른 구역에서 갈 때는
// 걸어가지 않고 T관 1층 → 에스컬레이터를 거치는 게 실제 이용 패턴입니다.
export const UPPER_CAMPUS_BUILDINGS = new Set([
  "미술관",
  "미래백년관",
  "가정관",
  "학군단",
  "생활예술관",
  "체육관",
  "상명아트센터(문화예술관)",
  "월해관(문화예술대학관 1관)",
  "제2교수회관",
]);

export const ESCALATOR_GATEWAY_BUILDING = "경영경제대학관(구 밀레니엄관)";

const NODE_LABELS = {
  T_ESC: "경영경제대학관(T) 1층 · 에스컬레이터 앞",
  T3: "경영경제대학관(T) 3층",
  T_ROOF: "경영경제대학관(T) 옥상",
  ESC_MID: "에스컬레이터 중간",
  ESC_TOP: "에스컬레이터 상단 · 미술관(B) 정문",
  R_B1: "미래백년관(R) B1층 정문",
  R_4F: "미래백년관(R) 4층",
  C_HOME: "가정관(C)",
  A_3F: "사범대학관(A) 3층",
  L_ROOF: "학술정보관(L) 옥상",
  L_4F: "학술정보관(L) 4층",
  G_3F: "제1공학관(G) 3층",
  N_3F: "인문사회과학대학관(N, 자하관) 3층",
  M_4F: "월해관(M) 4층 정문 · 제2교수회관(I)",
  E_BLD: "학군단(E)",
  D_BLD: "생활예술관(D)",
  F_BLD: "체육관(F)",
  U_BLD: "상명아트센터(U)",
};

// oneWay: true인 구간(에스컬레이터)은 from → to 방향으로만 이동 가능합니다.
const EDGES = [
  { from: "T_ESC", to: "ESC_MID", seconds: 60, oneWay: true },
  { from: "ESC_MID", to: "ESC_TOP", seconds: 90, oneWay: true },
  { from: "ESC_TOP", to: "R_4F", seconds: 20 },
  { from: "ESC_TOP", to: "M_4F", seconds: 90 },
  { from: "R_B1", to: "A_3F", seconds: 60 },
  { from: "R_B1", to: "L_ROOF", seconds: 120 },
  { from: "R_4F", to: "C_HOME", seconds: 90 },
  { from: "R_4F", to: "T_ROOF", seconds: 60 },
  { from: "L_ROOF", to: "A_3F", seconds: 90 },
  { from: "G_3F", to: "N_3F", seconds: 20 },
  { from: "ESC_TOP", to: "E_BLD", seconds: 60 },
  { from: "ESC_TOP", to: "D_BLD", seconds: 80 },
  { from: "ESC_TOP", to: "F_BLD", seconds: 180 },
  { from: "ESC_TOP", to: "U_BLD", seconds: 120 },
  { from: "L_4F", to: "ESC_MID", seconds: 10 },
  { from: "L_4F", to: "T3", seconds: 20 },
  // 에스컬레이터 실이용 실측치: T관에서 R관 방향(상행)은 아래 두 경로가 가장 빠름.
  // 반대 방향(R→T, 하행)은 에스컬레이터를 못 타므로 T_ROOF↔R_4F 경로를 이용.
  { from: "T_ESC", to: "R_4F", seconds: 150, oneWay: true },
  { from: "T3", to: "R_4F", seconds: 90, oneWay: true },
  // 같은 건물 내부 층간 이동 (실측치 없음 — 계단/엘리베이터 가정치).
  // T_ESC↔T3는 "T관1층→R관4층 150초 vs T관3층→R관4층 90초"라는 실측치와 앞뒤가
  // 맞도록 60초로 잡았습니다(15초/층 가정 대신). 이보다 짧게 잡으면 "굳이 3층까지
  // 걸어 올라간 뒤 타는 게 더 빠르다"는 실제와 다른 경로가 계산되어 버립니다.
  { from: "R_B1", to: "R_4F", seconds: 40 },
  { from: "L_4F", to: "L_ROOF", seconds: 30 },
  { from: "T_ESC", to: "T3", seconds: 60 },
  { from: "T3", to: "T_ROOF", seconds: 60 },
];

function buildAdjacency() {
  const adjacency = new Map();
  const addEdge = (from, to, seconds) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ to, seconds });
  };
  for (const edge of EDGES) {
    addEdge(edge.from, edge.to, edge.seconds);
    if (!edge.oneWay) addEdge(edge.to, edge.from, edge.seconds);
  }
  return adjacency;
}

const ADJACENCY = buildAdjacency();

/** 다익스트라 최단시간 경로. 도달 불가하면 null. */
export function findShortestRoute(fromNode, toNode) {
  if (fromNode === toNode) return { path: [fromNode], seconds: 0 };

  const distances = new Map([[fromNode, 0]]);
  const previous = new Map();
  const visited = new Set();
  const queue = [fromNode];

  while (queue.length) {
    queue.sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity));
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toNode) break;

    for (const { to, seconds } of ADJACENCY.get(current) || []) {
      const candidate = (distances.get(current) ?? Infinity) + seconds;
      if (candidate < (distances.get(to) ?? Infinity)) {
        distances.set(to, candidate);
        previous.set(to, current);
        queue.push(to);
      }
    }
  }

  if (!distances.has(toNode)) return null;

  const path = [toNode];
  let cursor = toNode;
  while (cursor !== fromNode) {
    cursor = previous.get(cursor);
    path.unshift(cursor);
  }
  return { path, seconds: distances.get(toNode) };
}

/** 건물 표시 이름(BUILDING_TO_NODE의 key) 두 개를 받아 경로 요약을 반환. 지름길 데이터가 없으면 null. */
export function describeRoute(fromBuildingName, toBuildingName) {
  const fromNode = BUILDING_TO_NODE[fromBuildingName];
  const toNode = BUILDING_TO_NODE[toBuildingName];
  if (!fromNode || !toNode) return null;

  const result = findShortestRoute(fromNode, toNode);
  if (!result) return null;

  return {
    seconds: result.seconds,
    steps: result.path.map((nodeId) => NODE_LABELS[nodeId] || nodeId),
  };
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}
