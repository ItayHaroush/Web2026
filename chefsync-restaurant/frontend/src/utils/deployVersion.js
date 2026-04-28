/** מזהה דיפלוי — מוחלף בזמן build ע"י Vite (מקור: public/build-version.json). */
export const APP_DEPLOY_VERSION =
  typeof __APP_DEPLOY_VERSION__ !== 'undefined' ? __APP_DEPLOY_VERSION__ : '0'

export function getFirebaseMessagingSwUrl() {
  const v = encodeURIComponent(APP_DEPLOY_VERSION)
  return `/firebase-messaging-sw.js?v=${v}`
}
