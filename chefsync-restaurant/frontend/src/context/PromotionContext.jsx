import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useCart } from './CartContext';
import promotionService from '../services/promotionService';

const PromotionContext = createContext();

export function PromotionProvider({ children }) {
    const { cartItems } = useCart();

    const [activePromotions, setActivePromotions] = useState([]);
    const [eligiblePromotions, setEligiblePromotions] = useState([]);
    const [selectedGifts, setSelectedGifts] = useState({});
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);

    // טעינת מבצעים פעילים בפעם הראשונה
    useEffect(() => {
        let cancelled = false;
        const fetchPromotions = async () => {
            try {
                const res = await promotionService.getActivePromotions();
                if (!cancelled && res.success) {
                    setActivePromotions(res.data || []);
                }
            } catch (err) {
                // silent - promotions are optional
            }
        };
        fetchPromotions();
        return () => { cancelled = true; };
    }, []);

    // בדיקת זכאות בכל שינוי בסל (debounced 500ms)
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (cartItems.length === 0) {
            setEligiblePromotions([]);
            setSelectedGifts({});
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                const items = cartItems
                    .filter(item => item.menuItemId)
                    .map(item => ({
                        menu_item_id: item.menuItemId,
                        category_id: item.categoryId || null,
                        qty: item.qty,
                    }));
                if (items.length === 0) {
                    setEligiblePromotions([]);
                    setLoading(false);
                    return;
                }
                const res = await promotionService.checkEligibility(items);
                if (res.success) {
                    const eligible = res.eligible || res.data || [];
                    setEligiblePromotions(eligible);

                    // הסרת מתנות עבור מבצעים שכבר לא עומדים בתנאים
                    const metPromotionIds = new Set(
                        eligible.filter(p => p.progress?.met).map(p => p.promotion_id)
                    );
                    setSelectedGifts(prev => {
                        const cleaned = {};
                        for (const [promoId, gifts] of Object.entries(prev)) {
                            if (metPromotionIds.has(Number(promoId))) {
                                cleaned[promoId] = gifts;
                            }
                        }
                        return cleaned;
                    });
                }
            } catch (err) {
                // silent
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [cartItems]);

    const selectGift = useCallback((promotionId, menuItemId) => {
        setSelectedGifts(prev => {
            const promoIdStr = String(promotionId);
            const current = prev[promoIdStr] || [];

            // מצא את המבצע כדי לבדוק max_selectable
            const promo = eligiblePromotions.find(p => p.promotion_id === promotionId);
            const maxSelectable = promo?.rewards?.[0]?.max_selectable ?? 1;

            if (current.includes(menuItemId)) {
                return prev; // כבר נבחר
            }

            if (current.length >= maxSelectable) {
                // החלפה - הסר את הראשון, הוסף את החדש
                return {
                    ...prev,
                    [promoIdStr]: [...current.slice(1), menuItemId],
                };
            }

            return {
                ...prev,
                [promoIdStr]: [...current, menuItemId],
            };
        });
    }, [eligiblePromotions]);

    const removeGift = useCallback((promotionId, menuItemId) => {
        setSelectedGifts(prev => {
            const promoIdStr = String(promotionId);
            const current = prev[promoIdStr] || [];
            return {
                ...prev,
                [promoIdStr]: current.filter(id => id !== menuItemId),
            };
        });
    }, []);

    const declineGift = useCallback((promotionId) => {
        setSelectedGifts(prev => {
            const next = { ...prev };
            delete next[String(promotionId)];
            return next;
        });
    }, []);

    const getAppliedPromotions = useCallback(() => {
        const applied = [];
        for (const promo of eligiblePromotions) {
            if (!promo.progress?.met) continue;

            const promoIdStr = String(promo.promotion_id);
            const gifts = selectedGifts[promoIdStr] || [];

            const allSpecific = (promo.rewards || []).every(r =>
                r.reward_type !== 'free_item' || r.reward_menu_item_id
            );

            // תמיד כולל מבצע שעמד בתנאים — הבקאנד מטפל בפריטים ספציפיים והנחות אוטומטית
            applied.push({
                promotion_id: promo.promotion_id,
                gift_items: allSpecific ? [] : gifts.map(menuItemId => ({ menu_item_id: menuItemId })),
            });
        }
        return applied;
    }, [eligiblePromotions, selectedGifts]);

    // חישוב קטגוריות המשתתפות במבצעים (לבאדג'ים בתפריט)
    const participatingCategoryIds = React.useMemo(() => {
        const ids = new Set();
        activePromotions.forEach(promo => {
            (promo.rules || []).forEach(rule => {
                if (rule.required_category_id) {
                    ids.add(rule.required_category_id);
                }
            });
        });
        return ids;
    }, [activePromotions]);

    const value = {
        activePromotions,
        eligiblePromotions,
        selectedGifts,
        loading,
        selectGift,
        removeGift,
        declineGift,
        getAppliedPromotions,
        participatingCategoryIds,
    };

    return (
        <PromotionContext.Provider value={value}>
            {children}
        </PromotionContext.Provider>
    );
}

export function usePromotions() {
    const context = useContext(PromotionContext);
    if (!context) {
        throw new Error('usePromotions must be used within PromotionProvider');
    }
    return context;
}
