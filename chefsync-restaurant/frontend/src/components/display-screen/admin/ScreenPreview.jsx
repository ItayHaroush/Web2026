import { PRESET_STYLES } from '../shared/presetStyles';
import { ASPECT_RATIOS } from '../shared/aspectRatioConfig';

export default function ScreenPreview({ form }) {
    const presetKey = form.design_preset === 'menuboard' && form.design_options?.menuboard_theme === 'light'
        ? 'menuboard-light'
        : form.design_preset;
    const preset = PRESET_STYLES[presetKey] || PRESET_STYLES.classic;
    const ratio = ASPECT_RATIOS.find(r => r.id === (form.aspect_ratio || '16:9'));

    // Build background style
    const bg = form.design_options?.background || {};
    let bgClass = preset.bg;
    let bgStyle = {};

    if (bg.mode === 'solid' && bg.solid_color) {
        bgClass = '';
        bgStyle = { backgroundColor: bg.solid_color };
    } else if (bg.mode === 'gradient' && bg.gradient) {
        bgClass = '';
        const dirMap = { 'to-b': '180deg', 'to-r': '90deg', 'to-br': '135deg', 'to-bl': '225deg' };
        bgStyle = {
            background: `linear-gradient(${dirMap[bg.gradient.direction] || '135deg'}, ${bg.gradient.from || '#000'}, ${bg.gradient.to || '#333'})`,
        };
    }

    const sampleItems = [
        { name: 'שניצל ביתי', price: '45', category: 'מנות עיקריות' },
        { name: 'סלט קיסר', price: '38', category: 'סלטים' },
        { name: 'המבורגר אנגוס', price: '62', category: 'מנות עיקריות' },
    ];

    return (
        <div className="space-y-3">
            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
                תצוגה מקדימה
            </label>
            <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-center">
                <div
                    className={`${bgClass} rounded-xl overflow-hidden relative`}
                    style={{
                        ...bgStyle,
                        width: '100%',
                        maxWidth: '420px',
                        aspectRatio: ratio?.id === '9:16' ? '9/16' : ratio?.id === '4:3' ? '4/3' : ratio?.id === '21:9' ? '21/9' : '16/9',
                    }}
                >
                    {/* Mini header */}
                    <div className={`${preset.header} px-4 py-2 flex items-center gap-2`}>
                        <div className={`w-6 h-6 rounded-lg bg-gray-300 ${preset.dark ? 'bg-white/20' : ''}`} />
                        <span className={`text-xs font-black ${preset.title}`}>שם המסעדה</span>
                    </div>

                    {/* Mini items */}
                    <div className="p-3 space-y-1.5">
                        {sampleItems.map((item, i) => (
                            <div
                                key={i}
                                className={`${preset.card} rounded-lg p-2 flex items-center justify-between`}
                            >
                                <span className={`text-[10px] font-black ${preset.title}`}>{item.name}</span>
                                <span className={`text-[10px] font-black ${preset.price} px-1.5 py-0.5 rounded-md`}>
                                    {item.price} ₪
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Ratio label */}
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[9px] font-black px-2 py-1 rounded-md">
                        {form.aspect_ratio || '16:9'}
                    </div>
                </div>
            </div>
        </div>
    );
}
