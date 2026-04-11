import { useState, useEffect } from 'react';
import { FaPlus, FaMinus, FaTrash, FaShekelSign, FaShoppingCart, FaSearch, FaPercent, FaTag } from 'react-icons/fa';
import api from '../../../services/apiClient';
import posApi from '../api/posApi';
import POSPaymentModal from './POSPaymentModal';
import POSCreditPaymentModal from './POSCreditPaymentModal';
import POSPaymentMethodModal from './POSPaymentMethodModal';
import { FaCashRegister } from 'react-icons/fa';
import POSSplitPaymentModal from './POSSplitPaymentModal';
import POSMenuItemModal, { posItemNeedsConfiguration } from './POSMenuItemModal';
import POSAmountKeypad from './POSAmountKeypad';
import { buildCartKey } from '../../../utils/cart';

export default function POSNewOrder({ headers, posToken, onOrderCreated, shift }) {
    // Require open shift
    if (!shift) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-20 h-20 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <FaCashRegister className="text-amber-400 text-3xl" />
                </div>
                <p className="text-white text-xl font-black mb-2">יש לפתוח משמרת</p>
                <p className="text-slate-400 text-sm">לא ניתן ליצור הזמנה ללא קופה פתוחה</p>
            </div>
        );
    }

    return <POSNewOrderInner headers={headers} posToken={posToken} onOrderCreated={onOrderCreated} />;
}

function POSNewOrderInner({ headers, posToken, onOrderCreated }) {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);
    /** @type {'dine_in' | 'takeaway'} */
    const [posOrderType, setPosOrderType] = useState('takeaway');
    const [paymentMethod, setPaymentMethod] = useState(null); // 'cash' | 'credit' | 'hold' | 'split'
    const [holdLoading, setHoldLoading] = useState(false);
    const [holdOrderId, setHoldOrderId] = useState(null);
    const [configureItem, setConfigureItem] = useState(null);
    const [customerName, setCustomerName] = useState('');

    // Discount state
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountType, setDiscountType] = useState('percentage'); // 'percentage' | 'fixed'
    const [discountValue, setDiscountValue] = useState('');
    const [discountReason, setDiscountReason] = useState('');

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

    const lineUnitTotal = (row) => {
        let u = row.price;
        if (row.addons?.length) {
            row.addons.forEach(a => { u += (a.price || 0); });
        }
        return u * row.quantity;
    };

    const mergeCartLine = (line) => {
        setCart(prev => {
            const key = line._cartKey;
            const existing = prev.find(c => c._cartKey === key);
            if (existing) {
                return prev.map(c => (c._cartKey === key ? { ...c, quantity: c.quantity + line.quantity } : c));
            }
            return [...prev, line];
        });
    };

    const handlePickMenuItem = (item) => {
        if (posItemNeedsConfiguration(item)) {
            setConfigureItem(item);
            return;
        }
        const line = {
            menu_item_id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: 1,
            variant_name: null,
            addons: [],
            _cartKey: buildCartKey(item.id, null, []),
        };
        mergeCartLine(line);
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

    const cartSubtotal = cart.reduce((sum, item) => {
        let itemTotal = item.price * item.quantity;
        if (item.addons) {
            item.addons.forEach(a => { itemTotal += (a.price || 0) * item.quantity; });
        }
        return sum + itemTotal;
    }, 0);

    const discVal = parseFloat(discountValue) || 0;
    const discountAmount = discVal > 0
        ? (discountType === 'percentage' ? Math.round(cartSubtotal * (discVal / 100) * 100) / 100 : Math.min(discVal, cartSubtotal))
        : 0;
    const cartTotal = Math.max(0, cartSubtotal - discountAmount);

    const clearDiscount = () => {
        setDiscountValue('');
        setDiscountReason('');
        setShowDiscount(false);
    };

    const handleOrderSuccess = () => {
        setCart([]);
        setShowPayment(false);
        setPaymentMethod(null);
        clearDiscount();
        setHoldOrderId(null);
        setCustomerName('');
        onOrderCreated?.();
    };

    const handlePaymentMethodSelect = async (method) => {
        setShowPayment(false);
        if (method === 'hold') {
            // Create order with hold
            setHoldLoading(true);
            try {
                const orderData = {
                    items: cart,
                    payment_method: 'hold',
                    order_type: posOrderType,
                    ...(customerName.trim() && { customer_name: customerName.trim() }),
                    ...(discountAmount > 0 && {
                        discount_type: discountType,
                        discount_value: discVal,
                        discount_reason: discountReason || undefined,
                    }),
                };
                const res = await posApi.createOrder(orderData, headers, posToken);
                if (res.data.success) {
                    setHoldOrderId(res.data.order?.id);
                    setTimeout(() => handleOrderSuccess(), 1500);
                }
            } catch (e) {
                alert(e.response?.data?.message || 'שגיאה ביצירת הזמנה');
            } finally {
                setHoldLoading(false);
            }
        } else if (method === 'split') {
            // רק פתיחת מודל פיצול — יצירת הזמנה תתבצע רק בעת אישור תשלום
            setPaymentMethod('split');
        } else {
            setPaymentMethod(method);
        }
    };

    const handlePaymentClose = () => {
        setPaymentMethod(null);
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
                            className="w-full min-w-0 pr-10 pl-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 focus:border-orange-500 focus:outline-none text-base"
                            placeholder="חיפוש פריט..."
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setSearch(''); }}
                                className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all shrink-0 ${activeCategory === cat.id && !search
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
                                onClick={() => handlePickMenuItem(item)}
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
                <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FaShoppingCart className="text-orange-400" />
                        <h3 className="text-white font-black">
                            סל ({cart.reduce((s, c) => s + c.quantity, 0)})
                        </h3>
                    </div>
                    {cart.length > 0 && (
                        <button
                            onClick={() => setShowDiscount(!showDiscount)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${discountAmount > 0
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                        >
                            <FaTag size={10} />
                            {discountAmount > 0 ? `הנחה ₪${discountAmount.toFixed(2)}` : 'הנחה'}
                        </button>
                    )}
                </div>

                {/* Discount panel */}
                {showDiscount && (
                    <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50 space-y-2 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDiscountType('percentage')}
                                className={`flex-1 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 ${discountType === 'percentage' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                            >
                                <FaPercent size={10} /> אחוז
                            </button>
                            <button
                                onClick={() => setDiscountType('fixed')}
                                className={`flex-1 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 ${discountType === 'fixed' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                            >
                                <FaShekelSign size={10} /> סכום קבוע
                            </button>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                            <p className="text-slate-500 text-[10px] font-bold mb-1">
                                {discountType === 'percentage' ? 'אחוז' : 'סכום (₪)'}
                            </p>
                            <p dir="ltr" className="text-white font-black text-lg text-center tabular-nums min-h-[28px]">
                                {discountValue || '0'}
                            </p>
                        </div>
                        <POSAmountKeypad value={discountValue} onChange={setDiscountValue} size="compact" className="mt-2" />
                        <input
                            type="text"
                            value={discountReason}
                            onChange={e => setDiscountReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-orange-500 focus:outline-none text-sm"
                            placeholder="סיבה (אופציונלי)"
                        />
                        {discountAmount > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-green-400 text-xs font-bold">הנחה: ₪{discountAmount.toFixed(2)}</span>
                                <button onClick={clearDiscount} className="text-red-400 text-xs font-bold hover:text-red-300">הסר</button>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {cart.length === 0 && (
                        <p className="text-slate-600 text-center py-12 font-bold text-sm">הסל ריק — בחר פריטים מהתפריט</p>
                    )}
                    {cart.map((item, idx) => (
                        <div key={item._cartKey || idx} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/50">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-white font-bold text-sm flex-1">{item.name}</p>
                                <button onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 p-1 transition-colors">
                                    <FaTrash size={12} />
                                </button>
                            </div>
                            {item.variant_name && (
                                <p className="text-slate-500 text-xs mb-1">{item.variant_name}</p>
                            )}
                            {item.addons?.length > 0 && (
                                <p className="text-slate-500 text-xs mb-1">{item.addons.map(a => (a.quantity || 1) > 1 ? `${a.name} ×${a.quantity}` : a.name).join(', ')}</p>
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
                                    ₪{lineUnitTotal(item).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total + Pay button */}
                <div className="border-t border-slate-700 p-4 space-y-3">
                    {discountAmount > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">סה״כ לפני הנחה</span>
                            <span className="text-slate-500 line-through">₪{cartSubtotal.toFixed(2)}</span>
                        </div>
                    )}
                    {discountAmount > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-green-400 font-bold flex items-center gap-1"><FaTag size={10} /> הנחה</span>
                            <span className="text-green-400 font-bold">-₪{discountAmount.toFixed(2)}</span>
                        </div>
                    )}
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
                <POSPaymentMethodModal
                    total={cartTotal}
                    orderType={posOrderType}
                    onOrderTypeChange={setPosOrderType}
                    customerName={customerName}
                    onCustomerNameChange={setCustomerName}
                    onSelect={handlePaymentMethodSelect}
                    onClose={() => setShowPayment(false)}
                />
            )}

            {paymentMethod === 'cash' && (
                <POSPaymentModal
                    cart={cart}
                    total={cartTotal}
                    headers={headers}
                    posToken={posToken}
                    orderType={posOrderType}
                    customerName={customerName}
                    onClose={handlePaymentClose}
                    onSuccess={handleOrderSuccess}
                    discountData={discountAmount > 0 ? { discount_type: discountType, discount_value: discVal, discount_reason: discountReason } : null}
                />
            )}

            {paymentMethod === 'credit' && (
                <POSCreditPaymentModal
                    cart={cart}
                    total={cartTotal}
                    headers={headers}
                    posToken={posToken}
                    orderType={posOrderType}
                    customerName={customerName}
                    onClose={handlePaymentClose}
                    onSuccess={handleOrderSuccess}
                />
            )}

            {paymentMethod === 'split' && (
                <POSSplitPaymentModal
                    cart={cart}
                    total={cartTotal}
                    headers={headers}
                    posToken={posToken}
                    orderType={posOrderType}
                    customerName={customerName}
                    discountData={discountAmount > 0 ? { discount_type: discountType, discount_value: discVal, discount_reason: discountReason } : null}
                    onClose={() => { setPaymentMethod(null); }}
                    onSuccess={handleOrderSuccess}
                />
            )}

            {/* Hold loading overlay */}
            {holdLoading && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-500 mx-auto" />
                        <p className="text-white text-xl font-black">יוצר הזמנה...</p>
                    </div>
                </div>
            )}

            {configureItem && (
                <POSMenuItemModal
                    item={configureItem}
                    onClose={() => setConfigureItem(null)}
                    onAdd={line => mergeCartLine(line)}
                />
            )}

            {holdOrderId && !holdLoading && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center">
                    <div className="text-center space-y-4 animate-in fade-in zoom-in-95">
                        <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
                            <FaShoppingCart className="text-amber-400 text-3xl" />
                        </div>
                        <p className="text-white text-2xl font-black">הזמנה #{holdOrderId} הושהתה</p>
                        <p className="text-amber-400 font-bold">ההזמנה תופיע ברשימת הממתינות לתשלום</p>
                    </div>
                </div>
            )}
        </div>
    );
}
