import FeatureGate from './FeatureGate';

/**
 * ProFeatureGate — backward compatibility wrapper
 * פשוט מפנה ל-FeatureGate החדש
 */
export default function ProFeatureGate(props) {
    return <FeatureGate {...props} />;
}
