import { FaSun, FaMoon, FaClock } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

const options = [
    { key: 'light', icon: FaSun, label: 'בהיר' },
    { key: 'dark', icon: FaMoon, label: 'כהה' },
    { key: 'auto', icon: FaClock, label: 'אוטומטי' },
];

/**
 * @param {{ variant?: 'compact' | 'fullWidth' }} props
 * fullWidth — שורה מלאה (מודל מובייל), compact — פס עגול כמו קודם
 */
export default function ThemeToggle({ variant = 'compact' }) {
    const { themePreference, setThemePreference } = useTheme();

    if (variant === 'fullWidth') {
        return (
            <div className="w-full rounded-xl bg-white/10 p-1">
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-white/50">מצב תצוגה</p>
                <div className="flex gap-1">
                    {options.map(({ key, icon: Icon, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setThemePreference(key)}
                            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-bold transition-all duration-200 ${themePreference === key
                                ? 'bg-brand-primary text-white shadow-md'
                                : 'text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <Icon size={14} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center bg-white/10 rounded-full p-0.5 gap-0.5">
            {options.map(({ key, icon: Icon }) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => setThemePreference(key)}
                    className={`p-1.5 rounded-full transition-all duration-200 ${themePreference === key
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-white/50 hover:text-white hover:bg-white/10'
                        }`}
                    title={options.find(o => o.key === key)?.label}
                >
                    <Icon size={12} />
                </button>
            ))}
        </div>
    );
}
