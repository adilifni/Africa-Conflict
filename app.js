// ==========================================
// 💬 نظام الشات النشط والسلايدر والتنقل (Router & Fetch System)
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

export function setupChatSystem() {
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');
    const chatMessagesBox = document.getElementById('chat-messages-box');

    if (!sendBtn || !chatInput || !chatMessagesBox) return;

    loadStoredMessages(chatMessagesBox);

    const handleSendMessage = () => {
        const textValue = chatInput.value.trim();
        if (textValue === '') return;

        const currentUserName = document.getElementById('user-name')?.textContent || 'لاعب مجهول';
        const messageData = { sender: currentUserName, text: textValue, time: Date.now() };

        saveMessageLocally(messageData);
        renderSingleMessage(chatMessagesBox, messageData, true);

        chatInput.value = '';
        chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); }
    });
}

function saveMessageLocally(msg) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    storedMessages.push(msg);
    localStorage.setItem('chat_messages_v1', JSON.stringify(storedMessages));
}

function loadStoredMessages(container) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    const currentTime = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    const validMessages = storedMessages.filter(msg => (currentTime - msg.time) < twentyFourHours);
    localStorage.setItem('chat_messages_v1', JSON.stringify(validMessages));

    container.innerHTML = '';
    validMessages.forEach(msg => {
        const currentPlayerName = document.getElementById('user-name')?.textContent || 'لاعب مجهول';
        renderSingleMessage(container, msg, msg.sender === currentPlayerName);
    });
    container.scrollTop = container.scrollHeight;
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
        { id: 'btn-continent-map', page: 'countries' },
        { id: 'btn-continent-pop', page: 'countries' },
        { id: 'btn-continent-online', page: 'countries' },
        { id: 'btn-continent-parties', page: 'parties' },
        { id: 'btn-continent-factories', page: 'work' },
        { id: 'btn-continent-countries', page: 'countries' },
        { id: 'btn-continent-alliances', page: 'wars' },
        { id: 'btn-continent-independent', page: 'countries' },
        { id: 'btn-country-flag', page: 'profile' },
        { id: 'btn-country-pop', page: 'countries' },
        { id: 'btn-country-online', page: 'countries' },
        { id: 'btn-country-parties', page: 'parties' },
        { id: 'btn-country-factories', page: 'work' }
    ];

    interactiveStats.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            element.addEventListener('click', (e) => { e.stopPropagation(); navigateTo(item.page); });
        }
    });
}

// 🌐 نظام التنقل الذكي وجلب الصفحات ديناميكياً من مجلد pages/
export async function navigateTo(targetPage) {
    // 1. إخفاء جميع الواجهات الحالية داخل المسرح
    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => { if (view) view.style.display = 'none'; });

    let viewId = `view-${targetPage}`;
    let targetElement = document.getElementById(viewId);

    // 2. إذا لم تكن الحاوية موجودة مسبقاً في الـ DOM، نقوم بإنشائها ديناميكياً داخل المسرح
    if (!targetElement) {
        targetElement = document.createElement('div');
        targetElement.id = viewId;
        targetElement.className = 'game-view';
        targetElement.style.cssText = "display: flex; flex-direction: column; gap: 15px; width: 100%;";
        
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.appendChild(targetElement);
        }
    }

    // 3. جلب محتوى الصفحة من مجلد pages/ عبر fetch إذا كانت الحاوية فارغة
    if (!targetElement.hasChildNodes() || targetElement.innerHTML.trim() === "") {
        try {
            const response = await fetch(`pages/${targetPage}.html`);
            if (response.ok) {
                const htmlContent = await response.text();
                targetElement.innerHTML = htmlContent;
                
                // إذا تم جلب صفحة الرئيسية main.html، قد تحتاج لإعادة تفعيل السلايدر أو الشات إن وجدوا داخلها
                if (targetPage === 'main') {
                    setupSliderSystem();
                    setupChatSystem();
                }
            } else {
                targetElement.innerHTML = `<p style="text-align: center; color: #fc8181; padding: 20px;">عذراً، تعذر تحميل الصفحة (${targetPage}.html).</p>`;
            }
        } catch (error) {
            console.error("خطأ أثناء جلب الملف:", error);
            targetElement.innerHTML = `<p style="text-align: center; color: #fc8181; padding: 20px;">حدث خطأ في الاتصال أثناء جلب الصفحة.</p>`;
        }
    }

    // 4. إظهار الواجهة المطلوبة
    targetElement.style.display = 'flex';

    // 5. إعادة التمرير للأعلى بسلاسة
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 6. تحديث الأزرار النشطة في شريط التنقل السفلي
    const allNavLinks = document.querySelectorAll('.bottom-nav .nav-link');
    allNavLinks.forEach(link => { if (link) link.classList.remove('active'); });

    allNavLinks.forEach(link => {
        const attr = link.getAttribute('onclick') || link.getAttribute('data-target');
        if (attr && attr.includes(`'${targetPage}'`)) {
            link.classList.add('active');
        }
    });
}

export function switchView(pageName) {
    navigateTo(pageName);
}

// ربط الدالة بنافذة المتصفح لتعمل مباشرة عبر الأزرار
window.switchView = switchView;