import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/apiClient';
import { getCities, searchCities } from '../services/restaurantService';
import { requestPhoneCode } from '../services/phoneAuthService';
import { toast } from 'react-hot-toast';
import { isValidIsraeliMobile } from '../utils/phone';
import { FaCheckCircle, FaCheck, FaArrowLeft, FaArrowRight, FaGlobe, FaInfoCircle, FaPen } from 'react-icons/fa';
import { FaStore, FaBrain, FaPizzaSlice, FaHamburger, FaUtensils, FaConciergeBell } from 'react-icons/fa';
import { GiKebabSpit, GiChefToque } from 'react-icons/gi';
import TakeEatIcon from '../images/TakeEatIcon.jpeg';

const DEFAULT_PRICING = {
    trial_duration_days: 60,
    orders_limit_enabled: true,
    basic_trial_orders_limit: 50,
    basic: { monthly: 299, yearly: 2990, ai_credits: 1, trial_ai_credits: 1 },
    pro: { monthly: 449, yearly: 4490, ai_credits: 500, trial_ai_credits: 50 },
    enterprise: { monthly: 0, yearly: 0, ai_credits: 1000, contactOnly: true },
};

const STEPS = [
    { number: 1, label: 'תכנית' },
    { number: 2, label: 'תפריט' },
    { number: 3, label: 'מסעדה' },
    { number: 4, label: 'בעלים' },
    { number: 5, label: 'סיכום' },
];

const TOTAL_STEPS = STEPS.length;

const TRANSITION_MESSAGES = {
    '1→2': { text: 'איך נטען את התפריט?', sub: 'ייבוא מוולט או הזנה ידנית' },
    '2→3': { text: 'מכינים את המסעדה שלכם...', sub: 'בואו נבנה משהו מדהים' },
    '3→4': { text: 'המסעדה מקבלת צורה!', sub: 'עוד קצת פרטים ומתחילים' },
    '4→5': { text: 'כמעט שם!', sub: 'בדקו שהכל מושלם' },
    '2→1': { text: 'חוזרים לבחירת תכנית', sub: '' },
    '3→2': { text: 'חוזרים לבחירת תפריט', sub: '' },
    '4→3': { text: 'חוזרים לפרטי המסעדה', sub: '' },
    '5→4': { text: 'חוזרים לפרטי בעלים', sub: '' },
};

const STORAGE_KEY = 'chefsync_registration_draft';
const WOLT_SELECTION_KEY = 'chefsync_wolt_import_selection';

export default function RegisterRestaurant() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [citiesReady, setCitiesReady] = useState(false);
    const [selectedTier, setSelectedTier] = useState('pro');
    const [pricing, setPricing] = useState(DEFAULT_PRICING);
    const [pricingLoaded, setPricingLoaded] = useState(false);
    const [form, setForm] = useState({
        name: '',
        tenant_id: '',
        wolt_url: '',
        restaurant_type: 'general',
        phone: '',
        address: '',
        city: '',
        city_id: '',
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
    const [citySuggestions, setCitySuggestions] = useState([]);
    const [citySearchLoading, setCitySearchLoading] = useState(false);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const citiesRef = useRef([]);

    // מסלול הקמה: 'wolt' — ייבוא מוולט (ממלא פרטים אוטומטית) | 'manual' — הזנה ידנית
    const [importChoice, setImportChoice] = useState(null);

    // בחירת מוצרים מוולט (נשמרת בדף /wolt-import)
    const [woltSelection, setWoltSelection] = useState(null);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(WOLT_SELECTION_KEY) || 'null');
            if (saved && Array.isArray(saved.categories)) {
                setWoltSelection(saved);
                // חזרה מדף בחירת המוצרים — ודא שהמסלול מסומן כייבוא והלינק מסונכרן
                setImportChoice((prev) => prev || 'wolt');
                if (saved.wolt_url) {
                    setForm((prev) => (prev.wolt_url === saved.wolt_url ? prev : { ...prev, wolt_url: saved.wolt_url }));
                }
            }
        } catch {
            setWoltSelection(null);
        }
    }, []);

    // הבחירה רלוונטית רק אם היא תואמת ללינק הוולט הנוכחי בטופס
    const woltSelectionValid = Boolean(
        woltSelection?.wolt_url && woltSelection.wolt_url === String(form.wolt_url || '').trim()
    );

    // מילוי אוטומטי של פרטי המסעדה מנתוני וולט — רק שדות ריקים (לא דורסים מה שהוקלד)
    useEffect(() => {
        if (!woltSelectionValid) return;
        const meta = woltSelection?.restaurant_meta || {};
        const slugTenantId = String(woltSelection?.slug || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

        setForm((prev) => {
            const next = { ...prev };
            let changed = false;
            const fill = (field, value) => {
                if (!String(prev[field] || '').trim() && value) {
                    next[field] = String(value);
                    changed = true;
                }
            };
            fill('name', meta.name);
            fill('tenant_id', slugTenantId);
            fill('phone', meta.phone);
            fill('address', meta.address);
            if (!String(prev.city || '').trim() && meta.city) {
                next.city = String(meta.city);
                next.city_id = '';
                changed = true;
            }
            return changed ? next : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [woltSelectionValid]);

    const handleChooseWoltProducts = () => {
        const url = String(form.wolt_url || '').trim();
        if (!url) {
            toast.error('הדביקו קודם קישור מסעדה מוולט');
            return;
        }
        navigate(`/wolt-import?url=${encodeURIComponent(url)}`);
    };

    const handleClearWoltSelection = () => {
        localStorage.removeItem(WOLT_SELECTION_KEY);
        setWoltSelection(null);
        toast.success('הבחירה הוסרה — טענו את התפריט מחדש או עברו להזנה ידנית');
    };

    // Wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [direction, setDirection] = useState('forward');
    const [isAnimating, setIsAnimating] = useState(false);
    const [stepErrors, setStepErrors] = useState({});
    const contentRef = useRef(null);

    // Transition overlay state
    const [showTransition, setShowTransition] = useState(false);
    const [transitionClosing, setTransitionClosing] = useState(false);
    const [transitionMsg, setTransitionMsg] = useState({ text: '', sub: '' });

    // נטען רק לאחר שהטיוטה נקראה — מונע מהשמירה האוטומטית לדרוס את הטיוטה במצב ההתחלתי (StrictMode מריץ אפקטים פעמיים)
    const [draftLoaded, setDraftLoaded] = useState(false);

    // Load saved draft on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem(STORAGE_KEY);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                setForm((prev) => ({ ...prev, ...(draft.form || {}) }));
                setSelectedTier(draft.selectedTier || 'pro');
                setCurrentStep(Math.min(draft.currentStep || 1, TOTAL_STEPS));
                setAgreedTerms(draft.agreedTerms || false);
                if (draft.importChoice) {
                    setImportChoice(draft.importChoice);
                }
                if (draft.logoPreview) {
                    setLogoPreview(draft.logoPreview);
                }
            } catch (err) {
                console.error('שגיאה בטעינת הטיוטה השמורה', err);
            }
        }
        setDraftLoaded(true);
    }, []);

    // Auto-save draft whenever form data changes (silent)
    useEffect(() => {
        if (!draftLoaded) return;
        const draft = {
            form,
            selectedTier,
            currentStep,
            agreedTerms,
            logoPreview,
            importChoice,
            timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }, [draftLoaded, form, selectedTier, currentStep, agreedTerms, logoPreview, importChoice]);

    const loadCities = useCallback(async () => {
        setCitiesReady(false);
        try {
            const items = await getCities();
            setCities(Array.isArray(items) ? items : []);
        } catch (err) {
            console.error('שגיאה בטעינת רשימת ערים', err);
            setCities([]);
        } finally {
            setCitiesReady(true);
        }
    }, []);

    useEffect(() => {
        void loadCities();
    }, [loadCities]);

    useEffect(() => {
        citiesRef.current = Array.isArray(cities) ? cities : [];
    }, [cities]);

    useEffect(() => {
        const query = String(form.city || '').trim();
        if (query.length < 2) {
            setCitySuggestions([]);
            setCitySearchLoading(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setCitySearchLoading(true);
            const remoteResults = await searchCities(query);
            const localResults = (citiesRef.current || [])
                .filter((city) => {
                    const text = `${city?.hebrew_name || ''} ${city?.name || ''}`.toLowerCase();
                    return text.includes(query.toLowerCase());
                })
                .slice(0, 10)
                .map((city) => ({
                    id: city.id,
                    name: city.name,
                    hebrew_name: city.hebrew_name || city.name,
                    latitude: city.latitude,
                    longitude: city.longitude,
                }));

            const merged = [...remoteResults, ...localResults].filter(
                (city, index, arr) => city?.id && arr.findIndex((x) => String(x.id) === String(city.id)) === index
            );

            if (!cancelled) {
                setCitySuggestions(merged);
                setCitySearchLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [form.city]);

    useEffect(() => {
        const loadPricing = async () => {
            try {
                const { data } = await api.get('/pricing');
                if (data?.success && data?.data) {
                    setPricing(data.data);
                }
            } catch (err) {
                console.error('שגיאה בטעינת מחירים, שימוש ב-defaults', err);
            } finally {
                setPricingLoaded(true);
            }
        };
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

    const validateImportStep = () => {
        const errors = {};
        if (!importChoice) {
            errors.importChoice = 'בחרו איך להקים את התפריט — ייבוא מוולט או הזנה ידנית';
        } else if (importChoice === 'wolt' && !woltSelectionValid) {
            errors.importChoice = 'טענו את התפריט מוולט ואשרו את בחירת המוצרים, או עברו להזנה ידנית';
        }
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
        if (!form.city_id && !form.city.trim()) errors.city = 'יש לבחור עיר מהרשימה או להקליד עיר חדשה';
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

    // --- Transition helper ---
    const animateTransition = useCallback((from, to, dir) => {
        const key = `${from}→${to}`;
        const msg = TRANSITION_MESSAGES[key] || { text: 'רגע...', sub: '' };
        setTransitionMsg(msg);
        setDirection(dir);
        setIsAnimating(true);
        setShowTransition(true);
        setTransitionClosing(false);

        // Hold overlay for longer on forward (building animation), shorter on back
        const holdTime = dir === 'forward' ? 1400 : 900;

        setTimeout(() => {
            setCurrentStep(to);
            setTransitionClosing(true);
            setTimeout(() => {
                setShowTransition(false);
                setTransitionClosing(false);
                setIsAnimating(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 300);
        }, holdTime);
    }, []);

    // --- Navigation ---
    const goNext = () => {
        if (isAnimating) return;
        let valid = false;
        if (currentStep === 1) valid = validateStep1();
        else if (currentStep === 2) valid = validateImportStep();
        else if (currentStep === 3) valid = validateStep2();
        else if (currentStep === 4) valid = validateStep3();
        if (!valid) return;

        animateTransition(currentStep, Math.min(currentStep + 1, TOTAL_STEPS), 'forward');
    };

    const goBack = () => {
        if (isAnimating || currentStep === 1) return;
        setStepErrors({});
        animateTransition(currentStep, Math.max(currentStep - 1, 1), 'backward');
    };

    const goToStep = (step) => {
        if (isAnimating || step >= currentStep) return;
        setStepErrors({});
        animateTransition(currentStep, step, 'backward');
    };

    // --- Submit ---
    const handleSubmit = async () => {
        if (!validateStep4()) return;
        setLoading(true);
        try {
            const formData = new FormData();
            const requiredFields = ['name', 'tenant_id', 'phone', 'owner_name', 'owner_email', 'owner_phone', 'password', 'password_confirmation', 'plan_type', 'verification_code'];
            requiredFields.forEach((field) => formData.append(field, form[field]));
            if (form.city_id) {
                formData.append('city_id', form.city_id);
            }
            if (form.city) {
                formData.append('city', form.city);
            }
            formData.append('tier', selectedTier);
            formData.append('restaurant_type', form.restaurant_type);
            if (form.address) formData.append('address', form.address);
            if (importChoice === 'wolt' && form.wolt_url) {
                formData.append('wolt_url', form.wolt_url);
                // בחירת מוצרים מדף הייבוא — נשלחת כבקשת ייבוא לאישור סופר-אדמין
                if (woltSelectionValid) {
                    formData.append('wolt_selection', JSON.stringify({
                        mode: woltSelection.mode,
                        slug: woltSelection.slug,
                        summary: woltSelection.summary,
                        categories: woltSelection.categories,
                        restaurant_meta: woltSelection.restaurant_meta,
                    }));
                }
            }
            if (form.latitude) formData.append('latitude', form.latitude);
            if (form.longitude) formData.append('longitude', form.longitude);
            formData.append('paid_upfront', '0');
            if (logoFile) formData.append('logo', logoFile);

            const response = await api.post('/register-restaurant', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const importRequest = response?.data?.wolt_import_request;
            const importError = response?.data?.wolt_import_error;

            if (importRequest) {
                const itemsCount = importRequest.summary?.items_count;
                toast.success(
                    itemsCount
                        ? `ההרשמה בוצעה! ${itemsCount} מוצרים מוולט נשלחו לאישור מנהל המערכת.`
                        : 'ההרשמה בוצעה! התפריט מוולט נשלח לאישור מנהל המערכת.',
                    { duration: 6000 }
                );
            } else if (importError) {
                toast.success('ההרשמה בוצעה בהצלחה!');
                toast.error(importError);
            } else {
                toast.success('ההרשמה בוצעה בהצלחה!');
            }
            // Clear the saved draft after successful registration
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(WOLT_SELECTION_KEY);
            navigate('/admin/login');
        } catch (error) {
            const validationErrors = error.response?.data?.errors;
            const firstValidationMessage = validationErrors
                ? Object.values(validationErrors).flat().find(Boolean)
                : null;
            const message = firstValidationMessage || error.response?.data?.message || 'שגיאה בהרשמה';
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

    const handleCityInputChange = (value) => {
        setForm((prev) => ({
            ...prev,
            city: value,
            city_id: '',
        }));
        setShowCitySuggestions(true);
        if (stepErrors.city) {
            setStepErrors((prev) => {
                const next = { ...prev };
                delete next.city;
                return next;
            });
        }
    };

    const handleCitySelect = (city) => {
        if (!city) return;

        setForm((prev) => ({
            ...prev,
            city: city.hebrew_name || city.name,
            city_id: String(city.id),
            latitude: city.latitude != null ? String(city.latitude) : prev.latitude,
            longitude: city.longitude != null ? String(city.longitude) : prev.longitude,
        }));
        setShowCitySuggestions(false);
    };

    const handleUseTypedCity = () => {
        const typedCity = String(form.city || '').trim();
        if (!typedCity) return;

        setForm((prev) => ({
            ...prev,
            city: typedCity,
            city_id: '',
        }));
        setShowCitySuggestions(false);
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

    const configuredTrialDays = Math.max(1, parseInt(String(pricing?.trial_duration_days ?? 60), 10) || 60);

    // Animation classes
    const getSlideClasses = () => {
        if (!isAnimating) return 'translate-x-0 opacity-100';
        if (direction === 'forward') return 'translate-x-full opacity-0 rtl:-translate-x-full';
        return '-translate-x-full opacity-0 rtl:translate-x-full';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-white py-8 px-4">
            {/* Transition Overlay */}
            {showTransition && (
                <StepTransitionOverlay
                    message={transitionMsg}
                    direction={direction}
                    closing={transitionClosing}
                />
            )}

            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">הצטרפו ל-TakeEat</h1>
                    <p className="text-gray-500 text-lg">
                        {configuredTrialDays} יום ניסיון חינם (לפי הגדרות המערכת). ללא כרטיס אשראי.
                    </p>
                </div>

                {/* Progress Stepper */}
                <ProgressStepper currentStep={currentStep} />

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
                    <div
                        ref={contentRef}
                        className={`transition-all duration-300 ease-in-out ${getSlideClasses()}`}
                    >
                        {currentStep === 1 && (
                            pricingLoaded ? (
                                <StepPlan
                                    selectedTier={selectedTier}
                                    setSelectedTier={setSelectedTier}
                                    pricing={pricing}
                                    configuredTrialDays={configuredTrialDays}
                                    form={form}
                                    setForm={setForm}
                                    stepErrors={stepErrors}
                                    onNext={goNext}
                                />
                            ) : (
                                <div className="flex justify-center items-center py-20">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
                                </div>
                            )
                        )}

                        {currentStep === 2 && (
                            <StepImportChoice
                                importChoice={importChoice}
                                setImportChoice={setImportChoice}
                                form={form}
                                handleChange={handleChange}
                                woltSelection={woltSelectionValid ? woltSelection : null}
                                onChooseWoltProducts={handleChooseWoltProducts}
                                onClearWoltSelection={handleClearWoltSelection}
                                stepErrors={stepErrors}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 3 && (
                            !citiesReady ? (
                                <div className="flex flex-col items-center justify-center py-24 px-6">
                                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-brand-primary border-t-transparent mb-4" />
                                    <p className="text-gray-600 font-medium">טוענים רשימת ערים…</p>
                                </div>
                            ) : cities.length === 0 ? (
                                <div className="p-10 text-center">
                                    <p className="text-gray-700 mb-4">לא ניתן היה לטעון רשימת ערים. בדקו חיבור לרשת או נסו שוב.</p>
                                    <button
                                        type="button"
                                        onClick={() => void loadCities()}
                                        className="px-6 py-2 rounded-xl bg-brand-primary text-white font-semibold hover:opacity-90"
                                    >
                                        נסו שוב
                                    </button>
                                </div>
                            ) : (
                                <StepRestaurantDetails
                                    form={form}
                                    handleChange={handleChange}
                                    citySuggestions={citySuggestions}
                                    citySearchLoading={citySearchLoading}
                                    showCitySuggestions={showCitySuggestions}
                                    onCityInputChange={handleCityInputChange}
                                    onCitySelect={handleCitySelect}
                                    onUseTypedCity={handleUseTypedCity}
                                    onCityFocus={() => setShowCitySuggestions(true)}
                                    onCityBlur={() => setTimeout(() => setShowCitySuggestions(false), 120)}
                                    logoPreview={logoPreview}
                                    handleLogoChange={handleLogoChange}
                                    stepErrors={stepErrors}
                                    importMode={importChoice === 'wolt' && woltSelectionValid}
                                    woltMeta={woltSelectionValid ? (woltSelection?.restaurant_meta || {}) : {}}
                                    onNext={goNext}
                                    onBack={goBack}
                                />
                            )
                        )}

                        {currentStep === 4 && (
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

                        {currentStep === 5 && (
                            <StepSummary
                                form={form}
                                cities={cities}
                                selectedTier={selectedTier}
                                pricing={pricing}
                                configuredTrialDays={configuredTrialDays}
                                currentPrice={currentPrice}
                                logoPreview={logoPreview}
                                loading={loading}
                                stepErrors={stepErrors}
                                agreedTerms={agreedTerms}
                                setAgreedTerms={setAgreedTerms}
                                handleSubmit={handleSubmit}
                                woltSelection={woltSelectionValid ? woltSelection : null}
                                importChoice={importChoice}
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
   Step Transition Overlay — Restaurant Building Animation
======================================== */
function StepTransitionOverlay({ message, direction, closing }) {
    const isForward = direction === 'forward';

    // Building block colors from brand palette
    const blockColors = [
        'from-brand-primary to-brand-secondary',
        'from-amber-400 to-orange-500',
        'from-orange-400 to-red-400',
        'from-yellow-400 to-amber-500',
        'from-brand-secondary to-brand-primary',
    ];

    // Sparkle positions for forward animation
    const sparkles = [
        { top: '20%', left: '15%', delay: '0.3s', size: 'w-3 h-3' },
        { top: '25%', right: '20%', delay: '0.5s', size: 'w-2 h-2' },
        { top: '60%', left: '10%', delay: '0.7s', size: 'w-2 h-2' },
        { top: '55%', right: '15%', delay: '0.4s', size: 'w-3 h-3' },
        { top: '40%', left: '25%', delay: '0.6s', size: 'w-2 h-2' },
        { top: '35%', right: '30%', delay: '0.8s', size: 'w-2 h-2' },
    ];

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center
                bg-gradient-to-br from-white via-orange-50 to-amber-50
                ${closing ? 'animate-wizard-overlay-out' : 'animate-wizard-overlay-in'}`}
        >
            {/* Expanding rings behind logo */}
            {isForward && (
                <>
                    <div className="absolute w-32 h-32 rounded-full border-2 border-brand-primary/20 animate-wizard-ring" />
                    <div className="absolute w-32 h-32 rounded-full border-2 border-brand-secondary/15 animate-wizard-ring" style={{ animationDelay: '0.3s' }} />
                    <div className="absolute w-32 h-32 rounded-full border-2 border-amber-400/10 animate-wizard-ring" style={{ animationDelay: '0.6s' }} />
                </>
            )}

            <div className="flex flex-col items-center gap-6">
                {/* Logo */}
                <div className={`relative ${isForward ? 'animate-wizard-logo' : 'animate-wizard-float'}`}>
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl shadow-brand-primary/30 border-2 border-white">
                        <img src={TakeEatIcon} alt="TakeEat" className="w-full h-full object-cover" />
                    </div>
                </div>

                {/* Building blocks animation (forward only) */}
                {isForward && (
                    <div className="flex items-end gap-1.5 h-16">
                        {blockColors.map((color, i) => (
                            <div
                                key={i}
                                className={`animate-wizard-block rounded-md bg-gradient-to-t ${color}`}
                                style={{
                                    width: '12px',
                                    height: `${20 + i * 8}px`,
                                    animationDelay: `${0.15 + i * 0.1}s`,
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Text message */}
                <div className="text-center animate-wizard-text">
                    <p className="text-xl font-bold text-gray-900">{message.text}</p>
                    {message.sub && (
                        <p className="text-sm text-gray-500 mt-1">{message.sub}</p>
                    )}
                </div>

                {/* Progress bar (forward only) */}
                {isForward && (
                    <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full animate-wizard-progress" />
                    </div>
                )}

                {/* Sparkle particles (forward only) */}
                {isForward && sparkles.map((s, i) => (
                    <div
                        key={i}
                        className={`absolute ${s.size} animate-wizard-sparkle`}
                        style={{
                            top: s.top,
                            left: s.left,
                            right: s.right,
                            animationDelay: s.delay,
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                            <path
                                d="M12 2L13.5 9.5L21 12L13.5 14.5L12 22L10.5 14.5L3 12L10.5 9.5L12 2Z"
                                fill="#F97316"
                                opacity="0.6"
                            />
                        </svg>
                    </div>
                ))}
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
                            className={`w-7 sm:w-12 md:w-16 h-1 mx-1 sm:mx-1.5 rounded-full transition-all duration-500 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
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
function StepPlan({ selectedTier, setSelectedTier, pricing, configuredTrialDays, form, setForm, stepErrors, onNext }) {
    const isEnterprise = selectedTier === 'enterprise';

    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">בחרו את התכנית המתאימה למסעדה שלכם</h2>
                <p className="text-gray-500 max-w-xl mx-auto">
                    כל התכניות כוללות {configuredTrialDays} יום ניסיון חינם (לפי הגדרות הפלטפורמה). התחילו לקבל הזמנות תוך
                    דקות, שדרגו בכל רגע.
                </p>
            </div>

            {/* Trial badge */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-5 py-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-700 font-semibold text-sm">
                        {configuredTrialDays} יום ניסיון חינם - ללא התחייבות
                    </span>
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
   Step 2: Import Choice (Wolt / Manual)
======================================== */
function StepImportChoice({
    importChoice,
    setImportChoice,
    form,
    handleChange,
    woltSelection,
    onChooseWoltProducts,
    onClearWoltSelection,
    stepErrors,
    onNext,
    onBack,
}) {
    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">איך תרצו להקים את התפריט?</h2>
                <p className="text-gray-500 max-w-xl mx-auto">
                    יש לכם עמוד בוולט? נייבא את התפריט, התמונות ופרטי המסעדה — ותמלאו הרבה פחות פרטים בהמשך.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-3xl mx-auto">
                {/* ייבוא מוולט */}
                <button
                    type="button"
                    onClick={() => setImportChoice('wolt')}
                    className={`relative text-right border-2 rounded-2xl p-6 transition-all hover:border-brand-primary ${importChoice === 'wolt' ? 'border-brand-primary bg-brand-primary/5 shadow-lg' : 'border-gray-200'}`}
                >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white bg-brand-primary">
                        מומלץ — חוסך זמן
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${importChoice === 'wolt' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                            <FaStore />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">ייבוא מוולט</h3>
                    </div>
                    <ul className="space-y-1.5 text-sm text-gray-600">
                        <li className="flex items-start gap-2"><FaCheckCircle className="mt-0.5 shrink-0 text-brand-primary" />תפריט מלא: קטגוריות, מוצרים, מחירים ותוספות</li>
                        <li className="flex items-start gap-2"><FaCheckCircle className="mt-0.5 shrink-0 text-brand-primary" />תמונות המוצרים ותמונת המסעדה</li>
                        <li className="flex items-start gap-2"><FaCheckCircle className="mt-0.5 shrink-0 text-brand-primary" />שם, טלפון, עיר וכתובת ימולאו אוטומטית</li>
                    </ul>
                </button>

                {/* הזנה ידנית */}
                <button
                    type="button"
                    onClick={() => setImportChoice('manual')}
                    className={`text-right border-2 rounded-2xl p-6 transition-all hover:border-brand-primary ${importChoice === 'manual' ? 'border-brand-primary bg-brand-primary/5 shadow-lg' : 'border-gray-200'}`}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${importChoice === 'manual' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                            <FaPen />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">הזנה ידנית</h3>
                    </div>
                    <ul className="space-y-1.5 text-sm text-gray-600">
                        <li className="flex items-start gap-2"><FaCheckCircle className="mt-0.5 shrink-0 text-gray-400" />ממלאים את פרטי המסעדה בטופס</li>
                        <li className="flex items-start gap-2"><FaCheckCircle className="mt-0.5 shrink-0 text-gray-400" />בונים את התפריט בעצמכם אחרי ההרשמה</li>
                        <li className="flex items-start gap-2"><FaCheckCircle className="mt-0.5 shrink-0 text-gray-400" />מתאים גם למסעדה שאינה בוולט</li>
                    </ul>
                </button>
            </div>

            {/* בלוק וולט — קישור ובחירת מוצרים */}
            {importChoice === 'wolt' && (
                <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl border border-orange-200 bg-orange-50/60">
                    <h4 className="text-sm font-bold text-orange-900 mb-1">קישור המסעדה בוולט</h4>
                    <p className="text-xs text-orange-800 mb-3">
                        הדביקו את הקישור, טענו את התפריט ובחרו אילו מוצרים לייבא. הייבוא יתבצע לאחר אישור מנהל המערכת.
                    </p>
                    <Input
                        name="wolt_url"
                        label="קישור מסעדה בוולט"
                        value={form.wolt_url}
                        onChange={handleChange}
                        placeholder="https://wolt.com/he/isr/afula/restaurant/xxxxx"
                    />

                    {woltSelection ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <FaCheckCircle className="shrink-0 text-emerald-500" aria-hidden />
                            <p className="flex-1 min-w-[10rem] text-xs font-bold text-emerald-800">
                                {woltSelection.mode === 'all'
                                    ? `כל התפריט נבחר לייבוא (${woltSelection.summary?.items_count || 0} מוצרים)`
                                    : `נבחרו ${woltSelection.summary?.items_count || 0} מתוך ${woltSelection.summary?.source_items_count || 0} מוצרים לייבוא`}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onChooseWoltProducts}
                                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                >
                                    עריכת בחירה
                                </button>
                                <button
                                    type="button"
                                    onClick={onClearWoltSelection}
                                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-gray-500 transition hover:bg-gray-100"
                                >
                                    הסרה
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onChooseWoltProducts}
                            disabled={!String(form.wolt_url || '').trim()}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        >
                            <FaUtensils aria-hidden />
                            טעינת התפריט ובחירת מוצרים
                        </button>
                    )}
                </div>
            )}

            {stepErrors.importChoice && (
                <p className="text-red-500 text-sm text-center mb-4">{stepErrors.importChoice}</p>
            )}

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
                    <span>המשך לפרטי מסעדה</span>
                    <FaArrowLeft />
                </button>
            </div>
        </div>
    );
}

/* ========================================
   Step 3: Restaurant Details
======================================== */
function StepRestaurantDetails({
    form,
    handleChange,
    citySuggestions,
    citySearchLoading,
    showCitySuggestions,
    onCityInputChange,
    onCitySelect,
    onUseTypedCity,
    onCityFocus,
    onCityBlur,
    logoPreview,
    handleLogoChange,
    stepErrors,
    importMode,
    woltMeta,
    onNext,
    onBack,
}) {
    const [showTooltip, setShowTooltip] = useState(false);
    const hasImportedImage = Boolean(woltMeta?.hero_image_url || woltMeta?.logo_url);

    return (
        <div className="p-6 md:p-10">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">ספרו לנו על המסעדה שלכם</h2>
                <p className="text-gray-500">
                    {importMode
                        ? 'רוב הפרטים מולאו אוטומטית מוולט — בדקו אותם והשלימו רק את החסר'
                        : 'מלאו את הפרטים הבאים כדי שנוכל להקים את המסעדה שלכם במערכת'}
                </p>
            </div>

            {importMode && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-gray-200 bg-transparent p-4">
                    <FaCheckCircle className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
                    <p className="text-sm text-gray-600">
                        פרטי המסעדה (שם, טלפון, עיר, כתובת) נטענו מוולט וניתנים לעריכה.
                        התפריט, התמונות ושאר הפרטים ייקלטו אוטומטית לאחר אישור הייבוא.
                    </p>
                </div>
            )}

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
                        <div className="space-y-1 relative">
                            <label className="block text-sm text-gray-700">
                                <span className="block mb-1 font-medium">עיר</span>
                                <input
                                    name="city"
                                    value={form.city}
                                    onChange={(e) => onCityInputChange(e.target.value)}
                                    onFocus={onCityFocus}
                                    onBlur={onCityBlur}
                                    required
                                    placeholder="הקלד לחיפוש עיר"
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none transition-colors ${stepErrors.city ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-brand-primary'}`}
                                    autoComplete="off"
                                />
                            </label>

                            {showCitySuggestions && (form.city || '').trim().length >= 2 && (
                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                    {citySearchLoading ? (
                                        <div className="px-3 py-2 text-sm text-gray-500">מחפש ערים...</div>
                                    ) : citySuggestions.length > 0 ? (
                                        citySuggestions.map((city) => (
                                            <button
                                                key={city.id}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => onCitySelect(city)}
                                                className="w-full text-right px-3 py-2 hover:bg-gray-50 text-sm"
                                            >
                                                {city.hebrew_name || city.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-2 py-2 space-y-1">
                                            <div className="px-2 py-1 text-sm text-gray-500">לא נמצאו תוצאות</div>
                                            <button
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={onUseTypedCity}
                                                className="w-full text-right px-3 py-2 rounded-md bg-brand-primary/10 text-brand-primary text-sm hover:bg-brand-primary/15"
                                            >
                                                להשתמש ב-"{form.city}" כעיר חדשה
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {form.city_id ? (
                                <span className="text-xs text-green-600 block">העיר נבחרה בהצלחה מהרשימה</span>
                            ) : (
                                <span className="text-xs text-gray-500 block">אפשר לבחור עיר מהרשימה או להמשיך עם עיר חדשה שהקלדת</span>
                            )}
                            {stepErrors.city && <span className="text-xs text-red-500 block">{stepErrors.city}</span>}
                        </div>
                        <div className="space-y-3">
                            {importMode && hasImportedImage && (
                                <div className="space-y-2">
                                    <span className="block text-sm text-gray-700 font-medium">תמונת המסעדה</span>
                                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-transparent p-3">
                                        <img
                                            src={woltMeta.hero_image_url || woltMeta.logo_url}
                                            alt="תמונת המסעדה מוולט"
                                            className="h-16 w-24 rounded-lg object-cover border border-gray-200"
                                        />
                                        <p className="text-xs text-gray-600">
                                            תמונת המסעדה תיקלט אוטומטית מוולט. אפשר להחליף אותה בכל רגע מהגדרות המסעדה.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <span className="block text-sm text-gray-700 font-medium">לוגו (אופציונלי)</span>
                                {logoPreview && (
                                    <img src={logoPreview} alt="תצוגה מקדימה" className="h-20 w-20 object-contain bg-gray-50 border rounded-xl p-2" />
                                )}
                                <input type="file" accept="image/*" onChange={handleLogoChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary text-sm" />
                                <p className="text-xs text-gray-500">עד 2MB, פורמטים: jpeg, png, webp</p>
                            </div>
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
function StepSummary({ form, cities, selectedTier, pricing, configuredTrialDays, currentPrice, logoPreview, loading, stepErrors, agreedTerms, setAgreedTerms, handleSubmit, woltSelection, importChoice, onBack, goToStep }) {
    const tierLabels = { basic: 'אתר הזמנות', pro: 'ניהול חכם', enterprise: 'מסעדה מלאה' };
    const typeLabels = { pizza: 'פיצרייה', shawarma: 'שווארמה / פלאפל', burger: 'המבורגר', bistro: 'ביסטרו / שף', catering: 'קייטרינג', general: 'כללי' };
    const isEnterprise = selectedTier === 'enterprise';
    const cityLabel = (cities || []).find(
        (x) => String(x.id) === String(form.city_id)
    )?.hebrew_name || form.city;

    const ordersLimitEnabled = pricing?.orders_limit_enabled !== false;
    const basicCap = pricing?.basic_trial_orders_limit;

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

                {/* Menu source summary */}
                <SummarySection title="מקור התפריט" onEdit={() => goToStep(2)}>
                    <SummaryRow
                        label="הקמת תפריט"
                        value={importChoice === 'wolt' ? 'ייבוא מוולט' : 'הזנה ידנית לאחר ההרשמה'}
                    />
                    {importChoice === 'wolt' && form.wolt_url && (
                        <SummaryRow
                            label="ייבוא מוולט"
                            value={woltSelection
                                ? (woltSelection.mode === 'all'
                                    ? `כל התפריט (${woltSelection.summary?.items_count || 0} מוצרים) — לאישור מנהל המערכת`
                                    : `${woltSelection.summary?.items_count || 0} מוצרים נבחרו — לאישור מנהל המערכת`)
                                : 'כל התפריט — לאישור מנהל המערכת'}
                        />
                    )}
                </SummarySection>

                {/* Restaurant summary */}
                <SummarySection title="פרטי מסעדה" onEdit={() => goToStep(3)}>
                    <SummaryRow label="שם המסעדה" value={form.name} />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">כתובת באתר</span>
                        <span className="text-sm font-mono text-brand-primary">takeeat.co.il/{form.tenant_id}</span>
                    </div>
                    <SummaryRow label="טלפון" value={form.phone} />
                    <SummaryRow label="עיר" value={cityLabel} />
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
                <SummarySection title="פרטי בעלים" onEdit={() => goToStep(4)}>
                    <SummaryRow label="שם" value={form.owner_name} />
                    <SummaryRow label="דוא״ל" value={form.owner_email} />
                    <SummaryRow label="טלפון" value={form.owner_phone} />
                </SummarySection>

                {/* Trial info */}
                {!isEnterprise && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-green-700 font-semibold text-sm">ללא חיוב מיידי</p>
                        <p className="text-green-600 text-xs mt-1 leading-relaxed">
                            {configuredTrialDays} ימי ניסיון חינם לפי הגדרות תקפת הניסיון במערכת.
                            {ordersLimitEnabled && typeof basicCap === 'number' ? (
                                <>
                                    {' '}
                                    בחבילת Basic בלבד עשויה לחול מגבלת תדירות (עד {basicCap} הזמנות בחודש בזמן הניסיון) רק כשהגבלת ההזמנות פועלת
                                    בשירות.
                                </>
                            ) : (
                                <> ללא מגבלת כמות הזמנות בשלב הניסיון לפי המצב הנוכחי במערכת.</>
                            )}{' '}
                            ניתן לשלם ולנעול מחיר בכל רגע.
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
                            <span>{isEnterprise ? 'שלח בקשת הצטרפות' : `סיום הרשמה — התחלת ${configuredTrialDays} יום ניסיון`}</span>
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
