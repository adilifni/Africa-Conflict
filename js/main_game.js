
// 4. دالة فحص الحساب وإنشاء الحقول الجديدة والافتراضية تلقائياً
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);

    userRef.get({ source: 'server' }).then((doc) => {
        if (!doc.exists) {
// 🚀 الحساب جديد تماماً! نقوم بتوليد كافة الحقول الهيكلية تلقائياً هنا
            userRef.set({
                uid: user.uid,
                name: user.displayName || "قائد جديد",
                email: user.email,
                photo: user.photoURL || "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),       

// ==========================================
// 💬 نظام الشات الذكي (مؤمن ومحفوظ لمدة 24 ساعة)
// ==========================================
function setupChatSystem() {
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');
    const chatMessagesBox = document.getElementById('chat-messages-box');

    if (!sendBtn || !chatInput || !chatMessagesBox) return;

    // تحميل الرسائل المحفوظة وعرض الصالحة منها (التي لم يمر عليها 24 ساعة)
    loadStoredMessages(chatMessagesBox);

    const handleSendMessage = () => {
        const textValue = chatInput.value.trim();
        if (textValue === '') return;

        const currentUserName = document.getElementById('user-name')?.textContent || 'قائد';
        const timestamp = Date.now(); // وقت الإرسال بالملي ثانية

        const messageData = {
            sender: currentUserName,
            text: textValue,
            time: timestamp
        };

        // 1. حفظ الرسالة في الـ LocalStorage الخاص بالمتصفح
        saveMessageLocally(messageData);

        // 2. عرض الرسالة فوراً في الشات
        renderSingleMessage(chatMessagesBox, messageData, true);

        chatInput.value = '';
        chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage();
        }
    });
}

// حفظ الرسالة محلياً
function saveMessageLocally(msg) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    storedMessages.push(msg);
    localStorage.setItem('chat_messages_v1', JSON.stringify(storedMessages));
}

// تحميل وعرض الرسائل وتصفية القديم منها (أقدم من 24 ساعة)
function loadStoredMessages(container) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    const currentTime = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 ساعة بالملي ثانية

    // تصفية الرسائل التي عمرها أقل من 24 ساعة فقط
    const validMessages = storedMessages.filter(msg => (currentTime - msg.time) < twentyFourHours);
    
    // تحديث التخزين بالرسائل الصالحة فقط وحذف المنتهية
    localStorage.setItem('chat_messages_v1', JSON.stringify(validMessages));

    // مسح حاوية الشات قبل العرض لتفادي التكرار (مع الإبقاء على رسالة الترحيب الافتراضية إن وجدت)
    container.innerHTML = '';

    // عرض الرسائل الصالحة
    validMessages.forEach(msg => {
        const isMe = msg.sender === (document.getElementById('user-name')?.textContent || 'قائد');
        renderSingleMessage(container, msg, isMe);
    });

    container.scrollTop = container.scrollHeight;
}

// دالة بناء هيكل الرسالة وعرضها
function renderSingleMessage(container, msg, isMe) {
    const msgDate = new Date(msg.time);
    let hours = msgDate.getHours();
    const minutes = String(msgDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${hours}:${minutes} ${ampm}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = isMe ? 'chat-message me' : 'chat-message others';
    
    messageDiv.innerHTML = `
        <div class="msg-header">
            <span>${msg.sender} ${isMe ? '(أنت)' : ''}</span>
            <span>${timeString}</span>
        </div>
        ${msg.text}
    `;
    container.appendChild(messageDiv);
}

// ==========================================
// 🔁 نظام السلايدشو المطور (إخفاء وإظهار آمن)
// ==========================================
function setupSliderSystem() {
    const slides = document.querySelectorAll('#slides-container .slide');
    const dot1 = document.getElementById('dot-1');
    const dot2 = document.getElementById('dot-2');
    const slidesContainer = document.getElementById('slides-container');

    if (slides.length >= 2 && dot1 && dot2) {
        if (slidesContainer) {
            slidesContainer.style.width = '100%';
            slidesContainer.style.transform = 'none'; 
        }

        const showSlide = (activeIndex) => {
            slides.forEach((slide, index) => {
                if (index === activeIndex) {
                    slide.style.display = 'block';
                    slide.style.width = '100%';
                } else {
                    slide.style.display = 'none';
                }
            });
        };

        showSlide(0);

        dot1.addEventListener('click', function(e) {
            e.stopPropagation();
            showSlide(0);
            dot1.classList.add('active');
            dot2.classList.remove('active');
        });

        dot2.addEventListener('click', function(e) {
            e.stopPropagation();
            showSlide(1);
            dot2.classList.add('active');
            dot1.classList.remove('active');
        });
    }
}

// ==========================================
// 🎯 ربط تفاعل الخلايا والتنقل
// ==========================================
function setupInteractiveElements() {
    const interactiveStats = [
        { id: 'btn-continent-map', page: 'continent-map' },
        { id: 'btn-continent-pop', page: 'continent-players' },
        { id: 'btn-continent-online', page: 'continent-online' },
        { id: 'btn-continent-parties', page: 'continent-parties' },
        { id: 'btn-continent-factories', page: 'continent-factories' },
        { id: 'btn-continent-countries', page: 'continent-countries' },
        { id: 'btn-continent-alliances', page: 'continent-alliances' },
        { id: 'btn-continent-independent', page: 'continent-independent' },
        
        { id: 'btn-country-flag', page: 'country-info' },
        { id: 'btn-country-pop', page: 'country-players' },
        { id: 'btn-country-online', page: 'country-online' },
        { id: 'btn-country-parties', page: 'country-parties' },
        { id: 'btn-country-factories', page: 'country-factories' }
    ];

    interactiveStats.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            element.addEventListener('click', function(e) {
                e.stopPropagation();
                navigateTo(item.page);
            });
        }
    });

    const navButtons = [
        { id: 'nav-btn-main', page: 'main' },
        { id: 'nav-btn-work', page: 'work' },
        { id: 'nav-btn-wars', page: 'wars' },
        { id: 'nav-btn-profile', page: 'profile' }
    ];

    navButtons.forEach(btn => {
        const element = document.getElementById(btn.id);
        if (element) {
            element.addEventListener('click', function(e) {
                e.preventDefault();
                navigateTo(btn.page);
            });
        }
    });
}

function navigateTo(targetPage) {
    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => { if (view) view.style.display = 'none'; });

    let viewId = 'view-main';
    switch (targetPage) {
        case 'main': viewId = 'view-main'; break;
        case 'work': viewId = 'view-work'; break;
        case 'wars': viewId = 'view-wars'; break;
        case 'profile': viewId = 'view-profile'; break;
        case 'continent-map': viewId = 'view-continent-map'; break;
        case 'continent-players': viewId = 'view-continent-players'; break;
        case 'continent-online': viewId = 'view-continent-online'; break;
        case 'continent-parties': viewId = 'view-continent-parties'; break;
        case 'continent-factories': viewId = 'view-continent-factories'; break;
        case 'continent-countries': viewId = 'view-continent-countries'; break;
        case 'continent-alliances': viewId = 'view-continent-alliances'; break;
        case 'continent-independent': viewId = 'view-continent-independent'; break;
        case 'country-info': viewId = 'view-country-info'; break;
        case 'country-players': viewId = 'view-country-players'; break;
        case 'country-online': viewId = 'view-country-online'; break;
        case 'country-parties': viewId = 'view-country-parties'; break;
        case 'country-factories': viewId = 'view-country-factories'; break;
    }

    const targetElement = document.getElementById(viewId);
    if (targetElement) targetElement.style.display = 'flex';

    const allNavButtons = document.querySelectorAll('.bottom-nav .nav-link');
    allNavButtons.forEach(btn => { if (btn) btn.classList.remove('active'); });

    let activeNavId = 'nav-btn-main';
    if (targetPage === 'work') activeNavId = 'nav-btn-work';
    else if (targetPage === 'wars') activeNavId = 'nav-btn-wars';
    else if (targetPage === 'profile') activeNavId = 'nav-btn-profile';

    const activeNavBtn = document.getElementById(activeNavId);
    if (activeNavBtn) activeNavBtn.classList.add('active');
}

// ==========================================
// 🏁 تشغيل الأنظمة عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    fetchInitialGameData();
    setupSliderSystem();
    setupChatSystem();
    setupInteractiveElements();
});