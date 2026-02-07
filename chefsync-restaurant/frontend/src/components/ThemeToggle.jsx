import { FaSun, FaMoon, FaClock } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

const options = [
    { key: 'light', icon: FaSun, label: 'בהיר' },
    { key: 'dark', icon: FaMoon, label: 'כהה' },
    { key: 'auto', icon: FaClock, label: 'אוטומטי' },
];

export default function ThemeToggle() {
    const { themePreference, setThemePreference } = useTheme();

    return (
        <div className="flex items-center bg-white/10 rounded-full p-0.5 gap-0.5">
            {options.map(({ key, icon: Icon }) => (
                <button
                    key={key}
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
