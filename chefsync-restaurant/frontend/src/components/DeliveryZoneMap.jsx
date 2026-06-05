import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import leafletImage from 'leaflet-image';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const normalizeLatLngs = (latLngs) => {
    if (!Array.isArray(latLngs)) return [];
    return latLngs.map((point) => ({ lat: point.lat, lng: point.lng }));
};

const circleToPolygon = (center, radiusMeters, points = 48) => {
    if (!center || !radiusMeters) return [];

    const lat = center.lat;
    const lng = center.lng;
    const earthRadius = 6371000;
    const angularDistance = radiusMeters / earthRadius;
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;

    const polygon = [];

    for (let i = 0; i < points; i += 1) {
        const bearing = (2 * Math.PI * i) / points;

        const pointLat = Math.asin(
            Math.sin(latRad) * Math.cos(angularDistance) +
            Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
        );

        const pointLng =
            lngRad +
            Math.atan2(
                Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
                Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat)
            );

        polygon.push({
            lat: (pointLat * 180) / Math.PI,
            lng: (pointLng * 180) / Math.PI,
        });
    }

    return polygon;
};

function MapController({ onMapReady }) {
    const map = useMap();
    useEffect(() => {
        onMapReady(map);
    }, [map, onMapReady]);
    return null;
}

export default function DeliveryZoneMap({ center, polygon, onPolygonChange, selectedCity, cityRadius, onRadiusChange, onMapCaptured, onStartMapDraw, onClearSelection }) {
    const mapRef = useRef(null);
    const featureGroupRef = useRef(null);
    const cityMarkerRef = useRef(null);
    const drawHandlerRef = useRef(null);
    const canvasRendererRef = useRef(null);
    const drawControlReadyRef = useRef(false);
    const rectStartRef = useRef(null);
    const polygonPointsRef = useRef([]);
    const tempLayerRef = useRef(null);
    const [mapCenter, setMapCenter] = useState(center);
    const lastCityIdRef = useRef(null);
    const [localRadius, setLocalRadius] = useState(cityRadius || 5);
    const [drawMode, setDrawMode] = useState('none');
    const [mapReady, setMapReady] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    // מספר גרסה של מופע המפה — מתעדכן כשה-MapContainer נבנה מחדש (מעבר למסך מלא)
    const [mapVersion, setMapVersion] = useState(0);

    useEffect(() => {
        setMapCenter(center);
    }, [center]);

    useEffect(() => {
        if (cityRadius) {
            setLocalRadius(cityRadius);
        }
    }, [cityRadius]);

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

            // Create canvas renderer if not exists
            if (!canvasRendererRef.current) {
                canvasRendererRef.current = L.canvas({ padding: 0.5 });
            }

            // Create circle marker for city
            const radiusInMeters = localRadius * 1000; // המרה מק"מ למטרים - חישוב מדויק 1:1
            const circle = L.circle(cityLatLng, {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.2,
                radius: radiusInMeters,
                weight: 2,
                renderer: canvasRendererRef.current
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
    }, [selectedCity?.id, selectedCity?.latitude, selectedCity?.longitude, localRadius, mapVersion]);
    const handleRadiusChange = (newRadius) => {
        setLocalRadius(newRadius);
        if (onRadiusChange) {
            onRadiusChange(newRadius);
        }
    };
    // יצירת featureGroup חד פעמית + listener של leaflet-draw
    // חשוב: רושמים את ה-listener רק כשהמפה מוכנה (mapReady), אחרת mapRef.current עדיין null
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;

        if (!featureGroupRef.current) {
            featureGroupRef.current = new L.FeatureGroup();
            map.addLayer(featureGroupRef.current);
        }

        const handleDrawCreated = (event) => {
            const group = featureGroupRef.current;
            if (!group) return;

            const { layerType, layer } = event;
            group.clearLayers();
            group.addLayer(layer);

            // הציור הסתיים — מאפסים את מצב הציור הפעיל
            drawHandlerRef.current = null;
            setDrawMode('none');

            // מלבן הוא בעצם פוליגון ב-leaflet — קוראים את הנקודות ישירות (יציב יותר מ-getBounds)
            if (layerType === 'rectangle' || layerType === 'polygon') {
                const latLngs = layer.getLatLngs();
                const points = Array.isArray(latLngs) ? latLngs[0] : [];
                onPolygonChange(normalizeLatLngs(points));
                return;
            }

            if (layerType === 'circle') {
                const centerPoint = layer.getLatLng();
                const radiusMeters = layer.getRadius();
                onPolygonChange(circleToPolygon(centerPoint, radiusMeters));
            }
        };

        map.on(L.Draw.Event.CREATED, handleDrawCreated);
        drawControlReadyRef.current = true;

        return () => {
            map.off(L.Draw.Event.CREATED, handleDrawCreated);
        };
    }, [mapReady, mapVersion, onPolygonChange]);

    // ציור polygon קיים על המפה
    useEffect(() => {
        const group = featureGroupRef.current;
        if (!group) {
            console.log('❌ featureGroup לא קיים עדיין');
            return;
        }

        console.log('🖼️ ציור polygon:', polygon);

        // נקה וצייר מחדש
        group.clearLayers();

        if (Array.isArray(polygon) && polygon.length >= 3) {
            // Create canvas renderer if not exists
            if (!canvasRendererRef.current) {
                canvasRendererRef.current = L.canvas({ padding: 0.5 });
            }

            const layer = L.polygon(
                polygon.map((point) => [point.lat, point.lng]),
                {
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.3,
                    weight: 2,
                    renderer: canvasRendererRef.current
                }
            );
            group.addLayer(layer);
            console.log('✅ polygon נוצר על המפה');
        } else if (polygon && polygon.length > 0) {
            console.log('⚠️ polygon לא תקין (צריך לפחות 3 נקודות):', polygon);
        }
    }, [polygon, mapVersion]);

    const startDraw = (mode) => {
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

        // איפוס מלא בעת מעבר בין מצבי ציור — מנקה ציור קודם ומאפס פוליגון
        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }
        onPolygonChange([]);

        const drawCommonOptions = {
            shapeOptions: {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.3,
                weight: 2,
            },
        };

        if (mode === 'circle') {
            drawHandlerRef.current = new L.Draw.Circle(map, drawCommonOptions);
        }

        if (drawHandlerRef.current) {
            drawHandlerRef.current.enable();
            if (onStartMapDraw) {
                onStartMapDraw();
            }
            setDrawMode(mode);
        }
    };

    // מלבן — מימוש ידני יציב (leaflet-draw Rectangle שבור ב-Leaflet 1.8+).
    // לחיצה ראשונה = פינה אחת, לחיצה שנייה = הפינה הנגדית.
    const startRectangle = () => {
        const map = mapRef.current;
        if (!map) return;

        if (drawHandlerRef.current) {
            try {
                drawHandlerRef.current.disable();
            } catch (e) {
                console.warn('Failed to disable draw handler:', e);
            }
            drawHandlerRef.current = null;
        }

        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }
        onPolygonChange([]);
        rectStartRef.current = null;
        setDrawMode('rectangle');
        if (onStartMapDraw) {
            onStartMapDraw();
        }
    };

    // מאזין ללחיצות המפה כשמצב הציור הוא 'rectangle'
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || drawMode !== 'rectangle') return;

        const handleRectClick = (e) => {
            if (!rectStartRef.current) {
                rectStartRef.current = e.latlng;
                return;
            }

            const a = rectStartRef.current;
            const b = e.latlng;
            const rectPolygon = [
                { lat: a.lat, lng: a.lng },
                { lat: a.lat, lng: b.lng },
                { lat: b.lat, lng: b.lng },
                { lat: b.lat, lng: a.lng },
            ];
            rectStartRef.current = null;
            setDrawMode('none');
            onPolygonChange(rectPolygon);
        };

        map.on('click', handleRectClick);
        return () => {
            map.off('click', handleRectClick);
        };
    }, [drawMode, mapReady, onPolygonChange]);

    // מנקה את שכבת התצוגה הזמנית של הפוליגון בעת הציור
    const clearTempLayer = () => {
        const map = mapRef.current;
        if (tempLayerRef.current && map) {
            map.removeLayer(tempLayerRef.current);
        }
        tempLayerRef.current = null;
        polygonPointsRef.current = [];
    };

    // מצייר מחדש את הנקודות והקו המחבר בזמן ציור אזור מותאם
    const renderTempPolygon = () => {
        const map = mapRef.current;
        if (!map) return;

        if (!tempLayerRef.current) {
            tempLayerRef.current = L.layerGroup().addTo(map);
        }
        tempLayerRef.current.clearLayers();

        const pts = polygonPointsRef.current;
        if (pts.length >= 2) {
            L.polyline(pts, { color: '#3b82f6', weight: 2, dashArray: '4 4' }).addTo(tempLayerRef.current);
        }
        pts.forEach((p, index) => {
            const isFirst = index === 0;
            L.circleMarker(p, {
                radius: isFirst ? 7 : 5,
                color: isFirst ? '#16a34a' : '#1d4ed8',
                fillColor: isFirst ? '#22c55e' : '#3b82f6',
                fillOpacity: 1,
                weight: 2,
            }).addTo(tempLayerRef.current);
        });
    };

    // אזור מותאם — מימוש ידני: כל לחיצה מוסיפה נקודה, "סיום ציור" סוגר
    const startPolygon = () => {
        const map = mapRef.current;
        if (!map) return;

        if (drawHandlerRef.current) {
            try {
                drawHandlerRef.current.disable();
            } catch (e) {
                console.warn('Failed to disable draw handler:', e);
            }
            drawHandlerRef.current = null;
        }

        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }
        onPolygonChange([]);
        clearTempLayer();
        rectStartRef.current = null;
        // מבטלים זום בדאבל-קליק כדי שלחיצה כפולה לא תוסיף נקודה לא רצויה
        if (map.doubleClickZoom) {
            map.doubleClickZoom.disable();
        }
        setDrawMode('polygon');
        if (onStartMapDraw) {
            onStartMapDraw();
        }
    };

    // מאזין ללחיצות המפה כשמצב הציור הוא 'polygon'
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || drawMode !== 'polygon') return;

        const handlePolyClick = (e) => {
            const pts = polygonPointsRef.current;
            // לחיצה על הנקודה הראשונה (כשיש לפחות 3) — סוגרת את הפוליגון
            if (pts.length >= 3) {
                const first = map.latLngToContainerPoint(pts[0]);
                const curr = map.latLngToContainerPoint(e.latlng);
                if (first.distanceTo(curr) < 14) {
                    finishDrawing();
                    return;
                }
            }
            // דילוג על לחיצה כפולה/צמודה מדי לנקודה הקודמת (מונע נקודה כפולה)
            if (pts.length > 0) {
                const prev = map.latLngToContainerPoint(pts[pts.length - 1]);
                const curr = map.latLngToContainerPoint(e.latlng);
                if (prev.distanceTo(curr) < 10) {
                    return;
                }
            }
            polygonPointsRef.current = [...pts, e.latlng];
            renderTempPolygon();
        };

        map.on('click', handlePolyClick);
        return () => {
            map.off('click', handlePolyClick);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawMode, mapReady]);

    const handleClear = () => {
        if (drawHandlerRef.current) {
            try {
                drawHandlerRef.current.disable();
            } catch {
                // ignore
            }
            drawHandlerRef.current = null;
        }

        if (featureGroupRef.current) {
            featureGroupRef.current.clearLayers();
        }

        clearTempLayer();
        rectStartRef.current = null;
        if (mapRef.current && mapRef.current.doubleClickZoom) {
            mapRef.current.doubleClickZoom.enable();
        }
        setDrawMode('none');

        if (onClearSelection) {
            onClearSelection();
            return;
        }

        onPolygonChange([]);
    };

    // סיום ציור אזור מותאם — סוגר את הצורה ושומר את הנקודות
    const finishDrawing = () => {
        const map = mapRef.current;
        const pts = polygonPointsRef.current;
        if (!Array.isArray(pts) || pts.length < 3) {
            alert('יש לסמן לפחות 3 נקודות');
            return;
        }
        const polygonPoints = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
        clearTempLayer();
        if (map && map.doubleClickZoom) {
            map.doubleClickZoom.enable();
        }
        setDrawMode('none');
        onPolygonChange(polygonPoints);
    };

    // Capture map as image
    const captureMapImage = useCallback(() => {
        const map = mapRef.current;
        // אם המפה לא קיימת או נהרסה (אין panes) — לא לוכדים תמונה במקום לקרוס
        if (!map || !map._panes || !map._panes.overlayPane) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            // המתן קצת כדי שכל השכבות יעובדו ויצוירו
            setTimeout(() => {
                // ודא שהמפה עדיין תקפה אחרי ההמתנה
                if (!mapRef.current || !mapRef.current._panes || !mapRef.current._panes.overlayPane) {
                    resolve(null);
                    return;
                }
                const liveMap = mapRef.current;
                // כפה רענון של המפה
                liveMap.invalidateSize();

                // המתן עוד רגע קצר לאחר הרענון
                setTimeout(() => {
                    if (!mapRef.current || !mapRef.current._panes || !mapRef.current._panes.overlayPane) {
                        resolve(null);
                        return;
                    }
                    try {
                        leafletImage(mapRef.current, (err, canvas) => {
                            if (err) {
                                console.error('Map capture error:', err);
                                resolve(null);
                                return;
                            }

                            // Convert to base64
                            const base64Image = canvas.toDataURL('image/jpeg', 0.8);
                            console.log('✅ Map captured successfully with all layers');
                            resolve(base64Image);
                        });
                    } catch (e) {
                        console.error('Map capture threw:', e);
                        resolve(null);
                    }
                }, 100);
            }, 100);
        });
    }, []);

    // Expose function to parent via callback
    useEffect(() => {
        if (onMapCaptured) {
            onMapCaptured(captureMapImage);
        }
    }, [captureMapImage, onMapCaptured]);

    // מאתחל מחדש כשה-MapContainer נבנה מחדש (למשל במעבר למסך מלא דרך Portal)
    const handleMapReady = useCallback((map) => {
        mapRef.current = map;
        // איפוס הפניות שקשורות ל-map הישן כדי שייוצרו מחדש על ה-map החדש
        featureGroupRef.current = null;
        cityMarkerRef.current = null;
        canvasRendererRef.current = null;
        drawControlReadyRef.current = false;
        setMapReady(true);
        setMapVersion((v) => v + 1);
    }, []);

    // מעבר בין תצוגה רגילה למסך מלא — מרענן את גודל המפה אחרי השינוי
    const toggleFullscreen = () => {
        setIsFullscreen((prev) => !prev);
        setTimeout(() => {
            if (mapRef.current) {
                mapRef.current.invalidateSize();
            }
        }, 150);
    };

    const mapElement = (
        <MapContainer
            center={mapCenter}
            zoom={13}
            className={isFullscreen ? 'flex-1 w-full rounded-xl overflow-hidden' : 'h-64 sm:h-72 w-full rounded-xl overflow-hidden'}
            scrollWheelZoom
        >
            <MapController onMapReady={handleMapReady} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <div className="leaflet-top leaflet-left">
                <div className="leaflet-control flex flex-col gap-1.5 sm:gap-2 bg-white/90 p-1.5 sm:p-2 rounded-lg shadow">
                    <button
                        type="button"
                        onClick={startRectangle}
                        className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded whitespace-nowrap ${drawMode === 'rectangle' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        מלבן
                    </button>
                    <button
                        type="button"
                        onClick={() => startDraw('circle')}
                        className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded whitespace-nowrap ${drawMode === 'circle' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        עיגול
                    </button>
                    <button
                        type="button"
                        onClick={startPolygon}
                        className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded whitespace-nowrap ${drawMode === 'polygon' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        אזור מותאם
                    </button>
                    {drawMode === 'polygon' && (
                        <button
                            type="button"
                            onClick={finishDrawing}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded whitespace-nowrap bg-green-600 text-white hover:bg-green-700"
                        >
                            סיום ציור
                        </button>
                    )}
                    {drawMode === 'rectangle' && (
                        <div className="px-2 py-1 text-[11px] sm:text-xs text-gray-700 bg-yellow-50 rounded whitespace-nowrap text-center">
                            לחץ שתי פינות נגדיות
                        </div>
                    )}
                    {drawMode === 'polygon' && (
                        <div className="px-2 py-1 text-[11px] sm:text-xs text-gray-700 bg-yellow-50 rounded whitespace-nowrap text-center">
                            לחץ נקודות, סגור על הנקודה הירוקה
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                        נקה
                    </button>
                    {selectedCity && (
                        <div className="mt-2 px-2 py-2 bg-white rounded text-xs">
                            <label className="block text-gray-700 font-medium mb-1">רדיוס מעגל (ק״מ)</label>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                step="0.5"
                                value={localRadius}
                                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                                className="w-full"
                            />
                            <div className="text-center font-bold text-brand-primary mt-1">
                                {localRadius} ק״מ
                            </div>
                            <div className="text-xs text-gray-500 text-center mt-1">
                                רדיוס מדויק: {(localRadius * 1000).toFixed(0)} מטר
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="leaflet-top leaflet-right">
                <div className="leaflet-control">
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg whitespace-nowrap bg-white/90 text-gray-700 hover:bg-white shadow font-medium"
                    >
                        {isFullscreen ? '✕ סגור מסך מלא' : '⛶ מסך מלא'}
                    </button>
                </div>
            </div>
        </MapContainer>
    );

    if (isFullscreen) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] bg-white p-2 sm:p-4 flex flex-col">
                {mapElement}
            </div>,
            document.body
        );
    }

    return <div className="relative">{mapElement}</div>;
}
