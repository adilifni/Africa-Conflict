// إعدادات البناء لـ Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCdHlC-kvNWRrYO8-ujA4CjkJsVdFLDTf8",
    authDomain: "africagameauth.firebaseapp.com",
    projectId: "africagameauth",
    storageBucket: "africagameauth.firebasestorage.app",
    messagingSenderId: "258396328681",
    appId: "1:258396328681:web:2ab3db790000bf16fc5678",
    measurementId: "G-02DLE1VMKT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserUid = null;
let currentUserCountry = "morocco"; // الافتراضي مؤقتاً للتجربة

// 1. نظام حركة السلايدر التفاعلي (يمين ويسار بلمس الشاشة والنقاط)
const wrapper = document.getElementById('sliderWrapper');
const dot1 = document.getElementById('dot1');
const dot2 = document.getElementById('dot2');

function switchSlide(index) {
    if (index === 0) {
        wrapper.style.transform = 'translateX(0%)';
        dot1.classList.add('active');
        dot2.classList.remove('active');
    } else {
        wrapper.style.transform = 'translateX(50%)'; // يتحرك لليسار ليظهر البلوك الثاني
        dot2.classList.add('active');
        dot1.classList.remove('active');
    }
}

// دعم اللمس والسحب باليد للهواتف (Swipe)
let startX = 0;
const sliderCard = document.getElementById('sliderCard');

sliderCard.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
sliderCard.addEventListener('touchend', e => {
    let diffX = e.changedTouches[0].clientX - startX;
    if (diffX > 50) switchSlide(0); // سحب لليمين
    if (diffX < -50) switchSlide(1); // سحب لليسار
});


// 2. مراقبة تسجيل الدخول وحساب المتصلين المباشر
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        window.location.assign("index.html");
    }
});

// دالة جلب بيانات القائد وزيادة إحصائيات المتصلين
function getPlayerDataAndActivateOnline(uid) {
    db.collection('players').doc(uid).get().then((doc) => {
        if (doc.exists) {
            let data = doc.data();
            if (data.country && data.country !== "لم يحدد بعد") {
                currentUserCountry = data.country;
            }
            
            // تشغيل التحديثات الحية الفورية (Real-time Listeners)
            listenToContinentStats();
            listenToCountryStats(currentUserCountry);
            
            // تفعيل ميزة زيادة المتصل المباشر (+1)
            activateOnlineStatus(currentUserCountry);
        }
    });
}

// الاستماع لإحصائيات القارة الحية (السلايد الأول)
function listenToContinentStats() {
    // سنستخدم جلب عادي أو مستمع حي
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties || 0;
            document.getElementById('cont-countries').innerText = data.total_countries || 50;
            document.getElementById('cont-online').innerText = data.total_online || 0;
            document.getElementById('cont-pop').innerText = data.total_population || 0;
        }
    });
}

// الاستماع لإحصائيات الدولة الحية (السلايد الثاني)
function listenToCountryStats(countryId) {
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-name').innerText = data.name || "0";
            document.getElementById('count-factories').innerText = data.factories || 0;
            document.getElementById('count-parties').innerText = data.parties || 0;
            document.getElementById('count-online').innerText = data.online || 0;
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        }
    });
}

// دالة تفعيل زيادة عدد المتصلين في القارة والدولة (+1 تلقائي عند فتح اللعبة)
function activateOnlineStatus(countryId) {
    const increment = firebase.firestore.FieldValue.increment(1);
    const decrement = firebase.firestore.FieldValue.increment(-1);
    
    // زيادة 1 في قاعدة البيانات فورياً
    db.collection('game_stats').doc('africa').update({ total_online: increment });
    db.collection('countries').doc(countryId).update({ online: increment });
    
    // خصم 1 تلقائياً عند إغلاق التاب أو الخروج من اللعبة لضمان دقة الأرقام
    window.addEventListener('beforeunload', () => {
        db.collection('game_stats').doc('africa').update({ total_online: decrement });
        db.collection('countries').doc(countryId).update({ online: decrement });
    });
}