import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const normalizeBounds = (bounds) => {
    if (!bounds) return null;
    const { _southWest, _northEast } = bounds;
    if (!_southWest || !_northEast) return null;

    return [
        { lat: _southWest.lat, lng: _southWest.lng },
        { lat: _southWest.lat, lng: _northEast.lng },
        { lat: _northEast.lat, lng: _northEast.lng },
        { lat: _northEast.lat, lng: _southWest.lng },
    ];
};

function MapController({ onMapReady }) {
    const map = useMap();
    useEffect(() => {
        onMapReady(map);
    }, [map, onMapReady]);
    return null;
}

export default function DeliveryZoneMap({ center, polygon, onPolygonChange, selectedCity }) {
    const mapRef = useRef(null);
    const featureGroupRef = useRef(null);
    const cityMarkerRef = useRef(null);
    const drawHandlerRef = useRef(null);
    const [mapCenter, setMapCenter] = useState(center);
    const lastCityIdRef = useRef(null);

    useEffect(() => {
        setMapCenter(center);
    }, [center]);

    useEffect(() => {
        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const nextCenter = [lat, lng];
                setMapCenter(nextCenter);
                if (mapRef.current) {
                    mapRef.current.setView(nextCenter, mapRef.current.getZoom() || 13);
                }
            },
            () => {
                // ignore location errors
            }
        );
    }, []);

    // הצגת מעגל כחול כשבוחרים עיר
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const cityId = selectedCity?.id;
        const cityLat = selectedCity?.latitude;
        const cityLng = selectedCity?.longitude;

        console.log('selectedCity changed:', { cityId, cityLat, cityLng, hasMarker: !!cityMarkerRef.current });

        // Remove existing city marker
        if (cityMarkerRef.current && map.hasLayer(cityMarkerRef.current)) {
            map.removeLayer(cityMarkerRef.current);
            cityMarkerRef.current = null;
        }

        // Add city marker if city is selected
        if (cityId && cityLat && cityLng) {
            const cityLatLng = [cityLat, cityLng];

            console.log('✅ Creating city circle at:', cityLatLng);

            // Create circle marker for city
            const circle = L.circle(cityLatLng, {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.2,
                radius: 5000, // 5km radius
                weight: 2
            });

            circle.addTo(map);
            cityMarkerRef.current = circle;
            lastCityIdRef.current = cityId;

            // Center map on city
            map.setView(cityLatLng, 13);
            setMapCenter(cityLatLng);
        } else {
            lastCityIdRef.current = null;
        }

        // Cleanup only runs when component unmounts
    }, [selectedCity?.id, selectedCity?.latitude, selectedCity?.longitude]);

    // יצירת featureGroup חד פעמית - פשוט ונקי
    useEffect(() => {
        const map = mapRef.current;
        if (!map || featureGroupRef.current) return;

        // יוצר featureGroup רק פעם אחת
        featureGroupRef.current = new L.FeatureGroup();
        map.addLayer(featureGroupRef.current);
        console.log('✅ featureGroup נוצר');
    }, []);

    // ציור polygon קיים על המפה
    useEffect(() => {
        const group = featureGroupRef.current;
        if (!group) {
            console.log('❌ featureGroup לא קיים עדיין');
            return;
        }

        console.log('🖼️ ציור polygon:', polygon);

        // אם כבר יש layer קיים (מציור ידני) - לא נגע בו
        const existingLayers = group.getLayers();
        if (existingLayers.length > 0 && Array.isArray(polygon) && polygon.length === 4) {
            // בדוק אם ה-layer הקיים תואם לפוליגון הנוכחי
            const existingLayer = existingLayers[0];
            if (existingLayer?.getBounds) {
                const existingBounds = existingLayer.getBounds();
                const matchesCurrent =
                    Math.abs(existingBounds.getSouthWest().lat - polygon[0].lat) < 0.0001 &&
                    Math.abs(existingBounds.getSouthWest().lng - polygon[0].lng) < 0.0001 &&
                    Math.abs(existingBounds.getNorthEast().lat - polygon[2].lat) < 0.0001 &&
                    Math.abs(existingBounds.getNorthEast().lng - polygon[2].lng) < 0.0001;

                if (matchesCurrent) {
                    console.log('✅ polygon כבר קיים על המפה - לא נוגע');
                    return; // הפוליגון כבר על המפה, לא צריך לצייר מחדש
                }
            }
        }

        // אחרת, נקה וצייר מחדש
        group.clearLayers();

        if (Array.isArray(polygon) && polygon.length === 4) {
            const bounds = [
                [polygon[0].lat, polygon[0].lng],
                [polygon[2].lat, polygon[2].lng]
            ];
            const rect = L.rectangle(bounds, {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.3,
                weight: 2
            });
            group.addLayer(rect);
            console.log('✅ polygon נוצר על המפה');
        } else if (polygon && polygon.length > 0) {
            console.log('⚠️ polygon לא תקין (צריך 4 נקודות):', polygon);
        }
    }, [polygon]);

    const handleDrawRectangle = () => {
        const map = mapRef.current;
        if (!map) {
            console.error('❌ Map לא קיים');
            return;
        }

        // וודא ש-featureGroup קיים
        if (!featureGroupRef.current) {
            console.log('🔧 יוצר featureGroup עכשיו...');
            featureGroupRef.current = new L.FeatureGroup();
            map.addLayer(featureGroupRef.current);
        }

        // Disable any existing draw handler
        if (drawHandlerRef.current) {
            try {
                drawHandlerRef.current.disable();
            } catch (e) {
                console.warn('Failed to disable draw handler:', e);
            }
            drawHandlerRef.current = null;
        }

        // יצירת handler לציור ידני עם אירועי עכבר
        let startLatLng = null;
        let tempRect = null;

        const onMouseDown = (e) => {
            startLatLng = e.latlng;
            map.dragging.disable();

            // יצירת מלבן זמני
            tempRect = L.rectangle([startLatLng, startLatLng], {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.3,
                weight: 2,
                dashArray: '5, 5'
            }).addTo(map);
            console.log('🖱️ התחלת ציור');
        };

        const onMouseMove = (e) => {
            if (startLatLng && tempRect) {
                const bounds = L.latLngBounds(startLatLng, e.latlng);
                tempRect.setBounds(bounds);
            }
        };

        const onMouseUp = (e) => {
            if (startLatLng && tempRect) {
                const endLatLng = e.latlng;
                const bounds = L.latLngBounds(startLatLng, endLatLng);

                console.log('🏁 סיום ציור, bounds:', bounds);

                // הסר מלבן זמני
                map.removeLayer(tempRect);

                // יצירת מלבן קבוע
                const finalRect = L.rectangle(bounds, {
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.3,
                    weight: 2
                });

                // וודא שה-featureGroup עדיין קיים
                if (featureGroupRef.current) {
                    console.log('🧹 מנקה layers קודמים...');
                    featureGroupRef.current.clearLayers();
                    console.log('➕ מוסיף מלבן חדש...');
                    featureGroupRef.current.addLayer(finalRect);
                } else {
                    console.error('❌ featureGroup נעלם!');
                    // יצירה מחדש אם נעלם
                    featureGroupRef.current = new L.FeatureGroup();
                    map.addLayer(featureGroupRef.current);
                    featureGroupRef.current.addLayer(finalRect);
                }

                // המר ל-polygon
                const nextPolygon = normalizeBounds(bounds);
                if (nextPolygon) {
                    console.log('📐 פוליגון שנוצר:', nextPolygon);
                    onPolygonChange(nextPolygon);
                }

                // נקה event listeners
                map.off('mousedown', onMouseDown);
                map.off('mousemove', onMouseMove);
                map.off('mouseup', onMouseUp);
                map.dragging.enable();

                console.log('✅ ציור הושלם בהצלחה!');
            }
        };

        // הוסף event listeners
        map.on('mousedown', onMouseDown);
        map.on('mousemove', onMouseMove);
        map.on('mouseup', onMouseUp);

        console.log('✏️ מצב ציור הופעל - לחץ וגרור על המפה');
    };

    const handleClear = () => {
        onPolygonChange([]);
    };

    return (
        <MapContainer
            center={mapCenter}
            zoom={13}
            className="h-64 sm:h-72 w-full rounded-xl overflow-hidden"
            scrollWheelZoom
        >
            <MapController onMapReady={(map) => { mapRef.current = map; }} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <div className="leaflet-top leaflet-left">
                <div className="leaflet-control flex flex-col gap-1.5 sm:gap-2 bg-white/90 p-1.5 sm:p-2 rounded-lg shadow">
                    <button
                        type="button"
                        onClick={handleDrawRectangle}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-brand-primary text-white rounded hover:bg-brand-primary/90 whitespace-nowrap"
                    >
                        סמן אזור
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                        נקה
                    </button>
                </div>
            </div>
        </MapContainer>
    );
}
