import { useEffect, useMemo, useRef, useState } from "react";
import { CAMPUS_BUILDINGS, kakaoDirectionsUrl, kakaoToUrl } from "../data/campusMap";
import {
  BUILDING_TO_NODE,
  ESCALATOR_GATEWAY_BUILDING,
  UPPER_CAMPUS_BUILDINGS,
  describeRoute,
  formatDuration,
} from "../data/campusRoutes";

const ROUTE_OPTION_NAMES = [
  ...CAMPUS_BUILDINGS.map((building) => building.name),
  ...Object.keys(BUILDING_TO_NODE).filter(
    (name) => !CAMPUS_BUILDINGS.some((building) => building.name === name)
  ),
];

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;
let kakaoLoadPromise = null;

function loadKakaoMaps() {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (kakaoLoadPromise) return kakaoLoadPromise;
  kakaoLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(script);
  });
  return kakaoLoadPromise;
}

export default function CampusMapModal({ onClose }) {
  const mapRef = useRef(null);
  const [error, setError] = useState(null);
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");

  useEffect(() => {
    if (!KAKAO_KEY) return undefined;
    let cancelled = false;
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !mapRef.current) return;
        const center = new kakao.maps.LatLng(37.6024, 126.9553);
        const map = new kakao.maps.Map(mapRef.current, { center, level: 4 });
        CAMPUS_BUILDINGS.forEach((building) => {
          const position = new kakao.maps.LatLng(building.lat, building.lng);
          const marker = new kakao.maps.Marker({ position, map });
          const overlay = new kakao.maps.CustomOverlay({
            position,
            yAnchor: 2.3,
            content: `<div class="campus-map-label">${building.code ? `${building.code}. ` : ""}${building.name}</div>`,
          });
          overlay.setMap(map);
          kakao.maps.event.addListener(marker, "click", () => window.open(kakaoToUrl(building), "_blank", "noopener"));
        });
      })
      .catch(() => {
        if (!cancelled) setError("카카오맵을 불러오지 못했습니다. API 키와 도메인 등록을 확인해 주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedError = error || (!KAKAO_KEY ? "카카오맵 API 키(VITE_KAKAO_MAP_KEY)가 설정되지 않았습니다." : null);
  const from = CAMPUS_BUILDINGS.find((building) => building.name === fromName);
  const to = CAMPUS_BUILDINGS.find((building) => building.name === toName);
  const canRoute = Boolean(from && to && from !== to);
  const internalRoute = useMemo(
    () => (fromName && toName && fromName !== toName ? describeRoute(fromName, toName) : null),
    [fromName, toName]
  );

  // 목적지가 상단 구역 건물이고, 출발지에서 곧장 이어지는 지름길이 없다면
  // "T관까지 이동 → 에스컬레이터"를 안내합니다 (하단→상단은 늘 에스컬레이터 경유).
  const needsEscalatorGateway = Boolean(
    !internalRoute &&
      fromName &&
      toName &&
      fromName !== toName &&
      fromName !== ESCALATOR_GATEWAY_BUILDING &&
      UPPER_CAMPUS_BUILDINGS.has(toName) &&
      !UPPER_CAMPUS_BUILDINGS.has(fromName)
  );
  const gatewayRoute = useMemo(
    () => (needsEscalatorGateway ? describeRoute(ESCALATOR_GATEWAY_BUILDING, toName) : null),
    [needsEscalatorGateway, toName]
  );
  const gatewayBuilding = CAMPUS_BUILDINGS.find((building) => building.name === ESCALATOR_GATEWAY_BUILDING);
  const gatewayLegUrl = gatewayRoute && from && gatewayBuilding ? kakaoDirectionsUrl(from, gatewayBuilding) : null;

  return (
    <div className="campus-map-overlay" onClick={onClose}>
      <div className="campus-map-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <b>🗺️ 학교 맵 (서울캠퍼스)</b>
          <button onClick={onClose} aria-label="닫기">✕</button>
        </header>
        <div className="campus-map-route">
          <select value={fromName} onChange={(event) => setFromName(event.target.value)}>
            <option value="">출발 건물</option>
            {ROUTE_OPTION_NAMES.map((name) => {
              const building = CAMPUS_BUILDINGS.find((item) => item.name === name);
              return (
                <option value={name} key={name}>
                  {building?.code ? `${building.code}. ` : ""}{name}
                </option>
              );
            })}
          </select>
          <span>→</span>
          <select value={toName} onChange={(event) => setToName(event.target.value)}>
            <option value="">도착 건물</option>
            {ROUTE_OPTION_NAMES.map((name) => {
              const building = CAMPUS_BUILDINGS.find((item) => item.name === name);
              return (
                <option value={name} key={name}>
                  {building?.code ? `${building.code}. ` : ""}{name}
                </option>
              );
            })}
          </select>
          <a
            className={canRoute ? "campus-map-route-button" : "campus-map-route-button disabled"}
            href={canRoute ? kakaoDirectionsUrl(from, to) : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!canRoute) event.preventDefault();
            }}
          >
            카카오맵에서 길찾기 ↗
          </a>
        </div>
        {internalRoute && (
          <div className="campus-map-internal-route">
            <b>🏫 캠퍼스 내부 지름길 · 약 {formatDuration(internalRoute.seconds)}</b>
            <ol>{internalRoute.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            <small>학생 제보 기반 경로입니다. 실외 도로를 따라가는 카카오맵 경로보다 빠를 수 있어요.</small>
          </div>
        )}
        {gatewayRoute && (
          <div className="campus-map-internal-route">
            <b>🏫 에스컬레이터 경유 · 이후 구간 약 {formatDuration(gatewayRoute.seconds)}</b>
            <ol>
              <li>
                {fromName} → 경영경제대학관(T) 1층{" "}
                {gatewayLegUrl && (
                  <a href={gatewayLegUrl} target="_blank" rel="noreferrer">(카카오맵 ↗)</a>
                )}
              </li>
              {gatewayRoute.steps.slice(1).map((step, index) => <li key={index}>{step}</li>)}
            </ol>
            <small>미술관보다 위쪽 건물은 보통 T관 1층에서 에스컬레이터를 타고 이동합니다.</small>
          </div>
        )}
        {displayedError ? <p className="campus-map-error">{displayedError}</p> : <div className="campus-map-canvas" ref={mapRef} />}
        <p className="campus-map-note">지도의 마커를 클릭해도 해당 건물로 카카오맵 길찾기가 열립니다.</p>
      </div>
    </div>
  );
}
