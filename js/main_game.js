// قاعدة بيانات الدول الإفريقية المدعومة حالياً في اللعبة لتبديل البلوك تلقائياً
const africanCountries = {
    morocco: { name: "المغرب", flag: "🇲🇦" },
    algeria: { name: "الجزائر", flag: "🇩🇿" },
    egypt: { name: "مصر", flag: "🇪🇬" },
    tunisia: { name: "تونس", flag: "🇹🇳" },
    libya: { name: "ليبيا", flag: "🇱🇾" },
    south_africa: { name: "جنوب إفريقيا", flag: "🇿🇦" },
    nigeria: { name: "نيجيريا", flag: "🇳🇬" },
    senegal: { name: "السنغال", flag: "🇸🇳" }
};

// متغير عالمي لحفظ مؤقت الخمول لكي لا يتداخل عند إعادة تعيينه
let inactivityTimer;

// ==========================================
// 📥 جلب اسم حساب الجيميل النشط وتحديث إحصائيات المتصلين والسكان من Firestore (بث مباشر)
// ==========================================
function fetchInitialGameData() {
    const userNameSpan = document.getElementById('user-name');
    if (!userNameSpan) return;

    // دالة فحص متكررة تنتظر حتى يتم تحميل مكتبة الفيربيس بالكامل في المتصفح
    function waitForFirebase() {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
            
            const db = firebase.firestore();

            // بمجرد أن يصبح الفيربيس جاهزاً، نستمع لحالة الحساب النشط حالياً
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    const userUid = user.uid;

                    // 1. الاستماع المباشر (Real-time) لبيانات اللاعب وموقعه الحالي من Firestore
                    db.collection('players').doc(userUid).onSnapshot((doc) => {
                        if (doc.exists) {
                            const data = doc.data();
                            
                            // عرض وتحديث اسم اللاعب النقي
                            let playerName = data.name || user.displayName || user.email.split('@')[0];
                            playerName = playerName.replace('قائد', '').replace('مجهول', '').trim();
                            userNameSpan.textContent = playerName;

                            // تحديث بلوك الدولة بناءً على موقع اللاعب الحالي (current_location)
                            const playerLoc = data.current_location || "morocco";
                            updateCountryBlockOnScreen(playerLoc);
                        }
                    }, (error) => {
                        console.error("خطأ في الاستماع لبيانات اللاعب:", error);
                    });

                    // 2. تحديث حالة الاتصال بالمتصفح الحالي إلى متصل (Online) في Firestore
                    db.collection('players').doc(userUid).update({
                        isOnline: true,
                        lastActive: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(err => console.error("Error setting online status:", err));

                    // 3. نظام مراقبة الخمول (Inactivity System) المطور والمحمي من تداخل التبويبات
                    const resetInactivityTimer = () => {
                        if (document.hidden) return; // تفادي تنشيط الحسابات بالخلفية عند حركة المستخدم بالحساب النشط

                        clearTimeout(inactivityTimer);
                        
                        db.collection('players').doc(userUid).update({
                            isOnline: true,
                            lastActive: firebase.firestore.FieldValue.serverTimestamp()
                        }).catch(err => {});

                        // مهلة الخمول المعتادة (5 دقائق)
                        inactivityTimer = setTimeout(() => {
                            db.collection('players').doc(userUid).update({
                                isOnline: false
                            }).catch(err => {});
                        }, 300000); 
                    };

                    // استماع حقيقي لتغيير التبويب (عند الخروج من الصفحة أو الانتقال لحساب آخر)
                    document.addEventListener('visibilitychange', () => {
                        if (document.hidden) {
                            clearTimeout(inactivityTimer);
                            db.collection('players').doc(userUid).update({
                                isOnline: false
                            }).catch(err => {});
                        } else {
                            resetInactivityTimer();
                        }
                    });

                    // الاستماع لحركات اللاعب المتنوعة (تتأثر فقط إذا كان التبويب مرئياً)
                    ['click', 'touchstart', 'mousemove', 'keypress', 'scroll'].forEach(eventType => {
                        window.addEventListener(eventType, resetInactivityTimer);
                    });

                    // تشغيل المؤقت لأول مرة عند الدخول
                    resetInactivityTimer();

                } else {
                    // إذا لم يسجل أي حساب دخوله بعد
                    userNameSpan.textContent = "زائر";
                    clearTimeout(inactivityTimer);
                }
            }); // إغلاق قوس onAuthStateChanged الصحيح هنا ✅

            // 4. الاستماع الحي والتحديث الفوري لإحصائيات السكان والمتصلين من قاعدة البيانات
            db.collection('players').onSnapshot((snapshot) => {
                const totalPlayers = snapshot.size; // إجمالي الحسابات المسجلة في اللعبة
                let onlinePlayers = 0;

                snapshot.forEach((doc) => {
                    if (doc.data().isOnline === true) {
                        onlinePlayers++;
                    }
                });

                // تأمين ظهور متصل واحد على الأقل (المستخدم النشط حالياً)
                if (onlinePlayers === 0 && firebase.auth().currentUser) {
                    onlinePlayers = 1;
                }

                // تحديث الأرقام على الشاشة فوراً
                updateStatsOnScreen(totalPlayers, onlinePlayers);
            }, (error) => {
                console.error("خطأ أثناء جلب إحصائيات اللاعبين:", error);
            });

        } else {
            // إذا لم تجهز المكتبة بعد، انتظر 100 مللي ثانية وحاول مجدداً
            setTimeout(waitForFirebase, 100);
        }
    }

    // بدء عملية الانتظار والربط
    waitForFirebase();
}

// دالة مساعدة لتحديث الأرقام مباشرة في واجهة المستخدم عبر الكلاسات المحددة
function updateStatsOnScreen(totalPlayers, onlinePlayers) {
    // 1. تحديث إحصائيات القارة (البلوك العلوي)
    const globalPopElements = document.querySelectorAll('.global-population');
    const globalOnlineElements = document.querySelectorAll('.global-online');

    globalPopElements.forEach(el => el.textContent = totalPlayers);
    globalOnlineElements.forEach(el => el.textContent = onlinePlayers);

    // 2. تحديث إحصائيات الدولة الحالية (البلوك السفلي)
    const countryPopElements = document.querySelectorAll('.country-population');
    const countryOnlineElements = document.querySelectorAll('.country-online');

    countryPopElements.forEach(el => el.textContent = totalPlayers);
    countryOnlineElements.forEach(el => el.textContent = onlinePlayers);
}

// دالة لتحديث واجهة بلوك الدولة (العلم والاسم) ديناميكياً
function updateCountryBlockOnScreen(countryKey) {
    const flagElement = document.getElementById('country-flag');
    const nameElement = document.getElementById('country-name-text');
    
    if (africanCountries[countryKey]) {
        const countryData = africanCountries[countryKey];
        if (flagElement) flagElement.textContent = countryData.flag;
        if (nameElement) nameElement.textContent = countryData.name;
    } else {
        if (flagElement) flagElement.textContent = "🌍";
        if (nameElement) nameElement.textContent = "أفريقيا";
    }
}

// ==========================================
// ✈️ دالة السفر والتنقل بين الدول الإفريقية
// ==========================================
function travelToCountry(targetCountryKey) {
    if (!africanCountries[targetCountryKey]) {
        console.error("هذه الدولة غير مدعومة حالياً!");
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user) {
        alert("يجب عليك تسجيل الدخول أولاً لتتمكن من السفر!");
        return;
    }

    const db = firebase.firestore();
    
    // تحديث مكان اللاعب الحالي في قاعدة البيانات
    db.collection('players').doc(user.uid).update({
        current_location: targetCountryKey
    })
    .then(() => {
        alert(`✈️ تم السفر بنجاح إلى ${africanCountries[targetCountryKey].name}!`);
    })
    .catch((error) => {
        console.error("خطأ أثناء محاولة السفر:", error);
    });
}

// ==========================================
// 💬 نظام الشات التفاعلي المربوط بالاسم النشط (24 ساعة)
// ==========================================
function setupChatSystem() {
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');
    const chatMessagesBox = document.getElementById('chat-messages-box');

    if (!sendBtn || !chatInput || !chatMessagesBox) return;

    // تحميل وعرض رسائل الـ 24 ساعة الماضية
    loadStoredMessages(chatMessagesBox);

    const handleSendMessage = () => {
        const textValue = chatInput.value.trim();
        if (textValue === '') return;

        // قراءة الاسم النشط حالياً على الشاشة (ليتغير بتغير الحساب)
        const currentUserName = document.getElementById('user-name')?.textContent || 'adil tabia';
        const timestamp = Date.now();

        const messageData = {
            sender: currentUserName,
            text: textValue,
            time: timestamp
        };

        saveMessageLocally(messageData);
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

// تحميل الرسائل الصالحة
function loadStoredMessages(container) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    const currentTime = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; 

    const validMessages = storedMessages.filter(msg => (currentTime - msg.time) < twentyFourHours);
    localStorage.setItem('chat_messages_v1', JSON.stringify(validMessages));

    container.innerHTML = '';

    validMessages.forEach(msg => {
        const currentPlayerName = document.getElementById('user-name')?.textContent || 'adil tabia';
        const isMe = msg.sender === currentPlayerName;
        renderSingleMessage(container, msg, isMe);
    });

    container.scrollTop = container.scrollHeight;
}

// بناء تصميم الرسالة
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

// دالة التنقل وإظهار الفيوز
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