// 1. إعدادات ربط Firebase الحقيقية الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة تطبيق Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. تسجيل الدخول باستخدام Popup (أكثر استقراراً على المتصفحات الحقيقية)
document.getElementById('google-login-trigger').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .then((result) => {
            alert("نجح تسجيل الدخول عبر الـ Popup! جاري التحقق من الحساب...");
            checkAndCreateUserAccount(result.user);
        })
        .catch((error) => {
            alert("فشل الـ Popup، جاري تجربة الـ Redirect كبديل: " + error.message);
            auth.signInWithRedirect(provider);
        });
});

// 3. مراقبة حالة اللاعب إذا كان مسجلاً دخولاً مسبقاً في المتصفح
auth.onAuthStateChanged((user) => {
    if (user) {
        alert("تم كشف مستخدم مسجل مسبقاً: " + user.displayName);
        checkAndCreateUserAccount(user);
    }
});

// 4. دافة فحص الحساب في قاعدة البيانات
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);

    userRef.get().then((doc) => {
        if (!doc.exists()) {
            userRef.set({
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photo: user.photoURL,
                country: "لم يحدد بعد",
                level: 1,
                energy: 100,
                money: 5000,
                wheat: 50,
                oil: 20,
                gold: 5,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                redirectToMainGame(user.displayName);
            });
        } else {
            redirectToMainGame(user.displayName);
        }
    }).catch((err) => {
        alert("خطأ في الاتصال بقاعدة البيانات: " + err.message);
    });
}

// 5. التوجيه الفوري القاطع باستخدام رابط مطلق يناسب السيرفر
function redirectToMainGame(userName) {
    // تحديد المسار الكامل ديناميكياً لضمان الانتقال على Netlify
    const targetUrl = window.location.origin + window.location.pathname.replace("index.html", "") + "main.html";
    console.log("جاري التوجيه إلى: " + targetUrl);
    
    // التوجيه القاطع
    window.location.assign(targetUrl);
}