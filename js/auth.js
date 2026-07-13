// 1. إعدادات Firebase الخاصة بمشروعك (تأكد من مطابقتها في كل الملفات)
const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة Firebase إذا لم يكن مهيأً بالفعل
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// تحديد زر تسجيل الدخول
const loginButton = document.getElementById('google-login-trigger');

if (loginButton) {
    loginButton.addEventListener('click', () => {
        // استخدام Popup لتفادي مشاكل إعادة التوجيه اللانهائية على الهواتف
        auth.signInWithPopup(provider)
            .then((result) => {
                if (result.user) {
                    console.log("تم تسجيل الدخول بنجاح عبر الـ Popup:", result.user.displayName);
                    checkAndCreateUserAccount(result.user);
                }
            })
            .catch((error) => {
                console.error("فشل الـ Popup، جاري المحاولة عبر الـ Redirect:", error.message);
                // إذا حظر المتصفح النافذة المنبثقة، نستخدم الطريقة البديلة تلقائياً
                auth.signInWithRedirect(provider);
            });
    });
}

// معالجة نتيجة تسجيل الدخول في حال تم استخدام الـ Redirect
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            console.log("تم تسجيل الدخول بعد إعادة التوجيه:", result.user.displayName);
            checkAndCreateUserAccount(result.user);
        } else {
            // مراقبة حالة المستخدم الحالية إذا كان مسجلاً بالفعل ودخل الصفحة
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("المستخدم مسجل دخول بالفعل:", user.displayName);
                    checkAndCreateUserAccount(user);
                }
            });
        }
    })
    .catch((error) => {
        console.error("خطأ أثناء معالجة تسجيل الدخول:", error.message);
    });

// دالة التحقق من وجود الحساب أو إنشائه
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);
    
    userRef.get().then((doc) => {
        if (!doc.exists) { 
            console.log("لاعب جديد! جاري إنشاء مستند اللاعب في قاعدة البيانات...");
            userRef.set({
                uid: user.uid,
                name: user.displayName || "قائد جديد",
                email: user.email,
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
                console.log("تم إنشاء الحساب بنجاح! جاري التوجيه للعبة...");
                redirectToMainGame();
            }).catch((err) => {
                console.error("خطأ أثناء إنشاء مستند اللاعب:", err.message);
            });
        } else {
            console.log("اللاعب مسجل مسبقاً، جاري التوجيه مباشرة...");
            redirectToMainGame();
        }
    }).catch((err) => {
        console.error("خطأ في جلب بيانات اللاعب من Firestore:", err.message);
        // حتى لو حدث خطأ في Firestore (مثلاً بسبب القواعد)، نوجه اللاعب للداخل لتفادي التعليق
        redirectToMainGame();
    });
}

// دالة التوجيه مع تفادي الكاش
function redirectToMainGame() {
    const cacheBuster = "?v=" + new Date().getTime();
    window.location.replace("/main.html" + cacheBuster);
}