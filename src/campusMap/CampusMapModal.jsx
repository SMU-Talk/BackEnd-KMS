import { useEffect, useMemo, useRef, useState } from "react";
import { CAMPUS_BUILDINGS, kakaoDirectionsUrl, kakaoToUrl } from "./buildings.js";
import { describeRoute } from "./routes.js";

// 선택 목록은 지도에 실제로 표시되는 건물만 씁니다. 예전에는 노드 목록에서도
// 이름을 끌어와 "학술정보관 4층"처럼 층 단위 항목이 섞여 나왔습니다.
const ROUTE_OPTION_NAMES = CAMPUS_BUILDINGS.map((building) => building.name);

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

/** 건물이 모두 보이도록 화면을 맞춥니다. level 고정보다 화면 크기에 잘 견딥니다. */
function fitToBuildings(kakao, map) {
  const bounds = new kakao.maps.LatLngBounds();
  CAMPUS_BUILDINGS.forEach((building) => bounds.extend(new kakao.maps.LatLng(building.lat, building.lng)));
  map.setBounds(bounds, 24, 24, 24, 24);
}

export default function CampusMapModal({ onClose }) {
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const mapObjectRef = useRef(null);
  const overlaysRef = useRef([]); // 경로를 다시 그릴 때 지울 선/마커
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");

  useEffect(() => {
    if (!KAKAO_KEY) return undefined;
    let cancelled = false;
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !mapRef.current) return;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(37.6026, 126.9554),
          level: 2,
        });
        kakaoRef.current = kakao;
        mapObjectRef.current = map;

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

        fitToBuildings(kakao, map);
        setMapReady(true);
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

  // 에스컬레이터 경유 안내는 그래프가 모든 건물을 이어주면서 필요가 없어졌습니다.
  // 이제 describeRoute가 에스컬레이터 구간까지 포함한 전체 경로를 돌려줍니다.
  const drawnRoute = internalRoute;

  // 선택된 경로를 지도 위에 직접 그립니다. 카카오맵 사이트로 나가지 않고 여기서 봅니다.
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapObjectRef.current;
    if (!mapReady || !kakao || !map) return;

    overlaysRef.current.forEach((item) => item.setMap(null));
    overlaysRef.current = [];

    if (!drawnRoute?.segments?.length) {
      fitToBuildings(kakao, map);
      return;
    }

    const bounds = new kakao.maps.LatLngBounds();
    drawnRoute.segments.forEach((segment) => {
      const path = [
        new kakao.maps.LatLng(segment.from.lat, segment.from.lng),
        new kakao.maps.LatLng(segment.to.lat, segment.to.lng),
      ];
      path.forEach((point) => bounds.extend(point));
      const line = new kakao.maps.Polyline({
        map,
        path,
        strokeWeight: segment.escalator ? 8 : 6,
        strokeColor: segment.escalator ? "#e8590c" : "#1c7ed6",
        strokeOpacity: 0.9,
        strokeStyle: segment.escalator ? "shortdash" : "solid",
      });
      overlaysRef.current.push(line);
    });

    const endpoints = [
      { point: drawnRoute.segments[0].from, text: "출발" },
      { point: drawnRoute.segments[drawnRoute.segments.length - 1].to, text: "도착" },
    ];
    endpoints.forEach(({ point, text }) => {
      const marker = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(point.lat, point.lng),
        yAnchor: 1.8,
        content: `<div class="campus-map-endpoint">${text}</div>`,
      });
      overlaysRef.current.push(marker);
    });

    map.setBounds(bounds, 60, 60, 60, 60);
  }, [drawnRoute, mapReady]);

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
            카카오맵에서 열기 ↗
          </a>
        </div>
        {internalRoute && (
          <div className="campus-map-internal-route">
            <b>🏫 캠퍼스 내부 지름길</b>
            <ol>{internalRoute.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            <small>학생 제보 기반 경로입니다. 실외 도로를 따라가는 카카오맵 경로보다 빠를 수 있어요.</small>
          </div>
        )}
        {canRoute && !internalRoute && (
          <p className="campus-map-note">
            이 구간은 건물 내부를 지나는 지름길이 없어 일반 도보로 이동합니다. 위
            &ldquo;카카오맵에서 열기&rdquo;로 길안내를 확인하세요.
          </p>
        )}
        {displayedError ? <p className="campus-map-error">{displayedError}</p> : <div className="campus-map-canvas" ref={mapRef} />}
        {drawnRoute && !displayedError && (
          <p className="campus-map-legend">
            <span className="campus-map-legend-walk" /> 도보
            <span className="campus-map-legend-esc" /> 에스컬레이터
          </p>
        )}
        <p className="campus-map-note">지도의 마커를 클릭하면 해당 건물로 카카오맵 길찾기가 열립니다.</p>
      </div>
    </div>
  );
}
