import { useState, useEffect } from 'react';
import { usePromotions } from '../context/PromotionContext';
import { FaGift, FaCheck, FaTimes } from 'react-icons/fa';
import apiClient from '../services/apiClient';

export default function GiftSelectionModal({ promotion, onClose }) {
    const { selectGift, removeGift, declineGift, selectedGifts } = usePromotions();
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const reward = promotion?.rewards?.[0];
    const maxSelectable = reward?.max_selectable ?? 1;
    const rewardCategoryId = reward?.reward_category_id;
    const promoIdStr = String(promotion?.promotion_id);
    const currentGifts = selectedGifts[promoIdStr] || [];

    // בדיקה האם כל הפרסים הם מוצר ספציפי
    const freeItemRewards = (promotion?.rewards || []).filter(r => r.reward_type === 'free_item');
    const isSpecificMode = freeItemRewards.length > 0 && freeItemRewards.every(r => r.reward_menu_item_id);

    useEffect(() => {
        // מצב ספציפי - לא צריך לטעון פריטים
        if (isSpecificMode) {
            setLoading(false);
            return;
        }

        if (!rewardCategoryId) return;

        const fetchItems = async () => {
            try {
                setLoading(true);
                const res = await apiClient.get('/menu');
                const categories = res.data?.data || res.data?.categories || [];

                const rewardCategory = (Array.isArray(categories) ? categories : []).find(cat => cat.id === rewardCategoryId);
                const items = rewardCategory?.items || [];
                setMenuItems(items.filter(item => item.is_available !== false));
            } catch (err) {
                console.error('Failed to load gift items', err);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, [rewardCategoryId, isSpecificMode]);

    const handleSelectItem = (itemId) => {
        if (currentGifts.includes(itemId)) {
            removeGift(promotion.promotion_id, itemId);
        } else {
            selectGift(promotion.promotion_id, itemId);
        }
    };

    const handleAcceptSpecific = () => {
        // קבלת מוצר ספציפי - הוספת כל ה-menu_item_ids לselectedGifts
        freeItemRewards.forEach(r => {
            if (r.reward_menu_item_id) {
                selectGift(promotion.promotion_id, r.reward_menu_item_id);
            }
        });
        onClose();
    };

    const handleDecline = () => {
        declineGift(promotion.promotion_id);
        onClose();
    };

    if (!promotion) return null;

    // ====== מצב מוצר ספציפי ======
    if (isSpecificMode) {
        const giftLabel = freeItemRewards.map(r => {
            const name = r.reward_menu_item_name || 'מתנה';
            const qty = r.max_selectable || 1;
            return qty > 1 ? `${name} x${qty}` : name;
        }).join(', ');

        return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="bg-white dark:bg-brand-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-brand-dark-border shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-light dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-brand-primary">
                                <FaGift size={18} />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-900 dark:text-brand-dark-text">מתנה מיוחדת!</h2>
                                <p className="text-xs text-gray-500 dark:text-brand-dark-muted">{promotion.name}</p>
                            </div>
                        </div>
                        <button onClick={handleDecline} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-brand-dark-border">
                            <FaTimes size={18} />
                        </button>
                    </div>

                    {/* Gift Card */}
                    <div className="p-6 space-y-4">
                        <div className="bg-gradient-to-br from-brand-light to-brand-cream dark:from-brand-dark-bg dark:to-orange-900/20 rounded-2xl p-6 text-center border-2 border-brand-primary/30 dark:border-brand-dark-border">
                            <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaGift className="text-brand-primary" size={28} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-brand-dark-text mb-2">{giftLabel}</h3>
                            <span className="inline-block bg-brand-light dark:bg-orange-900/30 text-brand-primary text-sm font-bold px-4 py-1.5 rounded-full">
                                מתנה חינם
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 dark:border-brand-dark-border px-6 py-4 shrink-0 space-y-2">
                        <button
                            onClick={handleAcceptSpecific}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-primary to-orange-600 text-white font-bold hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            <FaGift size={14} />
                            קבל מתנה
                        </button>
                        <button
                            onClick={handleDecline}
                            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-brand-dark-border text-gray-600 dark:text-brand-dark-muted font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            לא תודה
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ====== מצב קטגוריה ======
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-brand-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-brand-dark-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-light dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-brand-primary">
                            <FaGift size={18} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-brand-dark-text">בחר/י מתנה</h2>
                            <p className="text-xs text-gray-500 dark:text-brand-dark-muted">{promotion.name} - עד {maxSelectable} {maxSelectable === 1 ? 'פריט' : 'פריטים'}</p>
                        </div>
                    </div>
                    <button onClick={handleDecline} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-brand-dark-border">
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400 dark:text-brand-dark-muted">טוען פריטים...</div>
                    ) : menuItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-brand-dark-muted">אין פריטים זמינים</div>
                    ) : (
                        menuItems.map(item => {
                            const isSelected = currentGifts.includes(item.id);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectItem(item.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-right ${isSelected
                                        ? 'bg-brand-light border-2 border-brand-primary shadow-sm'
                                        : 'bg-gray-50 dark:bg-brand-dark-bg border-2 border-transparent hover:border-gray-200 dark:hover:border-brand-dark-border'
                                        }`}
                                >
                                    {item.image_url && (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-gray-900 dark:text-brand-dark-text truncate">{item.name}</div>
                                        {item.description && (
                                            <p className="text-xs text-gray-500 dark:text-brand-dark-muted truncate">{item.description}</p>
                                        )}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-primary text-white' : 'bg-gray-200 dark:bg-brand-dark-border text-gray-400'}`}>
                                        {isSelected ? <FaCheck size={14} /> : <FaGift size={12} />}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 dark:border-brand-dark-border px-6 py-4 shrink-0 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-500 dark:text-brand-dark-muted">נבחרו {currentGifts.length} מתוך {maxSelectable}</span>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={currentGifts.length === 0}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-primary to-orange-600 text-white font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <FaCheck size={14} />
                        אישור בחירה
                    </button>
                    <button
                        onClick={handleDecline}
                        className="w-full py-3 rounded-xl bg-gray-100 dark:bg-brand-dark-border text-gray-600 dark:text-brand-dark-muted font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        לא תודה
                    </button>
                </div>
            </div>
        </div>
    );
}
