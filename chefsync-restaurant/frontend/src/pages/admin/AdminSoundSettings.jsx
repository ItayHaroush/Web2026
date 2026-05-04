import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import SoundManager from '../../services/SoundManager';
import {
    FaBell,
    FaChevronRight,
    FaVolumeUp,
    FaVolumeMute,
    FaPlay,
    FaCheck,
} from 'react-icons/fa';

// ── אפשרויות ──────────────────────────────────────────────────

const PATTERNS = [
    { value: 'once',       label: 'צלצול יחיד',   desc: 'צלצול אחד בכל התראה' },
    { value: 'double',     label: 'כפול',          desc: 'שני צלצולים ברצף' },
    { value: 'triple',     label: 'משולש',         desc: 'שלושה צלצולים ברצף' },
    { value: 'continuous', label: 'רציף',          desc: 'מנגן ברצף (בשילוב עם "עד קבלה")' },
];

const MODES = [
    {
        value: 'timed',
        label: 'לפי זמן',
        desc: 'הצלצול נפסק אוטומטית אחרי מספר שניות שתבחר',
    },
    {
        value: 'acknowledge',
        label: 'עד קבלת הזמנה',
        desc: 'הצלצול ממשיך עד שתלחץ "קיבלתי" על הבאנר שמופיע',
    },
];

const DURATIONS = [
    { value: 5,  label: '5 שניות' },
    { value: 10, label: '10 שניות' },
    { value: 15, label: '15 שניות' },
    { value: 20, label: '20 שניות' },
    { value: 30, label: '30 שניות' },
    { value: 60, label: 'דקה' },
];

// ── קומפוננטה ראשית ───────────────────────────────────────────

export default function AdminSoundSettings() {
    const navigate = useNavigate();

    const [enabled,  setEnabledState]  = useState(() => SoundManager.isEnabled());
    const [volume,   setVolumeState]   = useState(() => Math.round(SoundManager.getVolume() * 100));
    const [pattern,  setPatternState]  = useState(() => SoundManager.getPattern());
    const [mode,     setModeState]     = useState(() => SoundManager.getRingMode());
    const [duration, setDurationState] = useState(() => SoundManager.getRingDuration());
    const [testing,  setTesting]       = useState(false);

    const handleEnabledToggle = () => {
        const next = !enabled;
        setEnabledState(next);
        SoundManager.setEnabled(next);
    };

    const handleVolumeChange = (e) => {
        const v = Number(e.target.value);
        setVolumeState(v);
        SoundManager.setVolume(v / 100);
    };

    const handlePatternSelect = (p) => {
        setPatternState(p);
        SoundManager.setPattern(p);
    };

    const handleModeSelect = (m) => {
        setModeState(m);
        SoundManager.setRingMode(m);
    };

    const handleDurationSelect = (d) => {
        setDurationState(d);
        SoundManager.setRingDuration(d);
    };

    const handleTest = useCallback(() => {
        if (testing) { SoundManager.stopAlert(); setTesting(false); return; }
        setTesting(true);
        // בדיקה עם ההגדרות הנוכחיות, אבל עצור אחרי 5 שניות לכל היותר
        const origMode = SoundManager.getRingMode();
        SoundManager.setRingMode('timed');
        const origDur  = SoundManager.getRingDuration();
        SoundManager.setRingDuration(5);

        SoundManager.playAlert();

        // שחזר הגדרות מקוריות אחרי 5.5 שניות
        setTimeout(() => {
            SoundManager.setRingMode(origMode);
            SoundManager.setRingDuration(origDur);
            setTesting(false);
        }, 5500);
    }, [testing]);

    return (
        <AdminLayout>
            <div className="max-w-xl mx-auto px-4 py-6" dir="rtl">
                {/* כותרת */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => navigate('/admin/settings-hub')}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                    >
                        <FaChevronRight size={16} />
                    </button>
                    <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                        <FaBell size={18} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">הגדרות צלצול</h1>
                        <p className="text-xs text-gray-500">התראות קוליות להזמנות חדשות</p>
                    </div>
                </div>

                {/* הפעלה/כיבוי */}
                <Section title="הפעלת צלצול">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                            {enabled
                                ? <FaVolumeUp size={18} className="text-orange-500" />
                                : <FaVolumeMute size={18} className="text-gray-400" />
                            }
                            <div>
                                <p className="text-sm font-black text-gray-800">
                                    {enabled ? 'צלצול פעיל' : 'צלצול כבוי'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {enabled ? 'תקבל התראה קולית עם הזמנה חדשה' : 'אין צלצול בהזמנות חדשות'}
                                </p>
                            </div>
                        </div>
                        <Toggle checked={enabled} onChange={handleEnabledToggle} />
                    </div>
                </Section>

                {enabled && (
                    <>
                        {/* עוצמה */}
                        <Section title="עוצמת צלצול">
                            <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <FaVolumeMute size={14} className="text-gray-400" />
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="flex-1 mx-3 accent-orange-500 h-2 rounded-full cursor-pointer"
                                    />
                                    <FaVolumeUp size={16} className="text-gray-500" />
                                    <span className="mr-3 text-sm font-black text-gray-700 w-10 text-left">{volume}%</span>
                                </div>
                            </div>
                        </Section>

                        {/* סוג צלצול */}
                        <Section title="סוג צלצול">
                            <div className="grid grid-cols-2 gap-3">
                                {PATTERNS.map((p) => (
                                    <OptionCard
                                        key={p.value}
                                        selected={pattern === p.value}
                                        onClick={() => handlePatternSelect(p.value)}
                                        label={p.label}
                                        desc={p.desc}
                                    />
                                ))}
                            </div>
                        </Section>

                        {/* משך צלצול */}
                        <Section title="משך הצלצול">
                            <div className="space-y-3">
                                {MODES.map((m) => (
                                    <div
                                        key={m.value}
                                        onClick={() => handleModeSelect(m.value)}
                                        className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                            mode === m.value
                                                ? 'border-orange-400 bg-orange-50'
                                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                        }`}
                                    >
                                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                            mode === m.value
                                                ? 'border-orange-500 bg-orange-500'
                                                : 'border-gray-300'
                                        }`}>
                                            {mode === m.value && <FaCheck size={9} className="text-white" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-800">{m.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* בורר שניות — רק במצב "לפי זמן" */}
                            {mode === 'timed' && (
                                <div className="mt-4">
                                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                                        כמה זמן לצלצל?
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {DURATIONS.map((d) => (
                                            <button
                                                key={d.value}
                                                onClick={() => handleDurationSelect(d.value)}
                                                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                                                    duration === d.value
                                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Section>

                        {/* כפתור בדיקה */}
                        <button
                            onClick={handleTest}
                            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-black transition-all ${
                                testing
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                                    : 'bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600'
                            }`}
                        >
                            <FaPlay size={14} className={testing ? 'animate-pulse' : ''} />
                            {testing ? 'מנגן... (לחץ לעצור)' : 'בדוק צלצול'}
                        </button>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}

// ── תתי-קומפוננטות ───────────────────────────────────────────

function Section({ title, children }) {
    return (
        <div className="mb-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">{title}</p>
            {children}
        </div>
    );
}

function OptionCard({ selected, onClick, label, desc }) {
    return (
        <div
            onClick={onClick}
            className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selected
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'
            }`}
        >
            {selected && (
                <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                    <FaCheck size={9} className="text-white" />
                </div>
            )}
            <p className={`text-sm font-black ${selected ? 'text-orange-600' : 'text-gray-800'}`}>{label}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <button
            onClick={onChange}
            className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${
                checked ? 'bg-orange-500' : 'bg-gray-300'
            }`}
        >
            <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    checked ? 'right-0.5' : 'left-0.5'
                }`}
            />
        </button>
    );
}
