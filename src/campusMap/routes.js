// 학생 제보 기반 캠퍼스 내부 이동 지름길(엘리베이터·계단·에스컬레이터·징검다리) 그래프.
// 좌표 기반 카카오맵 경로는 실외 도로를 따라가지만, 여기서는 건물 내부 고저차와
// 지름길을 반영해 최단 경로를 계산합니다.
//
// 간선의 seconds 값은 경로 선택(다익스트라)에만 쓰고 화면에는 표시하지 않습니다.
// 걸리는 시간은 사람마다 차이가 커서 숫자로 못 박으면 오히려 오해를 부릅니다.
// 값 자체보다 "어느 경로가 더 빠른가"라는 순서만 맞으면 되는 값입니다.

import { CAMPUS_BUILDINGS } from "./buildings.js";

// 값이 배열이면 출입구가 여럿이라는 뜻이고, 그중 가장 빠른 쪽이 쓰입니다.
// 학술정보관은 언덕에 걸쳐 있어 옥상이 세갈림길 쪽 출입구 역할을 합니다.
export const BUILDING_TO_NODE = {
  "경영경제대학관(구 밀레니엄관)": "T_B1",
  "미술관": "B_FRONT",
  "가정관": "C_HOME",
  "미래백년관": "R_B1",
  "사범대학관": "A_3F",
  "학술정보관": ["L_1F", "L_ROOF"],
  "제1공학관": "G_1F",
  "인문사회과학대학관(자하관)": "N_1F",
  "중앙교수연구동": "S_BLD",
  "제2교수회관/월해관": "M_MAIN",
  "학생회관": "H_BLD",
  "대학본관": "J_BLD",
  "제2공학관(구 자연과학대학)": "K_BLD",
  "학군단": "E_BLD",
  "생활예술관": "D_BLD",
  "체육관": "F_BLD",
  "상명아트센터(문화예술관)": "U_BLD",
};

// 에스컬레이터 상단보다 위쪽 구역 건물들. 이 안에서 서로 오갈 때는 건물을 통과하는
// 것보다 바깥 도보가 빠릅니다(제보). 그래서 이 조합은 내부 경로를 안내하지 않습니다.
const UPPER_WALK_CLUSTER = new Set([
  "가정관",
  "미술관",
  "체육관",
  "생활예술관",
  "학군단",
  "상명아트센터(문화예술관)",
  "제2교수회관/월해관",
]);

// 위 규칙에 안 걸리지만 도보가 더 빠른 조합(제보). **방향이 있습니다.**
// 미래백년관에서 제1공학관으로 갈 때는 걸어 내려가는 게 빠르지만, 반대로 올라올 때는
// 에스컬레이터를 타는 게 빠릅니다. 그래서 쌍을 정렬해 양방향으로 묶으면 안 됩니다.
const WALK_ONLY_DIRECTIONS = new Set([
  "미래백년관>제1공학관",
  "미래백년관>체육관",
]);

// 지도상 미래백년관과 그보다 위쪽에 있는 건물들.
const UPPER_AREA_BUILDINGS = new Set(["미래백년관", ...UPPER_WALK_CLUSTER]);

// 학생회관·대학본관·제2공학관으로 갈 때는, 위쪽 구역에서 내려오는 경우에만
// 미래백년관을 거치는 게 빠릅니다. 같은 아래쪽 구역에서 출발하면 바로 옆 건물이라
// 건물을 통과하지 않고 걸어가는 편이 빠릅니다(예: 대학본관 → 학생회관).
const LOWER_DOOR_BUILDINGS = new Set([
  "학생회관",
  "대학본관",
  "제2공학관(구 자연과학대학)",
]);

/** 두 건물 사이를 내부 경로 없이 도보로 안내할지. */
export function isWalkOnlyPair(fromName, toName) {
  if (UPPER_WALK_CLUSTER.has(fromName) && UPPER_WALK_CLUSTER.has(toName)) return true;
  if (LOWER_DOOR_BUILDINGS.has(toName) && !UPPER_AREA_BUILDINGS.has(fromName)) return true;
  return WALK_ONLY_DIRECTIONS.has(`${fromName}>${toName}`);
}

// 에스컬레이터는 T관 지하 1층에서 시작해 지도상 북쪽으로 올라갑니다(제보 실측 좌표).
export const ESCALATOR_BOTTOM = { lat: 37.6019, lng: 126.9557 };
export const ESCALATOR_TOP = { lat: 37.6027, lng: 126.9557 };

// 미래백년관·사범대학관을 오갈 때 지나는 갈림길.
export const CENTER_JUNCTION = { lat: 37.6025, lng: 126.9551 };

// 자하관·중앙교수연구동·제1공학관 쪽에서 에스컬레이터로 갈 때 지나는 지점(제보).
export const VIA_JUNCTION = { lat: 37.6018, lng: 126.9549 };

const buildingCoord = (name) => {
  const building = CAMPUS_BUILDINGS.find((item) => item.name === name);
  return building ? { lat: building.lat, lng: building.lng } : null;
};

// 에스컬레이터 상단·미술관 정문·미래백년관 4층은 서로 가깝지만 다른 지점입니다.
// 예전에는 셋을 같은 좌표로 두어 경로선이 겹쳐 그려졌습니다.
export const NODE_COORDS = {
  MID_JUNCTION: CENTER_JUNCTION,
  VIA: VIA_JUNCTION,
  T_B1: ESCALATOR_BOTTOM,
  T3: buildingCoord("경영경제대학관(구 밀레니엄관)"),
  T_ROOF: buildingCoord("경영경제대학관(구 밀레니엄관)"),
  // 에스컬레이터 중간은 T관 3층과 같은 높이·좌표입니다(제보).
  ESC_MID: buildingCoord("경영경제대학관(구 밀레니엄관)"),
  ESC_TOP: ESCALATOR_TOP,
  B_FRONT: { lat: 37.6029, lng: 126.9555 },
  R_4F: { lat: 37.6029, lng: 126.9554 },
  R_B1: buildingCoord("미래백년관"),
  C_HOME: buildingCoord("가정관"),
  A_3F: buildingCoord("사범대학관"),
  L_4F: buildingCoord("학술정보관"),
  L_1F: buildingCoord("학술정보관"),
  L_ROOF: buildingCoord("학술정보관"),
  G_3F: buildingCoord("제1공학관"),
  G_1F: buildingCoord("제1공학관"),
  N_3F: buildingCoord("인문사회과학대학관(자하관)"),
  N_1F: buildingCoord("인문사회과학대학관(자하관)"),
  S_BLD: buildingCoord("중앙교수연구동"),
  H_BLD: buildingCoord("학생회관"),
  J_BLD: buildingCoord("대학본관"),
  K_BLD: buildingCoord("제2공학관(구 자연과학대학)"),
  M_MAIN: buildingCoord("제2교수회관/월해관"),
  // 월해관 동편 출입구. 에스컬레이터를 이용할 때는 이쪽이 더 빠릅니다(제보).
  M_EAST: { lat: 37.6035, lng: 126.9566 },
  E_BLD: buildingCoord("학군단"),
  D_BLD: buildingCoord("생활예술관"),
  F_BLD: buildingCoord("체육관"),
  U_BLD: buildingCoord("상명아트센터(문화예술관)"),
};

const ESCALATOR_NODES = new Set(["T_B1", "ESC_MID", "ESC_TOP"]);

export function isEscalatorSegment(fromNode, toNode) {
  return ESCALATOR_NODES.has(fromNode) && ESCALATOR_NODES.has(toNode);
}

const NODE_LABELS = {
  MID_JUNCTION: "미백관·사범대 갈림길",
  VIA: "에스컬레이터 진입 갈림길",
  T_B1: "경영경제대학관(T) B1층 · 에스컬레이터 하단",
  T3: "경영경제대학관(T) 3층",
  T_ROOF: "경영경제대학관(T) 옥상",
  ESC_MID: "에스컬레이터 중간",
  ESC_TOP: "에스컬레이터 상단",
  B_FRONT: "미술관(B) 정문",
  R_4F: "미래백년관(R) 4층",
  R_B1: "미래백년관(R) B1층 정문",
  C_HOME: "가정관(C)",
  A_3F: "사범대학관(A) 3층",
  L_4F: "학술정보관(L) 4층",
  L_1F: "학술정보관(L) 1층",
  L_ROOF: "학술정보관(L) 옥상",
  G_3F: "제1공학관(G) 3층",
  G_1F: "제1공학관(G) 1층",
  N_3F: "인문사회과학대학관(N, 자하관) 3층",
  N_1F: "인문사회과학대학관(N, 자하관) 1층",
  S_BLD: "중앙교수연구동(S)",
  H_BLD: "학생회관(H)",
  J_BLD: "대학본관(J)",
  K_BLD: "제2공학관(K)",
  M_MAIN: "제2교수회관/월해관(M)",
  M_EAST: "제2교수회관/월해관(M) 동편 출입구",
  E_BLD: "학군단(E)",
  D_BLD: "생활예술관(D)",
  F_BLD: "체육관(F)",
  U_BLD: "상명아트센터(U)",
};

// oneWay: true인 구간(에스컬레이터)은 from → to 방향으로만 이동 가능합니다.
const EDGES = [
  // --- 에스컬레이터 (상행 전용) ---
  { from: "T_B1", to: "ESC_MID", seconds: 60, oneWay: true },
  { from: "ESC_MID", to: "ESC_TOP", seconds: 90, oneWay: true },
  // 내려올 때는 에스컬레이터를 못 타므로 옆길로 걸어 내려옵니다. 위쪽 구역에서
  // 아래로 오는 유일한 통로라, 이게 없으면 하행 경로가 전부 끊깁니다.
  // 미래백년관을 돌아가는 것(상단→R4층→T옥상)보다 싸야 합니다. 비싸면 위쪽에서
  // 내려오는 경로가 전부 미래백년관을 거쳐 갑니다.
  { from: "ESC_TOP", to: "T_ROOF", seconds: 90 },

  // --- 경영경제대학관(T) 내부 ---
  { from: "T_B1", to: "T3", seconds: 60 },
  { from: "T3", to: "T_ROOF", seconds: 60 },

  // --- 학술정보관(L) ---
  // 엘리베이터가 없어 층간 이동이 계단뿐입니다. 그래서 L을 관통하는 경로는
  // 웬만해선 최단이 되지 않습니다(옥상 경유 경로는 아예 뺐습니다).
  { from: "L_1F", to: "L_4F", seconds: 60 },
  { from: "L_4F", to: "T3", seconds: 20 },
  // 4층에서 에스컬레이터 중간으로 올라탈 수 있습니다(제보).
  { from: "L_4F", to: "ESC_MID", seconds: 60 },
  { from: "L_1F", to: "G_1F", seconds: 60 },
  { from: "L_1F", to: "N_1F", seconds: 70 },

  // --- 제1공학관(G) · 자하관(N) ---
  // 두 건물을 잇는 통로가 서로의 3층에 있습니다(제보).
  { from: "G_1F", to: "G_3F", seconds: 30 },
  { from: "N_1F", to: "N_3F", seconds: 30 },
  { from: "G_3F", to: "N_3F", seconds: 15 },

  // --- 에스컬레이터 진입 갈림길(VIA) ---
  { from: "VIA", to: "T_B1", seconds: 70 },
  { from: "G_1F", to: "VIA", seconds: 30 },
  // 갈림길 경유가 3층 통로(G↔N)보다 싸지면 두 건물 사이를 밖으로 돌아가게 됩니다.
  // 통로 합계(75초)보다 크도록 잡았습니다.
  { from: "N_1F", to: "VIA", seconds: 50 },
  { from: "S_BLD", to: "VIA", seconds: 35 },
  { from: "K_BLD", to: "VIA", seconds: 90 },
  { from: "S_BLD", to: "N_1F", seconds: 30 },

  // --- 하단 구역 도보 ---
  { from: "R_B1", to: "MID_JUNCTION", seconds: 45 },
  { from: "A_3F", to: "MID_JUNCTION", seconds: 15 },
  // 학술정보관 옥상이 이 갈림길 쪽 출입구입니다. 건물 안(1층·4층)과는 잇지 않았는데,
  // 엘리베이터가 없어 옥상↔1층을 실제로는 거의 다니지 않기 때문입니다.
  { from: "L_ROOF", to: "MID_JUNCTION", seconds: 150 },
  // 학생회관·대학본관에서 미래백년관까지는 건물을 통과하지 않고 도보로 갑니다(제보).
  { from: "H_BLD", to: "R_B1", seconds: 150 },
  { from: "J_BLD", to: "R_B1", seconds: 150 },
  // 미래백년관에서 캠퍼스 아래쪽으로 내려가는 길. 제2공학관으로 갈 때는 이 길로
  // 갈림길까지 내려간 뒤 도착합니다.
  // 양방향으로 두면 반대로 올라갈 때도 이 길이 최단이 되어, 에스컬레이터를 타는
  // 실제 경로와 어긋납니다(K→R 등).
  { from: "R_B1", to: "VIA", seconds: 220, oneWay: true },

  // --- 상단 구역 ---
  { from: "ESC_TOP", to: "B_FRONT", seconds: 30 },
  { from: "ESC_TOP", to: "R_4F", seconds: 45 },
  // 미술관은 에스컬레이터 상단을 거치지 않고 미백관 4층에서 바로 이어집니다(제보).
  { from: "R_4F", to: "B_FRONT", seconds: 25 },
  { from: "R_B1", to: "R_4F", seconds: 40 },
  { from: "ESC_TOP", to: "C_HOME", seconds: 110 },
  { from: "ESC_TOP", to: "E_BLD", seconds: 60 },
  { from: "ESC_TOP", to: "D_BLD", seconds: 80 },
  { from: "ESC_TOP", to: "F_BLD", seconds: 180 },
  { from: "ESC_TOP", to: "U_BLD", seconds: 120 },
  // 월해관은 동편 출입구가 에스컬레이터 쪽에 더 가깝습니다(제보).
  { from: "ESC_TOP", to: "M_EAST", seconds: 90 },
  { from: "M_MAIN", to: "M_EAST", seconds: 25 },
  { from: "M_MAIN", to: "R_4F", seconds: 230 },
  // 미래백년관 4층에서 T관 옥상으로 건너가는 내리막. 단방향입니다.
  // 양방향으로 열면 T·G·N에서 위로 올라갈 때도 이 길이 최단이 되어, 에스컬레이터를
  // 타는 실제 경로를 전부 밀어냅니다.
  { from: "R_4F", to: "T_ROOF", seconds: 60, oneWay: true },
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

/** 하단→상단을 한 번에 타는 경우 '중간' 단계는 안내에서 뺍니다. */
function hideEscalatorMiddle(path) {
  return path.filter((node, index) => {
    if (node !== "ESC_MID") return true;
    return !(path[index - 1] === "T_B1" && path[index + 1] === "ESC_TOP");
  });
}

// 중앙교수연구동(S)은 자하관(N) 바로 옆이라 가는 길이 같습니다. 그래서 N까지의
// 경로를 그대로 쓰고 마지막 이름만 바꿉니다. 다만 제1공학관 3층 통로로 N에 들어가는
// 경로는 N 건물 안을 지나 도착하는 것이라 S에는 쓸 수 없습니다.
const S_BUILDING = "중앙교수연구동";
const N_BUILDING = "인문사회과학대학관(자하관)";

/** 건물의 출입구 노드 목록. 한 개짜리도 배열로 맞춰 돌려줍니다. */
function entranceNodes(buildingName) {
  const value = BUILDING_TO_NODE[buildingName];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** 지도에 그릴 구간들. 같은 좌표가 이어지는 층간 이동은 그릴 선이 없어 건너뜁니다. */
function buildSegments(path) {
  const segments = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = NODE_COORDS[path[index]];
    const to = NODE_COORDS[path[index + 1]];
    if (!from || !to) continue;
    if (from.lat === to.lat && from.lng === to.lng) continue;
    segments.push({ from, to, escalator: isEscalatorSegment(path[index], path[index + 1]) });
  }
  return segments;
}

function summarize(path, seconds) {
  return {
    seconds,
    path,
    steps: hideEscalatorMiddle(path).map((nodeId) => NODE_LABELS[nodeId] || nodeId),
    segments: buildSegments(path),
  };
}

function borrowNeighbourRoute(fromBuildingName) {
  const route = describeRoute(fromBuildingName, N_BUILDING);
  // 3층 통로로 자하관에 들어가는 경로는 S관으로 이어지지 않습니다.
  if (!route || route.path.includes("N_3F")) return null;
  // 마지막 노드만 S로 바꾸고 경로선도 다시 만듭니다. 단계 이름만 바꾸면 지도에는
  // 여전히 자하관까지만 선이 그려집니다.
  return summarize([...route.path.slice(0, -1), "S_BLD"], route.seconds);
}

/**
 * 건물 표시 이름 두 개를 받아 경로 요약을 반환합니다.
 * 내부 지름길이 없거나 도보가 더 빠른 조합이면 null.
 */
export function describeRoute(fromBuildingName, toBuildingName) {
  if (isWalkOnlyPair(fromBuildingName, toBuildingName)) return null;

  if (toBuildingName === S_BUILDING && fromBuildingName !== N_BUILDING) {
    const borrowed = borrowNeighbourRoute(fromBuildingName);
    if (borrowed) return borrowed;
  }

  // 출입구가 여러 개인 건물은 모든 조합을 재보고 가장 빠른 쪽을 씁니다.
  const fromNodes = entranceNodes(fromBuildingName);
  const toNodes = entranceNodes(toBuildingName);
  if (!fromNodes.length || !toNodes.length) return null;

  let best = null;
  for (const start of fromNodes) {
    for (const goal of toNodes) {
      const result = findShortestRoute(start, goal);
      if (result && (!best || result.seconds < best.seconds)) best = result;
    }
  }
  if (!best) return null;
  return summarize(best.path, best.seconds);
}
