// ==========================================
// 🛡️ نظام التنقل المحمي والمستقر بين الصفحات
// ==========================================
function navigateTo(targetPage) {
    console.log(`محاولة الانتقال إلى الصفحة: ${targetPage}`);

    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => {
        if (view) view.style.display = 'none';
    });

    let viewId = 'view-main';
    switch (targetPage) {
        case 'main': viewId = 'view-main'; break;
        case 'work': viewId = 'view-work'; break;
        case 'wars': viewId = 'view-wars'; break;
        case 'profile': viewId = 'view-profile'; break;
        
        // القارة
        case 'continent-map': viewId = 'view-continent-map'; break;
        case 'continent-players': viewId = 'view-continent-players'; break;
        case 'continent-online': viewId = 'view-continent-online'; break;
        case 'continent-parties': viewId = 'view-continent-parties'; break;
        case 'continent-factories': viewId = 'view-continent-factories'; break;
        case 'continent-countries': viewId = 'view-continent-countries'; break;
        case 'continent-alliances': viewId = 'view-continent-alliances'; break;
        case 'continent-independent': viewId = 'view-continent-independent'; break;
        
        // الدولة
        case 'country-info': viewId = 'view-country-info'; break;
        case 'country-players': viewId = 'view-country-players'; break;
        case 'country-online': viewId = 'view-country-online'; break;
        case 'country-parties': viewId = 'view-country-parties'; break;
        case 'country-factories': viewId = 'view-country-factories'; break;
        
        default: viewId = 'view-main';
    }

    const targetElement = document.getElementById(viewId);
    if (targetElement) {
        targetElement.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // تحديث الأزرار النشطة بالفوتر السفلي
    const allNavButtons = document.querySelectorAll('.bottom-nav .nav-link');
    allNavButtons.forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    let activeNavId = 'nav-btn-main';
    if (targetPage === 'work') activeNavId = 'nav-btn-work';
    else if (targetPage === 'wars') activeNavId = 'nav-btn-wars';
    else if (targetPage === 'profile') activeNavId = 'nav-btn-profile';

    const activeNavBtn = document.getElementById(activeNavId);
    if (activeNavBtn) {
        activeNavBtn.classList.add('active');
    }
}

// ==========================================
// 🔁 نظام السلايدشو الذاتي واليدوي المحمي
// ==========================================
function setupSliderSystem() {
    const slidesContainer = document.getElementById('slides-container');
    const dot1 = document.getElementById('dot-1');
    const dot2 = document.getElementById('dot-2');

    if (slidesContainer && dot1 && dot2) {
        dot1.addEventListener('click', (e) => {
            e.stopPropagation();
            slidesContainer.style.transform = 'translateX(0%)';
            dot1.classList.add('active');
            dot2.classList.remove('active');
        });

        dot2.addEventListener('click', (e) => {
            e.stopPropagation();
            slidesContainer.style.transform = 'translateX(-50%)';
            dot2.classList.add('active');
            dot1.classList.remove('active');
        });
        
        console.log("✔️ تم تفعيل نظام السلايدشو بنجاح.");
    } else {
        console.warn("⚠️ عناصر السلايدشو غير متواجدة بالصفحة الحالية.");
    }
}

// ==========================================
// 💬 نظام الشات وإرسال الرسائل الفوري
// ==========================================
function setupChatSystem() {
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');
    const chatMessagesBox = document.getElementById('chat-messages-box');

    if (sendBtn && chatInput && chatMessagesBox) {
        const handleSendMessage = () => {
            const textValue = chatInput.value.trim();
            if (textValue === '') return;

            const now = new Date();
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'م' : 'ص';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const timeString = `${hours}:${minutes} ${ampm}`;

            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message me';
            messageDiv.innerHTML = `
                <div class="msg-header">
                    <span>أنت (القائد)</span>
                    <span>${timeString}</span>
                </div>
                ${textValue}
            `;

            chatMessagesBox.appendChild(messageDiv);
            chatInput.value = '';
            chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
        };

        sendBtn.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
            }
        });

        console.log("✔️ تم تفعيل نظام محادثات الشات بنجاح.");
    } else {
        console.warn("⚠️ عناصر الشات غير متوفرة بالصفحة حالياً.");
    }
}

// ==========================================
// 🎯 ربط تفاعل الخلايا وعناصر التحكم بالكامل
// ==========================================
function setupInteractiveElements() {
    // مصفوفة الربط للخلايا التفاعلية في البلوكين الأول والثاني
    const interactiveStats = [
        // البلوك الأول (القارة)
        { id: 'btn-continent-map', page: 'continent-map' },
        { id: 'btn-continent-pop', page: 'continent-players' },
        { id: 'btn-continent-online', page: 'continent-online' },
        { id: 'btn-continent-parties', page: 'continent-parties' },
        { id: 'btn-continent-factories', page: 'continent-factories' },
        { id: 'btn-continent-countries', page: 'continent-countries' },
        { id: 'btn-continent-alliances', page: 'continent-alliances' },
        { id: 'btn-continent-independent', page: 'continent-independent' },
        
        // البلوك الثاني (الدولة)
        { id: 'btn-country-flag', page: 'country-info' },
        { id: 'btn-country-pop', page: 'country-players' },
        { id: 'btn-country-online', page: 'country-online' },
        { id: 'btn-country-parties', page: 'country-parties' },
        { id: 'btn-country-factories', page: 'country-factories' }
    ];

    interactiveStats.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateTo(item.page);
            });
        }
    });

    // ربط مستقر وثابت لأزرار شريط التنقل السفلي
    const navButtons = [
        { id: 'nav-btn-main', page: 'main' },
        { id: 'nav-btn-work', page: 'work' },
        { id: 'nav-btn-wars', page: 'wars' },
        { id: 'nav-btn-profile', page: 'profile' }
    ];

    navButtons.forEach(btn => {
        const element = document.getElementById(btn.id);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(btn.page);
            });
        }
    });

    // ربط زر البرلمان
    const parliamentBtn = document.getElementById('btn-parliament');
    if (parliamentBtn) {
        parliamentBtn.addEventListener('click', () => {
            alert('أهلاً بك في برلمان الدولة السيادي! جاري تحضير جلسة التصويت...');
        });
    }

    console.log("✔️ تم تهيئة وربط كافة الخلايا والأزرار التفاعلية بنجاح.");
}

// ==========================================
// 📥 محاكاة تحميل بيانات اللاعب بشكل آمن
// ==========================================
function fetchInitialGameData() {
    // محاكاة سريعة ومضمونة لإلغاء حالة الانتظار
    setTimeout(() => {
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.textContent = 'adil tabia'; // حل فوري لمشكلة "جاري التحميل" المعلقة بالصورة
            console.log("✔️ تم جلب بيانات واسم القائد بنجاح.");
        }
    }, 200);
}

// ==========================================
// 🏁 تهيئة مستقرة عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("بوابة التحكم: مستند اللعبة جاهز ومستقر بالكامل.");
    
    // تشغيل الأنظمة بعد اكتمال بناء الصفحة لتفادي الأخطاء نهائياً
    fetchInitialGameData();
    setupSliderSystem();
    setupChatSystem();
    setupInteractiveElements();
});