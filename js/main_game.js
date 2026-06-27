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

let currentUserUid = null;
let currentUserCountry = "morocco"; 

// إدارة حركات السلايدر يميناً ويساراً
const wrapper = document.getElementById('sliderWrapper');
const dot1 = document.getElementById('dot1');
const dot2 = document.getElementById('dot2');

window.switchSlide = function(index) {
    if (index === 0) {
        if(wrapper) wrapper.style.transform = 'translateX(0%)';
        if(dot1) dot1.classList.add('active');
        if(dot2) dot2.classList.remove('active');
    } else {
        if(wrapper) wrapper.style.transform = 'translateX(50%)'; // إزاحة لليمين في اللغات العربية (RTL)
        if(dot2) dot2.classList.add('active');
        if(dot1) dot1.classList.remove('active');
    }
}

// السحب عبر اللمس للهاتف
let startX = 0;
const sliderCard = document.getElementById('sliderCard');
if(sliderCard) {
    sliderCard.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
    sliderCard.addEventListener('touchend', e => {
        let diffX = e.changedTouches[0].clientX - startX;
        if (diffX > 50) switchSlide(0); 
        if (diffX < -50) switchSlide(1); 
    });
}

// مراقبة حالة اتصال الحساب
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        const statusBox = document.getElementById('player-status');
        if(statusBox) statusBox.innerText = "القائد: " + (user.displayName || "لاعب");
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        window.location.assign("index.html");
    }
});

function getPlayerDataAndActivateOnline(uid) {
    db.collection('players').doc(uid).get().then((doc) => {
        if (doc.exists && doc.data().country) {
            let data = doc.data();
            if (data.country !== "لم يحدد بعد") {
                currentUserCountry = data.country;
            }
        }
        startLiveUpdates();
    }).catch((err) => {
        console.log("خطأ غير مؤثر:", err);
        startLiveUpdates(); // تشغيل على أي حال لعدم تعليق الشاشة
    });
}

function startLiveUpdates() {
    // إخفاء رسالة الانتظار وإظهار البلوكات فوراً لتفادي التعليق البصري
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    if(loadingMsg) loadingMsg.style.display = 'none';
    if(mainBlocks) mainBlocks.style.display = 'flex';

    listenToContinentStats();
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserCountry);
}

function listenToContinentStats() {
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties || 0;
            document.getElementById('cont-countries').innerText = data.total_countries || 50;
            document.getElementById('cont-online').innerText = data.total_online || 0;
            document.getElementById('cont-pop').innerText = data.total_population || 0;
        }
    }, err => console.log("مستند القارة بانتظار تعبئة حقوله بالكامل:", err));
}

function listenToCountryStats(countryId) {
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-name').innerText = data.name || "مجهول";
            document.getElementById('count-factories').innerText = data.factories || 0;
            document.getElementById('count-parties').innerText = data.parties || 0;
            document.getElementById('count-online').innerText = data.online || 0;
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        }
    }, err => console.log("مستند الدولة بانتظار بيانات الحقول المضافة:", err));
}

function activateOnlineStatus(countryId) {
    const increment = firebase.firestore.FieldValue.increment(1);
    const decrement = firebase.firestore.FieldValue.increment(-1);
    
    db.collection('game_stats').doc('africa').update({ total_online: increment }).catch(()=>{});
    db.collection('countries').doc(countryId).update({ online: increment }).catch(()=>{});
    
    window.addEventListener('beforeunload', () => {
        db.collection('game_stats').doc('africa').update({ total_online: decrement });
        db.collection('countries').doc(countryId).update({ online: decrement });
    });
}