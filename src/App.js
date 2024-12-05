import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import './styles.css';

const App = () => {
    const [hospitals, setHospitals] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredHospitals, setFilteredHospitals] = useState([]);
    const [selectedHospitalId, setSelectedHospitalId] = useState(null);
    const mapRef = useRef(null);
    const map = useRef(null);
    const [currentPosition, setCurrentPosition] = useState(null);
    const markers = useRef([]);    

    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                const response = await axios.get("https://volnewmer.co.kr/wp-json/wp/v2/hospital/?per_page=100");
                setHospitals(response.data);
                setFilteredHospitals(response.data);
            } catch (error) {
                console.error("Error fetching hospital data:", error);
            }
        };

        fetchHospitals();
    }, []);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCurrentPosition({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );
        }
    }, []);

    useEffect(() => {
        if (hospitals.length > 0 && currentPosition && !map.current) {
            // 지도 초기화
            map.current = new window.naver.maps.Map(mapRef.current, {
                center: new window.naver.maps.LatLng(currentPosition.lat, currentPosition.lng),
                zoom: 16, // 초기 줌 고정
            });

            // 사용자 위치 마커 추가
            new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(currentPosition.lat, currentPosition.lng),
                map: map.current,
                icon: {
                    url: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
                    size: new window.naver.maps.Size(50, 50),
                    origin: new window.naver.maps.Point(0, 0),
                    anchor: new window.naver.maps.Point(25, 25),
                },
                title: "현재 위치",
            });

            updateMarkers(hospitals);
        }
    }, [currentPosition, hospitals]);

    const updateMarkers = (hospitalList) => {
        // Clear existing markers
        markers.current.forEach(({ marker }) => {
            if (marker instanceof window.naver.maps.Marker) {
                marker.setMap(null);
            }
        });
        markers.current = [];

        // Add new markers
        hospitalList.forEach((hospital) => {
            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(hospital.acf.latitude, hospital.acf.longitude),
                map: map.current,
                title: hospital.title.rendered,
            });     
            const infoWindow = new window.naver.maps.InfoWindow({
                content: `<div style="padding:10px;">
                    <h4>
                    <a href="${hospital.acf.link ? hospital.acf.link: "javascript:void(0)"}" target="_blank">
                        ${hospital.title.rendered}
                    </a>                    
                    </h4>                    
                    <p>${hospital.acf.address ? hospital.acf.address: "업데이트 예정"}</p>
                </div>`,
            });

            window.naver.maps.Event.addListener(marker, "click", () => {
                infoWindow.open(map.current, marker);
            });

            markers.current.push({ marker, infoWindow, id: hospital.id });
        });

        // Adjust map bounds to fit all markers
        // if (hospitalList.length > 0) {
        //     const bounds = new window.naver.maps.LatLngBounds();
        //     hospitalList.forEach((hospital) => {
        //         bounds.extend(new window.naver.maps.LatLng(hospital.acf.latitude, hospital.acf.longitude));
        //     });
        //     map.current.fitBounds(bounds);
        // }
    };

    const handleInputChange = (value) => {
        setSearchTerm(value);

        const filtered = hospitals.filter(
            (hospital) =>
                hospital.title.rendered.toLowerCase().includes(value.toLowerCase()) ||
                (hospital.acf.address.toLowerCase() || "").includes(value.toLowerCase())
        );

        setFilteredHospitals(filtered);
        updateMarkers(filtered);
    };

    const handleListClick = (hospital) => {
        setSelectedHospitalId(hospital.id); // 클릭된 병원의 ID 저장
        if (!map.current) {
            console.error("Map is not initialized");
            return;
        }
    
        // 병원의 마커 객체 찾기
        const markerObj = markers.current.find((item) => item.id === hospital.id);
        if (markerObj) {
            const { marker, infoWindow } = markerObj;
    
            // 병원의 위치로 지도 중심 이동
            const position = marker.getPosition();
            if (position) {
                map.current.setCenter(position);
                // map.current.setZoom(17); // 확대 레벨 설정
            } else {
                console.error("Marker position is invalid");
            }
    
            // 병원 정보창 열기
            if (infoWindow) {
                infoWindow.open(map.current, marker);
            } else {
                console.error("InfoWindow not found for this marker");
            }
        } else {
            console.error("Marker not found for the selected hospital");
        }
    };

    return (
        <div className="app-container">
            <header className="header">
                <h1>리팟 병원 검색</h1>
                <input
                    type="text"
                    placeholder="지역 또는 병원명을 검색하세요"
                    value={searchTerm}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="search-input"
                />
            </header>
            <main className="main-content">
                <div ref={mapRef} className="map-container"></div>
                <aside className="hospital-list">
                    <h2>검색 결과</h2>
                    <ul>
                        {filteredHospitals.map((hospital) => (
                            <li key={hospital.id} className="hospital-item">
                                <h3
                                    onClick={() => handleListClick(hospital)}
                                    style={{
                                        cursor: "pointer",
                                        color: selectedHospitalId === hospital.id ? "#0056b3" : "#777777", // 선택된 병원은 빨간색
                                    }}
                                >
                                    {hospital.title.rendered}
                                </h3>
                                <p>{hospital.acf.address ? hospital.acf.address: "업데이트 예정"}</p>
                            </li>
                        ))}
                    </ul>
                </aside>
            </main>
            <footer className="footer">
                <p>© 2024 리팟 병원 검색 서비스</p>
            </footer>
        </div>
    );
};

export default App;
