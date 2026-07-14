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
    initializeCountryCard(); // بناء كارت الدولة الجديد بالمحاذاة البصرية الصحيحة
    listenToContinentAndCountryStats();
    
    if (currentUserUid) {
        activateOnlineStatus(currentUserUid, userCurrentLocation);
    }
    
    listenToLiveChat();
    setupClickListeners(); 
}

// 1️⃣ بناء وهيكلة السلايدشو (كارت القارة) - الخريطة على اليسار ثابتة
function initializeContinentSlideshow() {
    const continentCard = document.querySelector('.continent-stats-card') || document.getElementById('continent-card');
    if (!continentCard) return;

    continentCard.innerHTML = `
        <div class="slideshow-wrapper" style="display: flex; width: 100%; position: relative; overflow: hidden; align-items: center; justify-content: space-between; direction: rtl;">
            
            <div class="slides-container" style="flex: 1; overflow: hidden; position: relative; height: 60px;">
                
                <div class="slide-item active" id="slide-1" style="display: flex; justify-content: space-around; align-items: center; width: 100%; position: absolute; transition: transform 0.4s ease-in-out, opacity 0.4s; transform: translateX(0); opacity: 1;">
                    <div class="stat-unit" id="cont-pop-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">سكان</div>
                        <div id="cont-pop" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-online-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">متصل</div>
                        <div id="cont-online" style="font-size: 1.1rem; font-weight: bold; color: #4ade80;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-parties-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">أحزاب</div>
                        <div id="cont-parties" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-factories-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">مصانع</div>
                        <div id="cont-factories" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                </div>

                <div class="slide-item" id="slide-2" style="display: flex; justify-content: space-around; align-items: center; width: 100%; position: absolute; transition: transform 0.4s ease-in-out, opacity 0.4s; transform: translateX(100%); opacity: 0;">
                    <div class="stat-unit" id="cont-countries-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">دول</div>
                        <div id="cont-countries" style="font-size: 1.1rem; font-weight: bold; color: #fff;">50</div>
                    </div>
                    <div class="stat-unit" id="cont-alliances-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">تحالف</div>
                        <div id="cont-alliances" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                    <div class="stat-unit" id="cont-independent-wrapper" style="text-align: center; flex: 1;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">مستقلة</div>
                        <div id="cont-independent" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                    </div>
                </div>

            </div>

            <div class="static-continent-image" id="static-africa-img-btn" style="width: 55px; height: 55px; display: flex; align-items: center; justify-content: center; margin-left: 8px; cursor: pointer; flex-shrink: 0;">
                <img src="img/africa-map.png" alt="Africa Map" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='https://img.icons8.com/color/96/africa.png'">
            </div>
        </div>

        <div class="slideshow-dots" style="display: flex; justify-content: center; gap: 6px; margin-top: 5px;">
            <span class="slide-dot active-dot" data-slide="0" style="width: 7px; height: 7px; border-radius: 50%; background-color: #a1c4fd; cursor: pointer; transition: background-color 0.3s;"></span>
            <span class="slide-dot" data-slide="1" style="width: 7px; height: 7px; border-radius: 50%; background-color: #555; cursor: pointer; transition: background-color 0.3s;"></span>
        </div>
    `;

    setupSlideshowSwipeAndClicks();
}

// 2️⃣ بناء وهيكلة كارت الدولة - العلم على اليسار تماماً (تحت الخريطة) لموازاة بصرية مثالية
function initializeCountryCard() {
    const countryCard = document.querySelector('.country-stats-card') || document.getElementById('country-card');
    if (!countryCard) return;

    countryCard.innerHTML = `
        <div class="country-wrapper" style="display: flex; width: 100%; align-items: center; justify-content: space-between; direction: rtl;">
            
            <div class="country-stats-container" style="flex: 1; display: flex; justify-content: space-around; align-items: center; height: 60px;">
                <div class="stat-unit" id="count-pop-wrapper" style="text-align: center; flex: 1;">
                    <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">سكان</div>
                    <div id="count-pop" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                </div>
                <div class="stat-unit" id="count-online-wrapper" style="text-align: center; flex: 1;">
                    <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">متصل</div>
                    <div id="count-online" style="font-size: 1.1rem; font-weight: bold; color: #4ade80;">0</div>
                </div>
                <div class="stat-unit" id="count-parties-wrapper" style="text-align: center; flex: 1;">
                    <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">أحزاب</div>
                    <div id="count-parties" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                </div>
                <div class="stat-unit" id="count-factories-wrapper" style="text-align: center; flex: 1;">
                    <div style="font-size: 0.7rem; color: #888; margin-bottom: 3px;">مصانع</div>
                    <div id="count-factories" style="font-size: 1.1rem; font-weight: bold; color: #fff;">0</div>
                </div>
            </div>

            <div class="static-country-flag" style="width: 55px; height: 55px; display: flex; align-items: center; justify-content: center; margin-left: 8px; flex-shrink: 0;">
                <img id="country-flag" src="https://flagcdn.com/w320/ma.png" alt="Country Flag" style="width: 100%; height: 35px; border-radius: 4px; object-fit: cover; cursor: pointer;" onerror="this.src='https://img.icons8.com/color/96/flag.png'">
            </div>

        </div>
    `;

    // تحديث العلم فوراً بناءً على موقع اللاعب بعد إنشائه
    const flagImg = document.getElementById('country-flag');
    if (flagImg && userCurrentLocation) {
        let flagCode = countryFlagCodes[userCurrentLocation] || "ma"; 
        flagImg.src = `https://flagcdn.com/w320/${flagCode}.png`;
    }
}

function setupSlideshowSwipeAndClicks() {
    const slidesContainer = document.querySelector('.slides-container');
    const dots = document.querySelectorAll('.slide-dot');
    const slide1 = document.getElementById('slide-1');
    const slide2 = document.getElementById('slide-2');

    if (!slidesContainer || !slide1 || !slide2) return;

    function goToSlide(index) {
        currentSlideIndex = index;
        
        dots.forEach((dot, idx) => {
            dot.style.backgroundColor = (idx === index) ? '#a1c4fd' : '#555';
        });

        if (index === 0) {
            slide1.style.transform = 'translateX(0)';
            slide1.style.opacity = '1';
            slide2.style.transform = 'translateX(100%)';
            slide2.style.opacity = '0';
        } else {
            slide1.style.transform = 'translateX(-100%)';
            slide1.style.opacity = '0';
            slide2.style.transform = 'translateX(0)';
            slide2.style.opacity = '1';
        }
    }

    dots.forEach((dot, index) => {
        dot.onclick = (e) => {
            e.stopPropagation();
            goToSlide(index);
        };
    });

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

// 🌐 دالة التوجيه الذكية لتغيير وسط الصفحة بدون تحديث الأجزاء الثابتة
function navigateTo(targetPage, extraParams = {}) {
    console.log(`تم استدعاء الصفحة الديناميكية: ${targetPage}`, extraParams);
    
    // هنا مستقبلاً ستقوم بربط ملفات الـ JS الخاصة بك لتحديث محتوى حاوية الوسط (#main-game-blocks)
    alert(`سيتم فتح قسـم: ${targetPage} (مجهز للربط بملفات الـ JS الخاصة بك)`);
}

function setupClickListeners() {
    // 1. الضغط على خريطة أفريقيا الثابتة تنقلك برمجياً
    const staticAfricaImg = document.getElementById('static-africa-img-btn');
    if (staticAfricaImg) {
        staticAfricaImg.onclick = (e) => {
            e.stopPropagation();
            navigateTo('map');
        };
    }

    // 2. الضغط على العلم الثابت ينقلك لصفحة الدولة برمجياً
    const flagImg = document.getElementById('country-flag');
    if (flagImg) {
        flagImg.onclick = (e) => {
            e.stopPropagation();
            navigateTo('country-main', { country: userResidenceCountry });
        };
    }

    // 3. ربط كافة عناصر الإحصائيات بالسلايدشو والكروت بدالة التوجيه المشتركة
    const interactiveStats = [
        { id: 'cont-pop-wrapper', page: 'all-players' },
        { id: 'cont-online-wrapper', page: 'online-players' },
        { id: 'cont-parties-wrapper', page: 'parties' },
        { id: 'cont-factories-wrapper', page: 'factories' },
        { id: 'cont-countries-wrapper', page: 'all-countries' },
        { id: 'cont-alliances-wrapper', page: 'alliances' },
        { id: 'cont-independent-wrapper', page: 'independent' },
        
        // إحصائيات كارت الدولة
        { id: 'count-pop-wrapper', page: 'country-players' },
        { id: 'count-online-wrapper', page: 'country-online' },
        { id: 'count-parties-wrapper', page: 'parties' },
        { id: 'count-factories-wrapper', page: 'factories' }
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

    // 4. أزرار شريط التنقل السفلي الثابت
    const navItems = [
        { text: 'الرئيسية', page: 'main' },
        { text: 'العمل', page: 'work' },
        { text: 'الحروب', page: 'wars' },
        { text: 'الحساب', page: 'profile' }
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