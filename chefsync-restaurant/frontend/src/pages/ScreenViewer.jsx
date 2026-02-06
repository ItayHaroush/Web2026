import { useParams } from 'react-router-dom';
import useViewerData from '../components/display-screen/viewer/useViewerData';
import ViewerContainer from '../components/display-screen/viewer/ViewerContainer';
import ViewerHeader from '../components/display-screen/viewer/ViewerHeader';
import ViewerFooter from '../components/display-screen/viewer/ViewerFooter';
import ViewerGrid from '../components/display-screen/viewer/ViewerGrid';
import ViewerMenuboard from '../components/display-screen/viewer/ViewerMenuboard';
import ViewerMinimalList from '../components/display-screen/viewer/ViewerMinimalList';
import ViewerWidgets, { WidgetBar, WidgetBadges } from '../components/display-screen/viewer/ViewerWidgets';
import ViewerLogoOverlay from '../components/display-screen/viewer/ViewerLogoOverlay';

export default function ScreenViewer() {
    const { token } = useParams();
    const {
        data, error, screen, restaurant, items,
        currentItems, groupedItems, designOptions,
        preset, isMenuboard, aspectConfig,
        currentSlide, totalSlides,
    } = useViewerData(token);

    if (error && !data) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="text-6xl mb-6">📺</div>
                    <h1 className="text-3xl font-black text-white mb-3">מסך לא נמצא</h1>
                    <p className="text-gray-400 text-lg">הקישור אינו תקין או שהמסך הושבת</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
            </div>
        );
    }

    // Compute widget bars
    const widgetResult = ViewerWidgets({ designOptions, preset, restaurant });
    const hasWidgets = widgetResult !== null;

    return (
        <ViewerContainer designOptions={designOptions} preset={preset}>
            <ViewerLogoOverlay designOptions={designOptions} logoUrl={restaurant?.logo_url} />

            {/* Badge-positioned widgets (floating) */}
            {hasWidgets && (
                <WidgetBadges
                    widgets={widgetResult.badgeWidgets}
                    renderWidgetContent={widgetResult.renderWidgetContent}
                    barStyle={widgetResult.barStyle}
                />
            )}

            {/* Top widget bar */}
            {hasWidgets && (
                <WidgetBar
                    widgets={widgetResult.topBarWidgets}
                    renderWidgetContent={widgetResult.renderWidgetContent}
                    barStyle={widgetResult.barStyle}
                    position="top-bar"
                />
            )}

            <ViewerHeader
                screen={screen}
                restaurant={restaurant}
                preset={preset}
                designOptions={designOptions}
                currentSlide={currentSlide}
                totalSlides={totalSlides}
            />

            {/* Main Content */}
            <div className="flex-1 p-6 lg:p-10 overflow-hidden">
                {items.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className={`text-2xl font-bold ${preset.desc}`}>אין פריטים להצגה</p>
                    </div>
                ) : isMenuboard ? (
                    <ViewerMenuboard groupedItems={groupedItems} preset={preset} designOptions={designOptions} />
                ) : screen?.design_preset === 'minimal' ? (
                    <ViewerMinimalList items={currentItems} preset={preset} designOptions={designOptions} />
                ) : (
                    <ViewerGrid items={currentItems} preset={preset} designOptions={designOptions} aspectConfig={aspectConfig} />
                )}
            </div>

            {/* Bottom widget bar */}
            {hasWidgets && (
                <WidgetBar
                    widgets={widgetResult.bottomBarWidgets}
                    renderWidgetContent={widgetResult.renderWidgetContent}
                    barStyle={widgetResult.barStyle}
                    position="bottom-bar"
                />
            )}

            <ViewerFooter screen={screen} preset={preset} />
        </ViewerContainer>
    );
}
