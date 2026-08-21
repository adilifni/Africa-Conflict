// ==========================================
// 🗺️ صفحة الخريطة التفاعلية — قابلة للتكبير (Zoom) والتحريك (Pan)
// كل الدول الـ54 معروضة بمواضع محسوبة من إحداثياتها الجغرافية الحقيقية (geo.js)
// الضغطة الأولى على دولة: تعرض علمها بأعلى الصفحة
// الضغطة الثانية على نفس الدولة (أو الضغط على العلم المعروض): تنقلك لصفحة الدولة (قيد التطوير مستقبلاً)
// ==========================================
import { africanCountries } from './config.js';
import { latLonToPercent } from './geo.js';

let selectedMapCountry = null; // مفتاح الدولة المحددة حالياً على الخريطة (null = لا يوجد تحديد)

// حالة التكبير/التحريك
let zoomScale = 1;
let panX = 0;
let panY = 0;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export function initMapSystem() {
    const pinsContainer = document.getElementById('map-pins-container');
    if (!pinsContainer) return; // صفحة الخريطة لم تُحقن بالـDOM بعد

    renderMapPins(pinsContainer);
    setupFlagBoxClick();
    setupZoomPan();
}

// رسم نقاط كل الدول فوق صورة الخريطة — الموضع يُحسب مباشرة من lat/lon الحقيقية لكل دولة
function renderMapPins(container) {
    container.innerHTML = '';

    Object.entries(africanCountries).forEach(([key, country]) => {
        if (country.lat == null || country.lon == null) return;

        const pos = latLonToPercent(country.lat, country.lon);

        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'map-country-pin';
        pin.dataset.countryKey = key;
        pin.style.top = pos.top;
        pin.style.left = pos.left;
        pin.title = country.name;
        pin.innerHTML = '<span class="map-pin-dot"></span>';

        pin.addEventListener('click', (e) => {
            e.stopPropagation(); // منع تعارض ضغطة الدولة مع سحب/تحريك الخريطة
            handlePinClick(key, country, pin);
        });
        container.appendChild(pin);
    });
}

function handlePinClick(key, country, pinEl) {
    // ضغطة ثانية على نفس الدولة المحددة أصلاً ← الانتقال المباشر لصفحة الدولة
    if (selectedMapCountry === key) {
        openCountryDetailPage(key, country);
        return;
    }

    // ضغطة أولى (أو تبديل التحديد لدولة مختلفة) ← فقط نعرض العلم، بدون انتقال بعد
    selectedMapCountry = key;

    document.querySelectorAll('.map-country-pin').forEach(p => p.classList.remove('selected'));
    pinEl.classList.add('selected');

    showSelectedFlag(country, key);
}

function showSelectedFlag(country, key) {
    const flagBox = document.getElementById('map-selected-flag-box');
    const flagEmoji = document.getElementById('map-selected-flag-emoji');
    const nameEl = document.getElementById('map-selected-country-name');
    const travelBtn = document.getElementById('map-travel-btn');

    if (flagBox) flagBox.style.display = 'flex';
    if (flagEmoji) flagEmoji.textContent = country.flag;
    if (nameEl) nameEl.textContent = country.name;
    if (travelBtn) travelBtn.setAttribute('data-target-country', key);
}

// الضغط على بطاقة العلم المعروضة بأعلى الصفحة يُعتبر أيضاً "ضغطة ثانية"
function setupFlagBoxClick() {
    const flagBox = document.getElementById('map-selected-flag-box');
    if (!flagBox || flagBox.dataset.bound === 'true') return;
    flagBox.dataset.bound = 'true';

    flagBox.addEventListener('click', (e) => {
        if (e.target.closest('#map-travel-btn')) return; // زر السفر له سلوكه الخاص، لا يفتح صفحة الدولة
        if (!selectedMapCountry) return;
        const country = africanCountries[selectedMapCountry];
        if (country) openCountryDetailPage(selectedMapCountry, country);
    });
}

// الانتقال لصفحة الدولة — حالياً صفحة مؤقتة (Placeholder) لحين تطويرها بالتفصيل مستقبلاً
function openCountryDetailPage(key, country) {
    const nameEl = document.getElementById('country-detail-name');
    const flagEl = document.getElementById('country-detail-flag');
    const travelBtn = document.getElementById('country-detail-travel-btn');
    if (nameEl) nameEl.textContent = country.name;
    if (flagEl) flagEl.textContent = country.flag;
    if (travelBtn) travelBtn.setAttribute('data-target-country', key);

    if (typeof window.switchView === 'function') {
        window.switchView('country-detail');
    }
}

// ==========================================
// 🔍 التكبير والتحريك (Zoom & Pan) — تدعم اللمس (Pinch/Drag) والفأرة (Wheel/Drag) معاً
// ==========================================
function setupZoomPan() {
    const viewport = document.getElementById('map-zoom-viewport');
    const wrapper = document.getElementById('map-zoom-wrapper');
    if (!viewport || !wrapper || wrapper.dataset.zoomBound === 'true') return;
    wrapper.dataset.zoomBound = 'true';

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let panStartX = 0, panStartY = 0;

    let pinchStartDist = 0;
    let pinchStartScale = 1;

    function applyTransform() {
        // تحديد أقصى تحريك مسموح حتى لا تخرج الخريطة كلياً عن الإطار المرئي
        const maxPan = (zoomScale - 1) * 50; // نسبة تقريبية كافية لمعظم الحالات بما أن الحاوية مربعة
        panX = Math.max(-maxPan, Math.min(maxPan, panX));
        panY = Math.max(-maxPan, Math.min(maxPan, panY));
        viewport.style.transform = `translate(${panX}%, ${panY}%) scale(${zoomScale})`;
    }

    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ---- اللمس (الجوال) ----
    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            pinchStartDist = getTouchDistance(e.touches);
            pinchStartScale = zoomScale;
        } else if (e.touches.length === 1) {
            isDragging = true;
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
            panStartX = panX;
            panStartY = panY;
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const newDist = getTouchDistance(e.touches);
            const ratio = newDist / (pinchStartDist || newDist);
            zoomScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartScale * ratio));
            applyTransform();
        } else if (e.touches.length === 1 && isDragging && zoomScale > 1) {
            e.preventDefault();
            const dxPercent = ((e.touches[0].clientX - dragStartX) / wrapper.clientWidth) * 100;
            const dyPercent = ((e.touches[0].clientY - dragStartY) / wrapper.clientHeight) * 100;
            panX = panStartX + dxPercent;
            panY = panStartY + dyPercent;
            applyTransform();
        }
    }, { passive: false });

    wrapper.addEventListener('touchend', () => { isDragging = false; });

    // ---- الفأرة (الحاسوب) ----
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        zoomScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomScale + delta));
        applyTransform();
    }, { passive: false });

    wrapper.addEventListener('mousedown', (e) => {
        if (zoomScale <= 1) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panStartX = panX;
        panStartY = panY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dxPercent = ((e.clientX - dragStartX) / wrapper.clientWidth) * 100;
        const dyPercent = ((e.clientY - dragStartY) / wrapper.clientHeight) * 100;
        panX = panStartX + dxPercent;
        panY = panStartY + dyPercent;
        applyTransform();
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // ---- أزرار التحكم الصريحة (+ / - / إعادة ضبط) ----
    const zoomInBtn = document.getElementById('map-zoom-in-btn');
    const zoomOutBtn = document.getElementById('map-zoom-out-btn');
    const zoomResetBtn = document.getElementById('map-zoom-reset-btn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
        zoomScale = Math.min(MAX_ZOOM, zoomScale + 0.5);
        applyTransform();
    });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
        zoomScale = Math.max(MIN_ZOOM, zoomScale - 0.5);
        applyTransform();
    });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => {
        zoomScale = 1; panX = 0; panY = 0;
        applyTransform();
    });
}
