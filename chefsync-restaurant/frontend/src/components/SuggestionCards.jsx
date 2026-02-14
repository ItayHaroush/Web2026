import { FaPlus, FaGlassWhiskey, FaUtensils } from 'react-icons/fa';
import { resolveAssetUrl } from '../utils/assets';

const DRINK_PATTERNS = ['שתייה', 'משקאות', 'משקה', 'drinks', 'שתיה'];
const TOPPING_PATTERNS = ['תוספת', 'תוספות', 'extras', 'sides'];

function matchesCategory(categoryName, patterns) {
    if (!categoryName) return false;
    const lower = categoryName.toLowerCase();
    return patterns.some(p => lower.includes(p));
}

export function getSuggestions(categories, cartItems) {
    const suggestions = [];
    const cartCategoryIds = new Set(cartItems.map(item => item.categoryId));

    // Find drink categories
    const drinkCategories = categories.filter(cat => matchesCategory(cat.name, DRINK_PATTERNS));
    const hasDrinks = drinkCategories.some(cat => cartCategoryIds.has(cat.id));

    if (!hasDrinks && drinkCategories.length > 0) {
        const drinkItems = drinkCategories.flatMap(cat =>
            (cat.items || []).filter(item => item.is_available !== false).slice(0, 8)
        );
        if (drinkItems.length > 0) {
            suggestions.push({
                type: 'drinks',
                title: 'לא הוספת שתייה!',
                subtitle: 'מה דעתך להוסיף משקה?',
                icon: FaGlassWhiskey,
                items: drinkItems,
            });
        }
    }

    // Find topping categories (only if there's at least one main item in cart)
    const toppingCategories = categories.filter(cat => matchesCategory(cat.name, TOPPING_PATTERNS));
    const hasToppings = toppingCategories.some(cat => cartCategoryIds.has(cat.id));
    const hasMainItems = cartItems.length > 0;

    if (!hasToppings && toppingCategories.length > 0 && hasMainItems) {
        const toppingItems = toppingCategories.flatMap(cat =>
            (cat.items || []).filter(item => item.is_available !== false).slice(0, 8)
        );
        if (toppingItems.length > 0) {
            suggestions.push({
                type: 'toppings',
                title: 'רוצה תוספת?',
                subtitle: 'תוספות פופולריות',
                icon: FaUtensils,
                items: toppingItems,
            });
        }
    }

    return suggestions;
}

export default function SuggestionCards({ suggestions, onQuickAdd, onOpenItem, restaurantLogo }) {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="space-y-4">
            {suggestions.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                    <div key={suggestion.type} className="bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/30">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="bg-blue-100 dark:bg-blue-800/30 p-2 rounded-xl">
                                <Icon className="text-blue-600 dark:text-blue-400" size={16} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{suggestion.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.subtitle}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                            {suggestion.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex-shrink-0 w-28 bg-white dark:bg-brand-dark-surface rounded-xl border border-gray-100 dark:border-brand-dark-border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => {
                                        if (item.use_variants || item.use_addons) {
                                            onOpenItem?.(item);
                                        } else {
                                            onQuickAdd?.(item);
                                        }
                                    }}
                                >
                                    <div className="h-20 bg-gray-50 dark:bg-brand-dark-border/50 overflow-hidden relative">
                                        {item.image_url ? (
                                            <img src={resolveAssetUrl(item.image_url)} alt="" className="w-full h-full object-cover" />
                                        ) : restaurantLogo ? (
                                            <div className="absolute inset-0 flex items-center justify-center p-3">
                                                <img src={resolveAssetUrl(restaurantLogo)} alt="" className="w-full h-full object-contain opacity-15" />
                                            </div>
                                        ) : null}
                                        <button
                                            className="absolute bottom-1 left-1 bg-brand-primary text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (item.use_variants || item.use_addons) {
                                                    onOpenItem?.(item);
                                                } else {
                                                    onQuickAdd?.(item);
                                                }
                                            }}
                                        >
                                            <FaPlus size={10} />
                                        </button>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                                        <p className="text-xs text-brand-primary font-bold">₪{item.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
