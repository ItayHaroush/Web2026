import { FaTimes, FaPlus, FaEdit, FaCheckCircle } from 'react-icons/fa';
import ScreenFormBasic from './ScreenFormBasic';
import ScreenFormPresets from './ScreenFormPresets';
import ScreenFormFonts from './ScreenFormFonts';
import ScreenFormBackground from './ScreenFormBackground';
import ScreenFormLogo from './ScreenFormLogo';
import ScreenFormWidgets from './ScreenFormWidgets';
import ScreenFormLayout from './ScreenFormLayout';
import AspectRatioSelector from './AspectRatioSelector';

export default function ScreenFormModal({ form, setForm, editScreen, tier, onSubmit, onClose }) {
    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-indigo-100 rounded-[1.5rem] text-indigo-600 shadow-sm">
                            {editScreen ? <FaEdit size={24} /> : <FaPlus size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                {editScreen ? 'עריכת מסך' : 'מסך חדש'}
                            </h2>
                            <p className="text-gray-500 font-medium text-sm mt-0.5">הגדרות מסך תצוגה דיגיטלי</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                    >
                        <FaTimes size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={onSubmit} className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    <ScreenFormBasic form={form} setForm={setForm} tier={tier} />
                    <ScreenFormPresets form={form} setForm={setForm} tier={tier} />

                    {/* Aspect Ratio */}
                    <AspectRatioSelector
                        value={form.aspect_ratio || '16:9'}
                        onChange={(ratio) => setForm({ ...form, aspect_ratio: ratio })}
                    />

                    {/* Pro-only sections */}
                    {tier === 'pro' && (
                        <>
                            <ScreenFormFonts form={form} setForm={setForm} />
                            <ScreenFormBackground form={form} setForm={setForm} />
                            <ScreenFormLayout form={form} setForm={setForm} />
                        </>
                    )}

                    {/* Logo (available for both tiers, with position limits for basic) */}
                    {tier === 'pro' && (
                        <ScreenFormLogo form={form} setForm={setForm} tier={tier} />
                    )}

                    {/* Widgets */}
                    <ScreenFormWidgets form={form} setForm={setForm} tier={tier} />

                    {/* Submit */}
                    <div className="flex gap-6 pt-10">
                        <button
                            type="submit"
                            className="flex-1 bg-brand-primary text-white py-6 rounded-[2rem] font-black text-xl hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 active:scale-95 flex items-center justify-center gap-4"
                        >
                            <FaCheckCircle size={22} />
                            {editScreen ? 'עדכן מסך' : 'צור מסך'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-12 py-6 bg-gray-100 text-gray-700 rounded-[2rem] font-black hover:bg-gray-200 transition-all active:scale-95"
                        >
                            ביטול
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
