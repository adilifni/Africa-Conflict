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
let currentUserCountry = "morocco"; 

// مراقبة حالة اتصال اللاعب
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        const statusBox = document.getElementById('player-status');
        if(statusBox) statusBox.innerText = "القائد: " + (user.displayName || "لاعب");
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        window.location.assign("index.html");
    }
});

function getPlayerDataAndActivateOnline(uid) {
    db.collection('players').doc(uid).get().then((doc) => {
        if (doc.exists && doc.data().country) {
            let data = doc.data();
            if (data.country !== "لم يحدد بعد") {
                currentUserCountry = data.country;
            }
        }
        startLiveUpdates();
    }).catch((err) => {
        console.log("خطأ في جلب بيانات اللاعب:", err);
        startLiveUpdates(); 
    });
}

function startLiveUpdates() {
    // إخفاء رسالة الانتظار وإظهار البلوكات
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    if(loadingMsg) loadingMsg.style.display = 'none';
    if(mainBlocks) mainBlocks.style.display = 'flex';

    listenToContinentStats();
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserUid, currentUserCountry);
}

// 🌍 قراءة بيانات القارة + حساب عدد اللاعبين المسجلين حياً (السكان)
function listenToContinentStats() {
    // 1. جلب البيانات الثابتة للأحزاب والدول من المستند
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties || 0;
            document.getElementById('cont-countries').innerText = data.total_countries || 50;
        }
    });

    // 2. 🛡️ حساب عدد السكان الفعلي بناءً على عدد الحسابات المسجلة في قاعدة البيانات
    db.collection('players').onSnapshot((snapshot) => {
        document.getElementById('cont-pop').innerText = snapshot.size || 0;
    }, err => console.log("خطأ في عد الحسابات:", err));

    // 3. قراءة عدد المتصلين الفعلي بالقارة من مجموعة المراقبة الحية
    db.collection('online_users').onSnapshot((snapshot) => {
        document.getElementById('cont-online').innerText = snapshot.size || 0;
    });
}

// 🇲🇦 قراءة بيانات الدولة الحالية
function listenToCountryStats(countryId) {
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-name').innerText = data.name || "مجهول";
            document.getElementById('count-factories').innerText = data.factories || 0;
            document.getElementById('count-parties').innerText = data.parties || 0;
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        }
    }, err => console.log("خطأ في مستند الدولة:", err));

    // قراءة المتصلين الفعليين داخل هذه الدولة فقط
    db.collection('online_users').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-online').innerText = snapshot.size || 0;
    });
}

// 🛡️ دالة إدارة المتصلين المحدثة لمنع التكرار (تعتمد على الـ UID الفريد للاعب)
function activateOnlineStatus(uid, countryId) {
    if (!uid) return;

    // تسجيل الدخول: نضع مستند باسم الـ UID الخاص بك، وبذلك يستحيل تكراره حتى لو حدثت الصفحة
    db.collection('online_users').doc(uid).set({
        country: countryId,
        last_active: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
    
    // عند الخروج أو قفل المتصفح: نحذف المستند تماماً ليقل العداد فوراً
    window.addEventListener('beforeunload', () => {
        db.collection('online_users').doc(uid).delete();
    });
}