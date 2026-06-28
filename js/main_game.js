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
        const statusBox = document.getElementById('player-status');
        if(statusBox) statusBox.innerText = "القائد: " + currentUserName;
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
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    if(loadingMsg) loadingMsg.style.display = 'none';
    if(mainBlocks) mainBlocks.style.display = 'flex';

    // ربط مستمعات الضغط للخريطة والعلم للتوجيه مستقبلاً
    document.getElementById('continent-map-btn').onclick = function() {
        alert("سيتم نقلك قريباً إلى صفحة الخريطة التفاعلية الاستراتيجية! 🌍");
    };
    document.getElementById('country-flag').onclick = function() {
        alert("سيتم نقلك قريباً إلى الصفحة الرسمية لإحصائيات وإدارة دولتك! 🇲🇦");
    };

    listenToContinentStats();
    listenToCountryStats(currentUserCountry);
    activateOnlineStatus(currentUserUid, currentUserCountry);
    checkEmergencyEvents(currentUserUid, currentUserCountry);
    listenToLiveChat();
}

function listenToContinentStats() {
    db.collection('game_stats').doc('africa').onSnapshot((doc) => {
        if (doc.exists) {
            let data = doc.data();
            document.getElementById('cont-parties').innerText = data.total_parties || 0;
            document.getElementById('cont-countries').innerText = data.total_countries || 50;
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
            if (data.flag) {
                document.getElementById('country-flag').src = data.flag;
            }
        }
    });

    db.collection('online_users').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-online').innerText = snapshot.size || 0;
    });

    // 🎯 حساب عدد سكان هذه الدولة حياً بناءً على حقل الـ country لكل لاعب مسجل
    db.collection('players').where('country', '==', countryId).onSnapshot((snapshot) => {
        document.getElementById('count-pop').innerText = snapshot.size || 0;
    });
}

function activateOnlineStatus(uid, countryId) {
    if (!uid) return;
    db.collection('online_users').doc(uid).set({
        country: countryId,
        last_active: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
    
    window.addEventListener('beforeunload', () => {
        db.collection('online_users').doc(uid).delete();
    });
}

function checkEmergencyEvents(uid, countryId) {
    const eventsBox = document.getElementById('game-events-box');
    const btnInvite = document.getElementById('btn-invite');
    const btnWar = document.getElementById('btn-war');

    db.collection('players').doc(uid).onSnapshot((doc) => {
        if (doc.exists && doc.data().hasPartyInvite === true) {
            btnInvite.style.display = 'block';
            eventsBox.style.display = 'flex';
        } else {
            btnInvite.style.display = 'none';
        }
    });

    db.collection('countries').doc(countryId).onSnapshot((doc) => {
        if (doc.exists && doc.data().inWar === true) {
            btnWar.style.display = 'block';
            eventsBox.style.display = 'flex';
        } else {
            btnWar.style.display = 'none';
        }
    });
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
    }).catch(err => alert("عذراً، فشل إرسال البرقية: " + err.message));
}

function listenToLiveChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    db.collection('global_chat')
      .where('timestamp', '>=', twelveHoursAgo)
      .orderBy('timestamp', 'asc')
      .onSnapshot((snapshot) => {
          chatContainer.innerHTML = "";
          
          if(snapshot.empty) {
              chatContainer.innerHTML = `<p style="color:#57606a; text-align:center; margin-top:40px; font-size:13px;">لا توجد برقيات نشطة في آخر 12 ساعة...</p>`;
              return;
          }

          snapshot.forEach((doc) => {
              const data = doc.data();
              let timeString = "الآن";
              if (data.timestamp) {
                  const date = data.timestamp.toDate();
                  timeString = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
              }

              const msgBubble = document.createElement('div');
              msgBubble.className = 'msg-bubble';
              msgBubble.innerHTML = `
                  <div class="msg-meta">
                      <span>${data.senderName}</span>
                      <span>${timeString}</span>
                  </div>
                  <div class="msg-text">${data.message}</div>
              `;
              chatContainer.appendChild(msgBubble);
          });
          chatContainer.scrollTop = chatContainer.scrollHeight;
      }, err => {
          console.log("بانتظار الفهرسة:", err);
      });
}