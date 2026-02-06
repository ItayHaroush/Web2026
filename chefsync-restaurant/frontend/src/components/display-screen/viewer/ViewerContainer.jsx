import { useState, useEffect, useRef } from 'react';
import { buildGoogleFontsUrl, getFontById } from '../shared/fontDefinitions';

export default function ViewerContainer({ designOptions, preset, children }) {
    const [cursorHidden, setCursorHidden] = useState(false);
    const cursorTimer = useRef(null);

    // Hide cursor after 3s inactivity
    useEffect(() => {
        const handleMove = () => {
            setCursorHidden(false);
            if (cursorTimer.current) clearTimeout(cursorTimer.current);
            cursorTimer.current = setTimeout(() => setCursorHidden(true), 3000);
        };
        window.addEventListener('mousemove', handleMove);
        handleMove();
        return () => {
            window.removeEventListener('mousemove', handleMove);
            if (cursorTimer.current) clearTimeout(cursorTimer.current);
        };
    }, []);

    // Dynamic font loading
    useEffect(() => {
        const fonts = designOptions?.fonts;
        if (!fonts) return;
        const ids = [fonts.title, fonts.price, fonts.body].filter(Boolean);
        const url = buildGoogleFontsUrl(ids);
        if (!url) return;
        const link = document.createElement('link');
        link.href = url;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => { try { document.head.removeChild(link); } catch(e) {} };
    }, [designOptions?.fonts]);

    // Fullscreen on click
    const requestFullscreen = () => {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    };

    // Background
    const bgMode = designOptions?.background?.mode || 'preset';
    let bgClassName = preset.bg;
    let bgStyle = {};
    let bgOverlay = null;

    if (bgMode === 'solid' && designOptions.background.solid_color) {
        bgClassName = '';
        bgStyle = { backgroundColor: designOptions.background.solid_color };
    } else if (bgMode === 'gradient' && designOptions.background.gradient) {
        const g = designOptions.background.gradient;
        bgClassName = '';
        const dirMap = { 'to-b': '180deg', 'to-r': '90deg', 'to-br': '135deg', 'to-bl': '225deg' };
        bgStyle = { background: `linear-gradient(${dirMap[g.direction] || '135deg'}, ${g.from || '#000'}, ${g.to || '#333'})` };
    } else if (bgMode === 'image' && designOptions.background.image_url) {
        bgClassName = '';
        bgStyle = { backgroundColor: '#000' };
        bgOverlay = (
            <div
                className="fixed inset-0 z-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url(${designOptions.background.image_url})`,
                    opacity: designOptions.background.image_opacity || 0.3,
                }}
            />
        );
    }

    // Font scale
    const fontScale = designOptions?.layout?.font_scale || 1.0;
    const fontStyle = fontScale !== 1.0 ? { fontSize: `${fontScale}rem` } : {};

    // Font families as CSS vars
    const fonts = designOptions?.fonts;
    const fontVars = {};
    if (fonts?.title) fontVars['--font-title'] = getFontById(fonts.title).cssFamily;
    if (fonts?.price) fontVars['--font-price'] = getFontById(fonts.price).cssFamily;
    if (fonts?.body) fontVars['--font-body'] = getFontById(fonts.body).cssFamily;

    return (
        <div
            className={`min-h-screen ${bgClassName} flex flex-col relative ${cursorHidden ? 'cursor-none' : ''}`}
            style={{ ...bgStyle, ...fontStyle, ...fontVars }}
            dir="rtl"
            onClick={requestFullscreen}
        >
            {bgOverlay}
            <div className="relative z-[1] flex flex-col flex-1">
                {children}
            </div>
        </div>
    );
}
