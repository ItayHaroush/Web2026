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
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`
            );
            const data = await response.json();

            const city = data.address?.city || data.address?.town || data.address?.village || '';
            const road = data.address?.road || '';
            const houseNumber = data.address?.house_number || '';

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

        if (!query || query.length < 3) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);

        // Debounce search for 500ms
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, Israel&accept-language=he&limit=5&addressdetails=1`
                );
                const data = await response.json();
                setSearchResults(data);
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 500);
    };

    const selectSearchResult = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setPosition([lat, lng]);

        const city = result.address?.city || result.address?.town || result.address?.village || '';
        const road = result.address?.road || '';
        const houseNumber = result.address?.house_number || '';

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
        const locationData = {
            lat: position[0],
            lng: position[1],
            cityName: cityName || '',
            street: street || '',
            fullAddress: fullAddress || '',
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
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-4 sm:p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-lg sm:text-xl font-bold">📍 בחר מיקום למשלוח</h2>
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
                                className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-right transition-all"
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
                            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-2xl z-[9999] max-h-64 overflow-y-auto border-2 border-gray-100">
                                {searchResults.map((result, index) => (
                                    <div
                                        key={index}
                                        onClick={() => selectSearchResult(result)}
                                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-right transition-all group"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl mt-0.5 group-hover:scale-110 transition-transform">📍</span>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-gray-900 group-hover:text-brand-primary transition-colors">
                                                    {result.address?.road && result.address?.house_number
                                                        ? `${result.address.road} ${result.address.house_number}`
                                                        : result.address?.road || result.address?.neighbourhood || 'כתובת'}
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
                                ))}
                            </div>
                        )}

                        {searchQuery.length >= 3 && searchResults.length === 0 && !searching && (
                            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-lg p-4 text-center text-gray-500 text-sm border border-gray-200 z-[9999]">
                                ❌ לא נמצאו תוצאות עבור "{searchQuery}"
                            </div>
                        )}
                    </div>

                    {fullAddress && (
                        <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-xl">
                            <div className="text-xs sm:text-sm font-medium text-gray-700 mb-1">כתובת שזוהתה:</div>
                            <div className="text-base sm:text-lg font-bold text-gray-900 break-words">{fullAddress}</div>
                        </div>
                    )}

                    <div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                מיקום על המפה
                            </label>
                            <button
                                type="button"
                                onClick={handleGetCurrentLocation}
                                disabled={loading}
                                className="text-xs sm:text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                            >
                                {loading ? '⏳ מאתר...' : '📍 המיקום הנוכחי שלי'}
                            </button>
                        </div>

                        <div className="border rounded-xl overflow-hidden">
                            <MapContainer
                                center={position}
                                zoom={15}
                                className="h-64 sm:h-96 w-full"
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

                        <p className="text-xs text-gray-500 mt-2">
                            💡 גרור את הסמן למיקום המדויק שלך - הכתובת תזוהה אוטומטית
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
                            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-50"
                        >
                            ביטול
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
