import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/apiClient';
import { requestPhoneCode } from '../services/phoneAuthService';
import { toast } from 'react-hot-toast';
import { isValidIsraeliMobile } from '../utils/phone';
import { FaCheckCircle, FaCheck, FaArrowLeft, FaArrowRight, FaGlobe, FaInfoCircle, FaPen } from 'react-icons/fa';
import { FaStore, FaBrain, FaPizzaSlice, FaHamburger, FaUtensils, FaConciergeBell } from 'react-icons/fa';
import { GiKebabSpit, GiChefToque } from 'react-icons/gi';

const DEFAULT_PRICING = {
    basic: { monthly: 299, yearly: 2990, ai_credits: 1, trial_ai_credits: 1 },
    pro: { monthly: 449, yearly: 4490, ai_credits: 500, trial_ai_credits: 50 },
    enterprise: { monthly: 0, yearly: 0, ai_credits: 1000, contactOnly: true },
};

const STEPS = [
    { number: 1, label: 'תכנית' },
    { number: 2, label: 'מסעדה' },
    { number: 3, label: 'בעלים' },
    { number: 4, label: 'סיכום' },
];

export default function RegisterRestaurant() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [selectedTier, setSelectedTier] = useState('pro');
    const [pricing, setPricing] = useState(DEFAULT_PRICING);
    const [form, setForm] = useState({
        name: '',
        tenant_id: '',
        restaurant_type: 'general',
        phone: '',
        address: '',
        city: '',
        owner_name: '',
        owner_email: '',
        owner_phone: '',
        password: '',
        password_confirmation: '',
        plan_type: 'monthly',
        verification_code: '',
        latitude: '',
        longitude: '',
    });
    const [codeSending, setCodeSending] = useState(false);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [agreedTerms, setAgreedTerms] = useState(false);

    // Wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [direction, setDirection] = useState('forward');
    const [isAnimating, setIsAnimating] = useState(false);
    const [stepErrors, setStepErrors] = useState({});
    const contentRef = useRef(null);

    useEffect(() => {
        const loadCities = async () => {
            try {
                const { data } = await api.get('/cities');
                const items = data?.cities || data?.data || [];
                setCities(items);
            } catch (err) {
                console.error('שגיאה בטעינת רשימת ערים', err);
            }
        };
        const loadPricing = async () => {
            try {
                const { data } = await api.get('/pricing');
                if (data?.success && data?.data) {
                    setPricing(data.data);
                }
            } catch (err) {
                console.error('שגיאה בטעינת מחירים, שימוש ב-defaults', err);
            }
        };
        loadCities();
        loadPricing();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let nextValue = type === 'checkbox' ? checked : value;
        if (name === 'tenant_id') {
            nextValue = value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
        }
        setForm((prev) => ({ ...prev, [name]: nextValue }));
        if (stepErrors[name]) {
            setStepErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    // --- Validation per step ---
    const validateStep1 = () => {
        const errors = {};
        if (!selectedTier) errors.tier = 'יש לבחור תכנית';
        if (!form.plan_type) errors.plan_type = 'יש לבחור מחזור חיוב';
        setStepErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = () => {
        const errors = {};
        if (!form.name.trim()) errors.name = 'שם המסעדה חובה';
        if (!form.tenant_id.trim()) errors.tenant_id = 'מזהה מסעדה חובה';
        else if (form.tenant_id.length < 3) errors.tenant_id = 'מינימום 3 תווים';
        else if (!/^[a-z0-9-]+$/.test(form.tenant_id)) errors.tenant_id = 'אותיות קטנות באנגלית, מספרים ומקף בלבד';
        if (!form.phone.trim()) errors.phone = 'טלפון חובה';
        if (!form.city) errors.city = 'יש לבחור עיר';
        setStepErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep3 = () => {
        const errors = {};
        if (!form.owner_name.trim()) errors.owner_name = 'שם בעלים חובה';
        if (!form.owner_email.trim()) errors.owner_email = 'דוא"ל חובה';
        if (!form.owner_phone.trim()) errors.owner_phone = 'טלפון בעלים חובה';
        else if (!isValidIsraeliMobile(form.owner_phone)) errors.owner_phone = 'טלפון בעלים לא תקין (נייד ישראלי בלבד)';
        if (!form.password) errors.password = 'סיסמה חובה';
        else if (form.password.length < 6) errors.password = 'סיסמה חייבת להכיל לפחות 6 תווים';
        if (form.password !== form.password_confirmation) errors.password_confirmation = 'הסיסמאות לא תואמות';
        if (!form.verification_code.trim()) errors.verification_code = 'קוד אימות חובה';
        setStepErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep4 = () => {
        const errors = {};
        if (!agreedTerms) errors.terms = 'יש לאשר את תנאי השימוש';
        setStepErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // --- Navigation ---
    const goNext = () => {
        if (isAnimating) return;
        let valid = false;
        if (currentStep === 1) valid = validateStep1();
        else if (currentStep === 2) valid = validateStep2();
        else if (currentStep === 3) valid = validateStep3();
        if (!valid) return;

        setDirection('forward');
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentStep((s) => Math.min(s + 1, 4));
            setIsAnimating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    };

    const goBack = () => {
        if (isAnimating || currentStep === 1) return;
        setDirection('backward');
        setStepErrors({});
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentStep((s) => Math.max(s - 1, 1));
            setIsAnimating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    };

    const goToStep = (step) => {
        if (isAnimating || step >= currentStep) return;
        setDirection('backward');
        setStepErrors({});
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentStep(step);
            setIsAnimating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    };

    // --- Submit ---
    const handleSubmit = async () => {
        if (!validateStep4()) return;
        setLoading(true);
        try {
            const formData = new FormData();
            const requiredFields = ['name', 'tenant_id', 'phone', 'city', 'owner_name', 'owner_email', 'owner_phone', 'password', 'password_confirmation', 'plan_type', 'verification_code'];
            requiredFields.forEach((field) => formData.append(field, form[field]));
            formData.append('tier', selectedTier);
            formData.append('restaurant_type', form.restaurant_type);
            if (form.address) formData.append('address', form.address);
            if (form.latitude) formData.append('latitude', form.latitude);
            if (form.longitude) formData.append('longitude', form.longitude);
            formData.append('paid_upfront', '0');
            if (logoFile) formData.append('logo', logoFile);

            await api.post('/register-restaurant', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('ההרשמה בוצעה בהצלחה!');
            navigate('/admin/login');
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בהרשמה';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSendCode = async () => {
        if (!form.owner_phone) {
            toast.error('הזן טלפון בעלים לפני שליחת קוד');
            return;
        }
        if (!isValidIsraeliMobile(form.owner_phone)) {
            toast.error('טלפון בעלים לא תקין (נייד ישראלי בלבד)');
            return;
        }
        setCodeSending(true);
        try {
            await requestPhoneCode(form.owner_phone);
            toast.success('קוד נשלח ב-SMS');
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בשליחת קוד';
            toast.error(message);
        } finally {
            setCodeSending(false);
        }
    };

    const currentPrice = pricing[selectedTier]?.contactOnly
        ? null
        : form.plan_type === 'annual'
            ? pricing[selectedTier]?.yearly
            : pricing[selectedTier]?.monthly;

    // Animation classes
    const getSlideClasses = () => {
        if (!isAnimating) return 'translate-x-0 opacity-100';
        if (direction === 'forward') return 'translate-x-full opacity-0 rtl:-translate-x-full';
        return '-translate-x-full opacity-0 rtl:translate-x-full';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-white py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">הצטרפו ל-TakeEat</h1>
                    <p className="text-gray-500 text-lg">60 יום ניסיון חינם. ללא כרטיס אשראי.</p>
                </div>

                {/* Progress Stepper */}
                <ProgressStepper currentStep={currentStep} />

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div
                        ref={contentRef}
                        className={`transition-all duration-300 ease-in-out ${getSlideClasses()}`}
                    >
                        {currentStep === 1 && (
                            <StepPlan
                                selectedTier={selectedTier}
                                setSelectedTier={setSelectedTier}
                                pricing={pricing}
                                form={form}
                                setForm={setForm}
                                stepErrors={stepErrors}
                                onNext={goNext}
                            />
                        )}

                        {currentStep === 2 && (
                            <StepRestaurantDetails
                                form={form}
                                handleChange={handleChange}
                                cities={cities}
                                logoPreview={logoPreview}
                                handleLogoChange={handleLogoChange}
                                stepErrors={stepErrors}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 3 && (
                            <StepOwnerDetails
                                form={form}
                                handleChange={handleChange}
                                handleSendCode={handleSendCode}
                                codeSending={codeSending}
                                stepErrors={stepErrors}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 4 && (
                            <StepSummary
                                form={form}
                                selectedTier={selectedTier}
                                pricing={pricing}
                                currentPrice={currentPrice}
                                logoPreview={logoPreview}
                                loading={loading}
                                stepErrors={stepErrors}
                                agreedTerms={agreedTerms}
                                setAgreedTerms={setAgreedTerms}
                                handleSubmit={handleSubmit}
                                onBack={goBack}
                                goToStep={goToStep}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ========================================
   Progress Stepper
======================================== */
function ProgressStepper({ currentStep }) {
    return (
        <div className="flex items-center justify-center mb-8 px-4">
            {STEPS.map((step, i) => (
                <div key={step.number} className="flex items-center">
                    {/* Step circle */}
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                                ${currentStep > step.number
                                    ? 'bg-green-500 text-white shadow-md shadow-green-200'
                                    : currentStep === step.number
                                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/30 scale-110'
                                        : 'bg-gray-200 text-gray-400'
                                }`}
                        >
                            {currentStep > step.number ? <FaCheck className="text-sm" /> : step.number}
                        </div>
                        <span
                            className={`mt-2 text-xs font-medium transition-colors duration-300 ${currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'
                                }`}
                        >
                            {step.label}
                        </span>
                    </div>
                    {/* Connecting line */}
                    {i < STEPS.length - 1 && (
                        <div
                            className={`w-12 md:w-20 h-1 mx-1.5 rounded-full transition-all duration-500 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                                }`}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

/* ========================================
   Step 1: Plan Selection
======================================== */
function StepPlan({ selectedTier, setSelectedTier, pricing, form, setForm, stepErrors, onNext }) {
    const isEnterprise = selectedTier === 'enterprise';

    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">בחרו את התכנית המתאימה למסעדה שלכם</h2>
                <p className="text-gray-500 max-w-xl mx-auto">
                    כל התכניות כוללות 60 יום ניסיון חינם. התחילו לקבל הזמנות תוך דקות, שדרגו בכל רגע.
                </p>
            </div>

            {/* Trial badge */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-5 py-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-700 font-semibold text-sm">60 יום ניסיון חינם - ללא התחייבות</span>
                </div>
            </div>

            {/* Tier cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <TierCard
                    tier="basic"
                    title="אתר הזמנות"
                    subtitle="הכל כדי להתחיל לקבל הזמנות"
                    monthlyPrice={pricing.basic.monthly}
                    yearlyPrice={pricing.basic.yearly}
                    aiCredits={pricing.basic.ai_credits}
                    features={pricing.basic.features || [
                        'דף אישי למסעדה + תפריט דיגיטלי',
                        'מערכת הזמנות (איסוף ומשלוח)',
                        'הגדרת אזורי משלוח והגבלות',
                        'לינק + QR להזמנות',
                        'דוח חודשי',
                        'טעימת AI (1 קרדיט)',
                        'עד 50 הזמנות ראשונות'
                    ]}
                    selected={selectedTier === 'basic'}
                    onSelect={() => setSelectedTier('basic')}
                    icon={<FaStore />}
                />
                <TierCard
                    tier="pro"
                    title="ניהול חכם"
                    subtitle="הזמנות + ניהול מלא + AI"
                    monthlyPrice={pricing.pro.monthly}
                    yearlyPrice={pricing.pro.yearly}
                    aiCredits={pricing.pro.ai_credits}
                    features={pricing.pro.features || [
                        'כל מה שיש באתר הזמנות',
                        'הדפסה אוטומטית להזמנות',
                        'דוחות יומיים + סינון',
                        'סוכן AI מלא',
                        'ניהול עובדים (עד 10)',
                        'הזמנות ללא הגבלה'
                    ]}
                    selected={selectedTier === 'pro'}
                    onSelect={() => setSelectedTier('pro')}
                    icon={<FaBrain />}
                    badge="מומלץ"
                />
                <TierCard
                    tier="enterprise"
                    title="מסעדה מלאה"
                    subtitle="שליטה מלאה בכל המערכת"
                    contactOnly
                    features={pricing.enterprise?.features || [
                        'כל מה שיש בניהול חכם',
                        'קופה POS ענן',
                        'דוח נוכחות ושכר',
                        'קיוסקים לשירות עצמי',
                        'מסכי תצוגה ללא הגבלה',
                        'עד 5 מדפסות',
                        'עובדים ללא הגבלה'
                    ]}
                    selected={selectedTier === 'enterprise'}
                    onSelect={() => setSelectedTier('enterprise')}
                    icon={<FaConciergeBell />}
                    badge="מסעדה מלאה"
                />
            </div>

            {/* Enterprise info banner */}
            {isEnterprise && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl text-center">
                    <p className="text-purple-700 font-semibold text-sm">
                        חבילת מסעדה מלאה כוללת אישור צוות לפני הפעלה — נחזור אליכם בהקדם לאחר ההרשמה
                    </p>
                </div>
            )}

            {/* Billing cycle */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">מחזור חיוב</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                    <PlanCard
                        title="חודשי"
                        price={isEnterprise ? null : pricing[selectedTier]?.monthly}
                        subtitle="חיוב חודשי"
                        selected={form.plan_type === 'monthly'}
                        onSelect={() => setForm((p) => ({ ...p, plan_type: 'monthly' }))}
                        customPrice={isEnterprise ? 'מותאם אישית' : null}
                    />
                    <PlanCard
                        title="שנתי"
                        price={isEnterprise ? null : pricing[selectedTier]?.yearly}
                        subtitle="חיסכון מול חודשי"
                        selected={form.plan_type === 'annual'}
                        onSelect={() => setForm((p) => ({ ...p, plan_type: 'annual' }))}
                        customPrice={isEnterprise ? 'מותאם אישית' : null}
                    />
                </div>
            </div>

            {stepErrors.tier && <p className="text-red-500 text-sm text-center mb-4">{stepErrors.tier}</p>}

            {/* Navigation */}
            <div className="flex justify-center">
                <button
                    onClick={onNext}
                    className="inline-flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all"
                >
                    <span>המשך לפרטי מסעדה</span>
                    <FaArrowLeft />
                </button>
            </div>
        </div>
    );
}

/* ========================================
   Step 2: Restaurant Details
======================================== */
function StepRestaurantDetails({ form, handleChange, cities, logoPreview, handleLogoChange, stepErrors, onNext, onBack }) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">ספרו לנו על המסעדה שלכם</h2>
                <p className="text-gray-500">מלאו את הפרטים הבאים כדי שנוכל להקים את המסעדה שלכם במערכת</p>
            </div>

            <div className="space-y-8">
                <Section title="פרטי המסעדה">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input name="name" label="שם המסעדה" value={form.name} onChange={handleChange} required error={stepErrors.name} />

                        {/* Tenant ID with tooltip + URL preview */}
                        <div className="space-y-1">
                            <label className="block text-sm text-gray-700">
                                <span className="flex items-center gap-1.5 mb-1 font-medium">
                                    מזהה מסעדה (כתובת באתר)
                                    <button
                                        type="button"
                                        onClick={() => setShowTooltip(!showTooltip)}
                                        className="text-gray-400 hover:text-brand-primary transition-colors"
                                    >
                                        <FaInfoCircle className="text-sm" />
                                    </button>
                                </span>
                                <input
                                    name="tenant_id"
                                    value={form.tenant_id}
                                    onChange={handleChange}
                                    required
                                    placeholder="לדוגמה: pizza-palace"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none transition-colors ${stepErrors.tenant_id ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-brand-primary'}`}
                                />
                            </label>

                            {/* Tooltip */}
                            {showTooltip && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                    <p className="font-semibold mb-1">למה זה חשוב?</p>
                                    <p>זהו הכתובת הייחודית של המסעדה שלך באינטרנט. בחרו שם קצר באנגלית שלקוחות יזכרו בקלות — זה ישמש ב-URL של התפריט שלכם.</p>
                                </div>
                            )}

                            {/* Live URL preview */}
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                                <FaGlobe className="text-gray-400 shrink-0" />
                                <span className="text-sm font-mono text-gray-600 truncate">
                                    takeeat.co.il/<strong className="text-brand-primary">{form.tenant_id || 'your-restaurant'}</strong>
                                </span>
                            </div>

                            {/* Examples */}
                            <p className="text-xs text-gray-500">
                                &#10003; pizza-haifa, my-burger, cafe-love &nbsp;&nbsp; &#10007; abc123, test, x
                            </p>

                            {stepErrors.tenant_id && <span className="text-xs text-red-500 block">{stepErrors.tenant_id}</span>}
                        </div>

                        <Input name="phone" label="טלפון המסעדה" value={form.phone} onChange={handleChange} required inputMode="tel" error={stepErrors.phone} />
                        <Select
                            name="city"
                            label="עיר"
                            value={form.city}
                            onChange={handleChange}
                            options={cities.map((city) => ({ value: city.name, label: city.hebrew_name || city.name }))}
                            placeholder="בחר עיר"
                            required
                            error={stepErrors.city}
                        />
                        <div className="space-y-2">
                            <span className="block text-sm text-gray-700 font-medium">לוגו (אופציונלי)</span>
                            {logoPreview && (
                                <img src={logoPreview} alt="תצוגה מקדימה" className="h-20 w-20 object-contain bg-gray-50 border rounded-xl p-2" />
                            )}
                            <input type="file" accept="image/*" onChange={handleLogoChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary text-sm" />
                            <p className="text-xs text-gray-500">עד 2MB, פורמטים: jpeg, png, webp</p>
                        </div>
                        <Input name="address" label="כתובת (אופציונלי)" value={form.address} onChange={handleChange} />
                    </div>
                </Section>

                {/* Restaurant type */}
                <Section title="סוג המסעדה (לתוצאות AI טובות יותר)">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { value: 'pizza', label: 'פיצרייה', icon: FaPizzaSlice, color: 'text-orange-600' },
                            { value: 'shawarma', label: 'שווארמה / פלאפל', icon: GiKebabSpit, color: 'text-amber-600' },
                            { value: 'burger', label: 'המבורגר', icon: FaHamburger, color: 'text-red-600' },
                            { value: 'bistro', label: 'ביסטרו / שף', icon: GiChefToque, color: 'text-purple-600' },
                            { value: 'catering', label: 'קייטרינג', icon: FaConciergeBell, color: 'text-blue-600' },
                            { value: 'general', label: 'כללי', icon: FaUtensils, color: 'text-gray-600' },
                        ].map(type => {
                            const Icon = type.icon;
                            return (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => handleChange({ target: { name: 'restaurant_type', value: type.value, type: 'button' } })}
                                    className={`p-4 rounded-xl border-2 transition-all ${form.restaurant_type === type.value
                                        ? 'border-brand-primary bg-brand-primary/10 shadow-md'
                                        : 'border-gray-200 hover:border-brand-primary/50'
                                        }`}
                                >
                                    <Icon className={`text-3xl mb-1 mx-auto ${type.color}`} />
                                    <div className="text-sm font-medium text-gray-900">{type.label}</div>
                                </button>
                            );
                        })}
                    </div>
                    {form.restaurant_type === 'general' && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            בחירת סוג ספציפי תשפר את תיאורי המנות מה-AI
                        </div>
                    )}
                </Section>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                    <FaArrowRight />
                    <span>חזרה</span>
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="inline-flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all"
                >
                    <span>המשך לפרטי בעלים</span>
                    <FaArrowLeft />
                </button>
            </div>
        </div>
    );
}

/* ========================================
   Step 3: Owner Details & Verification
======================================== */
function StepOwnerDetails({ form, handleChange, handleSendCode, codeSending, stepErrors, onNext, onBack }) {
    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">פרטי הבעלים ואימות</h2>
                <p className="text-gray-500">הזינו את פרטי הבעלים ואמתו את מספר הטלפון</p>
            </div>

            <div className="space-y-8">
                {/* Owner details */}
                <Section title="פרטי בעלים">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input name="owner_name" label="שם מלא" value={form.owner_name} onChange={handleChange} required error={stepErrors.owner_name} />
                        <Input name="owner_email" label="דוא״ל" value={form.owner_email} onChange={handleChange} type="email" required error={stepErrors.owner_email} />
                        <Input name="owner_phone" label="טלפון נייד" value={form.owner_phone} onChange={handleChange} required placeholder="05x-xxxxxxx" inputMode="tel" error={stepErrors.owner_phone} />
                    </div>
                </Section>

                {/* Password */}
                <Section title="סיסמה">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input name="password" label="סיסמה" value={form.password} onChange={handleChange} type="password" required placeholder="מינימום 6 תווים" error={stepErrors.password} />
                        <Input name="password_confirmation" label="אישור סיסמה" value={form.password_confirmation} onChange={handleChange} type="password" required placeholder="הקלד שוב את הסיסמה" error={stepErrors.password_confirmation} />
                    </div>
                </Section>

                {/* Phone verification */}
                <Section title="אימות טלפון">
                    <div className="max-w-md">
                        <p className="text-gray-500 text-sm mb-4">נשלח קוד אימות ל-{form.owner_phone || 'הטלפון שהזנת'}</p>

                        <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={codeSending}
                            className="w-full px-4 py-3 border-2 border-brand-primary text-brand-primary rounded-xl font-semibold hover:bg-brand-primary/5 disabled:opacity-50 transition-all mb-4"
                        >
                            {codeSending ? 'שולח קוד...' : 'שלח קוד אימות ב-SMS'}
                        </button>

                        <Input
                            name="verification_code"
                            label="קוד אימות (6 ספרות)"
                            value={form.verification_code}
                            onChange={handleChange}
                            required
                            inputMode="numeric"
                            placeholder="הקלד את הקוד שהתקבל"
                            error={stepErrors.verification_code}
                        />
                    </div>
                </Section>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                    <FaArrowRight />
                    <span>חזרה</span>
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="inline-flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all"
                >
                    <span>המשך לסיכום</span>
                    <FaArrowLeft />
                </button>
            </div>
        </div>
    );
}

/* ========================================
   Step 4: Summary & Submit
======================================== */
function StepSummary({ form, selectedTier, pricing, currentPrice, logoPreview, loading, stepErrors, agreedTerms, setAgreedTerms, handleSubmit, onBack, goToStep }) {
    const tierLabels = { basic: 'אתר הזמנות', pro: 'ניהול חכם', enterprise: 'מסעדה מלאה' };
    const typeLabels = { pizza: 'פיצרייה', shawarma: 'שווארמה / פלאפל', burger: 'המבורגר', bistro: 'ביסטרו / שף', catering: 'קייטרינג', general: 'כללי' };
    const isEnterprise = selectedTier === 'enterprise';

    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">סיכום לפני שליחה</h2>
                <p className="text-gray-500">בדקו שהכל נכון לפני שליחת הטופס</p>
            </div>

            {/* Enterprise notice */}
            {isEnterprise && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-purple-700 font-bold text-sm text-center">
                        הרשמתך ממתינה לאישור צוות TakeEat — נחזור אליכם בהקדם לאחר הגשת הטופס
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {/* Plan summary */}
                <SummarySection title="תכנית שנבחרה" onEdit={() => goToStep(1)}>
                    <SummaryRow label="תכנית" value={tierLabels[selectedTier]} />
                    <SummaryRow label="מחזור חיוב" value={form.plan_type === 'annual' ? 'שנתי' : 'חודשי'} />
                    <SummaryRow label="מחיר" value={currentPrice ? `₪${currentPrice?.toLocaleString()}` : 'מותאם אישית'} />
                </SummarySection>

                {/* Restaurant summary */}
                <SummarySection title="פרטי מסעדה" onEdit={() => goToStep(2)}>
                    <SummaryRow label="שם המסעדה" value={form.name} />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">כתובת באתר</span>
                        <span className="text-sm font-mono text-brand-primary">takeeat.co.il/{form.tenant_id}</span>
                    </div>
                    <SummaryRow label="טלפון" value={form.phone} />
                    <SummaryRow label="עיר" value={form.city} />
                    {form.address && <SummaryRow label="כתובת" value={form.address} />}
                    <SummaryRow label="סוג" value={typeLabels[form.restaurant_type] || form.restaurant_type} />
                    {logoPreview && (
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">לוגו</span>
                            <img src={logoPreview} alt="לוגו" className="h-10 w-10 object-contain rounded-lg border" />
                        </div>
                    )}
                </SummarySection>

                {/* Owner summary */}
                <SummarySection title="פרטי בעלים" onEdit={() => goToStep(3)}>
                    <SummaryRow label="שם" value={form.owner_name} />
                    <SummaryRow label="דוא״ל" value={form.owner_email} />
                    <SummaryRow label="טלפון" value={form.owner_phone} />
                </SummarySection>

                {/* Trial info */}
                {!isEnterprise && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-green-700 font-semibold text-sm">ללא חיוב מיידי</p>
                        <p className="text-green-600 text-xs mt-1">
                            60 יום ניסיון חינם או 50 הזמנות ראשונות. ניתן לשלם ולנעול מחיר בכל רגע.
                        </p>
                    </div>
                )}

                {/* Terms checkbox */}
                <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-gray-200 hover:border-brand-primary/50 transition-all">
                    <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm text-gray-700">
                        אני מאשר/ת את{' '}
                        <Link to="/legal/restaurant" className="text-brand-primary hover:underline font-semibold">
                            תנאי השימוש למסעדנים
                        </Link>
                        {' '}ו{' '}
                        <Link to="/legal/privacy" className="text-brand-primary hover:underline font-semibold">
                            מדיניות הפרטיות
                        </Link>
                    </span>
                </label>
                {stepErrors.terms && <p className="text-red-500 text-sm">{stepErrors.terms}</p>}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                    <FaArrowRight />
                    <span>חזרה</span>
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>נרשם...</span>
                        </>
                    ) : (
                        <>
                            <FaCheck />
                            <span>{isEnterprise ? 'שלח בקשת הצטרפות' : 'סיום הרשמה — התחלת 60 יום ניסיון'}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

/* ========================================
   Shared Sub-Components
======================================== */
function SummarySection({ title, onEdit, children }) {
    return (
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">{title}</h3>
                <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline font-medium"
                >
                    <FaPen className="text-[10px]" />
                    עריכה
                </button>
            </div>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}

function SummaryRow({ label, value }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-semibold text-gray-900">{value || '-'}</span>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {children}
        </div>
    );
}

function Input({ label, name, value, onChange, type = 'text', className = '', required = false, helper = '', error = '', ...rest }) {
    return (
        <label className={`block text-sm text-gray-700 ${className}`}>
            <span className="block mb-1 font-medium">{label}</span>
            <input
                name={name}
                value={value}
                onChange={onChange}
                type={type}
                required={required}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none transition-colors ${error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-brand-primary'}`}
                {...rest}
            />
            {helper && <span className="text-xs text-gray-500 mt-1 block">{helper}</span>}
            {error && <span className="text-xs text-red-500 mt-1 block">{error}</span>}
        </label>
    );
}

function Select({ label, name, value, onChange, options = [], placeholder = '', className = '', required = false, error = '' }) {
    return (
        <label className={`block text-sm text-gray-700 ${className}`}>
            <span className="block mb-1 font-medium">{label}</span>
            <select
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none bg-white text-right transition-colors ${error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-brand-primary'}`}
            >
                <option value="" disabled>{placeholder || 'בחר'}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {error && <span className="text-xs text-red-500 mt-1 block">{error}</span>}
        </label>
    );
}

function TierCard({ tier, title, subtitle, monthlyPrice, yearlyPrice, aiCredits, features, selected, onSelect, icon, badge, contactOnly }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`relative w-full text-right border-2 rounded-2xl p-6 hover:border-brand-primary transition-all ${selected ? 'border-brand-primary bg-brand-primary/5 shadow-lg' : 'border-gray-200'} ${tier === 'enterprise' ? 'bg-gradient-to-b from-purple-50/50 to-white' : ''}`}
        >
            {badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white ${tier === 'enterprise' ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-brand-primary'}`}>
                    {badge}
                </div>
            )}
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${selected ? (tier === 'enterprise' ? 'bg-purple-600 text-white' : 'bg-brand-primary text-white') : 'bg-gray-100 text-gray-600'}`}>
                    {icon}
                </div>
                <div className="text-right">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
                {contactOnly ? (
                    <div className="text-center">
                        <span className="text-2xl font-bold text-gray-900">מותאם אישית</span>
                        <p className="text-xs text-gray-500 mt-1">תמחור מותאם לצרכים שלכם</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center">
                            <span className="text-2xl font-bold text-gray-900">₪{monthlyPrice}</span>
                            <span className="text-gray-500 text-sm">/חודש</span>
                        </div>
                        <div className="text-center text-xs text-gray-400 mt-1">
                            או ₪{yearlyPrice?.toLocaleString()}/שנה
                        </div>
                    </>
                )}
            </div>
            {!contactOnly && aiCredits > 0 && (
                <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-lg p-2 mb-4 text-center">
                    <p className="text-brand-primary font-bold text-xs">{aiCredits} קרדיטים AI/חודש</p>
                    {tier === 'pro' && (
                        <p className="text-[10px] text-gray-500 mt-1">* בתקופת הניסיון: 50 קרדיטים בלבד</p>
                    )}
                </div>
            )}
            <ul className="space-y-2 text-right text-sm">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700">
                        <FaCheckCircle className={`mt-0.5 flex-shrink-0 ${selected ? (tier === 'enterprise' ? 'text-purple-500' : 'text-brand-primary') : 'text-gray-400'}`} />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </button>
    );
}

function PlanCard({ title, price, subtitle, selected, onSelect, customPrice }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-right border rounded-xl p-4 hover:border-brand-primary transition ${selected ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200'}`}
        >
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{customPrice || (price ? `₪${price}` : 'מותאם אישית')}</p>
            {subtitle && <p className="text-xs text-green-600">{subtitle}</p>}
        </button>
    );
}
