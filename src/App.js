import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import './styles.css';

const App = () => {
    const [hospitals, setHospitals] = useState([]);
    const [filteredHospitals, setFilteredHospitals] = useState([]);
    const [regions, setRegions] = useState([]); // 지역 리스트
    const [selectedRegion, setSelectedRegion] = useState(null); // 선택된 지역
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedHospitalId, setSelectedHospitalId] = useState(null);
    const mapRef = useRef(null);
    const map = useRef(null);
    const [currentPosition, setCurrentPosition] = useState(null);
    const markers = useRef([]);

    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                // 병원 데이터 가져오기
                const response = await axios.get("https://volnewmer.co.kr/wp-json/wp/v2/hospital/?per_page=100");
                const hospitalData = response.data;

                // POST 데이터에서 hospital_areas 정보 추출
                const uniqueRegions = Array.from(
                    hospitalData
                        .flatMap(hospital => hospital.hospital_areas || [])
                        .filter(area => area.is_parent) // is_parent가 true인 항목만
                        .reduce((map, area) => map.set(area.id, area), new Map()) // 고유 ID를 기준으로 중복 제거
                        .values() // 고유 지역 값 추출
                );

                setRegions(uniqueRegions);
                setHospitals(hospitalData);
                setFilteredHospitals(hospitalData);
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
            map.current = new window.naver.maps.Map(mapRef.current, {
                center: new window.naver.maps.LatLng(currentPosition.lat, currentPosition.lng),
                zoom:16,
            });

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
        markers.current.forEach(({ marker }) => {
            if (marker instanceof window.naver.maps.Marker) {
                marker.setMap(null);
            }
        });
        markers.current = [];
        const bounds = new window.naver.maps.LatLngBounds();

        hospitalList.forEach((hospital) => {
            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(hospital.acf.latitude, hospital.acf.longitude),
                map: map.current,
                title: hospital.title.rendered,
            });
            const infoWindow = new window.naver.maps.InfoWindow({
                content: `<div style="padding:10px;">
                    <h4><a href="${hospital.acf.link || "javascript:void(0)"}" target="_blank">${hospital.title.rendered}</a></h4>
                    <p>${hospital.acf.address || "업데이트 예정"}</p>
                </div>`,
            });

            window.naver.maps.Event.addListener(marker, "click", () => {
                infoWindow.open(map.current, marker);
            });

            markers.current.push({ marker, infoWindow, id: hospital.id });
            bounds.extend(marker.getPosition());
        });
        // 지도 중심 및 줌 조정
        if (!hospitalList.length) {
            console.warn("병원 리스트가 비어 있습니다.");
        } else {
            map.current.fitBounds(bounds); // 마커 범위에 맞게 지도 조정
            map.current.setZoom(14); // 줌 레벨 14로 설정
        }        
    };

    const handleRegionFilter = (regionId) => {
        setSelectedRegion(regionId);

        const filtered = hospitals.filter(hospital =>
            (hospital.hospital_areas || []).some(area => area.id === regionId)
        );

        setFilteredHospitals(filtered);
        updateMarkers(filtered);
    };

    const handleInputChange = (value) => {
        setSearchTerm(value);

        const filtered = hospitals.filter(
            hospital =>
                hospital.title.rendered.toLowerCase().includes(value.toLowerCase()) ||
                (hospital.acf.address || "").toLowerCase().includes(value.toLowerCase())
        );

        setFilteredHospitals(filtered);
        updateMarkers(filtered);
    };

    const handleListClick = (hospital) => {
        setSelectedHospitalId(hospital.id); // 클릭된 병원의 ID 저장

        // 지도 중심 이동 (선택)
        if (map.current) {
            map.current.setCenter(new window.naver.maps.LatLng(hospital.acf.latitude, hospital.acf.longitude));
            map.current.setZoom(17);
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
                <div className="region-buttons">
                    {regions.map(region => (
                        <button
                            key={region.id}
                            onClick={() => handleRegionFilter(region.id)}
                            className={selectedRegion === region.id ? "active-region-button" : "region-button"}
                        >
                            {region.name}
                        </button>
                    ))}
                </div>
            </header>
            <main className="main-content">
                <div ref={mapRef} className="map-container"></div>
                <aside className="hospital-list">
                    <h2>검색 결과</h2>
                    <ul>
                        {filteredHospitals.map(hospital => (
                            <li key={hospital.id} className="hospital-item">
                                <h3
                                    onClick={() => {
                                        const marker = markers.current.find(m => m.id === hospital.id);
                                        if (marker) {
                                            handleListClick(hospital);
                                            map.current.setCenter(marker.marker.getPosition());
                                            marker.infoWindow.open(map.current, marker.marker);
                                        }
                                    }}
                                    style={{
                                        cursor: "pointer",
                                        color: selectedHospitalId === hospital.id ? "#0056b3" : "#777777",
                                    }}
                                >
                                    {hospital.title.rendered}
                                </h3>
                                <p>{hospital.acf.address || "업데이트 예정"}</p>
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
