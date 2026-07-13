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

const loginButton = document.getElementById('google-login-trigger');
const loadingScreen = document.getElementById('loading-screen');

// 1. تحديد حفظ الجلسة محلياً بشكل صارم لضمان بقاء المستخدم مسجلاً
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                if (loadingScreen) loadingScreen.style.display = 'flex';

                // استخدام Pop-up المباشر لتجاوز مشاكل حظر ملفات الكوكيز بالتحويل
                auth.signInWithPopup(provider)
                    .then((result) => {
                        if (result.user) {
                            console.log("نجح تسجيل الدخول:", result.user.displayName);
                            checkAndCreateUserAccount(result.user);
                        }
                    })
                    .catch((error) => {
                        if (loadingScreen) loadingScreen.style.display = 'none';
                        console.error("Popup Error:", error);
                        
                        // إذا تم حظر النافذة المنبثقة من قبل المتصفح، ننتقل للتحويل كخيار احتياطي ثانٍ
                        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                            if (loadingScreen) loadingScreen.style.display = 'flex';
                            auth.signInWithRedirect(provider);
                        } else {
                            alert("خطأ أثناء تسجيل الدخول: " + error.message);
                        }
                    });
            });
        }
    })
    .catch((err) => console.error("Persistence Error:", err));

// معالجة التحويل كخيار احتياطي في الخلفية
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            if (loadingScreen) loadingScreen.style.display = 'flex';
            checkAndCreateUserAccount(result.user);
        }
    })
    .catch((error) => {
        console.error("Redirect Fallback Error:", error);
    });

// الدالة المسؤولة عن فحص وإنشاء اللاعب في Firestore والتوجيه المباشر
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
                console.error("Error creating document:", err);
                redirectToMainGame(); // التوجيه على أي حال لكسر اللوب
            });
        } else {
            redirectToMainGame();
        }
    }).catch((err) => {
        console.error("Error checking document:", err);
        redirectToMainGame();
    });
}

function redirectToMainGame() {
    const cacheBuster = "?v=" + new Date().getTime();
    window.location.replace("/main.html" + cacheBuster);
}