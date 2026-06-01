import { useState, useEffect, useRef } from 'react';
import regionData from './data/regionData.json';
import benefitData from './data/benefitData.json';

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [messages, setMessages] = useState([
    { id: 1, text: "안녕하세요! 주민증 할인 정보가 궁금해요.", isUser: true },
    { id: 2, text: "어느 지역 상권을 찾고 계신가요?", isUser: false }
  ]);
  const [inputText, setInputText] = useState("");
  
  const [placeName, setPlaceName] = useState("선택된 지역 없음");
  const [price, setPrice] = useState(30000);
  const [discountRate, setDiscountRate] = useState(10);
  const SERVICE_KEY = import.meta.env.VITE_SERVICE_KEY;

  // 카카오 지도 최초 초기화 및 데이터 누락 확인 
  useEffect(() => {
    const initMap = () => {
      if (window.kakao && window.kakao.maps && mapContainerRef.current) {
        const options = { 
          center: new window.kakao.maps.LatLng(37.5665, 126.9780), 
          level: 8 
        };
        mapRef.current = new window.kakao.maps.Map(mapContainerRef.current, options);
        console.log("지도 초기화 완료");
      }
    };

    // 카카오맵이 이미 로드되어 있다면 바로 실행
    if (window.kakao && window.kakao.maps) {
      initMap();
    } else {
      // 아니면 스크립트 로딩 완료를 기다림
      const script = document.querySelector('script[src*="dapi.kakao.com"]');
      if (script) {
        script.onload = initMap;
      }
    }

    // 데이터 누락 확인 (지도 로딩과 무관하게 실행됨)
    const regionNames = regionData.map(r => r.시군구명);
    const benefitKeys = Object.keys(benefitData);
    regionNames.forEach(name => {
      if (!benefitKeys.includes(name)) {
        console.warn(`[주의] 혜택 데이터에 누락된 지역: ${name}`);
      }
    });
  }, []);

  const moveMapTo = (lat, lng) => {
    if (!mapRef.current) return;
    const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
    mapRef.current.panTo(moveLatLon);
    if (markerRef.current) markerRef.current.setMap(null);
    const newMarker = new window.kakao.maps.Marker({ position: moveLatLon });
    newMarker.setMap(mapRef.current);
    markerRef.current = newMarker;
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMessage = { id: Date.now(), text: inputText, isUser: true };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText("");

    const found = regionData.find(item => currentInput.includes(item.시군구명) || item.시군구명.includes(currentInput));

    if (found) {
      setPlaceName(found.시군구명);

      // benefitData에서 해당 지역 혜택 가져오기
      const benefits = benefitData[found.시군구명]; 
        
      // 혜택 멘트 생성 (있으면 리스트 출력, 없으면 기본 메시지)
      let benefitText = benefits 
          ? benefits.map(b => `• ${b.업체명}: ${b.혜택}`).join('\n')
          : "아직 등록된 혜택 정보가 없습니다.";

      // api 호출출
      const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${SERVICE_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&arrange=C&contentTypeId=12&lDongRegnCd=${found.시도코드}&lDongSignguCd=${found.시군구코드}`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        
        const body = data.response?.body;
        if (body && body.totalCount > 0) {
          const rawItems = body.items.item;
          const items = Array.isArray(rawItems) ? rawItems : [rawItems];
          const item = items[0];
          
          moveMapTo(parseFloat(item.mapy), parseFloat(item.mapx));
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
    root: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', display: 'flex', fontFamily: 'sans-serif' },
    leftSection: { width: '50%', height: '100%', display: 'flex', flexDirection: 'column' },
    mapArea: { width: '100%', height: '60%', minHeight: '400px', backgroundColor: '#e6f0fa', position: 'relative', overflow: 'hidden'},
    dashboardArea: { width: '100%', height: '40%', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', borderTop: '2px solid #e2e8f0' },
    rightSection: { width: '50%', height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '2px solid #e2e8f0' },
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
          <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>💳 디지털 관광주민증 실시간 가상 혜택 계산기</h3>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#64748b' }}>현재 선택 구역: <strong>{placeName}</strong> (기본 {discountRate}% 할인 상권)</p>
          <div style={styles.calcGrid}>
            <div style={styles.calcCard}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>예상 이용 금액 입력 (원)</label>
              <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold' }} />
            </div>
            <div style={styles.calcCard}>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>주민증 할인액: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-{discountedAmount.toLocaleString()}원</span></div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>최종 결제액: <span style={{ color: '#0284c7' }}>{finalPrice.toLocaleString()}원</span></div>
            </div>
          </div>
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
