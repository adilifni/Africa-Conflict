// 1. إعدادات ربط Firebase الحقيقية داخل ملف اللعبة الرئيسي
const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

// تهيئة Firebase بأمان
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// متغيرات عامة آمنة ومجهزة بقيم افتراضية لمنع الـ Crash
let currentUserUid = null;
let currentUserName = "لاعب";
let userResidenceCountry = "morocco";
let userCurrentLocation = "morocco";

// 2. مراقبة حالة الجلسة بصرامة (إذا حذفت البيانات يطردك فوراً لصفحة التسجيل)
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب";
        
        const playerStatusEl = document.getElementById('player-status');
        if (playerStatusEl) playerStatusEl.innerText = "القائد: " + currentUserName;
        
        // استدعاء بيانات اللاعب من السيرفر
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        // 🚪 البيانات محذوفة؟ اذهب فوراً لصفحة تسجيل الدخول بجوجل
        console.log("لا يوجد مستخدم نشط، إعادة توجيه لصفحة الدخول...");
        window.location.assign("index.html");
    }
});

// 3. جلب بيانات مستند اللاعب بأمان تّام وتحصين الحقول
function getPlayerDataAndActivateOnline(uid) {
    if (!uid) return;
    
    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            
            // فحص الحقول لتجنب أي قيمة فارغة أو قديمة تسبب تعليق الشاشة
            if (data.residence_country) {
                userResidenceCountry = data.residence_country.trim();
            } else if (data.country) {
                userResidenceCountry = data.country.trim();
            } else {
                userResidenceCountry = "morocco";
            }
            
            userCurrentLocation = data.current_location ? data.current_location.trim() : userResidenceCountry;
            
            // تحديث العلم تلقائياً بناءً على مكان تواجد اللاعب الحالي
            const flagImg = document.getElementById('country-flag');
            if (flagImg) {
                // تحويل الاسم لرمز الدولة الصغير (مثال: morocco -> ma)
                let flagCode = userCurrentLocation === "morocco" ? "ma" : "ma"; 
                flagImg.src = `https://flagcdn.com/w320/${flagCode}.png`;
            }
            
            // تشغيل التحديثات الحية وإظهار عناصر اللعبة
            startLiveUpdates();
        } else {
            // الحساب مسجل في الـ Auth ولكن مستنده غير موجود في الـ Firestore (تم حذفه يدوياً)
            console.warn("مستند اللاعب غير موجود، يتم تسجيل الخروج...");
            auth.signOut().then(() => {
                window.location.assign("index.html");
            });
        }
    }, (error) => {
        console.error("خطأ حماية في Firestore أو انتهت صلاحية الجلسة:", error);
        window.location.assign("index.html");
    });
}

// 4. دالة تشغيل وتأمين إظهار الشاشة الرئيسية واختفاء شاشة التحميل
function startLiveUpdates() {
    // 🚀 إخفاء رسالة التحميل وإظهار البلوكات فوراً
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (mainBlocks) mainBlocks.style.display = 'flex';

    // حماية إضافية: إذا لم تكتمل المتغيرات لا تشغل الدوال الفرعية لتجنب الأخطاء
    if (!currentUserUid || !userResidenceCountry) return;

    // تشغيل دوالك الخاصة بالسلايدر والإحصائيات والاتصال والشات بأمان
    if (typeof setupContinentSlider === "function") setupContinentSlider(); 
    if (typeof listenToContinentStats === "function") listenToContinentStats();
    if (typeof listenToCountryStats === "function") listenToCountryStats(userResidenceCountry, userCurrentLocation);
    if (typeof activateOnlineStatus === "function") activateOnlineStatus(currentUserUid, userCurrentLocation);
    if (typeof listenToLiveChat === "function") listenToLiveChat();
}

// 🛝 منطق السلايدر التلقائي الخاص بالبلوك الأول (قارة إفريقيا)
let currentSlide = 0;
function setupContinentSlider() {
    const sliderCore = document.getElementById('slider-core');
    const dots = [document.getElementById('dot0'), document.getElementById('dot1')];
    const wrapper = document.getElementById('slider-wrapper-zone');
    
    if (!sliderCore || !wrapper) return;
    
    // إزالة أي حدث قديم قبل الإضافة لتفادي التكرار
    wrapper.onclick = null; 
    wrapper.onclick = () => {
        currentSlide = currentSlide === 0 ? 1 : 0;
        sliderCore.style.transform = `translateX(${currentSlide * 50}%)`; // التحريك لليمين واليسار متوافق مع RTL
        
        dots.forEach((dot, index) => {
            if (dot) {
                if (index === currentSlide) dot.classList.add('active');
                else dot.classList.remove('active');
            }
        });
    };
}

// 💬 دالة إرسال برقيات الشات (تأكد من وجودها ومطابقتها لـ onclick في الـ HTML)
function sendChatMessage() {
    const inputField = document.getElementById('chat-input-field');
    if (!inputField || !inputField.value.trim() || !currentUserUid) return;
    
    const messageText = inputField.value.trim();
    
    db.collection('global_chat').add({
        uid: currentUserUid,
        name: currentUserName,
        text: messageText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        inputField.value = ""; // تصفير الحقل بعد الإرسال بنجاح
    }).catch((err) => {
        console.error("خطأ أثناء إرسال الرسالة:", err);
    });
}