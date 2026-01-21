import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

const hasValidPrefix = (raw) => {
    const trimmed = String(raw).trim();
    return trimmed.startsWith('0') || trimmed.startsWith('+972') || trimmed.startsWith('972');
};

export const normalizeIsraeliMobile = (raw) => {
    if (!raw || !hasValidPrefix(raw)) {
        return null;
    }

    const phone = parsePhoneNumberFromString(raw, 'IL');
    if (!phone || !phone.isValid()) {
        return null;
    }

    const type = phone.getType();
    const national = phone.nationalNumber; // e.g. "547466508"

    const isMobileType = type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE';
    const isLikelyMobile = !type && typeof national === 'string' && national.startsWith('5');

    if (!isMobileType && !isLikelyMobile) {
        return null;
    }

    return phone.number; // E.164 format
};

export const isValidIsraeliMobile = (raw) => normalizeIsraeliMobile(raw) !== null;

export default {
    normalizeIsraeliMobile,
    isValidIsraeliMobile,
};
