// ==========================================
// 🚀 التحكم بالتوجيه والتنقل بين الصفحات والأقسام
// ==========================================
function navigateTo(targetPage, extraParams = {}) {
    console.log(`الانتقال الذكي إلى: ${targetPage}`, extraParams);

    // 1. إخفاء جميع كتل وعروض اللعبة الوسطى
    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => {
        view.style.display = 'none';
    });

    // 2. تحديد المعرّف (ID) المناسب بناءً على الصفحة المطلوبة
    let viewId = 'view-main';

    switch (targetPage) {
        case 'main': viewId = 'view-main'; break;
        case 'work': viewId = 'view-work'; break;
        case 'wars': viewId = 'view-wars'; break;
        case 'profile': viewId = 'view-profile'; break;
        
        // 🌍 مسارات القارة (البلوك 1)
        case 'continent-map': viewId = 'view-continent-map'; break;
        case 'continent-players': viewId = 'view-continent-players'; break;
        case 'continent-online': viewId = 'view-continent-online'; break;
        case 'continent-parties': viewId = 'view-continent-parties'; break;
        case 'continent-factories': viewId = 'view-continent-factories'; break;
        case 'continent-countries': viewId = 'view-continent-countries'; break;
        case 'continent-alliances': viewId = 'view-continent-alliances'; break;
        case 'continent-independent': viewId = 'view-continent-independent'; break;
        
        // 🇲🇦 مسارات الدولة الحالية (البلوك 2)
        case 'country-info': viewId = 'view-country-info'; break;
        case 'country-players': viewId = 'view-country-players'; break;
        case 'country-online': viewId = 'view-country-online'; break;
        case 'country-parties': viewId = 'view-country-parties'; break;
        case 'country-factories': viewId = 'view-country-factories'; break;
        
        default: viewId = 'view-main';
    }

    // إظهار الصفحة المستهدفة
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = 'flex';
        // تمرير الشاشة للأعلى تلقائياً عند فتح الصفحة الجديدة لمظهر أفضل بالهواتف
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 3. تعديل الفئة النشطة (Active Class) بالفوتر ليتناسب مع موقع اللاعب الحالي
    const allLinks = document.querySelectorAll('.bottom-nav .nav-link');
    allLinks.forEach(link => link.classList.remove('active'));

    let activeBtnId = 'nav-btn-main';
    // نربط الأقسام الفرعية بالزر الأب بالفوتر لتظل الأضواء صحيحة
    if (targetPage === 'work') activeBtnId = 'nav-btn-work';
    else if (targetPage === 'wars') activeBtnId = 'nav-btn-wars';
    else if (targetPage === 'profile') activeBtnId = 'nav-btn-profile';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ==========================================
// 🎯 ربط الأحداث وإعطاء العناصر تأثيرات تفاعلية
// ==========================================
function setupInteractiveElements() {
    // خريطة الربط الكاملة للمعرفات وتوجهاتها
    const interactiveStats = [
        // 🌍 البلوك الأول (مستوى القارة)
        { id: 'btn-continent-map', page: 'continent-map' },          // الخريطة
        { id: 'btn-continent-pop', page: 'continent-players' },       // سكان أفريقيا
        { id: 'btn-continent-online', page: 'continent-online' },    // متصلين أفريقيا
        { id: 'btn-continent-parties', page: 'continent-parties' },  // أحزاب أفريقيا
        { id: 'btn-continent-factories', page: 'continent-factories' }, // مصانع أفريقيا
        { id: 'btn-continent-countries', page: 'continent-countries' }, // قائمة دول القارة
        { id: 'btn-continent-alliances', page: 'continent-alliances' }, // تحالفات القارة
        { id: 'btn-continent-independent', page: 'continent-independent' }, // مستقلة القارة
        
        // 🇲🇦 البلوك الثاني (مستوى الدولة)
        { id: 'btn-country-flag', page: 'country-info' },            // العلم (ديوان الرئاسة)
        { id: 'btn-country-pop', page: 'country-players' },          // سكان الدولة
        { id: 'btn-country-online', page: 'country-online' },        // متصلين الدولة
        { id: 'btn-country-parties', page: 'country-parties' },      // أحزاب الدولة
        { id: 'btn-country-factories', page: 'country-factories' }   // مصانع الدولة
    ];

    interactiveStats.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            // إعلام المتصفح واللاعب بأن العنصر زر تفاعلي
            element.style.cursor = 'pointer';
            element.style.transition = 'transform 0.1s ease, background-color 0.15s ease, opacity 0.15s';

            // إضافة لمسة جمالية خفيفة جداً للضغط بالهواتف والماوس بالكمبيوتر
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'scale(1.03)';
                element.style.opacity = '0.9';
            });

            element.addEventListener('mouseleave', () => {
                element.style.transform = 'scale(1)';
                element.style.opacity = '1';
            });

            // عند النقر يتم استدعاء دالة التوجيه بصفحتها المعزولة
            element.addEventListener('click', () => {
                navigateTo(item.page);
            });
        }
    });

    // ربط زر برلمان الدولة (مثال إضافي جاهز للتوجيه مستقبلاً)
    const parliamentBtn = document.getElementById('btn-parliament');
    if (parliamentBtn) {
        parliamentBtn.addEventListener('click', () => {
            alert('سيتم توجيهك لغرفة مناقشات وقرارات البرلمان قريباً جداً!');
        });
    }
}

// ==========================================
// 📥 جلب بيانات اللاعب والمخدم عند التحميل
// ==========================================
function fetchInitialGameData() {
    console.log("جاري استيراد معلومات اللعبة وبيانات القائد...");
    
    // محاكاة سريعة لتحميل البيانات وتعبئة اسم المستخدم
    setTimeout(() => {
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.textContent = 'adil tabia'; // اسم اللاعب الافتراضي
        }
        console.log("تم تحديث الواجهة والبيانات بنجاح!");
    }, 800);
}

// ==========================================
// ⚙️ تشغيل الأكواد فور استقرار الواجهة (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchInitialGameData();
    setupInteractiveElements();
});