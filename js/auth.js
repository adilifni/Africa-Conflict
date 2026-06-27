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

// 2. تسجيل الدخول باستخدام Popup عند الضغط على الزر
document.getElementById('google-login-trigger').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .then((result) => {
            checkAndCreateUserAccount(result.user);
        })
        .catch((error) => {
            console.error("خطأ أثناء تسجيل الدخول بالنافذة:", error.message);
            // حل بديل احتياطي في حال تم حظر النافذة المنبثقة
            auth.signInWithRedirect(provider);
        });
});

// 3. مراقبة حالة اللاعب - التوجيه الفوري المباشر والصامت للمسجلين سابقاً
auth.onAuthStateChanged((user) => {
    if (user) {
        // يمر مباشرة ودون أي تنبيهات إلى قاعدة البيانات ثم الصفحة الرئيسية
        checkAndCreateUserAccount(user);
    }
});

// 4. دالة فحص الحساب في قاعدة البيانات
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);

    userRef.get({ source: 'server' }).then((doc) => {
        if (!doc.exists) { 
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
                redirectToMainGame();
            });
        } else {
            redirectToMainGame();
        }
    }).catch((err) => {
        console.error("خطأ في Firestore:", err.message);
    });
}

// 5. التوجيه الصامت والمباشر إلى الصفحة الرئيسية للعبة
function redirectToMainGame() {
    const targetUrl = window.location.origin + window.location.pathname.replace("index.html", "") + "main.html";
    window.location.assign(targetUrl);
}