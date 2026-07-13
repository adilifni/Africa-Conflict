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

// تحديد موفر الخدمة (Google) وإعداد الحفظ المحلي للجلسة
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// إجبار المتصفح على حفظ الجلسة محلياً لكي لا تضيع بعد اختيار الحساب
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        const loginButton = document.getElementById('google-login-trigger');
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                // استخدام Redirect لأنها الأضمن على الهواتف والمتصفحات كـ Chrome Mobile
                auth.signInWithRedirect(provider);
            });
        }
    })
    .catch((error) => {
        console.error("خطأ في إعدادات حفظ الجلسة:", error.message);
    });

// معالجة النتيجة بعد عودة اللاعب من صفحة اختيار حساب Google
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            console.log("تم تسجيل الدخول بنجاح بعد التحويل:", result.user.displayName);
            checkAndCreateUserAccount(result.user);
        } else {
            // التحقق في حال كان المستخدم مسجلاً بالفعل من قبل في المتصفح
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("المستخدم مسجل دخول مسبقاً:", user.displayName);
                    checkAndCreateUserAccount(user);
                }
            });
        }
    })
    .catch((error) => {
        console.error("حدث خطأ أثناء معالجة تسجيل الدخول:", error.code, error.message);
        alert("فشل تسجيل الدخول: " + error.message);
    });

// دالة التحقق من الحساب في Firestore وإنشائه إذا لم يكن موجوداً
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);
    
    userRef.get().then((doc) => {
        if (!doc.exists) { 
            console.log("لاعب جديد! جاري إنشاء مستند اللاعب...");
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
                console.log("تم إنشاء الحساب في قاعدة البيانات بنجاح!");
                redirectToMainGame();
            }).catch((err) => {
                console.error("خطأ إنشاء مستند Firestore:", err.message);
                redirectToMainGame(); // نوجهه على أي حال لكي لا يعلق
            });
        } else {
            console.log("اللاعب مسجل مسبقاً في Firestore.");
            redirectToMainGame();
        }
    }).catch((err) => {
        console.error("خطأ جلب بيانات Firestore:", err.message);
        redirectToMainGame();
    });
}

// دالة التوجيه لصفحة اللعبة الرئيسية
function redirectToMainGame() {
    const cacheBuster = "?v=" + new Date().getTime();
    window.location.replace("/main.html" + cacheBuster);
}