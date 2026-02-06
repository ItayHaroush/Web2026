import { FaCrown, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { WIDGET_TYPES, createDefaultWidget, ANNOUNCEMENT_ICONS } from '../shared/widgetDefaults';
import { PROMO_ICONS } from '../shared/presetStyles';

export default function ScreenFormWidgets({ form, setForm, tier }) {
    const widgets = form.design_options?.widgets || [];

    const getWidget = (type) => widgets.find(w => w.type === type);

    const updateWidget = (type, updates) => {
        const existing = [...widgets];
        const idx = existing.findIndex(w => w.type === type);
        if (idx >= 0) {
            existing[idx] = { ...existing[idx], ...updates };
        } else {
            existing.push({ ...createDefaultWidget(type), ...updates });
        }
        setForm({
            ...form,
            design_options: {
                ...(form.design_options || {}),
                widgets: existing,
            },
        });
    };

    const updateWidgetConfig = (type, configUpdates) => {
        const widget = getWidget(type) || createDefaultWidget(type);
        updateWidget(type, {
            config: { ...widget.config, ...configUpdates },
        });
    };

    const toggleWidget = (type) => {
        const widget = getWidget(type);
        if (widget) {
            updateWidget(type, { enabled: !widget.enabled });
        } else {
            updateWidget(type, { enabled: true });
        }
    };

    const allowedWidgets = WIDGET_TYPES.filter(w => tier === 'pro' || w.tier === 'all');

    return (
        <div className="space-y-5">
            {allowedWidgets.map(widgetDef => {
                const widget = getWidget(widgetDef.type);
                const isEnabled = widget?.enabled || false;

                return (
                    <div
                        key={widgetDef.type}
                        className={`rounded-[2rem] p-6 border transition-all ${
                            isEnabled ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/50 border-gray-100'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                <span>{widgetDef.icon}</span> {widgetDef.label}
                                {widgetDef.tier === 'pro' && <FaCrown className="text-purple-500" size={12} />}
                            </label>
                            <button
                                type="button"
                                onClick={() => toggleWidget(widgetDef.type)}
                                className={`p-2 rounded-xl transition-all ${
                                    isEnabled ? 'text-amber-600 bg-amber-100' : 'text-gray-400 bg-gray-100'
                                }`}
                            >
                                {isEnabled ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                            </button>
                        </div>

                        {isEnabled && (
                            <div className="space-y-4 mt-4">
                                {/* Promotion config */}
                                {widgetDef.type === 'promotion' && (
                                    <>
                                        <input
                                            type="text"
                                            maxLength={100}
                                            value={widget?.config?.text || ''}
                                            onChange={(e) => updateWidgetConfig('promotion', { text: e.target.value })}
                                            placeholder="טקסט המבצע, למשל: 10% הנחה היום!"
                                            className="w-full px-6 py-4 bg-white border border-amber-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 text-gray-900 font-bold transition-all"
                                        />
                                        <div>
                                            <label className="text-xs font-black text-gray-500 mb-2 block">אייקון</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {PROMO_ICONS.map(icon => (
                                                    <button
                                                        key={icon}
                                                        type="button"
                                                        onClick={() => updateWidgetConfig('promotion', { icon })}
                                                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                                                            widget?.config?.icon === icon
                                                                ? 'bg-amber-200 border-2 border-amber-400 scale-110'
                                                                : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'tag', label: 'תג ליד פריט' },
                                                { id: 'bar', label: 'בר עליון קבוע' },
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    type="button"
                                                    onClick={() => updateWidgetConfig('promotion', { display_mode: mode.id })}
                                                    className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${
                                                        widget?.config?.display_mode === mode.id
                                                            ? 'bg-amber-50 border-amber-400 text-amber-600'
                                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Announcement config */}
                                {widgetDef.type === 'announcement' && (
                                    <>
                                        <input
                                            type="text"
                                            maxLength={200}
                                            value={widget?.config?.text || ''}
                                            onChange={(e) => updateWidgetConfig('announcement', { text: e.target.value })}
                                            placeholder="הודעה לתצוגה..."
                                            className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 text-gray-900 font-bold transition-all"
                                        />
                                        <div>
                                            <label className="text-xs font-black text-gray-500 mb-2 block">אייקון</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {ANNOUNCEMENT_ICONS.map(icon => (
                                                    <button
                                                        key={icon}
                                                        type="button"
                                                        onClick={() => updateWidgetConfig('announcement', { icon })}
                                                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                                                            widget?.config?.icon === icon
                                                                ? 'bg-blue-200 border-2 border-blue-400 scale-110'
                                                                : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Business hours config */}
                                {widgetDef.type === 'business_hours' && (
                                    <p className="text-sm text-gray-500 font-medium">
                                        יוצג אוטומטית על סמך שעות הפעילות שהוגדרו במסעדה.
                                    </p>
                                )}

                                {/* Delivery info config */}
                                {widgetDef.type === 'delivery_info' && (
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                            <input
                                                type="checkbox"
                                                checked={widget?.config?.show_pickup !== false}
                                                onChange={(e) => updateWidgetConfig('delivery_info', { show_pickup: e.target.checked })}
                                                className="rounded accent-amber-500"
                                            />
                                            איסוף עצמי
                                        </label>
                                        <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                            <input
                                                type="checkbox"
                                                checked={widget?.config?.show_delivery !== false}
                                                onChange={(e) => updateWidgetConfig('delivery_info', { show_delivery: e.target.checked })}
                                                className="rounded accent-amber-500"
                                            />
                                            משלוחים
                                        </label>
                                    </div>
                                )}

                                {/* Position selector for bar widgets */}
                                {widgetDef.type !== 'promotion' && (
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">מיקום</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {widgetDef.positions.map(pos => (
                                                <button
                                                    key={pos}
                                                    type="button"
                                                    onClick={() => updateWidget(widgetDef.type, { position: pos })}
                                                    className={`p-2 rounded-lg border-2 text-xs font-black transition-all ${
                                                        (widget?.position || widgetDef.defaultPosition) === pos
                                                            ? 'bg-amber-50 border-amber-300 text-amber-600'
                                                            : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {pos === 'top-bar' ? 'בר עליון' :
                                                     pos === 'bottom-bar' ? 'בר תחתון' :
                                                     pos === 'bottom-right-badge' ? 'תג ימין' :
                                                     pos === 'bottom-left-badge' ? 'תג שמאל' : pos}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
