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
    setupClickListeners(); // تهيئة الروابط وضغطات العناصر المضافة حديثاً
}

// تحديث إحصائيات القارة والدولة بشكل حي وحساب المتصلين بدقة وبدون أخطاء الفهرسة
function listenToContinentAndCountryStats() {
    // 1. حساب السكان لقارة أفريقيا بالكامل
    db.collection('players').onSnapshot((snapshot) => {
        const totalPopulation = snapshot.size;
        if(document.getElementById('cont-pop')) document.getElementById('cont-pop').innerText = totalPopulation;
        
        // سكان الدولة الحالية (اللاعبين الذين يملكون نفس جنسية اللاعب الحالي)
        if (userResidenceCountry) {
            let countryPopulation = 0;
            snapshot.forEach(doc => {
                const pData = doc.data();
                if (pData.residence_country && pData.residence_country.trim().toLowerCase() === userResidenceCountry) {
                    countryPopulation++;
                }
            });
            if(document.getElementById('count-pop')) document.getElementById('count-pop').innerText = countryPopulation;
        }
    }, err => console.error("خطأ حساب السكان:", err));

    // 2. حساب المتصلين الحقيقيين (من تفاعل خلال آخر 5 دقائق) في أفريقيا والدولة الحالية معاً
    db.collection('online_users').onSnapshot((snapshot) => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        let totalOnline = 0;
        let countryOnline = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            // تحويل الطابع الزمني لـ Firestore إلى مللي ثانية للمقارنة البرمجية الفورية
            const lastActiveMs = (data.lastActive && typeof data.lastActive.toMillis === 'function') ? data.lastActive.toMillis() : 0;
            
            if (lastActiveMs >= fiveMinutesAgo) {
                totalOnline++; // متصل في أفريقيا
                
                if (userResidenceCountry && data.location && data.location.trim().toLowerCase() === userResidenceCountry) {
                    countryOnline++; // متصل في نفس الدولة حالياً
                }
            }
        });

        if(document.getElementById('cont-online')) document.getElementById('cont-online').innerText = totalOnline;
        if(document.getElementById('count-online')) document.getElementById('count-online').innerText = countryOnline;
    }, err => console.error("خطأ تحديث المتصلين الحي:", err));

    // جلب باقي الإحصائيات الثابتة للقارة
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if(document.getElementById('cont-parties')) document.getElementById('cont-parties').innerText = data.parties || 0;
            if(document.getElementById('cont-factories')) document.getElementById('cont-factories').innerText = data.factories || 0;
            if(document.getElementById('cont-independent')) document.getElementById('cont-independent').innerText = data.independent || 0;
            if(document.getElementById('cont-alliances')) document.getElementById('cont-alliances').innerText = data.alliances || 0;
        }
    }, err => console.error("خطأ إحصائيات القارة الثابتة:", err));

    // جلب باقي الإحصائيات الثابتة للدولة
    if (userResidenceCountry) {
        db.collection('countries').doc(userResidenceCountry).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if(document.getElementById('count-factories')) document.getElementById('count-factories').innerText = data.factories || 0;
                if(document.getElementById('count-parties')) document.getElementById('count-parties').innerText = data.parties || 0;
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

// 🔗 دالة ربط العناصر وتحويلها لأزرار تفاعلية قابلة للضغط
function setupClickListeners() {
    // 1. جعل كارت أو خريطة أفريقيا قابلاً للنقر للانتقال لصفحة الخريطة
    const continentCard = document.querySelector('.continent-stats-card') || document.getElementById('continent-card');
    if (continentCard) {
        continentCard.style.cursor = 'pointer';
        continentCard.title = "اضغط للذهاب إلى الخريطة";
        continentCard.onclick = () => {
            window.location.href = "/map.html"; 
        };
    }

    // 2. جعل علم المغرب أو كارت إحصائيات الدولة قابلاً للنقر للانتقال لصفحة الدول
    const countryCard = document.querySelector('.country-stats-card') || document.getElementById('country-card');
    const flagImg = document.getElementById('country-flag');
    
    const goToCountryPage = () => {
        window.location.href = `/country.html?id=${userResidenceCountry}`;
    };

    if (countryCard) {
        countryCard.style.cursor = 'pointer';
        countryCard.title = "اضغط لعرض تفاصيل الدولة";
        countryCard.onclick = goToCountryPage;
    }
    if (flagImg) {
        flagImg.style.cursor = 'pointer';
        flagImg.onclick = (e) => {
            e.stopPropagation(); // منع تعارض الضغطات مع الكارت الكبير
            goToCountryPage();
        };
    }

    // 3. تحويل عناصر الإحصائيات الفردية (أحزاب، مصانع، تحالفات) إلى روابط قابلة للضغط
    const statsLinks = [
        { id: 'count-parties', url: '/parties.html' },
        { id: 'count-factories', url: '/factories.html' },
        { id: 'cont-parties', url: '/parties.html' },
        { id: 'cont-factories', url: '/factories.html' },
        { id: 'cont-alliances', url: '/alliances.html' }
    ];

    statsLinks.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            // جعل العنصر الأب المباشر له أو هو نفسه قابلاً للضغط
            const parent = el.parentElement;
            if (parent) {
                parent.style.cursor = 'pointer';
                parent.style.transition = 'transform 0.2s';
                parent.title = "اضغط للتفاصيل";
                parent.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = item.url;
                };
                // تأثير خفيف عند تمرير الماوس
                parent.onmouseenter = () => parent.style.transform = 'scale(1.03)';
                parent.onmouseleave = () => parent.style.transform = 'scale(1)';
            }
        }
    });

    // 4. جعل شريط التنقل السفلي تفاعلياً بالكامل
    // سنقوم بربط الكلمات مباشرة بالروابط المناسبة لها
    const navItems = [
        { text: 'الرئيسية', url: '/main.html' },
        { text: 'العمل', url: '/work.html' },
        { text: 'الحروب', url: '/wars.html' },
        { text: 'الحساب', url: '/profile.html' }
    ];

    const bottomNav = document.querySelector('.bottom-nav-container') || document.body; // ابحث في أسفل الشاشة
    
    navItems.forEach(nav => {
        // البحث عن أي عنصر نصي يحتوي على اسم الزر بالصفحة
        const xpath = `//span[text()='${nav.text}'] | //div[text()='${nav.text}'] | //a[text()='${nav.text}']`;
        const result = document.evaluate(xpath, bottomNav, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue;
        
        if (element) {
            // جعل العنصر الأب للكلمة أو الأيقونة قابلاً للنقر لسهولة الضغط بالإصبع في الموبايل
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
                sendChatMessage();
            }
        });
    }
});