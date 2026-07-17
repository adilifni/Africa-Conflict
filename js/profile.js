// ==========================================
// 👤 نظام إدارة حساب اللاعب، المستويات، والتطوير
// ==========================================

// المتغير العالمي لتخزين بيانات اللاعب الحالية محلياً لتسهيل الحسابات
let localPlayerData = null;
let trainingTimeout = null;

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

        // 1. تحديث الصورة والاسم
        const profileImg = document.getElementById('profile-avatar');
        if (profileImg) profileImg.src = data.avatarUrl || user.photoURL || 'https://via.placeholder.com/150';
        
        const profileName = document.getElementById('profile-name-display');
        if (profileName) profileName.textContent = data.name || user.displayName || "قائد مجهول";

        // 2. تحديث شريط المستوى (XP)
        updateXPProgressBar(data.xp || 0);

// تحديث أرقام الذهب والمال الحية من Firestore بدون كلمات إضافية
const goldDisplay = document.getElementById('profile-gold-display');
const moneyDisplay = document.getElementById('profile-money-display');

if (goldDisplay) goldDisplay.textContent = data.gold !== undefined ? data.gold : 0;
if (moneyDisplay) moneyDisplay.textContent = data.money !== undefined ? data.money : 0;

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

        // 4. تحديث الأرقام الأساسية (القوة، التعليم، الخبرة)
        document.getElementById('stat-power-val').textContent = data.power || 0;
        document.getElementById('stat-education-val').textContent = data.education || 0;
        document.getElementById('stat-experience-val').textContent = data.experience || 0;

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
    // معادلة المستوى التباطئية: كل مستوى يحتاج XP أكثر من الذي قبله
    // المستوى = الجذر التربعي لـ (XP / 100) + 1
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
            header.addEventListener('click', () => {
                // إغلاق باقي القوائم المفتوحة أولاً
                stats.forEach(s => {
                    if (s !== stat) document.getElementById(`stat-${s}-dropdown`)?.classList.remove('open');
                });
                // تبديل حالة القائمة الحالية
                dropdown.classList.toggle('open');
                
                // تحديث الأسعار والوقت بناءً على المستوى الحالي للعنصر
                if (dropdown.classList.contains('open') && localPlayerData) {
                    const currentStatLevel = localPlayerData[stat] || 0;
                    
                    // حساب التكلفة (تزداد تصاعدياً مع كل مستوى)
                    const moneyCost = (currentStatLevel + 1) * 1000;
                    const goldCost = (currentStatLevel + 1) * 5;
                    const timeInSeconds = (currentStatLevel + 1) * 30; // 30 ثانية لكل مستوى كمثال

                    document.getElementById(`cost-${stat}-money`).textContent = `${moneyCost} مال`;
                    document.getElementById(`cost-${stat}-gold`).textContent = `${goldCost} ذهب`;
                    document.getElementById(`time-${stat}`).textContent = `الوقت: ${timeInSeconds} ثانية`;
                }
            });
        }
    });
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
        .then(() => alert(`⏳ بدأ تطوير ${statName} الآن...`))
        .catch(err => console.error(err));
}

// فحص وإدارة العداد التنازلي للتطوير
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

    if (timeLeft <= 0) {
        // انتهى الوقت! نقوم بترقية العنصر وتصفير مؤقت التدريب بقاعدة البيانات
        timerDisplay.style.display = 'none';
        completeUpgrade(data.activeTraining.stat);
    } else {
        // تحديث العداد التنازلي على الشاشة
        timerDisplay.style.display = 'block';
        timerDisplay.textContent = `جاري تطوير ${data.activeTraining.stat}: ${Math.ceil(timeLeft / 1000)} ثانية متبقية`;
        
        if (trainingTimeout) clearTimeout(trainingTimeout);
        trainingTimeout = setTimeout(() => checkActiveTraining(data), 1000);
    }
}

// إنهاء الترقية وإضافة النقطة للاعب
function completeUpgrade(statName) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();
    db.collection('players').doc(user.uid).update({
        [statName]: firebase.firestore.FieldValue.increment(1),
        activeTraining: null // تفريغ الخانة للسماح بتطوير جديد
    }).then(() => {
        alert(`🎉 تهانينا! تم ترقية ${statName} بنجاح.`);
    });
}

// تغيير اسم اللاعب من الإعدادات
function changePlayerName(newName) {
    const trimmedName = newName.trim();
    if (trimmedName === "") return alert("الاسم لا يمكن أن يكون فارغاً");

    const user = firebase.auth().currentUser;
    if (!user) return;

    firebase.firestore().collection('players').doc(user.uid).update({
        name: trimmedName
    }).then(() => alert("تم تحديث الاسم بنجاح"));
}


// فتح نافذة الإعدادات وتعبئة الحقول بالاسم الحالي للاعب
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const nameInput = document.getElementById('settings-name-input');
    const fileInput = document.getElementById('settings-file-input');
    const statusText = document.getElementById('upload-status');

    if (modal && localPlayerData) {
        if (nameInput) nameInput.value = localPlayerData.name || "";
        if (fileInput) fileInput.value = ""; // إعادة تصغير خانة الملفات
        if (statusText) statusText.style.display = 'none';
        modal.style.display = 'flex';
    }
}

// إغلاق نافذة الإعدادات
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

// حفظ الاسم وصورة البروفايل (سواء المرفوعة حديثاً أو القديمة)
async function savePlayerSettings() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const newName = document.getElementById('settings-name-input').value.trim();
    const fileInput = document.getElementById('settings-file-input');
    const statusText = document.getElementById('upload-status');
    const saveBtn = document.getElementById('save-settings-btn');

    if (newName === "") {
        alert("⚠️ لا يمكن أن يكون اسم القائد فارغاً!");
        return;
    }

    // تجهيز كائن البيانات المحدثة الأساسي
    const updatedData = {
        name: newName
    };

    // التحقق مما إذا كان اللاعب قد اختار صورة جديدة لتحميلها
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // حماية حجم الملف (مثلاً أقصى حجم 2 ميجابايت)
        if (file.size > 2 * 1024 * 1024) {
            alert("❌ حجم الصورة كبير جداً! يرجى اختيار صورة أقل من 2 ميجابايت.");
            return;
        }

        // إظهار حالة الرفع وقفل زر الحفظ أثناء العملية
        if (statusText) {
            statusText.style.display = 'block';
            statusText.style.color = '#f6ad55';
            statusText.textContent = "⏳ جاري رفع الصورة إلى السيرفر...";
        }
        if (saveBtn) saveBtn.disabled = true;

        try {
            // إنشاء مسار فريد للملف داخل Firebase Storage
            const storageRef = firebase.storage().ref().child(`avatars/${user.uid}_${Date.now()}`);
            
            // رفع الملف
            const snapshot = await storageRef.put(file);
            
            // جلب رابط الصورة المباشر بعد انتهاء الرفع
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // إضافة رابط الصورة الجديد للبيانات المحدثة
            updatedData.avatarUrl = downloadURL;

        } catch (error) {
            console.error("خطأ أثناء رفع الملف:", error);
            alert("🔴 فشل رفع الصورة، سيتم حفظ الاسم فقط.");
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    // حفظ التحديثات النهائية في Firestore (الاسم ورابط الصورة إن وُجد)
    firebase.firestore().collection('players').doc(user.uid).update(updatedData)
        .then(() => {
            alert("🎉 تم تحديث وحفظ بيانات ملفك الشخصي بنجاح!");
            if (saveBtn) saveBtn.disabled = false;
            closeSettingsModal();
        })
        .catch((error) => {
            console.error("خطأ أثناء تحديث الإعدادات:", error);
            alert("🔴 حدث خطأ أثناء الحفظ.");
            if (saveBtn) saveBtn.disabled = false;
        });
}



    // تجهيز كائن التحديث لقاعدة البيانات
    const updatedData = {
        name: newName,
        avatarUrl: newAvatarUrl
    };

    firebase.firestore().collection('players').doc(user.uid).update(updatedData)
        .then(() => {
            alert("🎉 تم تحديث وحفظ بيانات الملف الشخصي بنجاح!");
            closeSettingsModal();
        })
        .catch((error) => {
            console.error("خطأ أثناء تحديث الإعدادات:", error);
            alert("🔴 حدث خطأ أثناء الحفظ، يرجى المحاولة مجدداً.");
        });
}



document.addEventListener('DOMContentLoaded', () => {
    // ننتظر ثانية واحدة حتى يتأكد المتصفح من وجود حساب الجيميل النشط
    setTimeout(initProfileSystem, 1000);
});