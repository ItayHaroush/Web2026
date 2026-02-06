import { FaCrown } from 'react-icons/fa';

export default function ScreenFormLayout({ form, setForm }) {
    const layout = form.design_options?.layout || {};

    const updateLayout = (updates) => {
        setForm({
            ...form,
            design_options: {
                ...(form.design_options || {}),
                layout: {
                    ...layout,
                    ...updates,
                },
            },
        });
    };

    return (
        <div className="space-y-5 bg-sky-50/50 rounded-[2rem] p-6 border border-sky-100">
            <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <FaCrown className="text-purple-500" /> בקרות תצוגה
            </label>

            {/* Font scale */}
            <div>
                <label className="text-xs font-black text-gray-500 mb-1 block">
                    גודל טקסט: {Math.round((layout.font_scale || 1.0) * 100)}%
                </label>
                <input
                    type="range"
                    min={70}
                    max={150}
                    value={Math.round((layout.font_scale || 1.0) * 100)}
                    onChange={(e) => updateLayout({ font_scale: parseInt(e.target.value) / 100 })}
                    className="w-full accent-sky-500"
                />
                <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
                    <span>קטן</span>
                    <span>רגיל</span>
                    <span>גדול</span>
                </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                {[
                    { key: 'show_descriptions', label: 'הצג תיאורים', defaultVal: true },
                    { key: 'show_images', label: 'הצג תמונות', defaultVal: true },
                    { key: 'show_categories', label: 'הצג קטגוריות', defaultVal: true },
                ].map(toggle => (
                    <label
                        key={toggle.key}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition-all"
                    >
                        <span className="text-sm font-black text-gray-700">{toggle.label}</span>
                        <input
                            type="checkbox"
                            checked={layout[toggle.key] !== false}
                            onChange={(e) => updateLayout({ [toggle.key]: e.target.checked })}
                            className="w-5 h-5 rounded accent-sky-500"
                        />
                    </label>
                ))}
            </div>

            {/* Card style */}
            <div>
                <label className="text-xs font-black text-gray-500 mb-2 block">סגנון כרטיסים</label>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { id: 'rounded', label: 'מעוגל' },
                        { id: 'sharp', label: 'חד' },
                        { id: 'minimal', label: 'מינימלי' },
                    ].map(style => (
                        <button
                            key={style.id}
                            type="button"
                            onClick={() => updateLayout({ card_style: style.id })}
                            className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${(layout.card_style || 'rounded') === style.id
                                    ? 'bg-sky-50 border-sky-400 text-sky-600'
                                    : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                                }`}
                        >
                            {style.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
