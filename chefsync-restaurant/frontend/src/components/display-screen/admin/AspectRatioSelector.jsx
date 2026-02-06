import { ASPECT_RATIOS } from '../shared/aspectRatioConfig';

export default function AspectRatioSelector({ value, onChange }) {
    return (
        <div className="space-y-4">
            <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                יחס מסך
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ASPECT_RATIOS.map(ratio => (
                    <button
                        key={ratio.id}
                        type="button"
                        onClick={() => onChange(ratio.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${value === ratio.id
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                                : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                            }`}
                    >
                        <span className="text-2xl">{ratio.icon}</span>
                        <div className="text-center">
                            <span className="block font-black text-sm">{ratio.label}</span>
                            <span className="text-[10px] opacity-60 font-medium">{ratio.hebrewLabel}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
