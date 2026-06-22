import React from 'react';

/**
 * עמוד 404 - דף לא נמצא
 */
export default function NotFoundPage({ variant = 'default', host = null }) {
    const isDomain = variant === 'domain';

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4" dir="rtl">
            <div className="text-center max-w-md">
                <h1 className="text-6xl font-bold text-brand-primary mb-4">404</h1>
                {isDomain ? (
                    <>
                        <p className="text-xl text-gray-800 font-black mb-2">הדומיין לא מחובר</p>
                        <p className="text-sm text-gray-500 mb-6">
                            {host ? (
                                <>הדומיין <span className="font-mono" dir="ltr">{host}</span> אינו משויך למסעדה פעילה במערכת.</>
                            ) : (
                                'הדומיין אינו משויך למסעדה פעילה במערכת.'
                            )}
                        </p>
                    </>
                ) : (
                    <p className="text-2xl text-gray-600 mb-6">דף לא נמצא</p>
                )}
                {!isDomain && (
                    <a
                        href="/"
                        className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
                    >
                        חזור לעמוד הבית
                    </a>
                )}
            </div>
        </div>
    );
}
