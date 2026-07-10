// 1. إعدادات ربط Firebase
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
const provider = new firebase.auth.GoogleAuthProvider();

// 2. معالجة الضغط على زر تسجيل الدخول (استخدام Redirect مباشرة لمنع حظر المتصفحات)
const loginButton = document.getElementById('google-login-trigger');
if (loginButton) {
    loginButton.addEventListener('click', () => {
        auth.signInWithRedirect(provider);
    });
}

// 3. التقاط نتيجة تسجيل الدخول بعد عودة المستخدم من صفحة Google ومراقبة الحالة
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            checkAndCreateUserAccount(result.user);
        } else {
            // إذا لم تكن هناك نتيجة راديكت، نتحقق من حالة الجلسة الحالية
            auth.onAuthStateChanged((user) => {
                if (user) {
                    checkAndCreateUserAccount(user);
                }
            });
        }
    })
    .catch((error) => {
        console.error("خطأ أثناء معالجة تسجيل الدخول:", error.message);
    });

// 4. دالة فحص الحساب وإنشاء بيانات اللاعب الجديد
function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);

    userRef.get().then((doc) => {
        if (!doc.exists) { 
            // إنشاء بيانات لاعب جديد تماماً
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
                redirectToMainGame();
            });
        } else {
            // اللاعب مسجل مسبقاً، توجه مباشرة
            redirectToMainGame();
        }
    }).catch((err) => {
        console.error("خطأ في جلب بيانات اللاعب من Firestore:", err.message);
    });
}

// 5. دالة التوجيه الآمنة والمعدلة لتتوافق مع استضافة Vercel
function redirectToMainGame() {
    console.log("🚀 جاري التوجيه إلى الصفحة الرئيسية للعبة...");
    const cacheBuster = "?v=" + new Date().getTime();
    
    // إضافة '/' في البداية لتوجيه صحيح للمجلد الرئيسي على Vercel
    window.location.replace("/main.html" + cacheBuster);
}