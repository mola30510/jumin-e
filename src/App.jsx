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
  const [viewMode, setViewMode] = useState('calculator');
  const [currentBenefits, setCurrentBenefits] = useState([]);

  const [markers, setMarkers] = useState([]);
  const [currentCircle, setCurrentCircle] = useState(null);
  const SERVICE_KEY = import.meta.env.VITE_SERVICE_KEY;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_APP_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => {
      const options = { center: new window.kakao.maps.LatLng(37.5665, 126.9780), level: 8 };
      mapRef.current = new window.kakao.maps.Map(mapContainerRef.current, options);
    });
    document.head.appendChild(script);
  }, []);

  const moveMapTo = (lat, lng) => {
    if (!mapRef.current) return;
    markers.forEach(m => m.setMap(null));
    setMarkers([]);
    if (currentCircle) { currentCircle.setMap(null); setCurrentCircle(null); }
    mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
  };

  const displayAreaInfo = (benefits, lat, lng) => {
    if (!mapRef.current) return;
    const newMarkers = [];
    const bounds = new window.kakao.maps.LatLngBounds();
    
    benefits.forEach(b => {
      const markerPosition = new window.kakao.maps.LatLng(lat + (Math.random()-0.5)*0.01, lng + (Math.random()-0.5)*0.01);
      const marker = new window.kakao.maps.Marker({ position: markerPosition });
      marker.setMap(mapRef.current);
      newMarkers.push(marker);
      bounds.extend(markerPosition);
    });

    setMarkers(newMarkers);
    mapRef.current.setBounds(bounds);

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

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), text: inputText, isUser: true }]);
    setInputText("");

    const found = regionData.find(item => inputText.includes(item.시군구명.replace(/[시군구]$/, "")));

    if (found) {
      setPlaceName(found.시군구명);
      const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${SERVICE_KEY}&numOfRows=5&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12&lDongRegnCd=${found.시도코드}&lDongSignguCd=${found.시군구코드}`;
    
      try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.response?.body?.items?.item;
        
        if (items) {
          const itemList = Array.isArray(items) ? items : [items];
          const lat = parseFloat(itemList[0].mapy);
          const lng = parseFloat(itemList[0].mapx);

          const apiBenefits = itemList.map(item => ({
            업체명: item.title,
            혜택: "관광주민증 제시 시 할인",
            imageUrl: item.firstimage,
            상세설명: item.addr1
          }));

          setCurrentBenefits(apiBenefits);
          setViewMode('info');
          moveMapTo(parseFloat(itemList[0].mapy), parseFloat(itemList[0].mapx));
          displayAreaInfo(apiBenefits, parseFloat(itemList[0].mapy), parseFloat(itemList[0].mapx));
          setMessages(prev => [...prev, { id: Date.now(), text: `🤖 '${found.시군구명}'의 관광지 정보를 불러왔습니다.`, isUser: false }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, { id: Date.now(), text: "🤖 API 오류 발생", isUser: false }]);
      }
    } else {
      setMessages(prev => [...prev, { id: Date.now(), text: "🤖 해당 지역을 찾을 수 없습니다.", isUser: false }]);
    }
  };

  const styles = {
    root: { display: 'flex', height: '100vh', width: '100vw', margin: 0, padding: 0 },
    // 왼쪽 영역 (지도 50% + 업체 정보 50%)
    leftSection: { width: '70%', height: '100%', display: 'flex', flexDirection: 'column' },
    mapArea: { width: '100%', height: '50%', backgroundColor: '#e6f0fa' },
    dashboardArea: { width: '100%', height: '50%', padding: '20px', overflowY: 'auto', backgroundColor: '#fff' },
    // 오른쪽 채팅 영역 (30%)
    rightSection: { width: '30%', height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ddd' },
    chatLog: { flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f1f5f9' },
    // 업체 카드 스타일
    cardContainer: { display: 'flex', gap: '15px', overflowX: 'auto', padding: '10px 0' },
    card: { minWidth: '200px', border: '1px solid #ddd', borderRadius: '10px', padding: '10px', textAlign: 'center' },
    inputRow: { padding: '10px', borderTop: '1px solid #ddd' }
  };

  return (
    <div style={styles.root}>
      <div style={styles.leftSection}>
        <div ref={mapContainerRef} style={styles.mapArea}></div>
        <div style={styles.dashboardArea}>
          {viewMode === 'info' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>{placeName} 주요 혜택 업체</h3>
                <button onClick={() => setViewMode('course')}>코스 추천 보기</button>
              </div>
              <div style={styles.cardContainer}>
                {currentBenefits.map((b, i) => (
                  <div key={i} style={styles.card}>
                    <img src={b.imageUrl || 'https://via.placeholder.com/150'} style={{ width: '100%', height: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                    <p style={{ fontWeight: 'bold', margin: '10px 0 5px' }}>{b.업체명}</p>
                    <p style={{ fontSize: '12px', color: '#666' }}>{b.상세설명}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3>{placeName} 추천 여행 코스</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
                1. {currentBenefits[0]?.업체명}에서 시작하세요.<br/>
                2. {currentBenefits[1]?.업체명}에서 식사하세요.<br/>
                3. {currentBenefits[2]?.업체명}에서 여유를 즐기세요.<br/>
                4. {currentBenefits[3]?.업체명}과 {currentBenefits[4]?.업체명}을 방문하세요.
              </p>
              <button onClick={() => setViewMode('info')}>업체 목록 보기</button>
            </div>
          )}
        </div>
      </div>
      <div style={styles.rightSection}>
        <div style={styles.chatLog}>
          {messages.map(m => <div key={m.id} style={{marginBottom: '10px'}}>{m.text}</div>)}
        </div>
        <div style={styles.inputRow}>
          <input style={{flex: 1}} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
          <button onClick={handleSend}>전송</button>
        </div>
      </div>
    </div>
  );
}
  