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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// 2. تسجيل الدخول باستخدام Popup عند الضغط على الزر
const loginButton = document.getElementById('google-login-trigger');
if (loginButton) {
    loginButton.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        auth.signInWithPopup(provider)
            .then((result) => {
                checkAndCreateUserAccount(result.user);
            })
            .catch((error) => {
                console.error("خطأ أثناء تسجيل الدخول بالنافذة:", error.message);
                // حل بديل احتياطي في حال تم حظر النافذة المنبثقة من المتصفح
                auth.signInWithRedirect(provider);
            });
    });
}

// 3. مراقبة حالة اللاعب التلقائية عند فتح الصفحة
auth.onAuthStateChanged((user) => {
    if (user) {
        checkAndCreateUserAccount(user);
    }
});

// 4. دالة فحص الحساب وإنشاء الحقول الجديدة والافتراضية تلقائياً
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);

    userRef.get({ source: 'server' }).then((doc) => {
        if (!doc.exists) { 
            // 🚀 الحساب جديد تماماً! نقوم بتوليد كافة الحقول الهيكلية تلقائياً هنا
            userRef.set({
                uid: user.uid,
                name: user.displayName || "قائد جديد",
                email: user.email,
                photo: user.photoURL || "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                
                // الموارد الابتدائية للاعب الجديد
                level: 1,
                energy: 100,
                money: 5000,
                gold: 5,
                oil: 20,
                wheat: 50,
                
                // 🌍 حقول المواقع الجديدة والتنقل والأحزاب والمصانع
                residence_country: "morocco", // الإقامة الافتراضية
                current_location: "morocco",   // التواجد الحالي
                has_party: false,
                party_id: "",
                factories_list: [1]            // يبدأ بالمصنع الأول ذو المستوى 1 تلقائياً
            }).then(() => {
                console.log("🚀 تم إنشاء ملف القائد الجديد بنجاح وبكافة الحقول التلقائية!");
                redirectToMainGame();
            });
        } else {
            // اللاعب مسجل مسبقاً ولديه حساب، يوجه مباشرة
            redirectToMainGame();
        }
    }).catch((err) => {
        console.error("خطأ في Firestore:", err.message);
    });
}

// 5. التوجيه الديناميكي الآمن إلى شاشة اللعبة الرئيسية
function redirectToMainGame() {
    // يتأكد من التوجيه لملف main_game.html المتواجد في مشروعك
    const targetUrl = window.location.origin + window.location.pathname.replace("index.html", "") + "main_game.html";
    window.location.assign(targetUrl);
}