import SuperAdminLayout from '../../layouts/SuperAdminLayout';

export default function SuperAdminSettings() {
    return (
        <SuperAdminLayout>
            <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">⚙️ הגדרות מערכת</h1>
                <p className="text-gray-600 mb-8">
                    מסך הגדרות למנהל המערכת. ניתן להוסיף כאן פרטי חיוב, מדיניות עמלות, והגדרות אבטחה.
                </p>

                <div className="bg-white rounded-2xl border shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">בקרוב</h2>
                    <p className="text-gray-600">
                        נרחיב כאן אפשרויות ניהול כגון שינוי שיעור שימוש במערכת, קביעת מטבע, ועידכון פרטי יצירת קשר.
                    </p>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
