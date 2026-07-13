// تأكد من مطابقة هذه الإعدادات بنسبة 100% مع الإعدادات الموجودة في مشروعك بـ Firebase
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
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} catch (e) {
    alert("فشل تهيئة Firebase: " + e.message);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const loginButton = document.getElementById('google-login-trigger');
const loadingScreen = document.getElementById('loading-screen');

if (loginButton) {
    loginButton.addEventListener('click', () => {
        if (loadingScreen) loadingScreen.style.display = 'flex';
        
        // محاولة تسجيل الدخول
        auth.signInWithRedirect(provider).catch((error) => {
            if (loadingScreen) loadingScreen.style.display = 'none';
            alert("خطأ أثناء بدء تسجيل الدخول:\n" + error.code + "\n" + error.message);
        });
    });
}

// معالجة العودة من جوجل وكشف الأخطاء المستترة
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            if (loadingScreen) loadingScreen.style.display = 'flex';
            checkAndCreateUserAccount(result.user);
        }
    })
    .catch((error) => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        // هذا التنبيه سيخبرنا بالسبب الدقيق لرفض Firebase تسجيل المستخدم
        alert("🚨 خطأ Firebase Auth الدقيق:\nكود الخطأ: " + error.code + "\nالرسالة: " + error.message);
    });

function checkAndCreateUserAccount(user) {
    const userRef = db.collection('players').doc(user.uid);
    
    userRef.get().then((doc) => {
        if (!doc.exists) { 
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
            }).catch((err) => {
                alert("خطأ أثناء إنشاء حساب Firestore:\n" + err.message);
                redirectToMainGame();
            });
        } else {
            redirectToMainGame();
        }
    }).catch((err) => {
        alert("خطأ في قراءة Firestore:\n" + err.message);
        redirectToMainGame();
    });
}

function redirectToMainGame() {
    const cacheBuster = "?v=" + new Date().getTime();
    window.location.replace("/main.html" + cacheBuster);
}