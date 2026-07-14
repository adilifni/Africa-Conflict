const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة Firebase مرة واحدة فقط لمنع التكرار
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserUid = null;
let currentUserName = "لاعب";
let userResidenceCountry = "morocco";
let userCurrentLocation = "morocco";

const countryFlagCodes = {
    "morocco": "ma", "egypt": "eg", "algeria": "dz", "tunisia": "tn",
    "libya": "ly", "sudan": "sd", "nigeria": "ng", "south_africa": "za"
};

// متغيرات التحكم في السلايدشو لقارة أفريقيا
let currentSlideIndex = 0;

// مراقبة حالة تسجيل الدخول وبدء جلب البيانات
auth.onAuthStateChanged((user) => {
    const currentPath = window.location.pathname;

    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب";
        
        const playerStatusEl = document.getElementById('player-status');
        if (playerStatusEl) playerStatusEl.innerText = "القائد: " + currentUserName;

        // فحص وجود مستند اللاعب في قاعدة البيانات
        const userRef = db.collection('players').doc(user.uid);
        userRef.get().then((doc) => {
            if (!doc.exists) {
                console.log("إنشاء حساب جديد للاعب في Firestore...");
                userRef.set({
                    uid: user.uid,
                    name: currentUserName,
                    email: user.email || "",
                    photo: user.photoURL || "",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    level: 1,
                    energy: 100,
                    money: 5000,
                    gold: 5,
                    oil: 20,
                    wheat: 50,
                    residence_country: "morocco", 
                    current_location: "morocco",   
                    has_party: false,
                    party_id: "",
                    factories_list: [1]            
                }).then(() => {
                    getPlayerDataAndActivateOnline(user.uid);
                }).catch((err) => {
                    console.error("خطأ أثناء تهيئة حساب جديد:", err);
                    getPlayerDataAndActivateOnline(user.uid);
                });
            } else {
                getPlayerDataAndActivateOnline(user.uid);
            }
        }).catch((err) => {
            console.error("خطأ جلب حساب اللاعب من Firestore:", err);
            getPlayerDataAndActivateOnline(user.uid);
        });

    } else {
        console.log("لا يوجد مستخدم نشط.");
        if (!currentPath.endsWith('/') && !currentPath.endsWith('index.html')) {
            window.location.replace("/");
        }
    }
});

function getPlayerDataAndActivateOnline(uid) {
    if (!uid) return;
    
    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            
            if (data.residence_country) {
                userResidenceCountry = data.residence_country.trim().toLowerCase();
            } else if (data.country) {
                userResidenceCountry = data.country.trim().toLowerCase();
            } else {
                userResidenceCountry = "morocco";
            }
            
            userCurrentLocation = data.current_location ? data.current_location.trim().toLowerCase() : userResidenceCountry;
            
            const flagImg = document.getElementById('country-flag');
            if (flagImg) {
                let flagCode = countryFlagCodes[userCurrentLocation] || "ma"; 
                flagImg.src = `https://flagcdn.com/w320/${flagCode}.png`;
            }
        }
        
        startLiveUpdates();

    }, (error) => {
        console.error("حدث خطأ أثناء الاتصال بـ Firestore:", error);
        startLiveUpdates();
    });
}

function startLiveUpdates() {
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (mainBlocks) mainBlocks.style.display = 'flex';

    listenToContinentAndCountryStats();
    
    if (currentUserUid) {
        activateOnlineStatus(currentUserUid, userCurrentLocation);
    }
    
    listenToLiveChat();
    initializeContinentSlideshow(); // بناء السلايدشو التفاعلي الجديد وهيكلته برمجياً
    setupClickListeners(); 
}

// بناء وهيكلة السلايدشو التفاعلي لقارة أفريقيا برمجياً دون الحاجة لتعديل ملف الـ HTML
function initializeContinentSlideshow() {
    const continentCard = document.querySelector('.continent-stats-card') || document.getElementById('continent-card');
    if (!continentCard) return;

    // إعادة تصميم الهيكل الداخلي ليدعم الجزء الثابت (الصورة) والجزء المتحرك (السلايدات)
    continentCard.innerHTML = `
        <div class="slideshow-wrapper" style="display: flex; width: 100%; position: relative; overflow: hidden; align-items: center; justify-content: space-between;">
            
            <div class="slides-container" style="flex: 1; overflow: hidden; position: relative; height: 75px;">
                
                <div class="slide-item active" id="slide-1" style="display: flex; justify-content: space-around; align-items: center; width: 100%; position: absolute; transition: transform 0.4s ease-in-out; transform: translateX(0);">
                    <div class="stat-unit" id="cont-pop-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">سكان</div>
                        <div id="cont-pop" style="font-size: 1.15rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-online-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">متصل</div>
                        <div id="cont-online" style="font-size: 1.15rem; font-weight: bold; color: #4ade80;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-parties-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">أحزاب</div>
                        <div id="cont-parties" style="font-size: 1.15rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-factories-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">مصانع</div>
                        <div id="cont-factories" style="font-size: 1.15rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                </div>

                <div class="slide-item" id="slide-2" style="display: flex; justify-content: space-around; align-items: center; width: 100%; position: absolute; transition: transform 0.4s ease-in-out; transform: translateX(-100%); opacity: 0;">
                    <div class="stat-unit" id="cont-countries-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">دول</div>
                        <div id="cont-countries" style="font-size: 1.15rem; font-weight: bold; color: #fff;">50</div>
                    </div>
                    <div class="stat-unit" id="cont-alliances-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">تحالف</div>
                        <div id="cont-alliances" style="font-size: 1.15rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-independent-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.75rem; color: #888;">مستقلة</div>
                        <div id="cont-independent" style="font-size: 1.15rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                </div>

            </div>

            <div class="static-continent-image" id="static-africa-img-btn" style="width: 65px; height: 65px; display: flex; align-items: center; justify-content: center; margin-right: 8px; cursor: pointer;" title="اضغط للانتقال للخريطة">
                <img src="img/africa-map.png" alt="Africa Map" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='https://img.icons8.com/color/96/africa.png'">
            </div>
        </div>

        <div class="slideshow-dots" style="display: flex; justify-content: center; gap: 6px; margin-top: 4px;">
            <span class="slide-dot active-dot" data-slide="0" style="width: 8px; height: 8px; border-radius: 50%; background-color: #a1c4fd; cursor: pointer; transition: background-color 0.3s;"></span>
            <span class="slide-dot" data-slide="1" style="width: 8px; height: 8px; border-radius: 50%; background-color: #555; cursor: pointer; transition: background-color 0.3s;"></span>
        </div>
    `;

    setupSlideshowSwipeAndClicks();
}

// برمجة وإعداد حركات السحب بالإصبع (Touch Swipe) والضغط على النقاط
function setupSlideshowSwipeAndClicks() {
    const slidesContainer = document.querySelector('.slides-container');
    const dots = document.querySelectorAll('.slide-dot');
    const slide1 = document.getElementById('slide-1');
    const slide2 = document.getElementById('slide-2');

    if (!slidesContainer || !slide1 || !slide2) return;

    function goToSlide(index) {
        currentSlideIndex = index;
        
        // تحديث النقاط النشطة
        dots.forEach((dot, idx) => {
            if (idx === index) {
                dot.style.backgroundColor = '#a1c4fd';
            } else {
                dot.style.backgroundColor = '#555';
            }
        });

        // حركة الانتقال والتأثير البصري السلس للسلايدات
        if (index === 0) {
            slide1.style.transform = 'translateX(0)';
            slide1.style.opacity = '1';
            slide2.style.transform = 'translateX(-100%)';
            slide2.style.opacity = '0';
        } else {
            slide1.style.transform = 'translateX(100%)';
            slide1.style.opacity = '0';
            slide2.style.transform = 'translateX(0)';
            slide2.style.opacity = '1';
        }
    }

    // إضافة تفعيل عند الضغط على النقاط
    dots.forEach((dot, index) => {
        dot.onclick = (e) => {
            e.stopPropagation();
            goToSlide(index);
        };
    });

    // التعرف على إيماءات اللمس والسحب بالإصبع (Touch events) للموبايل
    let touchStartX = 0;
    let touchEndX = 0;

    slidesContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    slidesContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        if (Math.abs(swipeDistance) > 40) { // حد أدنى للمسافة لتجنب التفاعل مع الاهتزازات الخفيفة
            if (swipeDistance < 0) {
                // سحب لليسار -> الانتقال للسلايد الثاني
                goToSlide(1);
            } else {
                // سحب لليمين -> الانتقال للسلايد الأول
                goToSlide(0);
            }
        }
    }
}

// تحديث إحصائيات القارة والدولة بشكل حي وحساب المتصلين بدقة وبدون أخطاء الفهرسة
function listenToContinentAndCountryStats() {
    db.collection('players').onSnapshot((snapshot) => {
        const totalPopulation = snapshot.size;
        const contPopEl = document.getElementById('cont-pop');
        if (contPopEl) contPopEl.innerText = totalPopulation;
        
        // حساب سكان الدولة الحالية
        if (userResidenceCountry) {
            let countryPopulation = 0;
            snapshot.forEach(doc => {
                const pData = doc.data();
                if (pData.residence_country && pData.residence_country.trim().toLowerCase() === userResidenceCountry) {
                    countryPopulation++;
                }
            });
            const countPopEl = document.getElementById('count-pop');
            if (countPopEl) countPopEl.innerText = countryPopulation;
        }
    }, err => console.error("خطأ حساب السكان الحية:", err));

    // حساب المتصلين خلال آخر 5 دقائق
    db.collection('online_users').onSnapshot((snapshot) => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        let totalOnline = 0;
        let countryOnline = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const lastActiveMs = (data.lastActive && typeof data.lastActive.toMillis === 'function') ? data.lastActive.toMillis() : 0;
            
            if (lastActiveMs >= fiveMinutesAgo) {
                totalOnline++;
                if (userResidenceCountry && data.location && data.location.trim().toLowerCase() === userResidenceCountry) {
                    countryOnline++;
                }
            }
        });

        const contOnlineEl = document.getElementById('cont-online');
        const countOnlineEl = document.getElementById('count-online');
        if (contOnlineEl) contOnlineEl.innerText = totalOnline;
        if (countOnlineEl) countOnlineEl.innerText = countryOnline;
    }, err => console.error("خطأ تحديث المتصلين النشطين:", err));

    // جلب الإحصائيات العامة للقارة
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const contParties = document.getElementById('cont-parties');
            const contFactories = document.getElementById('cont-factories');
            const contIndependent = document.getElementById('cont-independent');
            const contAlliances = document.getElementById('cont-alliances');

            if (contParties) contParties.innerText = data.parties || 0;
            if (contFactories) contFactories.innerText = data.factories || 0;
            if (contIndependent) contIndependent.innerText = data.independent || 0;
            if (contAlliances) contAlliances.innerText = data.alliances || 0;
        }
    }, err => console.error("خطأ إحصائيات القارة الثابتة:", err));

    // جلب الإحصائيات العامة للدولة
    if (userResidenceCountry) {
        db.collection('countries').doc(userResidenceCountry).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const countFactories = document.getElementById('count-factories');
                const countParties = document.getElementById('count-parties');
                
                if (countFactories) countFactories.innerText = data.factories || 0;
                if (countParties) countParties.innerText = data.parties || 0;
            }
        }, err => console.error("خطأ بيانات الدولة الإضافية:", err));
    }
}

function activateOnlineStatus(uid, location) {
    if (!uid) return;
    db.collection('online_users').doc(uid).set({
        uid: uid,
        name: currentUserName,
        location: location,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error("خطأ تحديث التواجد النشط:", err));
}

// شات اللعبة: فلترة آخر 24 ساعة وعرض التوقيت
function listenToLiveChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    db.collection('global_chat')
        .where('createdAt', '>=', twentyFourHoursAgo)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            chatContainer.innerHTML = ""; 
            
            let messages = [];
            snapshot.forEach(doc => messages.unshift(doc.data()));

            messages.forEach((msg) => {
                const msgBubble = document.createElement('div');
                msgBubble.className = "msg-bubble";
                
                let timeString = "";
                if (msg.createdAt && typeof msg.createdAt.toDate === 'function') {
                    const messageDate = msg.createdAt.toDate();
                    timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                msgBubble.innerHTML = `
                    <div class="msg-meta">
                        <span class="msg-author" style="font-weight: bold; color: #a1c4fd;">${msg.name || "لاعب"}</span>
                        <span class="msg-time" style="font-size: 0.75rem; color: #888; margin-right: 6px;">(${timeString})</span>
                    </div>
                    <div class="msg-text" style="margin-top: 3px; word-break: break-word;">${msg.text || ""}</div>
                `;
                chatContainer.appendChild(msgBubble);
            });
            
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, err => console.error("خطأ جلب شات اللعبة:", err));
}

function sendChatMessage() {
    const inputField = document.getElementById('chat-input-field');
    if (!inputField || !inputField.value.trim() || !currentUserUid) return;
    
    const messageText = inputField.value.trim();
    
    db.collection('global_chat').add({
        uid: currentUserUid,
        name: currentUserName,
        text: messageText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        inputField.value = ""; 
    }).catch((err) => {
        console.error("خطأ أثناء إرسال الرسالة للشات:", err);
    });
}

// 🔗 دالة ربط العناصر وتحويلها لأزرار تفاعلية قابلة للضغط مجهزة للروابط المستقبلية
function setupClickListeners() {
    
    // 1. صورة أفريقيا الثابتة تنقل إلى الخريطة
    const staticAfricaImg = document.getElementById('static-africa-img-btn');
    if (staticAfricaImg) {
        staticAfricaImg.onclick = (e) => {
            e.stopPropagation();
            window.location.href = "/map.html";
        };
    }

    // 2. كارت الدولة وعلم المغرب ينقلان لصفحة الدولة
    const countryCard = document.querySelector('.country-stats-card') || document.getElementById('country-card');
    const flagImg = document.getElementById('country-flag');
    
    const goToCountryPage = () => {
        window.location.href = `/country.html?id=${userResidenceCountry}`;
    };

    if (countryCard) {
        countryCard.style.cursor = 'pointer';
        countryCard.onclick = goToCountryPage;
    }
    if (flagImg) {
        flagImg.style.cursor = 'pointer';
        flagImg.onclick = (e) => {
            e.stopPropagation();
            goToCountryPage();
        };
    }
// 3. روابط السلايد التفاعلي الأول والثاني ومستندات الدولة
    const interactiveStats = [
        // السلايد الأول
        { id: 'cont-pop-wrapper', url: '/all-players.html' },
        { id: 'cont-online-wrapper', url: '/online-players.html' },
        { id: 'cont-parties-wrapper', url: '/parties.html' },
        { id: 'cont-factories-wrapper', url: '/factories.html' },
        // السلايد الثاني
        { id: 'cont-countries-wrapper', url: '/all-countries.html' },
        { id: 'cont-alliances-wrapper', url: '/alliances.html' },
        { id: 'cont-independent-wrapper', url: '/independent.html' },
        // كارت الدولة السفلي
        { id: 'count-pop', url: `/country-players.html?id=${userResidenceCountry}` },
        { id: 'count-online', url: `/country-online.html?id=${userResidenceCountry}` },
        { id: 'count-parties', url: '/parties.html' },
        { id: 'count-factories', url: '/factories.html' }
    ];
    interactiveStats.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.style.cursor = 'pointer';
            el.style.transition = 'transform 0.15s';
            el.onclick = (e) => {
                e.stopPropagation();
                window.location.href = item.url;
            };
            el.onmouseenter = () => el.style.transform = 'scale(1.05)';
            el.onmouseleave = () => el.style.transform = 'scale(1)';
        }
    });
    // 4. شريط التنقل السفلي (أزرار التنقل الرئيسية تظل ثابتة وتعمل بالكامل)
    const navItems = [
        { text: 'الرئيسية', url: '/main.html' },
        { text: 'العمل', url: '/work.html' },
        { text: 'الحروب', url: '/wars.html' },
        { text: 'الحساب', url: '/profile.html' }
    ];
    const bottomNav = document.querySelector('.bottom-nav-container') || document.body;
    
    navItems.forEach(nav => {
        const xpath = `//span[text()='${nav.text}'] | //div[text()='${nav.text}'] | //a[text()='${nav.text}']`;
        const result = document.evaluate(xpath, bottomNav, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue;
        
        if (element) {
            const clickableArea = element.parentElement || element;
            clickableArea.style.cursor = 'pointer';
            clickableArea.onclick = () => {
                window.location.href = nav.url;
            };
        }
    });
}
document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById('send-chat-trigger');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    const inputField = document.getElementById('chat-input-field');
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage);
            }
        });
    }
});