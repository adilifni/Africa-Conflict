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
const provider = new firebase.auth.GoogleAuthProvider();

// جعل الحفظ محلي ومستقر
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
    const loginButton = document.getElementById('google-login-trigger');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            // استخدام Redirect الأضمن للهواتف
            auth.signInWithRedirect(provider);
        });
    }
}).catch(err => console.error("Persistence error:", err));

// مراقبة النتيجة والتوجيه المباشر لتفادي التعليق
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log("تم تسجيل الدخول بعد الـ Redirect:", result.user.displayName);
        // حفظ مؤقت في المتصفح لتأكيد الدخول الفوري
        localStorage.setItem("justLoggedIn", "true");
        redirectToMainGame();
    }
}).catch((error) => {
    console.error("Redirect Error:", error.message);
    alert("خطأ أثناء تسجيل الدخول: " + error.message);
});

// مراقبة حالة الجلسة العامة
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("المستخدم مسجل دخول نشط:", user.displayName);
        // إذا كان قادماً من تسجيل الدخول أو مسجل بالفعل وجهه للداخل فوراً
        redirectToMainGame();
    }
});

function redirectToMainGame() {
    const cacheBuster = "?v=" + new Date().getTime();
    window.location.replace("/main.html" + cacheBuster);
}