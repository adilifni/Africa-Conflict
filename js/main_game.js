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
let currentUserName = "لاعب";
let userResidenceCountry = ""; // 🇲🇦 جنسية اللاعب/إقامته الثابتة (لحساب السكان والمصانع)
let userCurrentLocation = "";  // ✈️ موقع اللاعب الحالي (لحساب المتواجدين الآن والدردشة)

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب";
        
        const playerStatusEl = document.getElementById('player-status');
        if(playerStatusEl) playerStatusEl.innerText = "القائد: " + currentUserName;
        
        // 1️⃣ الخطوة الأولى: جلب الحقول الجديدة من مستند اللاعب
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        window.location.assign("index.html");
    }
});

function getPlayerDataAndActivateOnline(uid) {
    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists && doc.data().residence_country) {
            let data = doc.data();
            
            // جلب القيم الجديدة وتنظيف الفراغات
            userResidenceCountry = data.residence_country.trim();
            userCurrentLocation = (data.current_location || data.residence_country).trim();
            
            // 2️⃣ الخطوة الثانية: تشغيل التحديثات الحية للواجهة
            startLiveUpdates();
        } else {
            // حالة احتياطية إذا لم تكن الحقول جاهزة بعد
            userResidenceCountry = "morocco";
            userCurrentLocation = "morocco";
            startLiveUpdates();
        }
    }, (error) => {
        console.error("خطأ في قراءة مستند اللاعب:", error);
        userResidenceCountry = "morocco";
        userCurrentLocation = "morocco";
        startLiveUpdates();
    });
}

function startLiveUpdates() {
    if(document.getElementById('loading-msg')) document.getElementById('loading-msg').style.display = 'none';
    if(document.getElementById('main-game-blocks')) document.getElementById('main-game-blocks').style.display = 'flex';

    setupContinentSlider(); 
    listenToContinentStats();
    
    // تمرير المتغيرات الجديدة بدقة للوظائف الحية
    listenToCountryStats(userResidenceCountry, userCurrentLocation);
    activateOnlineStatus(currentUserUid, userCurrentLocation);
    listenToLiveChat();
}

// 🛝 السلايدر المتوافق مع حركة اليد لليمين واليسار (RTL)
function setupContinentSlider() {
    const core = document.getElementById('slider-core');
    const wrapper = document.getElementById('slider-wrapper-zone');
    const dot0 = document.getElementById('dot0');
    const dot1 = document.getElementById('dot1');
    
    if(!core || !wrapper) return;

    let startX = 0;
    let currentPageIndex = 0;

    wrapper.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, {passive: true});

    wrapper.addEventListener('touchend', (e) => {
        let diffX = e.changedTouches[0].clientX - startX;
        if (Math.abs(diffX) > 40) {
            if (diffX > 0 && currentPageIndex > 0) {
                currentPageIndex = 0; 
            } else if (diffX < 0 && currentPageIndex < 1) {
                currentPageIndex = 1; 
            }
            updateSliderPosition();
        }
    }, {passive: true});

    function updateSliderPosition() {
        if (currentPageIndex === 0) {
            core.style.transform = "translateX(0%)";
            if(dot0) dot0.classList.add('active');
            if(dot1) dot1.classList.remove('active');
        } else {
            core.style.transform = "translateX(-50%)"; 
            if(dot1) dot1.classList.add('active');
            if(dot0) dot0.classList.remove('active');
        }
    }
}

// 🌍 مراقبة إحصائيات قارة أفريقيا بالكامل
function listenToContinentStats() {
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties ?? 0;
            document.getElementById('cont-factories').innerText = data.total_factories ?? 0;
            document.getElementById('cont-independent').innerText = data.total_independent ?? 0;
            document.getElementById('cont-alliances').innerText = data.total_alliances ?? 0;
        }
    });

    db.collection('countries').onSnapshot((snapshot) => {
        document.getElementById('cont-countries').innerText = snapshot.size || 0;
    });

    db.collection('players').onSnapshot((snapshot) => {
        document.getElementById('cont-pop').innerText = snapshot.size || 0;
    });

    db.collection('online_users').onSnapshot((snapshot) => {
        document.getElementById('cont-online').innerText = snapshot.size || 0;
    });
}

// 🇲🇦 جلب بيانات الدولة وعلمها وحساب السكان حياً بناءً على الجنسية والموقع الحالي
function listenToCountryStats(residenceCountry, currentLocation) {
    if (!residenceCountry) return;

    document.getElementById('country-flag').onclick = function() {
        alert(`سيتم نقلك قريباً إلى الصفحة الرسمية لإدارة دولة: ${residenceCountry} 🚩`);
    };
    document.getElementById('continent-map-btn').onclick = function() {
        alert("سيتم نقلك قريباً إلى صفحة الخريطة الاستراتيجية للقارة! 🌍");
    };

    // 1️⃣ جلب بيانات مصانع وأحزاب وعلم دولة اللاعب الأصلية (الجنسية)
    db.collection('countries').doc(residenceCountry).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-factories').innerText = data.factories ?? 0;
            document.getElementById('count-parties').innerText = data.parties ?? 0;
            
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        } else {
            console.warn(`المستند ${residenceCountry} غير موجود في كوليكشن countries.`);
        }
    });

    // 2️⃣ حساب المتواجدين حالياً في الدولة (بناءً على مكان التواجد الحالي الفعلي)
    db.collection('online_users').where('country', '==', currentLocation).onSnapshot((snapshot) => {
        document.getElementById('count-online').innerText = snapshot.size || 0;
    });

    // 3️⃣ حساب عدد السكان حياً (يشمل حاملي الجنسية حتى لو كانوا مسافرين خارج الدولة)
    db.collection('players').where('residence_country', '==', residenceCountry).onSnapshot((snapshot) => {
        document.getElementById('count-pop').innerText = snapshot.size || 0;
    }, (error) => {
        // طريقة احتياطية مرنة لحساب السكان تفادياً لأي مشاكل
        db.collection('players').onSnapshot((allPlayers) => {
            let counter = 0;
            allPlayers.forEach((pDoc) => {
                let pResidence = pDoc.data().residence_country;
                if(pResidence && pResidence.trim().toLowerCase() === residenceCountry.toLowerCase()){
                    counter++;
                }
            });
            document.getElementById('count-pop').innerText = counter;
        });
    });
}

// 🌐 تفعيل حالة الاتصال بناءً على الموقع الحالي الفعلي للاعب
function activateOnlineStatus(uid, currentLocation) {
    if (!uid || !currentLocation) return;
    db.collection('online_users').doc(uid).set({
        country: currentLocation, // الدولة المتواجد فيها حالياً
        last_active: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
}

window.sendChatMessage = function() {
    const inputField = document.getElementById('chat-input-field');
    if (!inputField) return;
    const text = inputField.value.trim();
    if (!text) return;

    db.collection('global_chat').add({
        senderName: currentUserName,
        senderUid: currentUserUid,
        message: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        inputField.value = "";
    });
}

function listenToLiveChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    if(!chatContainer) return;

    db.collection('global_chat')
      .orderBy('timestamp', 'desc')
      .limit(25)
      .onSnapshot((snapshot) => {
          chatContainer.innerHTML = "";
          let messages = [];
          snapshot.forEach((doc) => {
              messages.unshift({ id: doc.id, ...doc.data() });
          });

          messages.forEach((data) => {
              let timeString = "الآن";
              if (data.timestamp) {
                  timeString = data.timestamp.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
              }

              const msgBubble = document.createElement('div');
              msgBubble.className = 'msg-bubble';
              msgBubble.innerHTML = `
                  <div class="msg-meta">⚙️ ${data.senderName || 'لاعب'} (${timeString})</div>
                  <div class="msg-text">${data.message || ''}</div>
              `;
              chatContainer.appendChild(msgBubble);
          });
          chatContainer.scrollTop = chatContainer.scrollHeight;
      });
}