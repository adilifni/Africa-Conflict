
// ==========================================
// 👤 نظام إدارة حساب اللاعب، المستويات، والتطوير
// ==========================================

// المتغير العالمي لتخزين بيانات اللاعب الحالية محلياً لتسهيل الحسابات
let localPlayerData = null;
let trainingTimeout = null;

// مصفوفة افتراضية لترجمة أسماء الدول لتجنب أخطاء الـ Undefined عند جلب البيانات
const africanCountries = {
    "morocco": { name: "المغرب" },
    "egypt": { name: "مصر" },
    "algeria": { name: "الجزائر" },
    "tunisia": { name: "تونس" },
    "libya": { name: "ليبيا" }
};

// دالة تشغيل نظام الحساب (يتم استدعاؤها عند فتح واجهة الحساب)
function initProfileSystem() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();

    // الاستماع المباشر لبيانات اللاعب لتحديث الواجهة فوراً عند أي تغيير
    db.collection('players').doc(user.uid).onSnapshot((doc) => {
        if (!doc.exists) {
            // إذا كان اللاعب جديداً تماماً، نقوم بإنشاء بياناته الافتراضية
            createNewPlayerProfile(user);
            return;
        }

        const data = doc.data();
        localPlayerData = data;

        // 1. تحديث الصورة والاسم في واجهة البروفايل وكذلك في الـ Header الرئيسي
        const profileImg = document.getElementById('profile-avatar');
        if (profileImg) profileImg.src = data.avatarUrl || user.photoURL || 'https://via.placeholder.com/150';
        
        const profileName = document.getElementById('profile-name-display');
        if (profileName) profileName.textContent = data.name || user.displayName || "قائد مجهول";

        const headerName = document.getElementById('user-name');
        if (headerName) headerName.textContent = data.name || user.displayName || "قائد مجهول";

        // 2. تحديث شريط المستوى (XP)
        updateXPProgressBar(data.xp || 0);

        // تحديث أرقام الذهب والمال الحية من Firestore بدون كلمات إضافية
        const goldDisplay = document.getElementById('profile-gold-display');
        const moneyDisplay = document.getElementById('profile-money-display');

        if (goldDisplay) goldDisplay.textContent = (data.gold !== undefined ? data.gold : 0) + " 🪙";
        if (moneyDisplay) moneyDisplay.textContent = (data.money !== undefined ? data.money : 0) + " 💵";

        // 3. تحديث بلوك المنطقة والجنسية
        const regionText = document.getElementById('profile-region');
        if (regionText) {
            const currentLoc = data.current_location || "morocco";
            regionText.textContent = africanCountries[currentLoc]?.name || "أفريقيا";
        }
        
        const nationalityText = document.getElementById('profile-nationality');
        if (nationalityText) {
            const nation = data.nationality || "morocco";
            nationalityText.textContent = africanCountries[nation]?.name || "لم تحدد";
        }

        // 4. تحديث الأرقام الأساسية (العناصر الثلاثة للتطوير)
        const powerVal = document.getElementById('stat-power-val');
        const educationVal = document.getElementById('stat-education-val');
        const expVal = document.getElementById('stat-experience-val');

        if (powerVal) powerVal.textContent = data.power || 0;
        if (educationVal) educationVal.textContent = data.education || 0;
        if (expVal) expVal.textContent = data.experience || 0;

        // 5. مراقبة التطوير الحالي (إذا كان هناك تطوير قيد الانتظار)
        checkActiveTraining(data);
    });

    // ربط أزرار القوائم المنزلقة والتطوير
    setupStatDropdowns();
}

// دالة إنشاء ملف لاعب جديد في Firestore لأول مرة
function createNewPlayerProfile(user) {
    const db = firebase.firestore();
    db.collection('players').doc(user.uid).set({
        name: user.displayName || "قائد جديد",
        avatarUrl: user.photoURL || '',
        xp: 0,
        current_location: "morocco",
        nationality: "morocco",
        power: 0,
        education: 0,
        experience: 0,
        money: 5000,  // أموال افتراضية للبداية
        gold: 50,     // ذهب افتراضي للبداية
        activeTraining: null // لا يوجد تطوير حالي
    }, { merge: true });
}

// ==========================================
// 📈 معادلة المستوى وشريط الـ XP التباطئي
// ==========================================
function updateXPProgressBar(totalXP) {
    // معادلة المستوى التباطئية
    const currentLevel = Math.floor(Math.sqrt(totalXP / 100)) + 1;
    
    // حساب الـ XP المطلوب للمستوى الحالي والمستوى التالي
    const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
    const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
    
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    
    // حساب النسبة المئوية للامتلاء
    const progressPercent = (xpInCurrentLevel / xpNeededForNext) * 100;

    // تحديث الواجهة
    const levelDisplay = document.getElementById('profile-level-number');
    const progressBar = document.getElementById('profile-xp-bar');
    const progressText = document.getElementById('profile-xp-text');

    if (levelDisplay) levelDisplay.textContent = `المستوى ${currentLevel}`;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${Math.floor(xpInCurrentLevel)} / ${xpNeededForNext} XP`;
}

// ==========================================
// 🔄 قوائم التطوير المنزلقة (Dropdowns) والأسعار
// ==========================================
function setupStatDropdowns() {
    const stats = ['power', 'education', 'experience'];
    
    stats.forEach(stat => {
        const header = document.getElementById(`stat-${stat}-header`);
        const dropdown = document.getElementById(`stat-${stat}-dropdown`);
        
        if (header && dropdown) {
            // نتحقق من عدم تكرار إضافة الـ EventListeners لضمان عدم حدوث وميض في القوائم
            if (!header.dataset.listenerAdded) {
                header.addEventListener('click', () => {
                    // إغلاق باقي القوائم المفتوحة أولاً
                    stats.forEach(s => {
                        if (s !== stat) document.getElementById(`stat-${s}-dropdown`)?.classList.remove('open');
                    });
                    
                    // تبديل حالة القائمة الحالية
                    dropdown.classList.toggle('open');
                    
                    // تحديث الأسعار والوقت بناءً على المستوى الحالي للعنصر
                    if (dropdown.classList.contains('open') && localPlayerData) {
                        updateDropdownPrices(stat);
                    }
                });
                header.dataset.listenerAdded = true;
            }
        }
    });
}

// تحديث نصوص الأسعار والأوقات داخل صندوق التطوير المفتوح
function updateDropdownPrices(stat) {
    const currentStatLevel = localPlayerData[stat] || 0;
    
    // حساب التكلفة (تزداد تصاعدياً مع كل مستوى)
    const moneyCost = (currentStatLevel + 1) * 1000;
    const goldCost = (currentStatLevel + 1) * 5;
    const timeInSeconds = (currentStatLevel + 1) * 30;

    const moneyBtn = document.getElementById(`cost-${stat}-money`);
    const goldBtn = document.getElementById(`cost-${stat}-gold`);
    const timeTxt = document.getElementById(`time-${stat}`);

    if (moneyBtn) moneyBtn.textContent = `${moneyCost} مال`;
    if (goldBtn) goldBtn.textContent = `${goldCost} ذهب`;
    if (timeTxt) {
        if (localPlayerData.activeTraining && localPlayerData.activeTraining.stat === stat) {
            timeTxt.textContent = `جاري ترقيتها الآن...`;
        } else {
            timeTxt.textContent = `الوقت: ${timeInSeconds} ثانية`;
        }
    }
}

// ==========================================
// ⚙️ معالجة عمليات التطوير (بالمال أو الذهب)
// ==========================================
function startStatUpgrade(statName, currencyType) {
    if (!localPlayerData) return;

    // شرط أساسي: التأكد من عدم وجود تطوير آخر قيد التنفيذ حالياً
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
        if ((localPlayerData.money || 0) < moneyCost) { return alert("🔴 لا تملك المال الكافي!"); }
        updates['money'] = firebase.firestore.FieldValue.increment(-moneyCost);
    } else if (currencyType === 'gold') {
        if ((localPlayerData.gold || 0) < goldCost) { return alert("🔴 لا تملك الذهب الكافي!"); }
        updates['gold'] = firebase.firestore.FieldValue.increment(-goldCost);
        timeInSeconds = Math.floor(timeInSeconds / 2); // ميزة: التطوير بالذهب يقلل الوقت للنصف!
    }

    // تسجيل بيانات التطوير النشط ووقت الانتهاء
    const finishTime = Date.now() + (timeInSeconds * 1000);
    updates['activeTraining'] = {
        stat: statName,
        finishAt: finishTime
    };

    db.collection('players').doc(user.uid).update(updates)
        .then(() => {
            // إغلاق القائمة بعد بدء التطوير مباشرة لتجميل مظهر الواجهة
            document.getElementById(`stat-${statName}-dropdown`)?.classList.remove('open');
        })
        .catch(err => console.error(err));
}

// فحص وإدارة العداد التنازلي للتطوير النشط
function checkActiveTraining(data) {
    const timerDisplay = document.getElementById('training-global-timer');
    if (!timerDisplay) return;

    if (!data.activeTraining) {
        timerDisplay.style.display = 'none';
        if (trainingTimeout) clearTimeout(trainingTimeout);
        return;
    }

    const now = Date.now();
    const timeLeft = data.activeTraining.finishAt - now;

    // تحديد الاسم المترجم للعنصر الجاري تطويره لعرضه باللغة العربية
    let arabicStatName = "عنصر";
    if (data.activeTraining.stat === 'power') arabicStatName = "القوة القتالية";
    if (data.activeTraining.stat === 'education') arabicStatName = "مستوى التعليم";
    if (data.activeTraining.stat === 'experience') arabicStatName = "نقاط الخبرة";

    if (timeLeft <= 0) {
        // انتهى الوقت تماماً! نقوم بترقية العنصر وتصفير مؤقت التدريب بقاعدة البيانات
        timerDisplay.style.display = 'none';
        if (trainingTimeout) clearTimeout(trainingTimeout);
        completeUpgrade(data.activeTraining.stat);
    } else {
        // تحديث العداد التنازلي المطور على شاشة اللاعب
        timerDisplay.style.display = 'block';
        timerDisplay.textContent = `⏳ جاري تطوير [${arabicStatName}]: متبقي ${Math.ceil(timeLeft / 1000)} ثانية`;
        
        if (trainingTimeout) clearTimeout(trainingTimeout);
        trainingTimeout = setTimeout(() => checkActiveTraining(data), 1000);
    }
}

// إنهاء الترقية، وإضافة النقطة للاعب، وإعطائه XP مكافأة على التطوير
function completeUpgrade(statName) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();
    db.collection('players').doc(user.uid).update({
        [statName]: firebase.firestore.FieldValue.increment(1),
        xp: firebase.firestore.FieldValue.increment(25), // منحه 25 XP مكافأة الترقية
        activeTraining: null // تفريغ خانة التطوير النشط
    }).then(() => {
        alert(`🎉 تهانينا القائد! تم ترقية العنصر بنجاح وحصلت على +25 XP.`);
    }).catch(err => console.error("خطأ أثناء إغلاق الترقية:", err));
}

// ==========================================
// ⚙️ معالجة نافذة الإعدادات وحفظ البيانات
// ==========================================

// فتح نافذة الإعدادات وتعبئة الحقول بالقيم الحالية
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const nameInput = document.getElementById('settings-name-input');
    const avatarUrlInput = document.getElementById('settings-avatar-url-input');

    if (modal && localPlayerData) {
        if (nameInput) nameInput.value = localPlayerData.name || "";
        if (avatarUrlInput) avatarUrlInput.value = localPlayerData.avatarUrl || "";
        modal.style.display = 'flex';
    }
}

// إغلاق نافذة الإعدادات
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

// حفظ الاسم وصورة البروفايل عبر رابط الـ URL المباشر
function savePlayerSettings() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const newName = document.getElementById('settings-name-input').value.trim();
    const newAvatarUrl = document.getElementById('settings-avatar-url-input').value.trim();
    const saveBtn = document.getElementById('save-settings-btn');

    if (newName === "") {
        alert("⚠️ لا يمكن أن يكون اسم القائد فارغاً!");
        return;
    }

    if (saveBtn) saveBtn.disabled = true;

    // تجهيز كائن التحديث لقاعدة البيانات بالاسم والرابط الجديد
    const updatedData = {
        name: newName,
        avatarUrl: newAvatarUrl
    };

    firebase.firestore().collection('players').doc(user.uid).update(updatedData)
        .then(() => {
            alert("🎉 تم تحديث وحفظ بيانات ملفك الشخصي بنجاح!");
            if (saveBtn) saveBtn.disabled = false;
            closeSettingsModal();
        })
        .catch((error) => {
            console.error("خطأ أثناء تحديث الإعدادات:", error);
            alert("🔴 حدث خطأ أثناء الحفظ، يرجى المحاولة مجدداً.");
            if (saveBtn) saveBtn.disabled = false;
        });
}

// الاستماع لـ Auth عند جهوزية الـ DOM لتشغيل النظام بشكل آمن تلقائياً
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // تشغيل النظام بمجرد التحقق من وجود مستخدم مسجل الدخول بنجاح
            initProfileSystem();
        } else {
            console.log("المستخدم غير مسجل الدخول حالياً.");
        }
    });
});