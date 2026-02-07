import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapController({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, 15);
        }
    }, [center, map]);
    return null;
}

function DraggableMarker({ position, onPositionChange, onDragEnd }) {
    const markerRef = useRef(null);

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker) {
                const pos = marker.getLatLng();
                onPositionChange([pos.lat, pos.lng]);
                if (onDragEnd) {
                    onDragEnd(pos.lat, pos.lng);
                }
            }
        },
    };

    return (
        <Marker
            draggable
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
}

export default function LocationPickerModal({ open, onClose, onLocationSelected }) {
    const [position, setPosition] = useState([32.0853, 34.7818]); // Default: Tel Aviv
    const [cityName, setCityName] = useState('');
    const [street, setStreet] = useState('');
    const [fullAddress, setFullAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const searchTimeoutRef = useRef(null);

    // Get address details from coordinates
    const getAddressFromCoordinates = async (lat, lng) => {
        try {
            // ניסיון 1: Nominatim
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he&addressdetails=1&zoom=18`
            );
            const data = await response.json();

            let city = data.address?.city || data.address?.town || data.address?.village || '';
            let road = data.address?.road || '';
            let houseNumber = data.address?.house_number || '';

            // אם לא מצאנו מספר בית, נסה Photon
            if (!houseNumber) {
                try {
                    const photonResponse = await fetch(
                        `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=he`
                    );
                    const photonData = await photonResponse.json();

                    if (photonData.features?.[0]) {
                        const props = photonData.features[0].properties;
                        road = road || props.street || '';
                        houseNumber = houseNumber || props.housenumber || '';
                        city = city || props.city || '';
                    }
                } catch (photonErr) {
                    console.warn('Photon reverse geocoding failed:', photonErr);
                }
            }

            // Build full address
            let addressParts = [];
            if (road) {
                addressParts.push(houseNumber ? `${road} ${houseNumber}` : road);
            }
            if (city) {
                addressParts.push(city);
            }

            setCityName(city);
            setStreet(road);
            setFullAddress(addressParts.join(', '));
        } catch (err) {
            console.warn('Could not get address:', err);
        }
    };

    // Search for addresses with debounce
    const searchAddress = (query) => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!query || query.length < 2) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);

        // Debounce search for 300ms (מהיר יותר)
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                let allResults = [];

                // בדיקה אם יש מספר בשאילתה
                const hasNumber = /\d/.test(query);

                // ניסיון 1: Nominatim - חיפוש structured אם יש מספר
                if (hasNumber) {
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(query)}&country=Israel&countrycodes=il&accept-language=he&limit=15&addressdetails=1`
                        );
                        const data = await response.json();
                        allResults = [...allResults, ...data];
                    } catch (e) {
                        console.warn('Structured search failed:', e);
                    }
                }

                // ניסיון 2: Nominatim - חיפוש חופשי (תמיד)
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, Israel&countrycodes=il&accept-language=he&limit=15&addressdetails=1`
                    );
                    const data = await response.json();
                    allResults = [...allResults, ...data];
                } catch (e) {
                    console.warn('Free search failed:', e);
                }

                // ניסיון 3: Photon (גיבוי וחיפוש נוסף)
                try {
                    const photonResponse = await fetch(
                        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=he&limit=15`
                    );
                    const photonData = await photonResponse.json();

                    // המר פורמט Photon לפורמט Nominatim
                    const photonConverted = photonData.features?.map(f => ({
                        lat: f.geometry.coordinates[1],
                        lon: f.geometry.coordinates[0],
                        display_name: [
                            f.properties.name,
                            f.properties.street,
                            f.properties.housenumber,
                            f.properties.city
                        ].filter(Boolean).join(', '),
                        address: {
                            road: f.properties.street,
                            house_number: f.properties.housenumber,
                            city: f.properties.city,
                            town: f.properties.city,
                        }
                    })) || [];

                    allResults = [...allResults, ...photonConverted];
                } catch (e) {
                    console.warn('Photon search failed:', e);
                }

                // הסרת כפילויות (לפי lat/lon)
                const uniqueResults = allResults.filter((result, index, self) =>
                    index === self.findIndex(r =>
                        Math.abs(parseFloat(r.lat) - parseFloat(result.lat)) < 0.0001 &&
                        Math.abs(parseFloat(r.lon) - parseFloat(result.lon)) < 0.0001
                    )
                );

                // מיון: תוצאות עם מספר בית קודם
                uniqueResults.sort((a, b) => {
                    const aHasNumber = a.address?.house_number ? 1 : 0;
                    const bHasNumber = b.address?.house_number ? 1 : 0;
                    return bHasNumber - aHasNumber;
                });

                // הגבלה ל-20 תוצאות מובילות
                setSearchResults(uniqueResults.slice(0, 20));
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    };

    const selectSearchResult = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setPosition([lat, lng]);

        // חילוץ נתונים מדויקים
        const city = result.address?.city || result.address?.town || result.address?.village || '';
        const road = result.address?.road || '';
        const houseNumber = result.address?.house_number || '';

        // וידוא שלא נכנס עיר למקום רחוב
        // אם display_name זה רק עיר (ללא רחוב), לא נשים את העיר כרחוב
        const finalRoad = road || '';

        let addressParts = [];
        if (finalRoad) {
            addressParts.push(houseNumber ? `${finalRoad} ${houseNumber}` : finalRoad);
        }
        if (city) {
            addressParts.push(city);
        }

        setCityName(city);
        setStreet(finalRoad); // רק רחוב, לא עיר
        setFullAddress(addressParts.join(', '));
        setSearchQuery('');
        setSearchResults([]);
    };

    useEffect(() => {
        if (open) {
            // Try to load saved location
            try {
                const saved = localStorage.getItem('user_delivery_location');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.lat && parsed.lng) {
                        setPosition([parsed.lat, parsed.lng]);
                        setCityName(parsed.cityName || '');
                        setStreet(parsed.street || '');
                        setFullAddress(parsed.fullAddress || '');
                    }
                }
            } catch (e) {
                console.warn('Failed to parse saved location', e);
            }
        } else {
            // Reset search when modal closes
            setSearchQuery('');
            setSearchResults([]);
            setSearching(false);
        }

        // Cleanup timeout on unmount
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [open]);

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('הדפדפן לא תומך במיקום גיאוגרפי');
            return;
        }

        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const newPosition = [pos.coords.latitude, pos.coords.longitude];
                setPosition(newPosition);
                await getAddressFromCoordinates(pos.coords.latitude, pos.coords.longitude);
                setLoading(false);
            },
            (err) => {
                setError('לא ניתן לקבל מיקום. אנא אפשר גישה למיקום בהגדרות הדפדפן.');
                setLoading(false);
                console.error('Geolocation error:', err);
            }
        );
    };

    const handleConfirm = () => {
        // בדיקה אם יש מספר בית בכתובת
        const hasHouseNumber = /\d/.test(fullAddress);

        const locationData = {
            lat: position[0],
            lng: position[1],
            cityName: cityName || '',
            street: street || '',
            fullAddress: fullAddress || '',
            needsCompletion: !street || !cityName || !hasHouseNumber, // דגל שמסמן שצריך להשלים פרטים
        };

        // Save to localStorage
        localStorage.setItem('user_delivery_location', JSON.stringify(locationData));

        // Callback to parent
        if (onLocationSelected) {
            onLocationSelected(locationData);
        }

        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-brand-dark-surface rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-4 sm:p-6 border-b flex items-center justify-between sticky top-0 bg-white dark:bg-brand-dark-surface z-10">
                    <h2 className="text-lg sm:text-xl font-bold dark:text-brand-dark-text">📍 בחר מיקום למשלוח</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                        ✕
                    </button>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {/* שורת חיפוש */}
                    <div className="relative">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="🔍 חפש עיר, רחוב או כתובת מלאה..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    searchAddress(e.target.value);
                                }}
                                onBlur={() => {
                                    // Delay to allow clicking on results
                                    setTimeout(() => {
                                        setSearchResults([]);
                                    }, 200);
                                }}
                                className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-right transition-all dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text"
                            />
                            {searching && (
                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin h-5 w-5 border-2 border-brand-primary border-t-transparent rounded-full"></div>
                                </div>
                            )}
                            {searchQuery && !searching && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSearchResults([]);
                                    }}
                                    className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl font-bold transition-colors"
                                    type="button"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* תוצאות חיפוש */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl z-[9999] max-h-80 overflow-y-auto border-2 border-brand-primary/30 dark:bg-brand-dark-surface">
                                <div className="sticky top-0 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 px-4 py-2 border-b-2 border-orange-200 dark:border-brand-dark-border font-bold text-sm text-gray-700 dark:text-gray-300">
                                    נמצאו {searchResults.length} תוצאות
                                </div>
                                {searchResults.map((result, index) => {
                                    const hasHouseNumber = result.address?.house_number;

                                    return (
                                        <div
                                            key={index}
                                            onClick={() => selectSearchResult(result)}
                                            className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 cursor-pointer border-b last:border-b-0 text-right transition-all group"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`text-xl mt-0.5 group-hover:scale-110 transition-transform ${hasHouseNumber ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {hasHouseNumber ? '📍' : '📌'}
                                                </span>
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-gray-900 group-hover:text-brand-primary transition-colors">
                                                        {result.address?.road && result.address?.house_number
                                                            ? `${result.address.road} ${result.address.house_number}`
                                                            : result.address?.road || result.address?.neighbourhood || result.display_name || 'כתובת'}
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                                        <span>📌</span>
                                                        <span>
                                                            {result.address?.city || result.address?.town || result.address?.village || ''}
                                                            {result.address?.state ? `, ${result.address.state}` : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                            <div className="absolute top-full mt-2 w-full bg-white dark:bg-brand-dark-surface rounded-xl shadow-lg p-4 text-center text-gray-500 dark:text-gray-400 text-sm border border-gray-200 dark:border-brand-dark-border z-[9999]">
                                ❌ לא נמצאו תוצאות עבור "{searchQuery}"
                            </div>
                        )}
                    </div>

                    {fullAddress && (
                        <div className={`rounded-2xl overflow-hidden border-2 ${!street || !cityName ? 'border-yellow-400 dark:border-yellow-600' : 'border-brand-primary/40 dark:border-brand-primary/30'}`}>
                            <div className={`px-4 py-3 flex items-center gap-3 ${!street || !cityName ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gradient-to-l from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!street || !cityName ? 'bg-yellow-200 dark:bg-yellow-800/40' : 'bg-brand-primary/15 dark:bg-brand-primary/20'}`}>
                                    <span className="text-lg">{!street || !cityName ? '⚠️' : '📍'}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-gray-500 dark:text-brand-dark-muted mb-0.5">
                                        {!street || !cityName ? 'כתובת חלקית' : 'כתובת שזוהתה'}
                                    </div>
                                    <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-brand-dark-text break-words leading-snug">
                                        {fullAddress}
                                    </div>
                                </div>
                            </div>
                            {(!street || !cityName) && (
                                <div className="px-4 py-2.5 bg-yellow-100/60 dark:bg-yellow-900/10 border-t border-yellow-300 dark:border-yellow-700/40">
                                    <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-300">
                                        נדרשת כתובת מלאה עם רחוב ומספר בית. תתבקש להשלים את הפרטים בשלב הבא.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-center">
                                    <span className="text-sm">🗺️</span>
                                </div>
                                <label className="text-sm font-bold text-gray-800 dark:text-brand-dark-text">
                                    מיקום על המפה
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={handleGetCurrentLocation}
                                disabled={loading}
                                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-brand-primary text-white px-3 py-2 rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
                            >
                                {loading ? (
                                    <>
                                        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></span>
                                        <span>מאתר...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>📍</span>
                                        <span>המיקום שלי</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-brand-dark-border shadow-sm">
                            <MapContainer
                                center={position}
                                zoom={15}
                                className="h-64 sm:h-80 w-full"
                                scrollWheelZoom
                            >
                                <MapController center={position} />
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <DraggableMarker
                                    position={position}
                                    onPositionChange={setPosition}
                                    onDragEnd={getAddressFromCoordinates}
                                />
                            </MapContainer>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-brand-dark-muted text-center">
                            גרור את הסמן למיקום המדויק שלך — הכתובת תזוהה אוטומטית
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="w-full sm:flex-1 bg-brand-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-brand-dark transition"
                        >
                            ✓ אישור מיקום
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-300 dark:border-brand-dark-border hover:bg-gray-50 dark:text-brand-dark-text dark:hover:bg-brand-dark-border/50"
                        >
                            ביטול
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
