import { usePromotions } from '../context/PromotionContext';
import { FaGift, FaCheck, FaExchangeAlt, FaPlus } from 'react-icons/fa';

export default function PromotionProgress({ onSelectGift, onNavigateToCategory }) {
    const { eligiblePromotions, selectedGifts } = usePromotions();

    if (!eligiblePromotions || eligiblePromotions.length === 0) return null;

    return (
        <div className="space-y-3">
            {eligiblePromotions.map(promo => {
                const { met, rules } = promo.progress || {};
                const totalRequired = (rules || []).reduce((sum, r) => sum + r.required, 0);
                const totalCurrent = (rules || []).reduce((sum, r) => sum + Math.min(r.current, r.required), 0);
                const progressPercent = totalRequired > 0 ? Math.min(100, (totalCurrent / totalRequired) * 100) : 0;
                const promoGifts = selectedGifts[String(promo.promotion_id)] || [];
                const hasSelectedGift = promoGifts.length > 0;

                return (
                    <div key={promo.promotion_id} className="bg-gradient-to-l from-brand-light to-brand-cream rounded-2xl p-4 border border-brand-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                            <FaGift className={met ? 'text-brand-primary' : 'text-gray-400'} size={16} />
                            <span className="font-bold text-gray-800 text-sm">{promo.name}</span>
                            {met && (
                                <span className="bg-brand-light text-brand-primary text-xs font-bold px-2 py-0.5 rounded-full mr-auto flex items-center gap-1">
                                    <FaCheck size={10} />
                                    עומד בתנאים
                                </span>
                            )}
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-white/60 rounded-full h-2 mb-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${met ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        {/* Rule details */}
                        <div className="flex flex-wrap gap-2 text-xs">
                            {(rules || []).map((rule, i) => {
                                const ruleMet = rule.current >= rule.required;
                                return (
                                    <span
                                        key={i}
                                        className={`px-2 py-1 rounded-lg font-medium ${ruleMet
                                            ? 'bg-brand-light text-brand-primary'
                                            : 'bg-white text-gray-600'
                                            }`}
                                    >
                                        {rule.current}/{rule.required} {rule.category_name}
                                    </span>
                                );
                            })}
                        </div>

                        {/* CTA for unmet rules — navigate to add items */}
                        {!met && onNavigateToCategory && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(rules || []).filter(r => r.current < r.required).map((rule, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onNavigateToCategory(rule.category_id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <FaPlus size={10} />
                                        <span>הוסף עוד {rule.required - rule.current} {rule.category_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* CTA when met */}
                        {met && onSelectGift && (() => {
                            if (hasSelectedGift) {
                                // מתנה כבר נבחרה - הצגת אישור + אפשרות שינוי
                                const freeItemRewards = (promo.rewards || []).filter(r => r.reward_type === 'free_item');
                                const allSpecific = freeItemRewards.length > 0 && freeItemRewards.every(r => r.reward_menu_item_id);

                                let giftLabel = '';
                                if (allSpecific) {
                                    giftLabel = freeItemRewards.map(r => {
                                        const name = r.reward_menu_item_name || 'מתנה';
                                        const qty = r.max_selectable || 1;
                                        return qty > 1 ? `${name} x${qty}` : name;
                                    }).join(', ');
                                } else {
                                    giftLabel = 'מתנה נבחרה';
                                }

                                return (
                                    <div className="mt-3 flex gap-2">
                                        <div className="flex-1 bg-brand-primary text-white py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                            <FaGift size={14} />
                                            <span>{giftLabel}</span>
                                            <FaCheck size={12} />
                                        </div>
                                        <button
                                            onClick={() => onSelectGift(promo)}
                                            className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 px-3 rounded-xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors flex items-center gap-1"
                                        >
                                            <FaExchangeAlt size={12} />
                                            שנה
                                        </button>
                                    </div>
                                );
                            }

                            // עדיין לא נבחרה מתנה - כפתור בחירה
                            return (
                                <button
                                    onClick={() => onSelectGift(promo)}
                                    className="mt-3 w-full bg-gradient-to-r from-brand-primary to-orange-600 text-white py-2.5 rounded-xl font-bold text-sm hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <FaGift size={14} />
                                    בחר/י מתנה
                                </button>
                            );
                        })()}
                    </div>
                );
            })}
        </div>
    );
}
