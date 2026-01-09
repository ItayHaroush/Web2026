import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/apiClient';
import { requestPhoneCode } from '../services/phoneAuthService';
import { toast } from 'react-hot-toast';

const MONTHLY_PRICE = 600;
const ANNUAL_PRICE = 5000;

export default function RegisterRestaurant() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [form, setForm] = useState({
        name: '',
        tenant_id: '',
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
    });
    const [codeSending, setCodeSending] = useState(false);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

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
        loadCities();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formData = new FormData();
            const requiredFields = ['name', 'tenant_id', 'phone', 'city', 'owner_name', 'owner_email', 'owner_phone', 'password', 'password_confirmation', 'plan_type', 'verification_code'];
            requiredFields.forEach((field) => {
                formData.append(field, form[field]);
            });

            if (form.address) {
                formData.append('address', form.address);
            }
            formData.append('paid_upfront', '0');

            if (logoFile) {
                formData.append('logo', logoFile);
            }

            await api.post('/register-restaurant', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('ההרשמה בוצעה בהצלחה');
            setForm((prev) => ({
                ...prev,
                password: '',
                password_confirmation: '',
                verification_code: '',
            }));
            setLogoFile(null);
            setLogoPreview(null);
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

    const currentPrice = form.plan_type === 'annual' ? ANNUAL_PRICE : MONTHLY_PRICE;

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-white py-12 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">הצטרפות כמסעדה</h1>
                <p className="text-gray-600 mb-6">בחרו מסלול, מלאו פרטים והתחילו להשתמש במערכת.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <PlanCard title="חודשי" price={MONTHLY_PRICE} subtitle="חיוב חודשי" selected={form.plan_type === 'monthly'} onSelect={() => setForm((p) => ({ ...p, plan_type: 'monthly' }))} />
                    <PlanCard title="שנתי" price={ANNUAL_PRICE} subtitle="חיסכון מול חודשי" selected={form.plan_type === 'annual'} onSelect={() => setForm((p) => ({ ...p, plan_type: 'annual' }))} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Section title="פרטי המסעדה">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input name="name" label="שם המסעדה" value={form.name} onChange={handleChange} required />
                            <Input name="tenant_id" label="Tenant ID (kebab-case)" value={form.tenant_id} onChange={handleChange} required placeholder="לדוגמה: pizza-palace" />
                            <Input name="phone" label="טלפון" value={form.phone} onChange={handleChange} required inputMode="tel" />
                            <Select
                                name="city"
                                label="עיר"
                                value={form.city}
                                onChange={handleChange}
                                options={cities.map((city) => ({ value: city.name, label: city.hebrew_name || city.name }))}
                                placeholder="בחר עיר"
                                required
                            />
                            <div className="space-y-2">
                                <span className="block text-sm text-gray-700 font-medium">לוגו (תמונה)</span>
                                {logoPreview && (
                                    <img src={logoPreview} alt="תצוגה מקדימה" className="h-20 w-20 object-contain bg-gray-50 border rounded-xl p-2" />
                                )}
                                <input type="file" accept="image/*" onChange={handleLogoChange} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary" />
                                <p className="text-xs text-gray-500">עד 2MB, פורמטים: jpeg, png, webp</p>
                            </div>
                            <Input name="address" label="כתובת" value={form.address} onChange={handleChange} className="md:col-span-2" />
                        </div>
                    </Section>

                    <Section title="פרטי בעלים">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input name="owner_name" label="שם" value={form.owner_name} onChange={handleChange} required />
                            <Input name="owner_email" label="דוא״ל" value={form.owner_email} onChange={handleChange} type="email" required />
                            <div className="space-y-2">
                                <Input name="owner_phone" label="טלפון" value={form.owner_phone} onChange={handleChange} required placeholder="05x-xxxxxxx" inputMode="tel" />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={codeSending}
                                    className="w-full px-4 py-2 border border-brand-primary text-brand-primary rounded-lg hover:bg-brand-primary/5 disabled:opacity-50"
                                >
                                    {codeSending ? 'שולח קוד...' : 'שלח קוד אימות ב-SMS'}
                                </button>
                                <p className="text-xs text-gray-500">נשלח למספר הבעלים לצורך אימות.</p>
                            </div>
                            <Input
                                name="verification_code"
                                label="קוד אימות שהתקבל ב-SMS"
                                value={form.verification_code}
                                onChange={handleChange}
                                required
                                inputMode="numeric"
                                placeholder="הקלד קוד בן 6 ספרות"
                            />
                            <Input name="password" label="סיסמה" value={form.password} onChange={handleChange} type="password" required placeholder="מינימום 6 תווים" />
                            <Input name="password_confirmation" label="אישור סיסמה" value={form.password_confirmation} onChange={handleChange} type="password" required placeholder="אימות סיסמה" />
                        </div>
                    </Section>

                    <div className="flex items-center justify-between bg-gray-50 border rounded-xl p-4">
                        <div>
                            <p className="text-sm text-gray-600">סכום חיוב לפי מסלול נבחר</p>
                            <p className="text-2xl font-bold text-gray-900">₪{currentPrice}</p>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 disabled:opacity-50"
                        >
                            {loading ? 'שולח...' : 'הצטרפות'}
                        </button>
                    </div>

                    <div className="text-xs text-gray-500 text-center">
                        בהרשמה אתה מאשר את{' '}
                        <Link to="/legal/restaurant" className="text-brand-primary hover:underline font-semibold">
                            תנאי השימוש למסעדנים
                        </Link>
                        {' '}ו{' '}
                        <Link to="/legal/privacy" className="text-brand-primary hover:underline font-semibold">
                            מדיניות הפרטיות
                        </Link>
                        .
                    </div>
                </form>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {children}
        </div>
    );
}

function Input({ label, name, value, onChange, type = 'text', className = '', required = false, ...rest }) {
    return (
        <label className={`block text-sm text-gray-700 ${className}`}>
            <span className="block mb-1 font-medium">{label}</span>
            <input
                name={name}
                value={value}
                onChange={onChange}
                type={type}
                required={required}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                {...rest}
            />
        </label>
    );
}

function Select({ label, name, value, onChange, options = [], placeholder = '', className = '', required = false }) {
    return (
        <label className={`block text-sm text-gray-700 ${className}`}>
            <span className="block mb-1 font-medium">{label}</span>
            <select
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary bg-white text-right"
            >
                <option value="" disabled>
                    {placeholder || 'בחר'}
                </option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function PlanCard({ title, price, subtitle, selected, onSelect }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-right border rounded-xl p-4 hover:border-brand-primary transition ${selected ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200'}`}
        >
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">₪{price}</p>
            {subtitle && <p className="text-xs text-green-600">{subtitle}</p>}
        </button>
    );
}
