const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");

// تهيئة Firebase Admin
initializeApp();

/**
 * اختبار اتصال Backend
 *
 * هذه أول Cloud Function في مشروع Africa Conflict.
 * لا تعدّل أي بيانات في اللعبة.
 */
exports.backendStatus = onCall(async (request) => {

    // يجب أن يكون اللاعب مسجلاً الدخول
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "يجب تسجيل الدخول أولاً."
        );
    }

    const uid = request.auth.uid;

    logger.info("Backend status request", {
        uid: uid
    });

    return {
        success: true,
        message: "Africa Conflict Backend يعمل بنجاح.",
        uid: uid,
        authenticated: true,
        serverTime: new Date().toISOString()
    };
});
