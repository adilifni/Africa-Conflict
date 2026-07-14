const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

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

        // فحص وجود مستند اللاعب وإنشائه تلقائياً إن لم يكن موجوداً
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
                    console.error("خطأ إنشاء الحساب:", err);
                    getPlayerDataAndActivateOnline(user.uid);
                });
            } else {
                getPlayerDataAndActivateOnline(user.uid);
            }
        }).catch((err) => {
            console.error("خطأ جلب حساب اللاعب:", err);
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
            
            startLiveUpdates();
        } else {
            console.warn("مستند اللاعب غير موجود، تشغيل الواجهة افتراضياً.");
            startLiveUpdates(); 
        }
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

    if (!currentUserUid || !userResidenceCountry) return;

    listenToContinentStats();
    listenToCountryStats(userResidenceCountry);
    activateOnlineStatus(currentUserUid, userCurrentLocation);
    listenToLiveChat();
}

// ⚠️ تعديل هام: تم تعديل اسم المجلد من 'stats' إلى 'game_stats' ليطابق قاعدة البيانات
function listenToContinentStats() {
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if(document.getElementById('cont-parties')) document.getElementById('cont-parties').innerText = data.parties || 0;
            if(document.getElementById('cont-online')) document.getElementById('cont-online').innerText = data.online || 0;
            if(document.getElementById('cont-pop')) document.getElementById('cont-pop').innerText = data.population || 0;
            if(document.getElementById('cont-factories')) document.getElementById('cont-factories').innerText = data.factories || 0;
            if(document.getElementById('cont-independent')) document.getElementById('cont-independent').innerText = data.independent || 0;
            if(document.getElementById('cont-alliances')) document.getElementById('cont-alliances').innerText = data.alliances || 0;
        }
    }, err => console.error("خطأ إحصائيات القارة:", err));
}

function listenToCountryStats(countryId) {
    if (!countryId) return;
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if(document.getElementById('count-factories')) document.getElementById('count-factories').innerText = data.factories || 0;
            if(document.getElementById('count-parties')) document.getElementById('count-parties').innerText = data.parties || 0;
            if(document.getElementById('count-online')) document.getElementById('count-online').innerText = data.online || 0;
            if(document.getElementById('count-pop')) document.getElementById('count-pop').innerText = data.population || 0;
        }
    }, err => console.error("خطأ إحصائيات الدولة:", err));
}

// ⚠️ تعديل هام: تم تعديل اسم المجلد من 'online_players' إلى 'online_users' ليطابق قاعدة البيانات
function activateOnlineStatus(uid, location) {
    if (!uid) return;
    db.collection('online_users').doc(uid).set({
        uid: uid,
        name: currentUserName,
        location: location,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error("خطأ تحديث التواجد:", err));
}

function listenToLiveChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    db.collection('global_chat')
        .orderBy('createdAt', 'desc')
        .limit(30)
        .onSnapshot((snapshot) => {
            chatContainer.innerHTML = ""; 
            
            let messages = [];
            snapshot.forEach(doc => messages.unshift(doc.data()));

            messages.forEach((msg) => {
                const msgBubble = document.createElement('div');
                msgBubble.className = "msg-bubble";
                
                msgBubble.innerHTML = `
                    <div class="msg-meta">${msg.name || "لاعب"}</div>
                    <div class="msg-text">${msg.text || ""}</div>
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
        console.error("خطأ أثناء إرسال الرسالة:", err);
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