import { useState } from 'react';
import { FaImage, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import { GiStoneBlock, GiWoodBeam, GiPlainCircle } from 'react-icons/gi';
import { BiDownArrow, BiRightArrow } from 'react-icons/bi';
import { IoMdHand } from 'react-icons/io';
import imageEnhancementService from '../services/imageEnhancementService';
import { useToast } from '../context/ToastContext';

/**
 * קומפוננטה לשיפור תמונות עם AI
 * תהליך 4 שלבים: העלאה → בחירת אופציות → יצירת וריאציות → בחירה סופית
 */
export default function AiImageEnhancer({ onComplete, menuItem = null, buttonClassName = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(1); // 1=upload, 2=options, 3=generating, 4=select
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedBackground, setSelectedBackground] = useState('marble');
    const [selectedAngle, setSelectedAngle] = useState('top');
    const [variations, setVariations] = useState([]);
    const [enhancementId, setEnhancementId] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const { addToast } = useToast();

    /**
     * דחיסת תמונה ל-JPEG עם איכות 85%
     * מקטין תמונות גדולות כדי להיות מתחת ל-2MB (הגבלת PHP)
     */
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // אם התמונה גדולה מ-2048px, הקטן אותה
                    const maxDimension = 2048;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = (height * maxDimension) / width;
                            width = maxDimension;
                        } else {
                            width = (width * maxDimension) / height;
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // המרה ל-JPEG עם איכות 85%
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }
                            // יצירת File חדש עם הגודל המקוטן
                            const compressedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        },
                        'image/jpeg',
                        0.85
                    );
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const backgroundOptions = [
        { value: 'marble', label: 'שיש מרשים', icon: <GiStoneBlock size={32} /> },
        { value: 'wood', label: 'עץ חם', icon: <GiWoodBeam size={32} /> },
        { value: 'clean', label: 'רקע נקי', icon: <GiPlainCircle size={32} /> },
    ];

    const angleOptions = [
        { value: 'top', label: 'מלמעלה', icon: <BiDownArrow size={32} /> },
        { value: 'side', label: 'מהצד', icon: <BiRightArrow size={32} /> },
        { value: 'hands', label: 'עם ידיים', icon: <IoMdHand size={32} /> },
    ];

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // בדיקת סוג קובץ
        if (!file.type.startsWith('image/')) {
            addToast('יש להעלות קובץ תמונה בלבד', 'error');
            return;
        }

        // בדיקת גודל ראשוני
        const maxSize = 10 * 1024 * 1024; // 10MB לפני דחיסה
        if (file.size > maxSize) {
            addToast('התמונה גדולה מדי! גודל מקסימלי: 10MB', 'error');
            return;
        }

        try {
            // דחיסת התמונה תמיד (למנוע בעיות עם הגבלת PHP 2MB)
            addToast('מכין את התמונה...', 'info');
            const compressedFile = await compressImage(file);

            console.log('📸 Image compressed:', {
                original: `${(file.size / 1024).toFixed(1)}KB`,
                compressed: `${(compressedFile.size / 1024).toFixed(1)}KB`,
                saved: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
            });

            // בדיקה שהדחיסה הצליחה להביא מתחת ל-2MB
            if (compressedFile.size > 2 * 1024 * 1024) {
                addToast('התמונה גדולה מדי גם אחרי דחיסה. נסה תמונה קטנה יותר', 'error');
                return;
            }

            setUploadedFile(compressedFile);
            setPreviewUrl(URL.createObjectURL(compressedFile));
            setStep(2);
        } catch (error) {
            console.error('Error compressing image:', error);
            addToast('שגיאה בעיבוד התמונה', 'error');
        }
    };

    const handleGenerate = async () => {
        if (!uploadedFile) return;

        setStep(3);
        setIsProcessing(true);

        try {
            const result = await imageEnhancementService.enhance(
                uploadedFile,
                selectedBackground,
                selectedAngle,
                menuItem
            );

            if (result.success) {
                const variations = result.data.variations;
                setVariations(variations);
                setEnhancementId(result.data.enhancement_id);

                // תמיד הצג תצוגה מקדימה למשתמש
                setStep(4);
                addToast('שיפור הושלם! בדוק את התוצאה ולחץ לבחירה', 'success');
            } else {
                throw new Error(result.message || 'שגיאה ביצירת וריאציות');
            }
        } catch (error) {
            console.error('Error generating variations:', error);
            console.error('Response data:', error.response?.data);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || 'שגיאה ביצירת וריאציות';
            addToast(errorMsg, 'error');
            setStep(2);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectVariation = async (index) => {
        setSelectedIndex(index);
        setIsProcessing(true);

        try {
            const result = await imageEnhancementService.selectVariation(enhancementId, index);

            if (result.success) {
                addToast('התמונה נשמרה בהצלחה!', 'success');
                onComplete?.(result.data.selected_url);
                handleClose();
            } else {
                throw new Error(result.message || 'שגיאה בשמירת הבחירה');
            }
        } catch (error) {
            console.error('Error selecting variation:', error);
            addToast(error.response?.data?.message || 'שגיאה בשמירת הבחירה', 'error');
            setSelectedIndex(null);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setStep(1);
        setUploadedFile(null);
        setPreviewUrl(null);
        setVariations([]);
        setEnhancementId(null);
        setSelectedIndex(null);
        setIsProcessing(false);
    };

    return (
        <>
            {/* כפתור פתיחה */}
            <button
                onClick={() => {
                    console.log('🎨 Opening AI Image Enhancer');
                    setIsOpen(true);
                }}
                type="button"
                className={buttonClassName || 'flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg'}
            >
                <FaImage />
                <span>שפר תמונה עם AI</span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                            <h2 className="text-2xl font-bold text-gray-800">
                                שיפור תמונה עם AI
                            </h2>
                            <button
                                onClick={handleClose}
                                disabled={isProcessing}
                                className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                            >
                                <MdClose size={28} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* שלב 1: העלאה */}
                            {step === 1 && (
                                <div className="text-center">
                                    <div className="border-4 border-dashed border-gray-300 rounded-xl p-12 hover:border-purple-500 transition-colors cursor-pointer">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="image-upload"
                                        />
                                        <label htmlFor="image-upload" className="cursor-pointer">
                                            <FaImage className="mx-auto text-6xl text-gray-400 mb-4" />
                                            <p className="text-xl font-semibold text-gray-700 mb-2">
                                                העלה תמונת מנה
                                            </p>
                                            <p className="text-gray-500">
                                                לחץ כדי לבחור תמונה (עד 5MB)
                                            </p>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* שלב 2: בחירת אופציות */}
                            {step === 2 && (
                                <div className="space-y-6">
                                    {/* תצוגה מקדימה */}
                                    <div className="text-center">
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="max-h-64 mx-auto rounded-lg shadow-md"
                                        />
                                    </div>

                                    {/* בחירת רקע */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                            בחר סוג רקע:
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {backgroundOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setSelectedBackground(option.value)}
                                                    className={`p-4 rounded-xl border-2 transition-all ${selectedBackground === option.value
                                                        ? 'border-purple-600 bg-purple-50 shadow-lg'
                                                        : 'border-gray-200 hover:border-purple-300'
                                                        }`}
                                                >
                                                    <div className="text-purple-600 mb-2 flex justify-center">{option.icon}</div>
                                                    <div className="font-semibold text-gray-800">
                                                        {option.label}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* בחירת זווית */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                            בחר זווית צילום:
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {angleOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setSelectedAngle(option.value)}
                                                    className={`p-4 rounded-xl border-2 transition-all ${selectedAngle === option.value
                                                        ? 'border-pink-600 bg-pink-50 shadow-lg'
                                                        : 'border-gray-200 hover:border-pink-300'
                                                        }`}
                                                >
                                                    <div className="text-pink-600 mb-2 flex justify-center">{option.icon}</div>
                                                    <div className="font-semibold text-gray-800">
                                                        {option.label}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* כפתור יצירה */}
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                                        >
                                            חזור
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGenerate}
                                            disabled={isProcessing}
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold shadow-lg disabled:opacity-50"
                                        >
                                            צור 3 וריאציות (3 קרדיטים)
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* שלב 3: מייצר */}
                            {step === 3 && (
                                <div className="text-center py-12">
                                    <FaSpinner className="animate-spin text-6xl text-purple-600 mx-auto mb-4" />
                                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                                        ה-AI עובד קשה...
                                    </h3>
                                    <p className="text-gray-600">
                                        יוצר 3 וריאציות מקצועיות של התמונה שלך
                                    </p>
                                </div>
                            )}

                            {/* שלב 4: בחירה */}
                            {step === 4 && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-800 text-center mb-4">
                                        בחר את הווריאציה האהובה עליך:
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        {variations.map((variation, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleSelectVariation(index)}
                                                disabled={isProcessing}
                                                className={`relative group rounded-xl overflow-hidden border-4 transition-all ${selectedIndex === index
                                                    ? 'border-green-500 shadow-2xl scale-105'
                                                    : 'border-gray-200 hover:border-purple-400 hover:shadow-xl'
                                                    } disabled:opacity-50`}
                                            >
                                                <img
                                                    src={variation.url}
                                                    alt={`Variation ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                {selectedIndex === index && (
                                                    <div className="absolute inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center">
                                                        <FaCheckCircle className="text-5xl text-green-600" />
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-center py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    וריאציה {index + 1}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-500 text-center">
                                        לאחר הבחירה, 2 הווריאציות האחרות יימחקו אוטומטית
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
