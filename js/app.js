// ==========================================

// دالة لإظهار دائرة التحميل
function showLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

// دالة لإخفاء دائرة التحميل
function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}


async function loadProfileData() {
    // 1. اظهار الدائرة فوراً قبل بدء جلب البيانات
    showLoader();

    try {
        // محاكاة جلب البيانات من Firebase أو سيرفر خارجي
        // await 
        
        // ... ضع كود جلب وتحديث بيانات البروفايل هنا ...

    } catch (error) {
        console.error("حدث خطأ أثناء التحميل:", error);
    } finally {
        // 2. إخفاء الدائرة فوراً سواء نجح التحميل أو حدث خطأ
        hideLoader();
    }
}



// 💬 نظام الشات النشط والسلايدر والتنقل (Router)
// ==========================================

export function formatTimeShort(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    let timeString = [];
    if (days > 0) timeString.push(`${days}j`);
    if (hours > 0) timeString.push(`${hours}h`);
    if (minutes > 0) timeString.push(`${minutes}m`);
    if (seconds > 0 && days === 0) timeString.push(`${seconds}s`);

    return timeString.join(' ') || "1s";
}

let unsubscribeChatMessages = null;

export function setupChatSystem() {
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');
    const chatMessagesBox = document.getElementById('chat-messages-box');

    if (!sendBtn || !chatInput || !chatMessagesBox) return;

    // ننتظر جاهزية Firebase قبل الاشتراك بمجموعة الدردشة (نفس أسلوب game.js)
    function waitForFirebaseChat() {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            subscribeToChatMessages(chatMessagesBox);
        } else {
            setTimeout(waitForFirebaseChat, 100);
        }
    }
    waitForFirebaseChat();

    const handleSendMessage = () => {
        const textValue = chatInput.value.trim();
        if (textValue === '') return;

        const currentUserName = document.getElementById('user-name')?.textContent || 'لاعب مجهول';
        const currentUser = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;

        if (!currentUser) {
            console.error("لا يمكن إرسال رسالة قبل تسجيل الدخول");
            return;
        }

        firebase.firestore().collection('global_chat').add({
            sender: currentUserName,
            senderUid: currentUser.uid,
            text: textValue,
            time: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error("خطأ أثناء إرسال الرسالة:", err));

        chatInput.value = '';
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); }
    });
}

// اشتراك حي بآخر 50 رسالة من الدردشة العامة المشتركة بين كل اللاعبين
function subscribeToChatMessages(container) {
    if (unsubscribeChatMessages) return; // تجنب اشتراك مكرر لو تم استدعاء الدالة أكثر من مرة

    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    unsubscribeChatMessages = firebase.firestore()
        .collection('global_chat')
        .orderBy('time', 'asc')
        .limitToLast(50)
        .onSnapshot((snapshot) => {
            container.innerHTML = '';
            const currentPlayerName = document.getElementById('user-name')?.textContent || 'لاعب مجهول';
            const now = Date.now();

            snapshot.forEach((doc) => {
                const msg = doc.data();
                const msgTime = msg.time?.toMillis ? msg.time.toMillis() : (typeof msg.time === 'number' ? msg.time : now);

                // إخفاء الرسائل الأقدم من 24 ساعة من العرض فقط (بدون حذفها من القاعدة)
                if (now - msgTime > twentyFourHoursMs) return;

                renderSingleMessage(container, { sender: msg.sender, text: msg.text, time: msgTime }, msg.sender === currentPlayerName);
            });

            container.scrollTop = container.scrollHeight;
        }, (err) => console.error("خطأ أثناء جلب رسائل الدردشة:", err));
}

function renderSingleMessage(container, msg, isMe) {
    const msgDate = new Date(msg.time);
    let hours = msgDate.getHours();
    const minutes = String(msgDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;

    const messageDiv = document.createElement('div');
    messageDiv.className = isMe ? 'chat-message me' : 'chat-message others';
    messageDiv.innerHTML = `
        <div class="msg-header">
            <span>${msg.sender} ${isMe ? '(أنت)' : ''}</span>
            <span>${hours}:${minutes} ${ampm}</span>
        </div>
        ${msg.text}
    `;
    container.appendChild(messageDiv);
}

export function setupSliderSystem() {
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
                slide.style.display = (index === activeIndex) ? 'block' : 'none';
                if (index === activeIndex) slide.style.width = '100%';
            });
        };
        showSlide(0);

        dot1.addEventListener('click', (e) => {
            e.stopPropagation(); showSlide(0);
            dot1.classList.add('active'); dot2.classList.remove('active');
        });
        dot2.addEventListener('click', (e) => {
            e.stopPropagation(); showSlide(1);
            dot2.classList.add('active'); dot1.classList.remove('active');
        });
    }
}

export function setupInteractiveElements() {
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
            element.addEventListener('click', (e) => { e.stopPropagation(); navigateTo(item.page); });
        }
    });
}

export function navigateTo(targetPage) {
    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => { if (view) view.style.display = 'none'; });

    let viewId = 'view-home'; // تم التعديل هنا لتبدأ بالرئيسية الصحيحة
    switch (targetPage) {
        case 'main': viewId = 'view-home'; break; // ربط صفحة main بالعنصر view-home
        case 'work': viewId = 'view-work'; break;
        case 'wars': viewId = 'view-wars'; break;
        case 'profile': viewId = 'view-profile'; break;
        default: viewId = `view-${targetPage}`;
    }

    const targetElement = document.getElementById(viewId);
    if (targetElement) {
        // تحديد طريقة العرض بناءً على الصفحة لضمان تناسق التصميم
        targetElement.style.display = (targetPage === 'profile' || targetPage === 'main') ? 'flex' : 'block';
        if (targetPage === 'profile' || targetPage === 'main') {
            targetElement.style.flexDirection = 'column';
        }
    }

    const allNavLinks = document.querySelectorAll('.bottom-nav .nav-link');
    allNavLinks.forEach(link => { if (link) link.classList.remove('active'); });

    allNavLinks.forEach(link => {
        const attr = link.getAttribute('onclick') || link.getAttribute('data-target');
        if (attr && attr.includes(`'${targetPage}'`)) link.classList.add('active');
    });
}

export function switchView(pageName) {
    navigateTo(pageName);
}

// ربط الدالة بنافذة المتصفح لتعمل مباشرة عبر الأزرار الداخلية
window.switchView = switchView;
