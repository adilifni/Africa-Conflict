const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة Firebase
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

let currentSlideIndex = 0;

// مراقبة حالة تسجيل الدخول
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب";
        
        const playerStatusEl = document.getElementById('player-status');
        if (playerStatusEl) playerStatusEl.innerText = "القائد: " + currentUserName;

        const userRef = db.collection('players').doc(user.uid);
        userRef.get().then((doc) => {
            if (!doc.exists) {
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
                    console.error("خطأ إنشاء الحساب:", err);
                    getPlayerDataAndActivateOnline(user.uid);
                });
            } else {
                getPlayerDataAndActivateOnline(user.uid);
            }
        }).catch((err) => {
            console.error("خطأ Firestore:", err);
            getPlayerDataAndActivateOnline(user.uid);
        });

    } else {
        console.log("الرجاء تسجيل الدخول أولاً.");
    }
});

function getPlayerDataAndActivateOnline(uid) {
    if (!uid) return;
    
    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            userResidenceCountry = data.residence_country ? data.residence_country.trim().toLowerCase() : "morocco";
            userCurrentLocation = data.current_location ? data.current_location.trim().toLowerCase() : userResidenceCountry;
            
            const flagImg = document.getElementById('country-flag');
            if (flagImg) {
                let flagCode = countryFlagCodes[userCurrentLocation] || "ma"; 
                flagImg.src = `https://flagcdn.com/w320/${flagCode}.png`;
            }
        }
        startLiveUpdates();
    }, (error) => {
        console.error("حدث خطأ في جلب بيانات اللاعب:", error);
        startLiveUpdates();
    });
}

function startLiveUpdates() {
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (mainBlocks) mainBlocks.style.display = 'flex';

    initializeContinentSlideshow(); 
    listenToContinentAndCountryStats();
    
    if (currentUserUid) {
        activateOnlineStatus(currentUserUid, userCurrentLocation);
    }
    
    listenToLiveChat();
    setupClickListeners(); 
}

function initializeContinentSlideshow() {
    const continentCard = document.getElementById('slider-wrapper-zone');
    if (!continentCard) return;

    continentCard.innerHTML = `
        <div class="slider-container" id="slider-core" style="display: flex; transition: transform 0.4s ease-in-out; width: 200%;">
            <div class="slider-page" style="width: 50%; display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; gap: 5px; flex-shrink: 0;">
                <div class="stat-item" id="cont-pop-wrapper">
                    <span class="stat-label">سكان</span>
                    <span class="stat-value" id="cont-pop">0</span>
                </div>
                <div class="stat-item" id="cont-online-wrapper">
                    <span class="stat-label">متصل</span>
                    <span class="stat-value" id="cont-online" style="color: #4ade80;">0</span>
                </div>
                <div class="stat-item" id="cont-parties-wrapper">
                    <span class="stat-label">أحزاب</span>
                    <span class="stat-value" id="cont-parties">0</span>
                </div>
                <div class="stat-item" id="cont-factories-wrapper">
                    <span class="stat-label">مصانع</span>
                    <span class="stat-value" id="cont-factories">0</span>
                </div>
            </div>
            <div class="slider-page" style="width: 50%; display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; gap: 5px; flex-shrink: 0;">
                <div class="stat-item" id="cont-countries-wrapper">
                    <span class="stat-label">دول</span>
                    <span class="stat-value" id="cont-countries">50</span>
                </div>
                <div class="stat-item" id="cont-alliances-wrapper">
                    <span class="stat-label">تحالف</span>
                    <span class="stat-value" id="cont-alliances">0</span>
                </div>
                <div class="stat-item" id="cont-independent-wrapper">
                    <span class="stat-label">مستقلة</span>
                    <span class="stat-value" id="cont-independent">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">-</span>
                    <span class="stat-value">-</span>
                </div>
            </div>
        </div>
        <div class="slider-dots">
            <div class="dot active" id="dot0"></div>
            <div class="dot" id="dot1"></div>
        </div>
    `;

    setupSlideshowSwipeAndClicks();
}

function setupSlideshowSwipeAndClicks() {
    const slidesContainer = document.getElementById('slider-wrapper-zone');
    const dot0 = document.getElementById('dot0');
    const dot1 = document.getElementById('dot1');
    const core = document.getElementById('slider-core');

    if (!slidesContainer || !core || !dot0 || !dot1) return;

    function goToSlide(index) {
        currentSlideIndex = index;
        if (index === 0) {
            core.style.transform = 'translateX(0)';
            dot1.classList.remove('active');
            dot0.classList.add('active');
        } else {
            core.style.transform = 'translateX(50%)'; // إزاحة الـ RTL المعتمدة بصفحتك
            dot0.classList.remove('active');
            dot1.classList.add('active');
        }
    }

    dot0.onclick = (e) => { e.stopPropagation(); goToSlide(0); };
    dot1.onclick = (e) => { e.stopPropagation(); goToSlide(1); };

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
        if (Math.abs(swipeDistance) > 35) {
            if (swipeDistance < 0) {
                goToSlide(1); 
            } else {
                goToSlide(0); 
            }
        }
    }
}

function listenToContinentAndCountryStats() {
    db.collection('players').onSnapshot((snapshot) => {
        const totalPopulation = snapshot.size;
        const contPopEl = document.getElementById('cont-pop');
        if (contPopEl) contPopEl.innerText = totalPopulation;
        
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
    }, err => console.error("خطأ السكان:", err));

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
    }, err => console.error("خطأ المتصلين:", err));

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
    }, err => console.error("خطأ إحصائيات أفريقيا:", err));

    if (userResidenceCountry) {
        db.collection('countries').doc(userResidenceCountry).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const countFactories = document.getElementById('count-factories');
                const countParties = document.getElementById('count-parties');
                
                if (countFactories) countFactories.innerText = data.factories || 0;
                if (countParties) countParties.innerText = data.parties || 0;
            }
        }, err => console.error("خطأ إحصائيات الدولة:", err));
    }
}

function activateOnlineStatus(uid, location) {
    if (!uid) return;
    db.collection('online_users').doc(uid).set({
        uid: uid,
        name: currentUserName,
        location: location,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error("خطأ التواجد:", err));
}

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
        }, err => console.error("خطأ الشات:", err));
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
        console.error("خطأ الإرسال:", err);
    });
}

function navigateTo(targetPage, extraParams = {}) {
    console.log(`تم استدعاء الصفحة الديناميكية: ${targetPage}`, extraParams);
    alert(`سيتم فتح قسـم: ${targetPage} (مجهز للربط بملفات الـ JS الخاصة بك)`);
}

function setupClickListeners() {
    const staticAfricaImg = document.getElementById('continent-map-btn');
    if (staticAfricaImg) {
        staticAfricaImg.onclick = (e) => {
            e.stopPropagation();
            navigateTo('map');
        };
    }

    const flagImg = document.getElementById('country-flag');
    if (flagImg) {
        flagImg.onclick = (e) => {
            e.stopPropagation();
            navigateTo('country-main', { country: userResidenceCountry });
        };
    }

    // ربط الضغطات بكروت الدولة الإحصائية الجديدة
    const interactiveStats = [
        { id: 'cont-pop-wrapper', page: 'all-players' },
        { id: 'cont-online-wrapper', page: 'online-players' },
        { id: 'cont-parties-wrapper', page: 'parties' },
        { id: 'cont-factories-wrapper', page: 'factories' },
        { id: 'cont-countries-wrapper', page: 'all-countries' },
        { id: 'cont-alliances-wrapper', page: 'alliances' },
        { id: 'cont-independent-wrapper', page: 'independent' },
        
        // إحصائيات البلوك الثاني (كارت الدولة في HTML الجديد)
        { id: 'btn-country-pop', page: 'country-players' },
        { id: 'btn-country-online', page: 'country-online' },
        { id: 'btn-country-parties', page: 'parties' },
        { id: 'btn-country-factories', page: 'factories' }
    ];

    interactiveStats.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.style.cursor = 'pointer';
            el.style.transition = 'transform 0.15s';
            el.onclick = (e) => {
                e.stopPropagation();
                navigateTo(item.page, { country: userResidenceCountry });
            };
            el.onmouseenter = () => el.style.transform = 'scale(1.05)';
            el.onmouseleave = () => el.style.transform = 'scale(1)';
        }
    });

    const navItems = [
        { text: 'الرئيسية', page: 'main' },
        { text: 'العمل', page: 'work' },
        { text: 'الحروب', page: 'wars' },
        { text: 'الحساب', page: 'profile' }
    ];

    const bottomNav = document.querySelector('.bottom-nav') || document.body;
    
    navItems.forEach(nav => {
        const xpath = `//span[text()='${nav.text}'] | //div[text()='${nav.text}'] | //a[text()='${nav.text}']`;
        const result = document.evaluate(xpath, bottomNav, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue;
        
        if (element) {
            const clickableArea = element.parentElement || element;
            clickableArea.style.cursor = 'pointer';
            clickableArea.onclick = () => {
                navigateTo(nav.page);
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
                sendChatMessage();
            }
        });
    }
});