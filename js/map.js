// ==========================================
// 🗺️ صفحة الخريطة التفاعلية
// الضغطة الأولى على دولة: تعرض علمها بأعلى الصفحة
// الضغطة الثانية على نفس الدولة (أو الضغط على العلم المعروض): تنقلك لصفحة الدولة (قيد التطوير مستقبلاً)
// ==========================================
import { africanCountries } from './config.js';

let selectedMapCountry = null; // مفتاح الدولة المحددة حالياً على الخريطة (null = لا يوجد تحديد)

export function initMapSystem() {
    const pinsContainer = document.getElementById('map-pins-container');
    if (!pinsContainer) return; // صفحة الخريطة لم تُحقن بالـDOM بعد

    renderMapPins(pinsContainer);
    setupFlagBoxClick();
}

// رسم نقاط الدول فوق صورة الخريطة، كل نقطة بموقعها المحدد بـconfig.js (mapPosition)
function renderMapPins(container) {
    container.innerHTML = '';

    Object.entries(africanCountries).forEach(([key, country]) => {
        if (!country.mapPosition) return; // تجاهل أي دولة بلا إحداثيات محددة بعد

        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'map-country-pin';
        pin.dataset.countryKey = key;
        pin.style.top = country.mapPosition.top;
        pin.style.left = country.mapPosition.left;
        pin.title = country.name;
        pin.innerHTML = '<span class="map-pin-dot"></span>';

        pin.addEventListener('click', () => handlePinClick(key, country, pin));
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

    showSelectedFlag(country);
}

function showSelectedFlag(country) {
    const flagBox = document.getElementById('map-selected-flag-box');
    const flagEmoji = document.getElementById('map-selected-flag-emoji');
    const nameEl = document.getElementById('map-selected-country-name');

    if (flagBox) flagBox.style.display = 'flex';
    if (flagEmoji) flagEmoji.textContent = country.flag;
    if (nameEl) nameEl.textContent = country.name;
}

// الضغط على بطاقة العلم المعروضة بأعلى الصفحة يُعتبر أيضاً "ضغطة ثانية" — أكثر بداهة للمستخدم من إلزامه بالضغط على النقطة الصغيرة تحديداً مرة أخرى
function setupFlagBoxClick() {
    const flagBox = document.getElementById('map-selected-flag-box');
    if (!flagBox || flagBox.dataset.bound === 'true') return; // منع ربط مكرر لو استُدعيت الدالة أكثر من مرة
    flagBox.dataset.bound = 'true';

    flagBox.addEventListener('click', () => {
        if (!selectedMapCountry) return;
        const country = africanCountries[selectedMapCountry];
        if (country) openCountryDetailPage(selectedMapCountry, country);
    });
}

// الانتقال لصفحة الدولة — حالياً صفحة مؤقتة (Placeholder) لحين تطويرها بالتفصيل مستقبلاً
function openCountryDetailPage(key, country) {
    const nameEl = document.getElementById('country-detail-name');
    const flagEl = document.getElementById('country-detail-flag');
    if (nameEl) nameEl.textContent = country.name;
    if (flagEl) flagEl.textContent = country.flag;

    if (typeof window.switchView === 'function') {
        window.switchView('country-detail');
    }
}
