import { FaCrown } from 'react-icons/fa';

const GRADIENT_DIRECTIONS = [
    { id: 'to-b', label: 'למטה', icon: '↓' },
    { id: 'to-r', label: 'ימינה', icon: '←' },
    { id: 'to-br', label: 'אלכסון', icon: '↙' },
    { id: 'to-bl', label: 'אלכסון הפוך', icon: '↘' },
];

export default function ScreenFormBackground({ form, setForm }) {
    const bg = form.design_options?.background || { mode: 'preset' };

    const updateBg = (updates) => {
        setForm({
            ...form,
            design_options: {
                ...(form.design_options || {}),
                background: {
                    ...bg,
                    ...updates,
                },
            },
        });
    };

    return (
        <div className="space-y-5 bg-emerald-50/50 rounded-[2rem] p-6 border border-emerald-100">
            <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <FaCrown className="text-purple-500" /> רקע מותאם
            </label>

            {/* Mode selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { id: 'preset', label: 'ברירת מחדל', icon: '🎨' },
                    { id: 'solid', label: 'צבע אחיד', icon: '🟦' },
                    { id: 'gradient', label: 'גרדיאנט', icon: '🌈' },
                    { id: 'image', label: 'תמונה', icon: '🖼️' },
                ].map(mode => (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateBg({ mode: mode.id })}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${bg.mode === mode.id
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                            }`}
                    >
                        <span className="text-xl">{mode.icon}</span>
                        <span className="text-[10px] font-black">{mode.label}</span>
                    </button>
                ))}
            </div>

            {/* Solid color */}
            {bg.mode === 'solid' && (
                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500">צבע רקע</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={bg.solid_color || '#1a1a2e'}
                            onChange={(e) => updateBg({ solid_color: e.target.value })}
                            className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer"
                        />
                        <input
                            type="text"
                            value={bg.solid_color || '#1a1a2e'}
                            onChange={(e) => updateBg({ solid_color: e.target.value })}
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:ring-2 focus:ring-emerald-400/20"
                            dir="ltr"
                        />
                    </div>
                </div>
            )}

            {/* Gradient */}
            {bg.mode === 'gradient' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500">צבע התחלה</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={bg.gradient?.from || '#1a1a2e'}
                                    onChange={(e) => updateBg({ gradient: { ...bg.gradient, from: e.target.value } })}
                                    className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={bg.gradient?.from || '#1a1a2e'}
                                    onChange={(e) => updateBg({ gradient: { ...bg.gradient, from: e.target.value } })}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-700"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500">צבע סיום</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={bg.gradient?.to || '#16213e'}
                                    onChange={(e) => updateBg({ gradient: { ...bg.gradient, to: e.target.value } })}
                                    className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={bg.gradient?.to || '#16213e'}
                                    onChange={(e) => updateBg({ gradient: { ...bg.gradient, to: e.target.value } })}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-700"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>
                    {/* Preview */}
                    <div
                        className="w-full h-14 rounded-2xl border border-gray-200"
                        style={{
                            background: `linear-gradient(${{ 'to-b': '180deg', 'to-r': '90deg', 'to-br': '135deg', 'to-bl': '225deg' }[bg.gradient?.direction || 'to-br']
                                }, ${bg.gradient?.from || '#1a1a2e'}, ${bg.gradient?.to || '#16213e'})`,
                        }}
                    />
                    <div className="flex gap-2">
                        {GRADIENT_DIRECTIONS.map(dir => (
                            <button
                                key={dir.id}
                                type="button"
                                onClick={() => updateBg({ gradient: { ...bg.gradient, direction: dir.id } })}
                                className={`flex-1 p-2 rounded-lg border-2 text-center transition-all ${(bg.gradient?.direction || 'to-br') === dir.id
                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                        : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-lg">{dir.icon}</span>
                                <span className="block text-[9px] font-bold mt-0.5">{dir.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Image */}
            {bg.mode === 'image' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500">כתובת תמונה (URL)</label>
                        <input
                            type="url"
                            value={bg.image_url || ''}
                            onChange={(e) => updateBg({ image_url: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-emerald-400/20"
                            dir="ltr"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-black text-gray-500 mb-1 block">
                            שקיפות תמונה: {Math.round((bg.image_opacity || 0.3) * 100)}%
                        </label>
                        <input
                            type="range"
                            min={10}
                            max={100}
                            value={Math.round((bg.image_opacity || 0.3) * 100)}
                            onChange={(e) => updateBg({ image_opacity: parseInt(e.target.value) / 100 })}
                            className="w-full accent-emerald-500"
                        />
                    </div>
                    {bg.image_url && (
                        <div className="relative w-full h-24 rounded-xl overflow-hidden border border-gray-200">
                            <div className="absolute inset-0 bg-black" />
                            <img
                                src={bg.image_url}
                                alt="תצוגה מקדימה"
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ opacity: bg.image_opacity || 0.3 }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
