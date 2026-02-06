import { useEffect } from 'react';
import { FaCrown } from 'react-icons/fa';
import { FONT_LIBRARY, getFontById, buildGoogleFontsUrl } from '../shared/fontDefinitions';

export default function ScreenFormFonts({ form, setForm }) {
    const fonts = form.design_options?.fonts || {};

    // Load preview fonts
    useEffect(() => {
        const ids = [fonts.title, fonts.price, fonts.body].filter(Boolean);
        const url = buildGoogleFontsUrl(ids);
        if (!url) return;
        const link = document.createElement('link');
        link.href = url;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => { try { document.head.removeChild(link); } catch (e) { } };
    }, [fonts.title, fonts.price, fonts.body]);

    const updateFont = (key, fontId) => {
        setForm({
            ...form,
            design_options: {
                ...(form.design_options || {}),
                fonts: {
                    ...(form.design_options?.fonts || {}),
                    [key]: fontId,
                },
            },
        });
    };

    const FONT_SLOTS = [
        { key: 'title', label: 'כותרת', sampleText: 'שם המנה' },
        { key: 'price', label: 'מחיר', sampleText: '₪ 49.90' },
        { key: 'body', label: 'תיאור', sampleText: 'מנה טעימה במיוחד' },
    ];

    return (
        <div className="space-y-6 bg-violet-50/50 rounded-[2rem] p-6 border border-violet-100">
            <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <FaCrown className="text-purple-500" /> גופנים
            </label>

            {FONT_SLOTS.map(slot => {
                const currentId = fonts[slot.key] || 'Rubik';
                const currentFont = getFontById(currentId);
                return (
                    <div key={slot.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-gray-600">{slot.label}</span>
                            <span
                                className="text-lg font-bold text-gray-800"
                                style={{ fontFamily: currentFont.cssFamily }}
                            >
                                {slot.sampleText}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {FONT_LIBRARY.map(font => (
                                <button
                                    key={font.id}
                                    type="button"
                                    onClick={() => updateFont(slot.key, font.id)}
                                    className={`p-3 rounded-xl border-2 transition-all text-center ${currentId === font.id
                                            ? 'bg-violet-50 border-violet-400 text-violet-700'
                                            : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <span
                                        className="block text-sm font-bold"
                                        style={{ fontFamily: font.cssFamily }}
                                    >
                                        {font.hebrewLabel}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-medium mt-0.5 block">
                                        {font.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
