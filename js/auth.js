// 1. إعدادات ربط Firebase الحقيقية الخاصة بك (صحيحة تماماً)
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

// 2. تفعيل زر تسجيل الدخول باستخدام الـ Redirect بدلاً من Popup
document.getElementById('google-login-trigger').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    // استخدام Redirect لضمان العمل على الهواتف والمعاينة داخل Acode بدون مشاكل أمنية
    auth.signInWithRedirect(provider);
});

// 3. مراقبة حالة اللاعب فور عودته من صفحة جوجل بنجاح (Redirect)
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            const user = result.user;
            console.log("تم تسجيل الدخول بنجاح بعد إعادة التوجيه:", user.displayName);
            checkAndCreateUserAccount(user);
        }
    })
    .catch((error) => {
        console.error("خطأ أثناء العودة من جوجل:", error.message);
    });

// 4. دالة فحص ما إذا كان اللاعب مسجلاً بالفعل (تشتغل تلقائياً في الخلفية)
auth.onAuthStateChanged((user) => {
    if (user) {
        // إذا كان اللاعب مسجلاً دخوله بالفعل، لا داعي ليرى صفحة الدخول مرة أخرى
        checkAndCreateUserAccount(user);
    }
});

// 5. دالة فحص وإنشاء حساب اللاعب والثروات الأساسية
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
                console.log("تم إنشاء حساب جديد بنجاح!");
                redirectToMainGame(user.displayName);
            });
        } else {
            console.log("لاعب قديم، أهلاً بعودتك!");
            redirectToMainGame(user.displayName);
        }
    }).catch((err) => {
        console.error("خطأ في الاتصال بقاعدة البيانات (Firestore):", err.message);
    });
}

// 6. التنبيه بالنجاح والتوجيه الفوري إلى الصفحة الرئيسية الفارغة
function redirectToMainGame(userName) {
    console.log("توجيه اللاعب " + userName + " إلى الصفحة الرئيسية...");
    // التوجيه إلى صفحة main.html
    window.location.href = "main.html";
}