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

    listenToContinentStats();
    
    if (userResidenceCountry) {
        listenToCountryStats(userResidenceCountry);
    }
    
    if (currentUserUid) {
        activateOnlineStatus(currentUserUid, userCurrentLocation);
    }
    
    listenToLiveChat();
}

// تحديث الإحصائيات العامة للقارة بشكل حي وتلقائي
function listenToContinentStats() {
    // 1. حساب إجمالي عدد السكان (كل الحسابات المسجلة باللعبة)
    db.collection('players').onSnapshot((snapshot) => {
        const totalPopulation = snapshot.size;
        if(document.getElementById('cont-pop')) document.getElementById('cont-pop').innerText = totalPopulation;
    }, err => console.error("خطأ حساب سكان القارة الحية:", err));

    // 2. حساب إجمالي المتصلين (الحسابات النشطة خلال آخر 5 دقائق)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    db.collection('online_users')
      .where('lastActive', '>=', fiveMinutesAgo)
      .onSnapshot((snapshot) => {
        const totalOnline = snapshot.size;
        if(document.getElementById('cont-online')) document.getElementById('cont-online').innerText = totalOnline;
    }, err => console.error("خطأ حساب متصلي القارة الحية:", err));

    // الإحصائيات الثابتة الأخرى (أو المخزنة في المستند لسهولة إدارتها)
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if(document.getElementById('cont-parties')) document.getElementById('cont-parties').innerText = data.parties || 0;
            if(document.getElementById('cont-factories')) document.getElementById('cont-factories').innerText = data.factories || 0;
            if(document.getElementById('cont-independent')) document.getElementById('cont-independent').innerText = data.independent || 0;
            if(document.getElementById('cont-alliances')) document.getElementById('cont-alliances').innerText = data.alliances || 0;
        }
    }, err => console.error("خطأ إحصائيات القارة الثابتة:", err));
}

// تحديث إحصائيات الدولة الحية تلقائياً حسب هوية اللاعب وموقعه الحالي
function listenToCountryStats(countryId) {
    if (!countryId) return;

    // 1. سكان الدولة الحالية (اللاعبين المقيمين في هذه الدولة)
    db.collection('players')
      .where('residence_country', '==', countryId)
      .onSnapshot((snapshot) => {
        const countryPopulation = snapshot.size;
        if(document.getElementById('count-pop')) document.getElementById('count-pop').innerText = countryPopulation;
    }, err => console.error("خطأ حساب سكان الدولة:", err));

    // 2. المتصلون حالياً في هذه الدولة (موقعهم الحالي وتفاعلوا في آخر 5 دقائق)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    db.collection('online_users')
      .where('location', '==', countryId)
      .where('lastActive', '>=', fiveMinutesAgo)
      .onSnapshot((snapshot) => {
        const countryOnline = snapshot.size;
        if(document.getElementById('count-online')) document.getElementById('count-online').innerText = countryOnline;
    }, err => console.error("خطأ حساب متصلي الدولة:", err));

    // الإحصائيات المتبقية للدولة من مستندها
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if(document.getElementById('count-factories')) document.getElementById('count-factories').innerText = data.factories || 0;
            if(document.getElementById('count-parties')) document.getElementById('count-parties').innerText = data.parties || 0;
        }
    }, err => console.error("خطأ بيانات الدولة الإضافية:", err));
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

// شات اللعبة: عرض التوقيت وفلترة آخر 24 ساعة فقط
function listenToLiveChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    // تحديد توقيت قبل 24 ساعة من الآن
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
                
                // استخراج الوقت وتنسيقه ليكون مثل (10:30 م) أو (02:15 ص)
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