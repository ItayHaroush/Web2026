import { DESIGN_PRESETS } from '../shared/presetStyles';

export default function ScreenFormPresets({ form, setForm, tier }) {
    return (
        <>
            {/* Design Preset */}
            <div className="space-y-4">
                <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                    עיצוב
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {DESIGN_PRESETS.map((preset) => {
                        const disabled = tier === 'basic' && preset.tier === 'pro';
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => !disabled && setForm({ ...form, design_preset: preset.id })}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-right ${form.design_preset === preset.id
                                        ? 'bg-indigo-50 border-indigo-500'
                                        : disabled
                                            ? 'bg-gray-50 border-transparent opacity-40 cursor-not-allowed'
                                            : 'bg-gray-50 border-transparent hover:bg-gray-100'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${preset.color}`}>
                                    {preset.label.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-black text-sm text-gray-800">{preset.label}</div>
                                    <div className="text-[10px] text-gray-400 font-medium">{preset.desc}</div>
                                </div>
                                {disabled && <span className="mr-auto text-[9px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg">PRO</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Menuboard Theme Toggle */}
            {form.design_preset === 'menuboard' && (
                <div className="space-y-4">
                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                        ערכת צבע לוח מחירים
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { id: 'dark', label: 'כהה', desc: 'רקע שחור, טקסט לבן', colorBox: 'bg-[#1c1c1c] text-white' },
                            { id: 'light', label: 'בהיר', desc: 'רקע בהיר, טקסט כהה', colorBox: 'bg-amber-50 text-gray-900' },
                        ].map(theme => {
                            const currentTheme = form.design_options?.menuboard_theme || 'dark';
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setForm({
                                        ...form,
                                        design_options: {
                                            ...(form.design_options || {}),
                                            menuboard_theme: theme.id,
                                        },
                                    })}
                                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-right ${currentTheme === theme.id
                                            ? 'bg-indigo-50 border-indigo-500'
                                            : 'bg-gray-50 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${theme.colorBox}`}>
                                        {theme.label.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-black text-sm text-gray-800">{theme.label}</div>
                                        <div className="text-[10px] text-gray-400 font-medium">{theme.desc}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
