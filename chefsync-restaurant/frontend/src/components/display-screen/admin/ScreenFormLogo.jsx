import { FaCrown, FaToggleOn, FaToggleOff } from 'react-icons/fa';

const POSITIONS = [
    { id: 'top-right', label: 'ימין למעלה' },
    { id: 'top-left', label: 'שמאל למעלה' },
    { id: 'bottom-right', label: 'ימין למטה' },
    { id: 'bottom-left', label: 'שמאל למטה' },
    { id: 'center', label: 'מרכז למעלה' },
];

const SIZES = [
    { id: 'sm', label: 'קטן' },
    { id: 'md', label: 'בינוני' },
    { id: 'lg', label: 'גדול' },
];

export default function ScreenFormLogo({ form, setForm, tier }) {
    const overlay = form.design_options?.logo_overlay || {};

    const updateOverlay = (updates) => {
        setForm({
            ...form,
            design_options: {
                ...(form.design_options || {}),
                logo_overlay: {
                    ...overlay,
                    ...updates,
                },
            },
        });
    };

    const toggleEnabled = () => {
        updateOverlay({
            enabled: !overlay.enabled,
            position: overlay.position || 'top-right',
            size: overlay.size || 'md',
            opacity: overlay.opacity || 8,
        });
    };

    const allowedPositions = tier === 'pro' ? POSITIONS : POSITIONS.filter(p => ['top-right', 'top-left'].includes(p.id));

    return (
        <div className="space-y-4 bg-indigo-50/50 rounded-[2rem] p-6 border border-indigo-100">
            <div className="flex items-center justify-between">
                <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                    <FaCrown className="text-purple-500" /> לוגו שכבת-על
                </label>
                <button
                    type="button"
                    onClick={toggleEnabled}
                    className={`p-2 rounded-xl transition-all ${overlay.enabled
                            ? 'text-indigo-600 bg-indigo-100'
                            : 'text-gray-400 bg-gray-100'
                        }`}
                >
                    {overlay.enabled ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                </button>
            </div>

            {overlay.enabled && (
                <div className="space-y-4 mt-2">
                    {/* Position */}
                    <div>
                        <label className="text-xs font-black text-gray-500 mb-2 block">מיקום</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {allowedPositions.map(pos => (
                                <button
                                    key={pos.id}
                                    type="button"
                                    onClick={() => updateOverlay({ position: pos.id })}
                                    className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${overlay.position === pos.id
                                            ? 'bg-indigo-50 border-indigo-400 text-indigo-600'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    {pos.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Size (Pro only) */}
                    {tier === 'pro' && (
                        <div>
                            <label className="text-xs font-black text-gray-500 mb-2 block">גודל</label>
                            <div className="grid grid-cols-3 gap-2">
                                {SIZES.map(size => (
                                    <button
                                        key={size.id}
                                        type="button"
                                        onClick={() => updateOverlay({ size: size.id })}
                                        className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${(overlay.size || 'md') === size.id
                                                ? 'bg-indigo-50 border-indigo-400 text-indigo-600'
                                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        {size.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Opacity */}
                    <div>
                        <label className="text-xs font-black text-gray-500 mb-1 block">
                            שקיפות: {(overlay.opacity || 8) * 10}%
                        </label>
                        <input
                            type="range"
                            min={3}
                            max={10}
                            value={overlay.opacity || 8}
                            onChange={(e) => updateOverlay({ opacity: parseInt(e.target.value) })}
                            className="w-full accent-indigo-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
