import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function LegalMarkdownPage({ title, markdownPath }) {
    const [markdown, setMarkdown] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const absolutePath = useMemo(() => {
        if (!markdownPath) return '';
        return markdownPath.startsWith('/') ? markdownPath : `/${markdownPath}`;
    }, [markdownPath]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError('');

                const res = await fetch(absolutePath, {
                    headers: { Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1' },
                    cache: 'no-cache',
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const text = await res.text();
                if (!cancelled) setMarkdown(text);
            } catch (e) {
                if (!cancelled) {
                    setError('לא הצלחנו לטעון את מסמך התנאים.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (absolutePath) load();

        return () => {
            cancelled = true;
        };
    }, [absolutePath]);

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="text-sm font-semibold text-brand-primary hover:underline"
                    >
                        ← חזרה
                    </button>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            דף הבית
                        </Link>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-brand-dark mb-4">
                        {title}
                    </h1>

                    {loading && (
                        <div className="text-gray-600">טוען מסמך…</div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="text-gray-800 leading-7">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: (props) => (
                                        <h2 className="text-xl sm:text-2xl font-bold text-brand-dark mt-6 mb-3" {...props} />
                                    ),
                                    h2: (props) => (
                                        <h3 className="text-lg sm:text-xl font-bold text-brand-dark mt-6 mb-2" {...props} />
                                    ),
                                    h3: (props) => (
                                        <h4 className="text-base sm:text-lg font-bold text-brand-dark mt-5 mb-2" {...props} />
                                    ),
                                    p: (props) => (
                                        <p className="mb-3" {...props} />
                                    ),
                                    ul: (props) => (
                                        <ul className="list-disc pr-6 mb-3" {...props} />
                                    ),
                                    ol: (props) => (
                                        <ol className="list-decimal pr-6 mb-3" {...props} />
                                    ),
                                    li: (props) => (
                                        <li className="mb-1" {...props} />
                                    ),
                                    hr: () => (
                                        <div className="my-5 border-t border-gray-200" />
                                    ),
                                    strong: (props) => (
                                        <strong className="font-bold" {...props} />
                                    ),
                                    a: (props) => (
                                        <a className="text-brand-primary hover:underline" target="_blank" rel="noreferrer" {...props} />
                                    ),
                                    code: (props) => (
                                        <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded" {...props} />
                                    ),
                                }}
                            >
                                {markdown}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
