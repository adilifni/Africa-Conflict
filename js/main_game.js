// ==========================================
// 1. المتغيرات العامة (Global Variables)
// ==========================================
let currentUserUid = null;
let userCurrentLocation = "ma"; // القيمة الافتراضية (مثلاً المغرب "ma")

// ==========================================
// 2. مراقبة حالة تسجيل الدخول (Firebase Auth)
// ==========================================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        currentUserUid = user.uid;
        
        // جلب وتحديث اسم اللاعب في الشريط العلوي
        const playerStatus = document.getElementById('player-status');
        if (playerStatus) {
            playerStatus.textContent = `القائد: ${user.displayName || 'لاعب جديد'}`;
        }

        // تشغيل اللعبة واستدعاء البيانات الحية
        startLiveUpdates();
    } else {
        // إذا لم يكن هناك مستخدم مسجل، يتم توجيهه لصفحة تسجيل الدخول
        console.log("لم يتم العثور على جلسة تسجيل دخول نشطة، جاري التوجيه...");
        window.location.href = "login.html";
    }
});

// ==========================================
// 3. دالة بدء التحديثات والاتصال بالبيانات الحية
// ==========================================
function startLiveUpdates() {
    console.log("بدء تشغيل اللعبة والاتصال بالبيانات الحية...");
    
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    
    // إخفاء شاشة التحميل وإظهار محتوى اللعبة الرئيسي
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (mainBlocks) mainBlocks.style.display = 'flex';

    // 1. بناء العناصر أولاً داخل الصفحة بشكل آمن
    try {
        initializeContinentSlideshow(); 
    } catch (error) {
        console.error("خطأ أثناء تشغيل شريحة القارات:", error);
    }

    try {
        initializeCountryCard(); 
    } catch (error) {
        console.error("خطأ أثناء تشغيل كارت الدولة:", error);
    }
    
    // 2. ربط أزرار الضغط بعد رسم العناصر بنجاح
    try {
        setupClickListeners(); 
    } catch (error) {
        console.error("خطأ أثناء إعداد مستمعي الأزرار:", error);
    }

    // 3. تشغيل جلب البيانات المباشرة والشات من قاعدة البيانات
    try {
        listenToContinentAndCountryStats();
    } catch (error) {
        console.error("خطأ أثناء جلب إحصائيات القارات والدول:", error);
    }

    if (currentUserUid) {
        try {
            activateOnlineStatus(currentUserUid, userCurrentLocation);
        } catch (error) {
            console.error("خطأ أثناء تحديث حالة الاتصال للاعب الحالية:", error);
        }
    }

    try {
        listenToLiveChat();
    } catch (error) {
        console.error("خطأ أثناء تشغيل المحادثة الحية:", error);
    }
}

// ==========================================
// 4. دالات البناء والواجهات (تحتاج لربطها بقاعدة بياناتك)
// ==========================================
function initializeContinentSlideshow() {
    console.log("تم تهيئة شريحة عرض القارات بنجاح.");
    // ضع هنا منطق الـ Slideshow الخاص بك إن وجد
}

function initializeCountryCard() {
    console.log("تم تهيئة كارت الدولة بنجاح.");
    // ضع هنا كود رسم علم الدولة وإحصائياتها الافتراضية
}

// ==========================================
// 5. دالة ربط أزرار التحكم والبرلمان
// ==========================================
function setupClickListeners() {
    // جلب الأزرار بناءً على الـ IDs الموجودة في تصميم الـ HTML الجديد
    const factoriesBtn = document.getElementById('btn-country-factories');
    const partiesBtn = document.getElementById('btn-country-parties');
    const onlineBtn = document.getElementById('btn-country-online');
    const popBtn = document.getElementById('btn-country-pop');
    const parliamentBtn = document.getElementById('parliament-main-btn');

    if (factoriesBtn) {
        factoriesBtn.onclick = () => {
            console.log("تم الضغط على زر المصانع.");
            window.location.href = "factories.html"; // أو التوجيه لصفحتك
        };
    }

    if (partiesBtn) {
        partiesBtn.onclick = () => {
            console.log("تم الضغط على زر الأحزاب.");
            window.location.href = "parties.html";
        };
    }

    if (onlineBtn) {
        onlineBtn.onclick = () => {
            console.log("تم الضغط على زر المتصلين.");
            // كود إظهار قائمة المتصلين
        };
    }

    if (popBtn) {
        popBtn.onclick = () => {
            console.log("تم الضغط على زر السكان.");
        };
    }

    if (parliamentBtn) {
        parliamentBtn.onclick = () => {
            console.log("تم الضغط على زر برلمان الدولة.");
            window.location.href = "parliament.html";
        };
    }
}

// ==========================================
// 6. الاتصال بقاعدة البيانات (Firebase Realtime Database)
// ==========================================
function listenToContinentAndCountryStats() {
    // مثال لجلب إحصائيات الدولة الحية
    const countryRef = firebase.database().ref(`countries/${userCurrentLocation}`);
    countryRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // تحديث الأرقام المعروضة في كارت الدولة بناءً على البيانات الحقيقية
            const factoriesCount = document.getElementById('country-factories-count');
            const partiesCount = document.getElementById('country-parties-count');
            const onlineCount = document.getElementById('country-online-count');
            const popCount = document.getElementById('country-pop-count');

            if (factoriesCount) factoriesCount.textContent = data.factories || 0;
            if (partiesCount) partiesCount.textContent = data.parties || 0;
            if (onlineCount) onlineCount.textContent = data.online || 0;
            if (popCount) popCount.textContent = data.population || 0;
        }
    });
}

function activateOnlineStatus(uid, location) {
    // كود تسجيل اللاعب كنشط حالياً في قاعدة البيانات
    const userStatusRef = firebase.database().ref(`status/${location}/${uid}`);
    
    // عندما يخرج اللاعب أو يغلق المتصفح، يتم حذفه تلقائياً (onDisconnect)
    userStatusRef.set({ online: true, last_active: firebase.database.ServerValue.TIMESTAMP });
    userStatusRef.onDisconnect().remove();
}

function listenToLiveChat() {
    // كود مراقبة المحادثة الإقليمية للبلد الحالي وعرضها
    const chatRef = firebase.database().ref(`chats/${userCurrentLocation}`).limitToLast(20);
    chatRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            displayChatMessage(message);
        }
    });
}

function displayChatMessage(msg) {
    const chatBox = document.getElementById('chat-messages-container');
    if (!chatBox) return;

    const msgElement = document.createElement('div');
    msgElement.className = 'chat-message';
    msgElement.innerHTML = `
        <span class="chat-sender">${msg.senderName}:</span>
        <span class="chat-text">${msg.text}</span>
    `;
    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight; // النزول لأسفل الشات تلقائياً
}