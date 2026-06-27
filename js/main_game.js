// إعدادات Firebase الخاصة بمشروعك
const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة الخدمة
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// مراقبة حالة اتصال اللاعب
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('player-status').innerText = "القائد: " + user.displayName;
        loadPlayerCountry(user.uid);
    } else {
        // إذا حاول الدخول للملف مباشرة دون تسجيل، يتم طرده لصفحة الدخول
        window.location.assign("index.html");
    }
});

// دالة معرفة دولة اللاعب الحالية
function loadPlayerCountry(uid) {
    db.collection('players').doc(uid).get().then((playerDoc) => {
        if (playerDoc.exists) {
            let countryId = playerDoc.data().country;
            
            // إذا كانت الدولة لم تحدد بعد، سنربطه بـ morocco كافتراضي للتجربة حية
            if (!countryId || countryId === "لم يحدد بعد") {
                countryId = "morocco";
            }
            
            fetchCountryResources(countryId);
        }
    }).catch((error) => {
        console.error("خطأ أثناء جلب ملف اللاعب:", error.message);
    });
}

// دالة سحب موارد الدولة وعرضها ديناميكياً في الواجهة
function fetchCountryResources(countryId) {
    db.collection('countries').doc(countryId).get().then((countryDoc) => {
        if (countryDoc.exists) {
            const data = countryDoc.data();
            
            // إخفاء رسالة التحميل وإظهار بطاقة الدولة
            document.getElementById('loading-msg').style.display = 'none';
            document.getElementById('country-data-card').style.display = 'block';
            
            // صب البيانات ديناميكياً داخل العناصر
            document.getElementById('country-title').innerText = data.name;
            document.getElementById('country-gold').innerText = data.gold;
            document.getElementById('country-oil').innerText = data.oil;
            document.getElementById('country-wheat').innerText = data.wheat;
        } else {
            document.getElementById('loading-msg').innerText = "خطأ: مستند الدولة غير موجود في قاعدة البيانات.";
        }
    }).catch((error) => {
        document.getElementById('loading-msg').innerText = "فشل الاتصال بقاعدة البيانات لجلب الموارد.";
        console.error(error.message);
    });
}