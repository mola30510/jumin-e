import { useState, useEffect, useRef } from 'react';
import regionData from './data/regionData.json';
import benefitData from './data/benefitData.json';

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [messages, setMessages] = useState([
    { id: 1, text: "안녕하세요! 주민증 할인 정보가 궁금해요.", isUser: true },
    { id: 2, text: "어느 지역 상권을 찾고 계신가요?", isUser: false }
  ]);
  const [inputText, setInputText] = useState("");
  const [placeName, setPlaceName] = useState("선택된 지역 없음");
  const [price, setPrice] = useState(30000);
  const [discountRate, setDiscountRate] = useState(10);
  const [viewMode, setViewMode] = useState('calculator'); // 'calculator' | 'info'
  const [currentBenefits, setCurrentBenefits] = useState([]);

  // 지도 요소 관리
  const [markers, setMarkers] = useState([]);
  const [currentCircle, setCurrentCircle] = useState(null);

  const SERVICE_KEY = import.meta.env.VITE_SERVICE_KEY;

  // 카카오 지도 최초 초기화 및 데이터 누락 확인 
  useEffect(() => {
    // 1. 카카오 지도 로드 로직
    const loadKakaoMap = () => {
      const script = document.createElement("script");
      // VITE_KAKAO_APP_KEY 환경변수 설정 
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_APP_KEY}&autoload=false`;
      script.async = true;
      script.onload = () => {
        window.kakao.maps.load(() => {
          const container = mapContainerRef.current;
          if (!container) return;
          const options = {
            center: new window.kakao.maps.LatLng(37.5665, 126.9780),
            level: 8,
          };
          mapRef.current = new window.kakao.maps.Map(container, options);
        });
      };
      document.head.appendChild(script);
    };
    // 2. 데이터 누락 확인 로직 
    const regionNames = regionData.map(r => r.시군구명);
    const benefitKeys = Object.keys(benefitData);
    regionNames.forEach(name => {
      if (!benefitKeys.includes(name)) {
        console.warn(`[주의] 혜택 데이터에 누락된 지역: ${name}`);
      }
    });
    loadKakaoMap();
  }, []);

  // 지도 이동 및 기존 요소 삭제
  const moveMapTo = (lat, lng) => {
    if (!mapRef.current) return;
    markers.forEach(m => m.setMap(null));
    setMarkers([]);
    if (currentCircle) {
      currentCircle.setMap(null);
      setCurrentCircle(null);
    }
    mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
  };
  // 업체 마커 5개 찍고 영역 색칠
  const displayAreaInfo = (benefits, lat, lng) => {
    if (!mapRef.current) return;

    // 1. 기존 마커 지우기
    markers.forEach(m => m.setMap(null));
    if (currentCircle) currentCircle.setMap(null);
    
    // 2. 5개의 지점에 파란색 핑 찍기
    const newMarkers = [];
    const bounds = new window.kakao.maps.LatLngBounds();
    // 업체별 좌표 분산 처리 (중심점 기준)
    if (benefits && benefits.length > 0) {
      benefits.forEach((b, index) => {
        const latOffset = (Math.random() - 0.5) * 0.01;
        const lngOffset = (Math.random() - 0.5) * 0.01;
        const markerPosition = new window.kakao.maps.LatLng(lat + latOffset, lng + lngOffset);
        const marker = new window.kakao.maps.Marker({ position: markerPosition });
        marker.setMap(mapRef.current);
        newMarkers.push(marker);
        bounds.extend(markerPosition);
      });
    }

    // 3. 지도를 마커들이 다 보이게 축소
    setMarkers(newMarkers);
    mapRef.current.setBounds(bounds);

    // 4. 영역 표시 
    const circle = new window.kakao.maps.Circle({
      center: new window.kakao.maps.LatLng(lat, lng),
      radius: 1500,
      strokeWeight: 2,
      strokeColor: '#FF0000',
      fillColor: '#FF0000',
      fillOpacity: 0.2
    });
    circle.setMap(mapRef.current);
    setCurrentCircle(circle);
  };
  // 검색 및 결과 처리
  const handleSend = async () => {
    if (!inputText.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), text: inputText, isUser: true }]);
    const currentInput = inputText;
    setInputText("");

    // regionData에 있는 모든 지역명 중, 현재 입력값에 포함된 첫 번째 지역을 찾음
    const found = regionData.find(item => {
      // 1. 지역명에서 '시', '군', '구'를 뺀 순수 이름 추출 (예: "곡성군" -> "곡성")
      const shortName = item.시군구명.replace(/[시군구]$/, "");
      
      // 2. 사용자가 입력한 문장에 이 이름이 포함되어 있는지 확인
      return currentInput.includes(shortName);
    });

    if (found) {
      setPlaceName(found.시군구명);
      // benefitData에서 해당 지역 혜택 가져오기
      const benefits = benefitData[found.시군구명]; 

      if (benefits && benefits.length > 0) {
        setCurrentBenefits(benefits);
        setViewMode('info');
      } else {
        setViewMode('calculator');
      }
        
      // 혜택 멘트 생성 (있으면 리스트 출력, 없으면 기본 메시지)
      let benefitText = benefits 
          ? benefits.map(b => `• ${b.업체명}: ${b.혜택}`).join('\n')
          : "아직 등록된 혜택 정보가 없습니다.";

      // api 호출출
      const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${SERVICE_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&arrange=C&contentTypeId=12&lDongRegnCd=${found.시도코드}&lDongSignguCd=${found.시군구코드}`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        const item = data.response?.body?.items?.item[0];
        
        if (item) {
          const lat = parseFloat(item.mapy);
          const lng = parseFloat(item.mapx);

          moveMapTo(lat, lng); // 기존 지도 이동
          displayAreaInfo(benefits || [], lat, lng); // 핑 5개 찍고 영역 표시
          
          setMessages(prev => [...prev, { id: Date.now(), text: `🤖 '${found.시군구명}'의 대표 관광지 '${item.title}'로 이동합니다. 이곳은 관광주민증 혜택이 적용되는 지역입니다.`, isUser: false }]);
        } else {
          setMessages(prev => [...prev, { id: Date.now(), text: `🤖 '${found.시군구명}' 지역에 등록된 관광지 정보가 없습니다.`, isUser: false }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, { id: Date.now(), text: "🤖 API 서버 연결 중 오류가 발생했습니다.", isUser: false }]);
      }
    } else {
      setMessages(prev => [...prev, { id: Date.now(), text: "🤖 관광주민증 활용 가능 지역이 아닙니다.", isUser: false }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const discountedAmount = (price * (discountRate / 100));
  const finalPrice = price - discountedAmount;

  const styles = {
    root: { position: 'flex', display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', margin: 0, padding: 0 },
    leftSection: { width: '50%', height: '100%', display: 'flex', flexDirection: 'column' },
    mapArea: { width: '100%', height: '50%', backgroundColor: '#e6f0fa'},
    dashboardArea: { width: '100%', height: '50%', backgroundColor: '#ffffff', overflowY: 'auto', padding: '20px' },
    rightSection: { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' },
    chatLog: { width: '100%', height: '85%', backgroundColor: '#f1f5f9', padding: '20px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
    bubble: (isUser) => ({
      backgroundColor: isUser ? '#0284c7' : '#ffffff',
      color: isUser ? '#ffffff' : '#1e293b',
      padding: '12px 16px',
      borderRadius: '12px',
      maxWidth: '80%',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      fontSize: '14px',
      lineHeight: '1.5',
      whiteSpace: 'pre-line'
    }),
    inputRow: { width: '100%', height: '15%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', padding: '0 20px', boxSizing: 'border-box', gap: '10px', borderTop: '1px solid #e2e8f0' },
    input: { flex: 1, height: '45px', padding: '0 15px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' },
    button: { height: '45px', padding: '0 25px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    calcGrid: { display: 'flex', gap: '20px', marginTop: '10px' },
    calcCard: { flex: 1, backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }
  };

  return (
    <div style={styles.root}>
      <div style={styles.leftSection}>
        <div ref={mapContainerRef} style={styles.mapArea}></div>
        <div style={styles.dashboardArea}>
        {viewMode === 'calculator' ? (
          // 기존 계산기 UI
          <>
            <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>💳 디지털 관광주민증 실시간 가상 혜택 계산기</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#64748b' }}>현재 선택 구역: <strong>{placeName}</strong></p>
            <div style={styles.calcGrid}>
              <div style={styles.calcCard}>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>예상 이용 금액 (원)</label>
                <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold' }} />
              </div>
              <div style={styles.calcCard}>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>주민증 할인액: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-{discountedAmount.toLocaleString()}원</span></div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>최종 결제액: <span style={{ color: '#0284c7' }}>{finalPrice.toLocaleString()}원</span></div>
              </div>
            </div>
          </>
        ) : (
          // 혜택 정보 UI
          <div style={{ overflowY: 'auto', height: '100%' }}>
            <h3 style={{ color: '#0f172a' }}>{placeName} 주요 혜택 업체</h3>
            {currentBenefits.map((b, i) => (
              <div key={i} style={{ marginBottom: '10px', fontSize: '14px' }}>
                <strong>{b.업체명}</strong>: {b.혜택}
              </div>
            ))}
            <button 
              onClick={() => setViewMode('calculator')} 
              style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}
            >
              다시 계산기로
            </button>
          </div>
        )}
      </div>
      </div>
      <div style={styles.rightSection}>
        <div style={styles.chatLog}>{messages.map(msg => <div key={msg.id} style={styles.bubble(msg.isUser)}>{msg.text}</div>)}</div>
        <div style={styles.inputRow}>
          <input style={styles.input} type="text" placeholder="방문하고 싶은 지역을 보내주세요!" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} />
          <button style={styles.button} onClick={handleSend}>전송</button>
        </div>
      </div>
    </div>
  );
}
