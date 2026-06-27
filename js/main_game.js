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

// مراقبة حالة اتصال اللاعب المباشر
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
        console.log("استدعاء البيانات الاحتياطية:", err);
        startLiveUpdates(); 
    });
}

function startLiveUpdates() {
    // إخفاء رسالة الانتظار وإظهار بلوكات اللعبة كاملة تحت بعضها
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    if(loadingMsg) loadingMsg.style.display = 'none';
    if(mainBlocks) mainBlocks.style.display = 'flex';

    listenToContinentStats();
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserCountry);
}

// قراءة حية وإسقاط فوري للبيانات في بلوك القارة العلوي
function listenToContinentStats() {
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties || 0;
            document.getElementById('cont-countries').innerText = data.total_countries || 50;
            document.getElementById('cont-online').innerText = data.total_online || 0;
            document.getElementById('cont-pop').innerText = data.total_population || 0;
        }
    }, err => console.log("في انتظار تعبئة مستند القارة بالكامل:", err));
}

// قراءة حية وإسقاط فوري للبيانات في بلوك الدولة السفلي
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
    }, err => console.log("في انتظار تعبئة مستند هذه الدولة:", err));
}

// إدارة احتساب عداد المتصلين تلقائياً وبأمان داخل الخوادم
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