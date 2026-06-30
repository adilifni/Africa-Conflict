// 1. إعدادات ربط Firebase الحقيقية داخل ملف اللعبة الرئيسي
const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة Firebase بأمان
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// متغيرات عامة آمنة ومجهزة بقيم افتراضية لمنع الـ Crash
let currentUserUid = null;
let currentUserName = "لاعب";
let userResidenceCountry = "morocco";
let userCurrentLocation = "morocco";

// قاموس ديناميكي لتحويل أسماء الدول لرموز الأعلام الدولية
const countryFlagCodes = {
    "morocco": "ma", "egypt": "eg", "algeria": "dz", "tunisia": "tn",
    "libya": "ly", "sudan": "sd", "nigeria": "ng", "south_africa": "za"
};
// 2. مراقبة حالة الجلسة بصرامة تامة ومنع تكرار الروابط
auth.onAuthStateChanged((user) => {
    // الحصول على المسار النظيف الحالي بدون الأخطاء الزائدة
    const currentPath = window.location.pathname;

    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب";
        
        const playerStatusEl = document.getElementById('player-status');
        if (playerStatusEl) playerStatusEl.innerText = "القائد: " + currentUserName;
        
        // إذا كان الرابط تالفاً بسب الكاش ومكرراً، أصلحه فوراً برابط نظيف
        if (currentPath.includes('main.html/main.html')) {
            window.location.href = "https://adilifni.github.io/Africa-Conflict/main.html";
            return;
        }

        // استدعاء بيانات اللاعب من السيرفر
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        console.log("لا يوجد مستخدم نشط، إعادة توجيه لصفحة الدخول...");
        
        // التحويل لصفحة الدخول برابط ثابت ومطلق لمنع التكرار العشوائي
        if (!currentPath.endsWith('index.html')) {
            window.location.href = "https://adilifni.github.io/Africa-Conflict/index.html";
        }
    }
});

// 3. جلب بيانات مستند اللاعب بأمان تّام وتحصين كامل ضد الطرد
function getPlayerDataAndActivateOnline(uid) {
    if (!uid) return;
    
    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            
            // تحصين قراءة دولة الإقامة
            if (data.residence_country) {
                userResidenceCountry = data.residence_country.trim().toLowerCase();
            } else if (data.country) {
                userResidenceCountry = data.country.trim().toLowerCase();
            } else {
                userResidenceCountry = "morocco";
            }
            
            userCurrentLocation = data.current_location ? data.current_location.trim().toLowerCase() : userResidenceCountry;
            
            // تحديث العلم تلقائياً بناءً على مكان تواجد اللاعب الحالي
            const flagImg = document.getElementById('country-flag');
            if (flagImg) {
                let flagCode = countryFlagCodes[userCurrentLocation] || "ma"; 
                flagImg.src = `https://flagcdn.com/w320/${flagCode}.png`;
            }
            
            // تشغيل التحديثات الحية وإظهار عناصر اللعبة
            startLiveUpdates();
        } else {
            console.warn("مستند اللاعب غير موجود في Firestore، يتم تشغيل الواجهة افتراضياً لمنع الطرد.");
            // حماية مطلقة: حتى لو لم يجد المستند، افتح اللعبة بالقيم الافتراضية ولا تطرد اللاعب
            startLiveUpdates(); 
        }
    }, (error) => {
        console.error("تنبيه: حدث خطأ أثناء الاتصال بـ Firestore (غالباً بسبب قواعد الحماية أو الكاش):", error);
        // الحفاظ على استقرار الصفحة: تشغيل الواجهة الرئيسية بالقيم الافتراضية بدلاً من الانتقال لصفحة الخطأ
        startLiveUpdates();
    });
}
// 4. دالة تشغيل وتأمين إظهار الشاشة الرئيسية واختفاء شاشة التحميل
function startLiveUpdates() {
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (mainBlocks) mainBlocks.style.display = 'flex';

    if (!currentUserUid || !userResidenceCountry) return;

    // تشغيل دوالك المتصلة بالقاعدة الآن بأمان تام
    listenToContinentStats();
    listenToCountryStats(userResidenceCountry);
    activateOnlineStatus(currentUserUid, userCurrentLocation);
    listenToLiveChat();
}

// 🌍 الدالة المسؤولة عن جلب إحصائيات قارة إفريقيا بالكامل من السيرفر
function listenToContinentStats() {
    db.collection('stats').doc('africa').onSnapshot((doc) => {
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

// 🗺️ الدالة المسؤولة عن جلب إحصائيات الدولة التي يتواجد بها اللاعب حالياً
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

// 🟢 تحديث حالة اللاعب ليكون متصلاً (Online) داخل السيرفر تلقائياً
function activateOnlineStatus(uid, location) {
    if (!uid) return;
    const onlineRef = db.collection('online_players').doc(uid);
    onlineRef.set({
        uid: uid,
        name: currentUserName,
        location: location,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error("خطأ تحديث التواجد الحركي الحقيقي:", err));
}

// 💬 الاستماع الفوري لشات اللعبة وعرض برقيات الرسائل بشكل متتالي
function listenToLiveChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    db.collection('global_chat')
        .orderBy('createdAt', 'desc')
        .limit(30)
        .onSnapshot((snapshot) => {
            chatContainer.innerHTML = ""; // تصفير الحاوية قبل التحديث لمنع التكرار
            
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
        }, err => console.error("خطأ جلب شات اللعبة الحية:", err));
}

// 💬 دالة إرسال برقيات الشات
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

// ربط حدث الضغط على زر الإرسال المتواجد في HTML الجديد
document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById('send-chat-trigger');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
});