/**
 * Tier hierarchy utilities for 3-tier subscription system.
 * Basic → Pro → Enterprise
 */

export const TIER_HIERARCHY = { basic: 0, pro: 1, enterprise: 2 };
export const TIER_LABELS = { basic: 'Basic', pro: 'Pro', enterprise: 'מסעדה מלאה' };
export const TIER_LABELS_HE = { basic: 'בייסיק', pro: 'פרו', enterprise: 'מסעדה מלאה' };

/**
 * Check if current tier is sufficient for required tier
 */
export function isTierSufficient(currentTier, requiredTier) {
    return (TIER_HIERARCHY[currentTier] ?? 0) >= (TIER_HIERARCHY[requiredTier] ?? 0);
}

/**
 * Get the next tier up (for upgrade prompts)
 */
export function getNextTier(currentTier) {
    if (currentTier === 'basic') return 'pro';
    if (currentTier === 'pro') return 'enterprise';
    return null;
}

/**
 * Check feature access from features map
 * Returns 'full' or 'demo'
 */
export function getFeatureAccess(features, featureKey) {
    return features?.[featureKey] ?? 'demo';
}

/**
 * Check if a feature is fully unlocked
 */
export function isFeatureUnlocked(features, featureKey) {
    return getFeatureAccess(features, featureKey) === 'full';
}
