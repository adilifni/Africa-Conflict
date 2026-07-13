const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const loginButton = document.getElementById('google-login-trigger');
const loadingScreen = document.getElementById('loading-screen');

// عند الضغط على الزر
if (loginButton) {
    loginButton.addEventListener('click', () => {
        if (loadingScreen) loadingScreen.style.display = 'flex';
        auth.signInWithRedirect(provider);
    });
}

// معالجة العودة بعد اختيار الحساب
auth.getRedirectResult()
    .then((result) => {
        if (result.user) {
            if (loadingScreen) loadingScreen.style.display = 'flex';
            checkAndCreateUserAccount(result.user);
        } else {
            // التحقق من الجلسة الحالية
            auth.onAuthStateChanged((user) => {
                if (user) {
                    if (loadingScreen) loadingScreen.style.display = 'flex';
                    checkAndCreateUserAccount(user);
                }
            });
        }
    })
    .catch((error) => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        console.error("Redirect Error:", error.message);
        alert("خطأ أثناء تسجيل الدخول: " + error.message);
    });

// التحقق من الحساب وإنشاؤه لضمان تسجيله في لوحة تحكم Firebase أولاً
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
                redirectToMainGame();
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
    setTimeout(() => {
        const cacheBuster = "?v=" + new Date().getTime();
        window.location.replace("/main.html" + cacheBuster);
    }, 1000); // تأخير ثانية واحدة لضمان استقرار الاتصال
}