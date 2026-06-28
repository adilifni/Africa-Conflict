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
let currentUserCountry = "morocco"; 

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
            let data = doc.data();
            if (data.country !== "لم يحدد بعد") {
                // تصفية وحماية النص ليكون متطابقاً مع قواعد البيانات
                currentUserCountry = data.country.trim().toLowerCase();
            }
        }
        startLiveUpdates();
    }).catch((err) => {
        console.log("خطأ بالبيانات الاحتياطية:", err);
        startLiveUpdates(); 
    });
}

function startLiveUpdates() {
    document.getElementById('loading-msg').style.display = 'none';
    document.getElementById('main-game-blocks').style.display = 'flex';

    document.getElementById('continent-map-btn').onclick = function() {
        alert("سيتم نقلك قريباً إلى صفحة الخريطة التفاعلية الاستراتيجية! 🌍");
    };
    document.getElementById('country-flag').onclick = function() {
        alert("سيتم نقلك قريباً إلى الصفحة الرسمية لدولتك! 🇲🇦");
    };

    setupContinentSlider(); // تفعيل سلايدر القارة
    listenToContinentStats();
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserUid, currentUserCountry);
    listenToLiveChat();
}

// 🛝 دالة برمجة وإدارة اللمس للسلايدر (يمين ويسار)
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
        // إذا سحب المستخدم مسافة أكبر من 50 بكسل
        if (Math.abs(diffX) > 50) {
            if (diffX > 0 && currentPageIndex > 0) {
                currentPageIndex = 0; // عودة لليمين
            } else if (diffX < 0 && currentPageIndex < 1) {
                currentPageIndex = 1; // ذهاب لليسار
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
            core.style.transform = "translateX(50%)"; // التحرك لليسار بالتوافق مع اتجاه RTL
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
            // جلب البيانات الإضافية الجديدة للسلايدر الثاني
            document.getElementById('cont-factories').innerText = data.total_factories || 0;
            document.getElementById('cont-independent').innerText = data.total_independent || 0;
            document.getElementById('cont-alliances').innerText = data.total_alliances || 0;
        }
    });

    db.collection('players').onSnapshot((snapshot) => {
        document.getElementById('cont-pop').innerText = snapshot.size || 0;
    });

    db.collection('online_users').onSnapshot((snapshot) => {
        document.getElementById('cont-online').innerText = snapshot.size || 0;
    });
}

function listenToCountryStats(countryId) {
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-factories').innerText = data.factories || 0;
            document.getElementById('count-parties').innerText = data.parties || 0;
            if (data.flag) document.getElementById('country-flag').src = data.flag;
        }
    });

    db.collection('online_users').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-online').innerText = snapshot.size || 0;
    });

    // 💡 إصلاح المشكلة: البحث يدعم حالة الأحرف الكبيرة والصغيرة لضمان جلب سكان المغرب بشكل صحيح
    db.collection('players').onSnapshot((snapshot) => {
        let count = 0;
        snapshot.forEach((pDoc) => {
            let pCountry = pDoc.data().country;
            if (pCountry && pCountry.trim().toLowerCase() === countryId.toLowerCase()) {
                count++;
            }
        });
        document.getElementById('count-pop').innerText = count;
    });
}

function activateOnlineStatus(uid, countryId) {
    if (!uid) return;
    db.collection('online_users').doc(uid).set({
        country: countryId,
        last_active: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
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