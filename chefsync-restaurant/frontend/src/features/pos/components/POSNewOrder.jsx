import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaMinus, FaTrash, FaShekelSign, FaShoppingCart, FaSearch } from 'react-icons/fa';
import api from '../../../services/apiClient';
import POSPaymentModal from './POSPaymentModal';

export default function POSNewOrder({ headers, posToken, onOrderCreated }) {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);

    useEffect(() => {
        fetchMenu();
    }, []);

    const fetchMenu = async () => {
        try {
            const res = await api.get('/menu', { headers });
            if (res.data.success) {
                const rawCategories = res.data.data || [];
                const cats = rawCategories.map(c => ({ id: c.id, name: c.name, icon: c.icon }));
                setCategories(cats);

                const flatItems = rawCategories.flatMap(cat =>
                    (cat.items || []).map(item => ({
                        ...item,
                        category: { id: cat.id, name: cat.name },
                    }))
                );
                setItems(flatItems);
                if (cats.length > 0) setActiveCategory(cats[0].id);
            }
        } catch (e) {
            console.error('Failed to fetch menu:', e);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item => {
        if (search) return item.name.includes(search);
        return activeCategory ? item.category?.id === activeCategory : true;
    });

    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(c => c.menu_item_id === item.id && !c.variant_name);
            if (existing) {
                return prev.map(c => c === existing ? { ...c, quantity: c.quantity + 1 } : c);
            }
            return [...prev, {
                menu_item_id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                quantity: 1,
                variant_name: null,
                addons: [],
            }];
        });
    };

    const updateQty = (index, delta) => {
        setCart(prev => {
            const next = [...prev];
            next[index] = { ...next[index], quantity: next[index].quantity + delta };
            if (next[index].quantity <= 0) next.splice(index, 1);
            return next;
        });
    };

    const removeItem = (index) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const cartTotal = cart.reduce((sum, item) => {
        let itemTotal = item.price * item.quantity;
        if (item.addons) {
            item.addons.forEach(a => { itemTotal += (a.price || 0) * item.quantity; });
        }
        return sum + itemTotal;
    }, 0);

    const handleOrderSuccess = () => {
        setCart([]);
        setShowPayment(false);
        onOrderCreated?.();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex h-full">
            {/* Menu side */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Search + Categories */}
                <div className="p-3 space-y-3 shrink-0">
                    <div className="relative">
                        <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pr-10 pl-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 focus:border-orange-500 focus:outline-none text-sm"
                            placeholder="חיפוש פריט..."
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setSearch(''); }}
                                className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all shrink-0 ${
                                    activeCategory === cat.id && !search
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Items Grid */}
                <div className="flex-1 overflow-y-auto p-3 pt-0 custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-right hover:border-orange-500/50 hover:bg-slate-700/50 transition-all active:scale-95 group"
                            >
                                {item.image_url && (
                                    <div className="w-full aspect-square rounded-xl mb-3 overflow-hidden bg-slate-700">
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    </div>
                                )}
                                <p className="text-white font-black text-sm leading-tight truncate">{item.name}</p>
                                <p className="text-orange-400 font-black text-lg mt-1">₪{item.price}</p>
                            </button>
                        ))}
                        {filteredItems.length === 0 && (
                            <p className="text-slate-600 text-center col-span-full py-12 font-bold">לא נמצאו פריטים</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart side */}
            <div className="w-80 lg:w-96 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
                <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-3">
                    <FaShoppingCart className="text-orange-400" />
                    <h3 className="text-white font-black">
                        סל ({cart.reduce((s, c) => s + c.quantity, 0)})
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {cart.length === 0 && (
                        <p className="text-slate-600 text-center py-12 font-bold text-sm">הסל ריק — בחר פריטים מהתפריט</p>
                    )}
                    {cart.map((item, idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/50">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-white font-bold text-sm flex-1">{item.name}</p>
                                <button onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 p-1 transition-colors">
                                    <FaTrash size={12} />
                                </button>
                            </div>
                            {item.variant_name && (
                                <p className="text-slate-500 text-xs mb-1">{item.variant_name}</p>
                            )}
                            {item.addons.length > 0 && (
                                <p className="text-slate-500 text-xs mb-1">{item.addons.map(a => a.name).join(', ')}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => updateQty(idx, -1)} className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 active:scale-90">
                                        <FaMinus size={10} />
                                    </button>
                                    <span className="text-white font-black text-sm w-6 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQty(idx, 1)} className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center hover:bg-slate-600 active:scale-90">
                                        <FaPlus size={10} />
                                    </button>
                                </div>
                                <span className="text-orange-400 font-black text-sm">
                                    ₪{(item.price * item.quantity).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total + Pay button */}
                <div className="border-t border-slate-700 p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-black">סה״כ</span>
                        <span className="text-white font-black text-2xl flex items-center gap-1">
                            <FaShekelSign className="text-sm text-orange-400" />
                            {cartTotal.toFixed(2)}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowPayment(true)}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                    >
                        המשך לתשלום
                    </button>
                </div>
            </div>

            {showPayment && (
                <POSPaymentModal
                    cart={cart}
                    total={cartTotal}
                    headers={headers}
                    posToken={posToken}
                    onClose={() => setShowPayment(false)}
                    onSuccess={handleOrderSuccess}
                />
            )}
        </div>
    );
}
