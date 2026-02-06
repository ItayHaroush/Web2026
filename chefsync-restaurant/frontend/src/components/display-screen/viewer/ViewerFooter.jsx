export default function ViewerFooter({ screen, preset }) {
    if (!screen?.show_branding) return null;

    return (
        <div className={`${preset.header} px-6 py-3 text-center shrink-0`}>
            <p className={`text-xs font-medium ${preset.desc}`}>
                Powered by <span className="font-black">ChefSync</span>
            </p>
        </div>
    );
}
