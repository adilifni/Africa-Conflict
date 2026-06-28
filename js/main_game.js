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
let currentUserCountry = ""; // سيتم جلبها ديناميكياً بالكامل من حساب اللاعب

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        currentUserName = user.displayName || "لاعب";
        
        const playerStatusEl = document.getElementById('player-status');
        if(playerStatusEl) playerStatusEl.innerText = "القائد: " + currentUserName;
        
        // 1️⃣ الخطوة الأولى: معرفة دولة اللاعب الحالية من مستنده الخاص
        getPlayerDataAndActivateOnline(user.uid);
    } else {
        window.location.assign("index.html");
    }
});

function getPlayerDataAndActivateOnline(uid) {
    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists && doc.data().country) {
            let countryData = doc.data().country;
            // تنظيف النص لضمان مطابقة تامة مع معرّف المستند في كوليكشن countries
            currentUserCountry = countryData.trim();
            
            // 2️⃣ الخطوة الثانية: تشغيل التحديثات الحية للدولة والقارة بناءً على الدولة المستدعاة
            startLiveUpdates();
        } else {
            // حالة احتياطية إذا لم يتم العثور على حقل الدولة للاعب
            currentUserCountry = "morocco";
            startLiveUpdates();
        }
    }, (error) => {
        console.error("خطأ في قراءة مستند اللاعب:", error);
        currentUserCountry = "morocco";
        startLiveUpdates();
    });
}

function startLiveUpdates() {
    if(document.getElementById('loading-msg')) document.getElementById('loading-msg').style.display = 'none';
    if(document.getElementById('main-game-blocks')) document.getElementById('main-game-blocks').style.display = 'flex';

    setupContinentSlider(); 
    listenToContinentStats();
    
    // تمرير معرف الدولة لجلب بياناتها وعلمها ديناميكياً
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserUid, currentUserCountry);
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

// 🌍 مراقبة إحصائيات قارة أفريقيا بشكل ديناميكي
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

    // عدد الدول الفعلي في الكوليكشن (سيقرأ 2 تلقائياً)
    db.collection('countries').onSnapshot((snapshot) => {
        document.getElementById('cont-countries').innerText = snapshot.size || 0;
    });

    // إجمالي سكان القارة (كل الحسابات المسجلة)
    db.collection('players').onSnapshot((snapshot) => {
        document.getElementById('cont-pop').innerText = snapshot.size || 0;
    });

    // إجمالي المتصلين في القارة كاملة
    db.collection('online_users').onSnapshot((snapshot) => {
        document.getElementById('cont-online').innerText = snapshot.size || 0;
    });
}

// 🇲🇦 جلب بيانات وعلم الدولة ديناميكياً من السيرفر حسب اختيار اللاعب
function listenToCountryStats(countryId) {
    if (!countryId) return;

    // تفعيل تفاعل زر العلم للذهاب لصفحة هذه الدولة ديناميكياً مستقبلاً
    document.getElementById('country-flag').onclick = function() {
        alert(`سيتم نقلك قريباً إلى الصفحة الرسمية لإدارة دولة: ${countryId} 🚩`);
    };
    document.getElementById('continent-map-btn').onclick = function() {
        alert("سيتم نقلك قريباً إلى صفحة الخريطة الاستراتيجية للقارة! 🌍");
    };

    // 1️⃣ جلب المصانع، الأحزاب، ورابط العلم المخزن في الفايربيس للدولة الحالية
    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('count-factories').innerText = data.factories ?? 0;
            document.getElementById('count-parties').innerText = data.parties ?? 0;
            
            // 🚩 تحديث صورة العلم تلقائياً من الرابط المخزن في الفايربيس بدلاً من الرابط الثابت
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        } else {
            console.warn(`المستند ${countryId} غير موجود في كوليكشن countries. يرجى التأكد من تطابق الاسم تماماً.`);
        }
    });

    // 2️⃣ جلب المتصلين بالدولة الحالية
    db.collection('online_users').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-online').innerText = snapshot.size || 0;
    });

    // 3️⃣ حساب عدد سكان هذه الدولة حياً بناءً على تطابق حقل country في حسابات اللاعبين
    db.collection('players').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-pop').innerText = snapshot.size || 0;
    }, (error) => {
        // طريقة احتياطية مرنة لحساب السكان في حال وجود اختلافات في حالة الأحرف (Capital/Small)
        db.collection('players').onSnapshot((allPlayers) => {
            let counter = 0;
            allPlayers.forEach((pDoc) => {
                let pCountry = pDoc.data().country;
                if(pCountry && pCountry.trim().toLowerCase() === countryId.toLowerCase()){
                    counter++;
                }
            });
            document.getElementById('count-pop').innerText = counter;
        });
    });
}

function activateOnlineStatus(uid, countryId) {
    if (!uid || !countryId) return;
    db.collection('online_users').doc(uid).set({
        country: countryId,
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