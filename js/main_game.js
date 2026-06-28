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
let currentUserCountry = "morocco"; // القيمة الافتراضية

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب غامض";
        document.getElementById('player-status').innerText = "القائد: " + currentUserName;
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        window.location.assign("index.html");
    }
});

function getPlayerDataAndActivateOnline(uid) {
    db.collection('players').doc(uid).get().then((doc) => {
        if (doc.exists && doc.data().country) {
            let countryData = doc.data().country;
            if (countryData && countryData !== "لم يحدد بعد") {
                currentUserCountry = countryData.trim().toLowerCase();
            }
        }
        startLiveUpdates();
    }).catch((err) => {
        console.error("خطأ في جلب بيانات اللاعب الرئيسي:", err);
        startLiveUpdates(); 
    });
}

function startLiveUpdates() {
    document.getElementById('loading-msg').style.display = 'none';
    document.getElementById('main-game-blocks').style.display = 'flex';

    // تفعيل تفاعل الأيقونات الثابتة
    document.getElementById('continent-map-btn').onclick = function() {
        alert("سيتم نقلك قريباً إلى صفحة الخريطة التفاعلية الاستراتيجية! 🌍");
    };
    document.getElementById('country-flag').onclick = function() {
        alert("سيتم نقلك قريباً إلى الصفحة الرسمية لدولتك! 🇲🇦");
    };

    setupContinentSlider(); 
    listenToContinentStats();
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserUid, currentUserCountry);
    listenToLiveChat();
}

// 🛝 إصلاح كامل لنظام السلايدر ليتوافق مع اللغات من اليمين إلى اليسار (RTL)
function setupContinentSlider() {
    const core = document.getElementById('slider-core');
    const wrapper = document.getElementById('slider-wrapper-zone');
    const dot0 = document.getElementById('dot0');
    const dot1 = document.getElementById('dot1');
    
    let startX = 0;
    let currentPageIndex = 0;

    wrapper.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, {passive: true});

    wrapper.addEventListener('touchend', (e) => {
        let diffX = e.changedTouches[0].clientX - startX;
        
        if (Math.abs(diffX) > 40) {
            // في وضع RTL السحب لليمين يعيدنا للخلف ولليسار ينقلنا للأمام
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
            dot0.classList.add('active');
            dot1.classList.remove('active');
        } else {
            // استخدام القيمة السالبة لتحريك السلايدر لليسار بشكل هندسي دقيق في الـ RTL
            core.style.transform = "translateX(-50%)"; 
            dot1.classList.add('active');
            dot0.classList.remove('active');
        }
    }
}

function listenToContinentStats() {
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties || 0;
            document.getElementById('cont-countries').innerText = data.total_countries || 50;
            document.getElementById('cont-factories').innerText = data.total_factories || 0;
            document.getElementById('cont-independent').innerText = data.total_independent || 0;
            document.getElementById('cont-alliances').innerText = data.total_alliances || 0;
        }
    }, (error) => {
        console.error("مشكلة مراقبة إحصائيات أفريقيا الحية:", error);
    });

    db.collection('players').onSnapshot((snapshot) => {
        document.getElementById('cont-pop').innerText = snapshot.size || 0;
    });

    db.collection('online_users').onSnapshot((snapshot) => {
        document.getElementById('cont-online').innerText = snapshot.size || 0;
    });
}

function listenToCountryStats(countryId) {
    // مراقبة بيانات مستند الدولة (المصانع والأحزاب)
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-factories').innerText = data.factories || 0;
            document.getElementById('count-parties').innerText = data.parties || 0;
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        }
    });

    // مراقبة عدد اللاعبين المتصلين حالياً بالدولة
    db.collection('online_users').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-online').innerText = snapshot.size || 0;
    });

    // 💡 حل مشكلة الـ 0 لسكان المغرب: مراقبة حية مرنة تحسب اللاعبين مع تجاهل الفراغات وحالة الحروف
    db.collection('players').onSnapshot((snapshot) => {
        let populationCounter = 0;
        snapshot.forEach((playerDoc) => {
            let pData = playerDoc.data();
            if (pData && pData.country) {
                let formattedCountry = pData.country.trim().toLowerCase();
                if (formattedCountry === countryId.toLowerCase() || formattedCountry === "morocco") {
                    populationCounter++;
                }
            }
        });
        document.getElementById('count-pop').innerText = populationCounter;
    });
}

function activateOnlineStatus(uid, countryId) {
    if (!uid) return;
    db.collection('online_users').doc(uid).set({
        country: countryId,
        last_active: firebase.firestore.FieldValue.serverTimestamp()
    }).catch((e) => console.log("خطأ غير مؤثر في تحديث التواجد الحقيقي المباشر."));
}

window.sendChatMessage = function() {
    const inputField = document.getElementById('chat-input-field');
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
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    db.collection('global_chat')
      .where('timestamp', '>=', twelveHoursAgo)
      .orderBy('timestamp', 'asc')
      .onSnapshot((snapshot) => {
          chatContainer.innerHTML = "";
          snapshot.forEach((doc) => {
              const data = doc.data();
              let timeString = "الآن";
              if (data.timestamp) {
                  timeString = data.timestamp.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
              }

              const msgBubble = document.createElement('div');
              msgBubble.className = 'msg-bubble';
              msgBubble.innerHTML = `
                  <div class="msg-meta">⚙️ ${data.senderName} (${timeString})</div>
                  <div class="msg-text">${data.message}</div>
              `;
              chatContainer.appendChild(msgBubble);
          });
          chatContainer.scrollTop = chatContainer.scrollHeight;
      });
}