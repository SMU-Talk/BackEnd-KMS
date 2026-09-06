// 상명대학교 서울캠퍼스 건물 좌표. 캠퍼스 안내도의 기호(code)를 함께 기록해
// 지도 마커 라벨과 대조할 수 있게 합니다. 좌표가 없는 건물은 추후 추가합니다.
export const CAMPUS_BUILDINGS = [
  { code: "R", name: "미래백년관", lat: 37.6032, lng: 126.9548 },
  { code: "A", name: "사범대학관", lat: 37.6024, lng: 126.9547 },
  { code: "G", name: "제1공학관", lat: 37.6015, lng: 126.9545 },
  { code: "H", name: "학생회관", lat: 37.602, lng: 126.9543 },
  { code: "J", name: "대학본관", lat: 37.6024, lng: 126.9542 },
  { code: "K", name: "제2공학관(구 자연과학대학)", lat: 37.6007, lng: 126.9571 },
  // 제2교수회관과 월해관은 같은 건물이라 하나로 합쳤습니다.
  { code: "M", name: "제2교수회관/월해관", lat: 37.6037, lng: 126.9564 },
  { code: "L", name: "학술정보관", lat: 37.6022, lng: 126.9553 },
  { code: "N", name: "인문사회과학대학관(자하관)", lat: 37.601, lng: 126.9544 },
  { code: "S", name: "중앙교수연구동", lat: 37.6013, lng: 126.9547 },
  { code: "T", name: "경영경제대학관(구 밀레니엄관)", lat: 37.6022, lng: 126.9558 },
  { code: "C", name: "가정관", lat: 37.6032, lng: 126.9559 },
  { code: "B", name: "미술관", lat: 37.6031, lng: 126.9557 },
  { code: "F", name: "체육관", lat: 37.6039, lng: 126.9549 },
  { code: "D", name: "생활예술관", lat: 37.6035, lng: 126.9559 },
  { code: "E", name: "학군단", lat: 37.6034, lng: 126.9561 },
  { code: "U", name: "상명아트센터(문화예술관)", lat: 37.603, lng: 126.9564 },
];

const encodePoint = (building) => `${encodeURIComponent(building.name)},${building.lat},${building.lng}`;

export function kakaoToUrl(building) {
  return `https://map.kakao.com/link/to/${encodePoint(building)}`;
}

export function kakaoDirectionsUrl(from, to) {
  return `https://map.kakao.com/link/from/${encodePoint(from)}/to/${encodePoint(to)}`;
}
