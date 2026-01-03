import React from 'react';

/**
 * עמוד 404 - דף לא נמצא
 */

export default function NotFoundPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-brand-primary mb-4">404</h1>
                <p className="text-2xl text-gray-600 mb-6">דף לא נמצא</p>
                <a
                    href="/"
                    className="bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
                >
                    חזור לעמוד הבית
                </a>
            </div>
        </div>
    );
}
