import { useState } from 'react';
import { FaFrown, FaMeh, FaSmile, FaGrin, FaGrinHearts } from 'react-icons/fa';

/**
 * קומפוננטת דירוג עם 5 פרצופים (Font Awesome)
 * 
 * @param {number} value - ערך נוכחי (1-5)
 * @param {function} onChange - callback בלחיצה על פרצוף (value => {})
 * @param {boolean} readOnly - האם מצב קריאה בלבד (ללא אפשרות לחיצה)
 * @param {string} size - גודל אייקונים: 'sm', 'md', 'lg'
 */
export default function RatingWidget({ value, onChange, readOnly = false, size = 'md' }) {
    const [hoveredValue, setHoveredValue] = useState(null);

    const ratingOptions = [
        { value: 1, icon: FaFrown, color: 'text-red-500', label: 'גרוע', hoverColor: 'hover:text-red-600' },
        { value: 2, icon: FaMeh, color: 'text-orange-500', label: 'בסדר', hoverColor: 'hover:text-orange-600' },
        { value: 3, icon: FaSmile, color: 'text-yellow-500', label: 'טוב', hoverColor: 'hover:text-yellow-600' },
        { value: 4, icon: FaGrin, color: 'text-green-500', label: 'מצוין', hoverColor: 'hover:text-green-600' },
        { value: 5, icon: FaGrinHearts, color: 'text-pink-500', label: 'מושלם!', hoverColor: 'hover:text-pink-600' },
    ];

    const sizeClasses = {
        sm: 'text-3xl',
        md: 'text-5xl',
        lg: 'text-7xl',
    };

    const iconSize = sizeClasses[size] || sizeClasses.md;

    const handleClick = (rating) => {
        if (!readOnly && onChange) {
            onChange(rating);
        }
    };

    const displayValue = hoveredValue || value;

    return (
        <div className="flex flex-col items-center gap-4">
            {/* שורת אייקונים */}
            <div className="flex items-center gap-3 sm:gap-6">
                {ratingOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value === option.value;
                    const isHovered = hoveredValue === option.value;

                    // במצב readOnly - הצג רק את הפרצוף שנבחר
                    if (readOnly && !isSelected) {
                        return null;
                    }

                    // במצב עריכה - הפרצוף המרחף או שנבחר צבוע
                    const isActive = readOnly
                        ? isSelected
                        : (hoveredValue ? isHovered : isSelected);

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleClick(option.value)}
                            onMouseEnter={() => !readOnly && setHoveredValue(option.value)}
                            onMouseLeave={() => !readOnly && setHoveredValue(null)}
                            disabled={readOnly}
                            className={`
                                transition-all duration-200 transform
                                ${!readOnly && 'cursor-pointer active:scale-90'}
                                ${readOnly && 'cursor-default'}
                                ${isActive ? option.color : 'text-gray-300'}
                                ${!readOnly && !isActive && option.hoverColor}
                                ${isHovered && !readOnly && 'scale-125'}
                                ${isSelected && 'scale-110 drop-shadow-lg'}
                            `}
                            aria-label={option.label}
                        >
                            <Icon className={iconSize} />
                        </button>
                    );
                })}
            </div>

            {/* תווית טקסט */}
            {displayValue && (
                <div className="text-center">
                    <p className={`text-lg font-black ${ratingOptions[displayValue - 1]?.color}`}>
                        {ratingOptions[displayValue - 1]?.label}
                    </p>
                    {!readOnly && (
                        <p className="text-xs text-gray-500 mt-1">
                            לחץ לבחירה
                        </p>
                    )}
                </div>
            )}

            {/* הצגת ערך מספרי במצב readOnly */}
            {readOnly && value && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-bold">{value}</span>
                    <span>מתוך 5</span>
                </div>
            )}
        </div>
    );
}
