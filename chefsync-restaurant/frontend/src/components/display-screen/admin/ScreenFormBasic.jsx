import { FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import { isFeatureUnlocked } from '../../../utils/tierUtils';

export default function ScreenFormBasic({ form, setForm, subscriptionInfo }) {
    return (
        <>
            {/* Name */}
            <div className="space-y-4">
                <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest flex items-center gap-2">
                    <FaInfoCircle className="text-indigo-500" /> שם המסך
                </label>
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 text-gray-900 font-black transition-all text-lg"
                    placeholder='למשל: מסך דלפק, מסך קיר...'
                />
            </div>

            {/* Display Type */}
            <div className="space-y-4">
                <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                    סוג תצוגה
                </label>
                <div className="grid grid-cols-2 gap-5">
                    {[
                        { id: 'static', label: 'סטטי', desc: 'כל הפריטים ברשת', icon: '🖥️', disabled: false },
                        { id: 'rotating', label: 'קרוסלה', desc: 'שקפים מתחלפים', icon: '🎠', disabled: !isFeatureUnlocked(subscriptionInfo?.features, 'display_screens') },
                    ].map((type) => (
                        <button
                            key={type.id}
                            type="button"
                            disabled={type.disabled}
                            onClick={() => !type.disabled && setForm({ ...form, display_type: type.id })}
                            className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] border-2 transition-all duration-300 relative ${form.display_type === type.id
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-500/5'
                                    : type.disabled
                                        ? 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed'
                                        : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                                }`}
                        >
                            <span className="text-4xl">{type.icon}</span>
                            <div className="text-center">
                                <span className={`block font-black text-sm ${form.display_type === type.id ? 'text-indigo-600' : ''}`}>{type.label}</span>
                                <span className="text-[10px] opacity-60 font-medium">{type.desc}</span>
                            </div>
                            {type.disabled && (
                                <span className="absolute top-2 left-2 text-[9px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg">PRO</span>
                            )}
                            {form.display_type === type.id && (
                                <div className="absolute -top-2 -right-2 bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                                    <FaCheckCircle size={12} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Mode */}
            <div className="space-y-4">
                <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                    מצב תוכן
                </label>
                <div className="grid grid-cols-2 gap-5">
                    {[
                        { id: 'auto_available', label: 'אוטומטי', desc: 'כל הפריטים הזמינים' },
                        { id: 'manual', label: 'ידני', desc: 'בחירה ידנית + סידור' },
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            onClick={() => setForm({ ...form, content_mode: mode.id })}
                            className={`p-5 rounded-2xl border-2 transition-all text-center ${form.content_mode === mode.id
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                                }`}
                        >
                            <div className="font-black text-sm">{mode.label}</div>
                            <div className="text-[10px] opacity-60 font-medium mt-1">{mode.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Refresh Interval */}
            <div className="space-y-4">
                <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                    מרווח רענון (שניות)
                </label>
                <input
                    type="number"
                    min={10}
                    max={300}
                    value={form.refresh_interval}
                    onChange={(e) => setForm({ ...form, refresh_interval: parseInt(e.target.value) || 30 })}
                    className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 text-gray-900 font-black transition-all"
                />
            </div>

            {/* Rotation Speed (only for rotating) */}
            {form.display_type === 'rotating' && (
                <div className="space-y-4">
                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                        מהירות סיבוב (שניות לשקף)
                    </label>
                    <input
                        type="number"
                        min={3}
                        max={30}
                        value={form.rotation_speed}
                        onChange={(e) => setForm({ ...form, rotation_speed: parseInt(e.target.value) || 5 })}
                        className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 text-gray-900 font-black transition-all"
                    />
                </div>
            )}
        </>
    );
}
