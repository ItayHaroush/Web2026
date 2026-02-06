export default function ViewerWidgets({ designOptions, preset, restaurant }) {
    const widgets = (designOptions?.widgets || []).filter(w => w.enabled);
    if (widgets.length === 0) return null;

    const topBarWidgets = widgets.filter(w => w.position === 'top-bar');
    const bottomBarWidgets = widgets.filter(w => w.position === 'bottom-bar');
    const badgeWidgets = widgets.filter(w => w.position?.endsWith('-badge'));

    const renderWidgetContent = (widget) => {
        switch (widget.type) {
            case 'promotion':
                if (widget.config?.display_mode === 'tag') return null;
                return (
                    <p className="font-black text-lg">
                        {widget.config?.icon && <span className="ml-2">{widget.config.icon}</span>}
                        {widget.config?.text}
                    </p>
                );
            case 'announcement':
                return (
                    <p className="font-black text-lg">
                        {widget.config?.icon && <span className="ml-2">{widget.config.icon}</span>}
                        {widget.config?.text}
                    </p>
                );
            case 'business_hours': {
                if (!restaurant) return null;
                const isOpen = restaurant.is_open_now;
                return (
                    <p className="font-bold text-sm">
                        <span className={`inline-block w-2 h-2 rounded-full ml-2 ${isOpen ? 'bg-green-400' : 'bg-red-400'}`}></span>
                        {isOpen ? 'פתוח כעת' : 'סגור כעת'}
                    </p>
                );
            }
            case 'delivery_info': {
                if (!restaurant) return null;
                const parts = [];
                if (widget.config?.show_pickup && restaurant.has_pickup) {
                    parts.push(`איסוף: ${restaurant.pickup_time_minutes || '~'} דק׳`);
                }
                if (widget.config?.show_delivery && restaurant.has_delivery) {
                    parts.push(`משלוח: ${restaurant.delivery_time_minutes || '~'} דק׳`);
                }
                if (parts.length === 0) return null;
                return <p className="font-bold text-sm">{parts.join(' | ')}</p>;
            }
            default:
                return null;
        }
    };

    const barStyle = preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white';

    return { topBarWidgets, bottomBarWidgets, badgeWidgets, renderWidgetContent, barStyle };
}

// Helper component for rendering bar widgets
export function WidgetBar({ widgets, renderWidgetContent, barStyle, position }) {
    const filtered = widgets.filter(w => w.position === position);
    if (filtered.length === 0) return null;

    return (
        <div className={`${barStyle} px-6 py-3 text-center shrink-0 flex items-center justify-center gap-6`}>
            {filtered.map((w, i) => {
                const content = renderWidgetContent(w);
                return content ? <div key={`${position}-${i}`}>{content}</div> : null;
            })}
        </div>
    );
}

// Badge position mapping
const BADGE_POSITIONS = {
    'top-right-badge': 'top-6 right-6',
    'top-left-badge': 'top-6 left-6',
    'bottom-right-badge': 'bottom-6 right-6',
    'bottom-left-badge': 'bottom-6 left-6',
};

// Helper component for rendering badge-positioned widgets
export function WidgetBadges({ widgets, renderWidgetContent, barStyle }) {
    if (!widgets || widgets.length === 0) return null;

    return (
        <>
            {widgets.map((w, i) => {
                const content = renderWidgetContent(w);
                if (!content) return null;
                const posClass = BADGE_POSITIONS[w.position] || 'bottom-6 right-6';
                return (
                    <div
                        key={`badge-${i}`}
                        className={`fixed z-10 ${posClass} ${barStyle} px-4 py-2.5 rounded-2xl shadow-lg`}
                    >
                        {content}
                    </div>
                );
            })}
        </>
    );
}
