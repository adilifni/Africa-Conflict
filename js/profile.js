// ===================================================
// 👤 نظام إدارة حساب اللاعب، التنقل، والعدادات المصلحة
// ===================================================

let localPlayerData = null;
let trainingInterval = null; 

const africanCountries = {
    "morocco": { name: "المغرب" },
    "egypt": { name: "مصر" },
    "algeria": { name: "الجزائر" },
    "tunisia": { name: "تونس" },
    "libya": { name: "ليبيا" }
};

// دالة تشغيل البروفايل وتفعيل مراقبة Firestore الحية
function initProfileSystem() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();

    db.collection('players').doc(user.uid).onSnapshot((doc) => {
        if (!doc.exists) {
            createNewPlayerProfile(user);
            return;
        }

        const data = doc.data();
        localPlayerData = data;

        // تحديث البيانات الأساسية بالـ Header والواجهة
        if (document.getElementById('profile-avatar')) document.getElementById('profile-avatar').src = data.avatarUrl || 'https://via.placeholder.com/150';
        if (document.getElementById('profile-name-display')) document.getElementById('profile-name-display').textContent = data.name || "قائد مجهول";
        if (document.getElementById('user-name')) document.getElementById('user-name').textContent = data.name || "قائد مجهول";

        // تحديث الثروة
        if (document.getElementById('profile-money-display')) document.getElementById('profile-money-display').textContent = (data.money !== undefined ? data.money : 0) + " 💵";
        if (document.getElementById('profile-gold-display')) document.getElementById('profile-gold-display').textContent = (data.gold !== undefined ? data.gold : 0) + " 🪙";

        // تحديث شريط الـ XP
        updateXPProgressBar(data.xp || 0);

        // تحديث المناطق والدول
        const currentLoc = data.current_location || "morocco";
        const nation = data.nationality || "morocco";
        if (document.getElementById('profile-region')) document.getElementById('profile-region').textContent = africanCountries[currentLoc]?.name || "المغرب";
        if (document.getElementById('profile-nationality')) document.getElementById('profile-nationality').textContent = africanCountries[nation]?.name || "المغرب";

        // تحديث قيم عناصر التطوير
        if (document.getElementById('stat-power-val')) document.getElementById('stat-power-val').textContent = data.power || 0;
        if (document.getElementById('stat-education-val')) document.getElementById('stat-education-val').textContent = data.education || 0;

        // فحص وإدارة العداد التنازلي للتطوير النشط
        checkActiveTraining(data);
    }, error => {
        console.error("Firestore Error:", error);
    });

    setupStatDropdowns();
}

function createNewPlayerProfile(user) {
    firebase.firestore().collection('players').doc(user.uid).set({
        name: user.displayName || "قائد جديد",
        avatarUrl: '', xp: 0, current_location: "morocco", nationality: "morocco",
        power: 0, education: 0, money: 5000, gold: 50, activeTraining: null
    }, { merge: true });
}

function updateXPProgressBar(totalXP) {
    const currentLevel = Math.floor(Math.sqrt(totalXP / 100)) + 1;
    const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
    const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    const progressPercent = (xpInCurrentLevel / xpNeededForNext) * 100;

    if (document.getElementById('profile-level-number')) document.getElementById('profile-level-number').textContent = `المستوى ${currentLevel}`;
    if (document.getElementById('profile-xp-bar')) document.getElementById('profile-xp-bar').style.width = `${progressPercent}%`;
    if (document.getElementById('profile-xp-text')) document.getElementById('profile-xp-text').textContent = `${Math.floor(xpInCurrentLevel)} / ${xpNeededForNext} XP`;
}

function setupStatDropdowns() {
    ['power', 'education'].forEach(stat => {
        const header = document.getElementById(`stat-${stat}-header`);
        const dropdown = document.getElementById(`stat-${stat}-dropdown`);
        
        if (header && dropdown && !header.dataset.listenerAdded) {
            header.addEventListener('click', () => {
                dropdown.classList.toggle('open');
                if (dropdown.classList.contains('open') && localPlayerData) {
                    const currentStatLevel = localPlayerData[stat] || 0;
                    const moneyCost = (currentStatLevel + 1) * 1000;
                    const timeInSeconds = (currentStatLevel + 1) * 30;
                    
                    const timeEl = document.getElementById(`time-${stat}`);
                    if (timeEl) timeEl.textContent = `الوقت: ${timeInSeconds} ثانية | التكلفة: ${moneyCost} مال`;
                }
            });
            header.dataset.listenerAdded = "true";
        }
    });
}

function startStatUpgrade(statName, currencyType) {
    if (!localPlayerData) return;
    if (localPlayerData.activeTraining) {
        alert("⚠️ هناك عملية تطوير جارية بالفعل! انتظر حتى تنتهي.");
        return;
    }

    const currentStatLevel = localPlayerData[statName] || 0;
    const moneyCost = (currentStatLevel + 1) * 1000;
    const goldCost = (currentStatLevel + 1) * 5;
    let timeInSeconds = (currentStatLevel + 1) * 30;

    const user = firebase.auth().currentUser;
    const db = firebase.firestore();
    const updates = {};

    if (currencyType === 'money') {
        if ((localPlayerData.money || 0) < moneyCost) return alert("🔴 لا تملك المال الكافي!");
        updates['money'] = firebase.firestore.FieldValue.increment(-moneyCost);
    } else if (currencyType === 'gold') {
        if ((localPlayerData.gold || 0) < goldCost) return alert("🔴 لا تملك الذهب الكافي!");
        updates['gold'] = firebase.firestore.FieldValue.increment(-goldCost);
        timeInSeconds = Math.floor(timeInSeconds / 2);
    }

    updates['activeTraining'] = {
        stat: statName,
        finishAt: Date.now() + (timeInSeconds * 1000)
    };

    db.collection('players').doc(user.uid).update(updates).then(() => {
        document.getElementById(`stat-${statName}-dropdown`)?.classList.remove('open');
    });
}

function checkActiveTraining(data) {
    const timerDisplay = document.getElementById('training-global-timer');
    if (!timerDisplay) return;

    if (trainingInterval) clearInterval(trainingInterval);

    if (!data.activeTraining) {
        timerDisplay.style.display = 'none';
        return;
    }

    trainingInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = data.activeTraining.finishAt - now;

        if (timeLeft <= 0) {
            clearInterval(trainingInterval);
            timerDisplay.style.display = 'none';
            completeUpgrade(data.activeTraining.stat);
        } else {
            timerDisplay.style.display = 'block';
            timerDisplay.textContent = `⏳ متبقي للتطوير: ${Math.ceil(timeLeft / 1000)} ثانية`;
        }
    }, 1000);
}

function completeUpgrade(statName) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    firebase.firestore().collection('players').doc(user.uid).update({
        [statName]: firebase.firestore.FieldValue.increment(1),
        xp: firebase.firestore.FieldValue.increment(25),
        activeTraining: null
    });
}

// 🌐 دالة التنقل والتبديل الكامل والذكي بين الصفحات الأربعة لضمان بقاء الزر نشطاً
function switchView(viewId) {
    // إخفاء جميع الشاشات أولاً
    document.querySelectorAll('.game-view').forEach(v => v.style.display = 'none');
    
    // إزالة الصف النشط من أزرار الهيدر السفلي
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // إظهار الشاشة المحددة فقط
    const targetView = document.getElementById('view-' + viewId);
    if (targetView) targetView.style.display = 'flex';
    
    // تحديد الزر الذي تم ضغطه وإعطاؤه اللون الأزرق النشط
    const targetNav = document.getElementById('nav-' + viewId);
    if (targetNav) targetNav.classList.add('active');
}

function openSettingsModal() {
    if (!localPlayerData) return;
    document.getElementById('settings-name-input').value = localPlayerData.name || "";
    document.getElementById('settings-avatar-url-input').value = localPlayerData.avatarUrl || "";
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function savePlayerSettings() {
    const name = document.getElementById('settings-name-input').value.trim();
    const url = document.getElementById('settings-avatar-url-input').value.trim();
    if (!name) return alert("الاسم فارغ!");

    firebase.firestore().collection('players').doc(firebase.auth().currentUser.uid).update({
        name: name,
        avatarUrl: url
    }).then(() => closeSettingsModal());
}

firebase.auth().onAuthStateChanged(user => { 
    if (user) initProfileSystem(); 
});