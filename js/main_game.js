// ==========================================
// 🚀 دالة الانتقال بين الصفحات والأقسام الرئيسية
// ==========================================
function navigateTo(targetPage, extraParams = {}) {
    console.log(`محاولة الانتقال إلى: ${targetPage}`, extraParams);

    // 1. إخفاء جميع الصفحات (Views)
    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => {
        view.style.display = 'none';
    });

    // 2. مطابقة الصفحة المستهدفة بالـ ID الخاص بالحاوية
    let viewId = 'view-main';

    switch (targetPage) {
        case 'main': viewId = 'view-main'; break;
        case 'work': viewId = 'view-work'; break;
        case 'wars': viewId = 'view-wars'; break;
        case 'profile': viewId = 'view-profile'; break;
        
        // 🌍 القارة
        case 'continent-map': viewId = 'view-continent-map'; break;
        case 'continent-players': viewId = 'view-continent-players'; break;
        case 'continent-online': viewId = 'view-continent-online'; break;
        case 'continent-parties': viewId = 'view-continent-parties'; break;
        case 'continent-factories': viewId = 'view-continent-factories'; break;
        case 'continent-countries': viewId = 'view-continent-countries'; break;
        case 'continent-alliances': viewId = 'view-continent-alliances'; break;
        case 'continent-independent': viewId = 'view-continent-independent'; break;
        
        // 🇲🇦 الدولة
        case 'country-info': viewId = 'view-country-info'; break;
        case 'country-players': viewId = 'view-country-players'; break;
        case 'country-online': viewId = 'view-country-online'; break;
        case 'country-parties': viewId = 'view-country-parties'; break;
        case 'country-factories': viewId = 'view-country-factories'; break;
        
        default: viewId = 'view-main';
    }

    // إظهار الحاوية المطلوبة
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 3. تحديث مظهر زر التنقل الفوتر النشط (Bottom Navigation)
    const allLinks = document.querySelectorAll('.bottom-nav .nav-link');
    allLinks.forEach(link => link.classList.remove('active'));

    let activeBtnId = 'nav-btn-main';
    if (targetPage === 'work') activeBtnId = 'nav-btn-work';
    else if (targetPage === 'wars') activeBtnId = 'nav-btn-wars';
    else if (targetPage === 'profile') activeBtnId = 'nav-btn-profile';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ==========================================
// 🔁 منطق تحويل وعرض شرائح البلوك الأول (Slider/Swipe)
// ==========================================
function setupSliderLogic() {
    const dot1 = document.getElementById('dot-1');
    const dot2 = document.getElementById('dot-2');
    const slide1 = document.getElementById('slide-1');
    const slide2 = document.getElementById('slide-2');

    if (dot1 && dot2 && slide1 && slide2) {
        // تفعيل الشريحة الأولى
        dot1.addEventListener('click', (e) => {
            e.stopPropagation();
            slide1.classList.add('active');
            slide2.classList.remove('active');
            dot1.classList.add('active');
            dot2.classList.remove('active');
        });

        // تفعيل الشريحة الثانية
        dot2.addEventListener('click', (e) => {
            e.stopPropagation();
            slide2.classList.add('active');
            slide1.classList.remove('active');
            dot2.classList.add('active');
            dot1.classList.remove('active');
        });
    }
}

// ==========================================
// 🎯 ربط الأحداث وإضافة تأثيرات التفاعل للمربعات
// ==========================================
function setupInteractiveElements() {
    const interactiveStats = [
        // 🌍 مستوى القارة (البلوك الأول - الشريحة الأولى والثانية)
        { id: 'btn-continent-map', page: 'continent-map' },
        { id: 'btn-continent-pop', page: 'continent-players' },
        { id: 'btn-continent-online', page: 'continent-online' },
        { id: 'btn-continent-parties', page: 'continent-parties' },
        { id: 'btn-continent-factories', page: 'continent-factories' },
        { id: 'btn-continent-countries', page: 'continent-countries' },
        { id: 'btn-continent-alliances', page: 'continent-alliances' },
        { id: 'btn-continent-independent', page: 'continent-independent' },
        
        // 🇲🇦 مستوى الدولة (البلوك الثاني)
        { id: 'btn-country-flag', page: 'country-info' },
        { id: 'btn-country-pop', page: 'country-players' },
        { id: 'btn-country-online', page: 'country-online' },
        { id: 'btn-country-parties', page: 'country-parties' },
        { id: 'btn-country-factories', page: 'country-factories' }
    ];

    interactiveStats.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            // إضافة مؤشر الماوس (اليد) والتأثيرات البصرية
            element.style.cursor = 'pointer';
            element.style.transition = 'transform 0.1s ease, background-color 0.15s ease';

            element.addEventListener('click', (e) => {
                e.stopPropagation(); // منع تداخل الأحداث
                navigateTo(item.page);
            });

            element.addEventListener('mouseenter', () => {
                element.style.transform = 'scale(1.05)';
                element.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            });

            element.addEventListener('mouseleave', () => {
                element.style.transform = 'scale(1)';
                element.style.backgroundColor = 'transparent';
            });
        }
    });

    // ربط زر البرلمان
    const parliamentBtn = document.getElementById('btn-parliament');
    if (parliamentBtn) {
        parliamentBtn.addEventListener('click', () => {
            alert('سيتم فتح بوابة برلمان الدولة قريباً!');
        });
    }
}

// ==========================================
// 📥 تهيئة البيانات والتحميل المبدئي
// ==========================================
function fetchInitialGameData() {
    setTimeout(() => {
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.textContent = 'Bidro Fingers';
        }
    }, 500);
}

// تشغيل الأكواد فور استقرار الواجهة
document.addEventListener('DOMContentLoaded', () => {
    fetchInitialGameData();
    setupSliderLogic();          // تشغيل محول السلايدر في البلوك الأول
    setupInteractiveElements();  // ربط الأزرار بالصفحات
});