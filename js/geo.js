// ==========================================
// 🌍 أدوات جغرافية مشتركة — تُستخدم من الخريطة (مواضع الدول) ومن نظام السفر (حساب المسافة والوقت)
// كل الحسابات تعتمد على إحداثيات عاصمة كل دولة (lat/lon) المخزّنة في config.js
// ==========================================
import { africanCountries } from './config.js';

// حدود القارة الإفريقية التقريبية (خطوط العرض/الطول) — نفس الحدود المستخدمة تقليدياً بخرائط الموقع البسيطة
// تُستخدم لتحويل أي إحداثية (lat, lon) إلى نسبة مئوية (top/left) فوق صورة الخريطة المستطيلة
export const MAP_BOUNDS = { top: 38, bottom: -35, left: -19, right: 52 };

// ثوابت صيغة وقت السفر — مُعايرة على مثالين حقيقيين: المغرب↔الجزائر (~946كم) = 10 دقائق تقريباً،
// المغرب↔جنوب إفريقيا (~7600كم) = 50 دقيقة تقريباً (راجع الحساب الدقيق في ملاحظات المطور)
const TRAVEL_BASE_MINUTES = 4;
const TRAVEL_MINUTES_PER_KM = 0.006;
const TRAVEL_MIN_MINUTES = 3; // حد أدنى، حتى لا يصبح السفر بين دولتين متجاورتين جداً فورياً بلا معنى

// المسافة الحقيقية بين عاصمتين بالكيلومترات (صيغة Haversine على سطح كروي)
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// المسافة بالكيلومترات بين دولتين (بمفاتيحهما بـconfig.js)، أو null لو إحداثيات إحداهما غير معروفة
export function getDistanceKm(countryKeyA, countryKeyB) {
    const a = africanCountries[countryKeyA];
    const b = africanCountries[countryKeyB];
    if (!a?.lat || !b?.lat) return null;
    return haversineKm(a.lat, a.lon, b.lat, b.lon);
}

// وقت السفر بالدقائق بناءً على المسافة الفعلية
export function getTravelMinutes(distanceKm) {
    if (distanceKm == null) return TRAVEL_MIN_MINUTES;
    return Math.max(TRAVEL_MIN_MINUTES, Math.round(TRAVEL_BASE_MINUTES + distanceKm * TRAVEL_MINUTES_PER_KM));
}

// تحويل إحداثية جغرافية (lat, lon) إلى موضع نسبي (top%, left%) فوق صورة الخريطة المستطيلة
export function latLonToPercent(lat, lon) {
    const left = ((lon - MAP_BOUNDS.left) / (MAP_BOUNDS.right - MAP_BOUNDS.left)) * 100;
    const top = ((MAP_BOUNDS.top - lat) / (MAP_BOUNDS.top - MAP_BOUNDS.bottom)) * 100;
    return {
        top: `${Math.max(0, Math.min(100, top)).toFixed(2)}%`,
        left: `${Math.max(0, Math.min(100, left)).toFixed(2)}%`
    };
}
