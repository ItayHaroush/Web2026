import { useState } from 'react';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';

const MONTHLY_PRICE = 600;
const ANNUAL_PRICE = 5000;

export default function RegisterRestaurant() {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        tenant_id: '',
        phone: '',
        address: '',
        logo_url: '',
        owner_name: '',
        owner_email: '',
        owner_phone: '',
        password: '',
        plan_type: 'monthly',
        paid_upfront: false,
    });

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
            await api.post('/register-restaurant', form);
            toast.success('ההרשמה בוצעה בהצלחה');
            setForm((prev) => ({ ...prev, password: '' }));
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בהרשמה';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const currentPrice = form.plan_type === 'annual' ? ANNUAL_PRICE : MONTHLY_PRICE;

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-white py-12 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">הצטרפות כמסעדה</h1>
                <p className="text-gray-600 mb-6">בחרו מסלול, מלאו פרטים והתחילו להשתמש במערכת.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <PlanCard title="חודשי" price={MONTHLY_PRICE} selected={form.plan_type === 'monthly'} onSelect={() => setForm((p) => ({ ...p, plan_type: 'monthly' }))} />
                    <PlanCard title="שנתי" price={ANNUAL_PRICE} subtitle="הנחה" selected={form.plan_type === 'annual'} onSelect={() => setForm((p) => ({ ...p, plan_type: 'annual' }))} />
                    <div className="border rounded-xl p-4 bg-gray-50">
                        <label className="flex items-center gap-3 text-sm text-gray-700">
                            <input type="checkbox" name="paid_upfront" checked={form.paid_upfront} onChange={handleChange} className="w-4 h-4" />
                            שולם מראש
                        </label>
                        <p className="text-xs text-gray-500 mt-2">אם מסומן, התשלום ירשם כ-Paid (סכום מלא למסלול שנבחר).</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Section title="פרטי המסעדה">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input name="name" label="שם המסעדה" value={form.name} onChange={handleChange} required />
                            <Input name="tenant_id" label="Tenant ID (kebab-case)" value={form.tenant_id} onChange={handleChange} required />
                            <Input name="phone" label="טלפון" value={form.phone} onChange={handleChange} required />
                            <Input name="logo_url" label="URL לוגו" value={form.logo_url} onChange={handleChange} />
                            <Input name="address" label="כתובת" value={form.address} onChange={handleChange} className="md:col-span-2" />
                        </div>
                    </Section>

                    <Section title="פרטי בעלים">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input name="owner_name" label="שם" value={form.owner_name} onChange={handleChange} required />
                            <Input name="owner_email" label="דוא" value={form.owner_email} onChange={handleChange} type="email" required />
                            <Input name="owner_phone" label="טלפון" value={form.owner_phone} onChange={handleChange} required />
                            <Input name="password" label="סיסמה" value={form.password} onChange={handleChange} type="password" required />
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

function Input({ label, name, value, onChange, type = 'text', className = '', required = false }) {
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
            />
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
