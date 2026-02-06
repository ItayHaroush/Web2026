import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getViewerContent } from '../../../services/displayScreenService';
import { PRESET_STYLES } from '../shared/presetStyles';
import { getAspectConfig } from '../shared/aspectRatioConfig';
import { migrateV1toV2, mergeWithDefaults } from '../shared/designOptionsUtils';

export default function useViewerData(token) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const refreshTimer = useRef(null);
    const slideTimer = useRef(null);

    const fetchContent = useCallback(async () => {
        try {
            const res = await getViewerContent(token);
            if (res.success) {
                setData(res.data);
                setError(false);
            }
        } catch (err) {
            console.error('Failed to fetch screen content:', err);
            if (!data) setError(true);
        }
    }, [token]);

    // Initial fetch
    useEffect(() => {
        fetchContent();
        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, [fetchContent]);

    // Auto-refresh interval
    useEffect(() => {
        if (data?.screen?.refresh_interval) {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
            refreshTimer.current = setInterval(fetchContent, data.screen.refresh_interval * 1000);
        }
        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, [data?.screen?.refresh_interval, fetchContent]);

    // Derived state
    const screen = data?.screen;
    const restaurant = data?.restaurant;
    const items = data?.items || [];
    const rawDesignOptions = screen?.design_options || {};

    const designOptions = useMemo(
        () => mergeWithDefaults(migrateV1toV2(rawDesignOptions)),
        [rawDesignOptions]
    );

    const isMenuboard = screen?.design_preset === 'menuboard';
    const aspectRatio = screen?.aspect_ratio || '16:9';
    const aspectConfig = getAspectConfig(aspectRatio);

    const itemsPerSlide = isMenuboard
        ? aspectConfig.menuboardItemsPerSlide
        : aspectConfig.itemsPerSlide;

    // Resolve effective preset key
    const effectivePresetKey = isMenuboard && designOptions.menuboard_theme === 'light'
        ? 'menuboard-light'
        : screen?.design_preset;
    const preset = PRESET_STYLES[effectivePresetKey] || PRESET_STYLES.classic;

    const totalSlides = Math.ceil(items.length / itemsPerSlide) || 1;
    const currentItems = screen?.display_type === 'rotating'
        ? items.slice(currentSlide * itemsPerSlide, (currentSlide + 1) * itemsPerSlide)
        : items;

    // Carousel auto-advance
    useEffect(() => {
        if (data?.screen?.display_type === 'rotating' && items.length > itemsPerSlide) {
            if (slideTimer.current) clearInterval(slideTimer.current);
            slideTimer.current = setInterval(() => {
                setCurrentSlide(prev => (prev + 1) % totalSlides);
            }, (data.screen.rotation_speed || 5) * 1000);
        }
        return () => {
            if (slideTimer.current) clearInterval(slideTimer.current);
        };
    }, [data?.screen?.display_type, data?.screen?.rotation_speed, items.length, itemsPerSlide, totalSlides]);

    // Group by category for menuboard
    const groupedItems = useMemo(() => {
        if (!isMenuboard || currentItems.length === 0) return null;
        const groups = {};
        currentItems.forEach(item => {
            const cat = item.category || 'כללי';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [isMenuboard, currentItems]);

    return {
        data,
        error,
        screen,
        restaurant,
        items,
        currentItems,
        groupedItems,
        designOptions,
        preset,
        isMenuboard,
        aspectRatio,
        aspectConfig,
        currentSlide,
        totalSlides,
    };
}
