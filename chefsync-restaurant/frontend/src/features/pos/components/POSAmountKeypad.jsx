import { FaBackspace } from 'react-icons/fa';

/**
 * לוח מקשים לסכומים בקופה — מחליף type="number" במסכי מגע.
 *
 * @param {string} value
 * @param {(next: string) => void} onChange
 * @param {boolean} [disabled]
 * @param {boolean} [allowDecimal]
 * @param {'default' | 'compact'} [size]
 */
export default function POSAmountKeypad({
    value,
    onChange,
    disabled = false,
    allowDecimal = true,
    size = 'default',
    className = '',
}) {
    const isCompact = size === 'compact';
    const numBtn = isCompact
        ? 'h-11 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white text-base font-black active:scale-90 border border-slate-600/30 disabled:opacity-40 disabled:pointer-events-none'
        : 'h-14 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-white text-xl font-black active:scale-90 border border-slate-600/30 disabled:opacity-40 disabled:pointer-events-none';
    const delBtn = isCompact
        ? 'h-11 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-90 disabled:opacity-40 disabled:pointer-events-none'
        : 'h-14 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-90 disabled:opacity-40 disabled:pointer-events-none';

    const keys = allowDecimal
        ? ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del']
        : ['7', '8', '9', '4', '5', '6', '1', '2', '3', '_', '0', 'del'];

    const press = (d) => {
        if (disabled) return;
        if (d === '_') return;
        if (d === 'del') {
            onChange(value.slice(0, -1));
            return;
        }
        if (d === '.' && !allowDecimal) return;
        if (d === '.' && value.includes('.')) return;
        onChange(value + d);
    };

    return (
        <div dir="ltr" className={`grid grid-cols-3 ${isCompact ? 'gap-1.5' : 'gap-2'} ${className}`.trim()}>
            {keys.map((d, idx) => {
                if (d === 'del') {
                    return (
                        <button
                            key={idx}
                            type="button"
                            disabled={disabled}
                            onClick={() => press('del')}
                            className={delBtn}
                        >
                            <FaBackspace size={isCompact ? 16 : 20} />
                        </button>
                    );
                }
                if (d === '_') {
                    return <div key={idx} className={isCompact ? 'h-11' : 'h-14'} aria-hidden />;
                }
                return (
                    <button
                        key={idx}
                        type="button"
                        disabled={disabled}
                        onClick={() => press(d)}
                        className={numBtn}
                    >
                        {d}
                    </button>
                );
            })}
        </div>
    );
}
