import { FaPlus } from 'react-icons/fa';

/**
 * כפתור הוספה צף — מובייל בלבד (ימין למטה). בדסקטופ מוסתר.
 * כשמודל פתוח: אל תרנדרו — עטפו ב־`{!showModal && <MobileAddFab ... />}` (או מצבי מודל רלוונטיים).
 * @param {string} [positionClass] — למשל `bottom-[6.5rem] right-4` כשמערימים שני FABs
 */
export default function MobileAddFab({ label, onClick, disabled, icon: Icon = FaPlus, positionClass = 'bottom-5 right-4' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`fixed z-40 flex md:hidden items-center gap-2 rounded-full bg-brand-primary text-white shadow-xl shadow-brand-primary/35 px-4 py-3.5 font-black text-sm max-w-[min(92vw,20rem)] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none ${positionClass}`}
            style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
            aria-label={label}
        >
            <Icon className="text-lg shrink-0" />
            <span className="truncate text-right leading-tight">{label}</span>
        </button>
    );
}
