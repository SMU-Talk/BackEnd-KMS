// 학생 제보 기반 캠퍼스 내부 이동 지름길(엘리베이터·계단·에스컬레이터·징검다리) 그래프.
// 좌표 기반 카카오맵 경로는 실외 도로를 따라가지만, 여기서는 건물 내부 고저차와
// 지름길을 반영한 실제 체감 소요 시간(초)으로 최단 경로를 계산합니다.
//
// 층간 이동 시간은 제보 실측치가 있으면 그 값을 쓰고(자하관·제1공학관 30초,
// 학술정보관 1층↔4층 40초), 없는 구간만 계단 15초/층으로 가정했습니다.
// 가정치가 남아 있는 곳은 EDGES에 주석으로 표시해 두었습니다.

import { CAMPUS_BUILDINGS } from "./buildings.js";

export const BUILDING_TO_NODE = {
  "경영경제대학관(구 밀레니엄관)": "T_ESC",
  "미술관": "ESC_TOP",
  "가정관": "C_HOME",
  "미래백년관": "R_B1",
  "사범대학관": "A_3F",
  // 학술정보관은 1층 정문이 기본이고, 4층에서 출발/도착하는 경우를 위해 따로도 고를
  // 수 있게 해 두었습니다. 두 노드는 계단 40초로 이어져 있어 더 빠른 쪽이 선택됩니다.
  "학술정보관": "L_1F",
  "학술정보관 4층": "L_4F",
  "제1공학관": "G_1F",
  "인문사회과학대학관(자하관)": "N_1F",
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

// 지도에 경로선을 그리려면 노드마다 좌표가 있어야 합니다. 건물에 붙은 노드는
// buildings.js의 건물 좌표를 그대로 쓰고, 건물 사이에 있는 지점(에스컬레이터 등)만
// 따로 잡았습니다.
//
// 에스컬레이터: 경영경제대학관(T) 남서쪽 아래에서 미술관(B) 남쪽 꼭짓점까지
// 지도상 수직(남북) 방향으로 이어집니다. 아래는 제보받은 실측 좌표입니다.
// 남북 방향이라 두 지점의 경도는 같습니다.
export const ESCALATOR_BOTTOM = { lat: 37.6019, lng: 126.9557 };
export const ESCALATOR_TOP = { lat: 37.6027, lng: 126.9557 };
const ESCALATOR_MIDDLE = {
  lat: (ESCALATOR_BOTTOM.lat + ESCALATOR_TOP.lat) / 2,
  lng: ESCALATOR_BOTTOM.lng,
};

// 미래백년관·학술정보관 옥상·사범대학관을 오갈 때 세 경로가 공통으로 지나는 갈림길.
// 좌표는 제보값이고, 세 구간의 기존 실측치(60·120·90초)가 이 지점을 경유하는 것으로
// 정확히 맞아떨어져서(45+15, 45+75, 15+75) 각 구간 시간을 그대로 나눌 수 있었습니다.
export const CENTER_JUNCTION = { lat: 37.6025, lng: 126.9551 };

const buildingCoord = (name) => {
  const building = CAMPUS_BUILDINGS.find((item) => item.name === name);
  return building ? { lat: building.lat, lng: building.lng } : null;
};

export const NODE_COORDS = {
  MID_JUNCTION: CENTER_JUNCTION,
  T_ESC: ESCALATOR_BOTTOM,
  T3: buildingCoord("경영경제대학관(구 밀레니엄관)"),
  T_ROOF: buildingCoord("경영경제대학관(구 밀레니엄관)"),
  ESC_MID: ESCALATOR_MIDDLE,
  ESC_TOP: ESCALATOR_TOP,
  R_B1: buildingCoord("미래백년관"),
  R_4F: buildingCoord("미래백년관"),
  C_HOME: buildingCoord("가정관"),
  A_3F: buildingCoord("사범대학관"),
  L_ROOF: buildingCoord("학술정보관"),
  L_4F: buildingCoord("학술정보관"),
  L_1F: buildingCoord("학술정보관"),
  G_3F: buildingCoord("제1공학관"),
  G_1F: buildingCoord("제1공학관"),
  N_3F: buildingCoord("인문사회과학대학관(자하관)"),
  N_1F: buildingCoord("인문사회과학대학관(자하관)"),
  M_4F: buildingCoord("월해관(문화예술대학관 1관)"),
  E_BLD: buildingCoord("학군단"),
  D_BLD: buildingCoord("생활예술관"),
  F_BLD: buildingCoord("체육관"),
  U_BLD: buildingCoord("상명아트센터(문화예술관)"),
};

// 에스컬레이터 구간은 지도에서 다르게(점선 등) 그리려고 따로 표시합니다.
const ESCALATOR_NODES = new Set(["T_ESC", "ESC_MID", "ESC_TOP"]);

export function isEscalatorSegment(fromNode, toNode) {
  return ESCALATOR_NODES.has(fromNode) && ESCALATOR_NODES.has(toNode);
}

const NODE_LABELS = {
  MID_JUNCTION: "미백관·학술정보관·사범대 갈림길",
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
  L_1F: "학술정보관(L) 1층",
  G_3F: "제1공학관(G) 3층",
  G_1F: "제1공학관(G) 1층",
  N_3F: "인문사회과학대학관(N, 자하관) 3층",
  N_1F: "인문사회과학대학관(N, 자하관) 1층",
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
  // 이 세 구간은 갈림길(MID_JUNCTION)을 함께 지납니다. 직선 간선으로 두면 지도에
  // 실제로 지나지 않는 선이 그려져서, 경유 지점을 넣고 시간을 쪼갰습니다.
  // 합계는 기존 실측치와 동일합니다: R-A 60, R-L 120, L-A 90.
  { from: "R_B1", to: "MID_JUNCTION", seconds: 45 },
  { from: "A_3F", to: "MID_JUNCTION", seconds: 15 },
  { from: "L_ROOF", to: "MID_JUNCTION", seconds: 75 },
  { from: "R_4F", to: "C_HOME", seconds: 90 },
  { from: "R_4F", to: "T_ROOF", seconds: 60 },
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
  // 자하관·제1공학관과 캠퍼스 나머지를 잇는 1층 구간 (제보 실측치).
  // 이 네 간선이 생기기 전에는 G·N 두 노드가 서로만 연결된 섬이라, 나머지 12개
  // 건물과의 48개 조합이 전부 "경로 없음"이었습니다.
  { from: "N_1F", to: "L_1F", seconds: 50 },
  { from: "G_1F", to: "L_1F", seconds: 30 },
  { from: "N_1F", to: "T_ESC", seconds: 80 },
  { from: "G_1F", to: "T_ESC", seconds: 60 },
  // 건물 내부 층간 이동 (제보 실측치).
  { from: "N_1F", to: "N_3F", seconds: 30 },
  { from: "G_1F", to: "G_3F", seconds: 30 },
  { from: "L_1F", to: "L_4F", seconds: 40 },
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

  // 지도에 그릴 구간들. 같은 좌표가 연속되는 층간 이동(예: T관 1층 -> 3층)은
  // 선으로 그릴 게 없으므로 건너뜁니다.
  const segments = [];
  for (let index = 0; index < result.path.length - 1; index += 1) {
    const from = NODE_COORDS[result.path[index]];
    const to = NODE_COORDS[result.path[index + 1]];
    if (!from || !to) continue;
    if (from.lat === to.lat && from.lng === to.lng) continue;
    segments.push({
      from,
      to,
      escalator: isEscalatorSegment(result.path[index], result.path[index + 1]),
    });
  }

  return {
    seconds: result.seconds,
    path: result.path,
    steps: result.path.map((nodeId) => NODE_LABELS[nodeId] || nodeId),
    segments,
  };
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}
