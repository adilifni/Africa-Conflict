// ==========================================
// 🎮 نظام اللعبة الأساسي والتواصل مع Firestore
// ==========================================
import { africanCountries } from './config.js';
import { formatTimeShort } from './app.js';

let localPlayerData = null;
let trainingInterval = null; 
let isUpgradingNow = false;  

// ==========================================
// ⚙️ إعدادات نظام التطوير المتصاعد (Upgrade Engine)
// عدّل هذه الثوابت وحدها لضبط سرعة/تكلفة اللعبة بالكامل
// ==========================================
const STAT_CONFIG = {
    power:     { baseMoney: 100, baseGold: 5,  label: '💪 القوة القتالية' },
    education: { baseMoney: 200, baseGold: 10, label: '📚 مستوى التعليم' },
    energy:    { baseMoney: 50,  baseGold: 2,  label: '⚡ مستوى الطاقة' }
};

const TIME_BASE_MINUTES = 3;    // الوقت اللازم لترقية المستوى 1 (بالمال)
const TIME_EXPONENT     = 1.55; // معدل تسارع الوقت مع ارتفاع المستوى
const COST_EXPONENT     = 1.5;  // معدل تسارع السعر مع ارتفاع المستوى

// ==========================================
// ☁️ رفع الصور عبر Cloudinary (بديل Firebase Storage - لا يتطلب خطة Blaze)
// ==========================================
const CLOUDINARY_CLOUD_NAME = 'ضع_اسم_حسابك_هنا';       // مثال: 'dxyzabc12'
const CLOUDINARY_UPLOAD_PRESET = 'ضع_اسم_البريست_هنا';   // مثال: 'africa_conflict_uploads'

async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData, signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errBody = await response.json().catch(() => null);
            throw new Error(errBody?.error?.message || 'فشل رفع الصورة إلى Cloudinary');
        }

        const data = await response.json();
        return data.secure_url;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('انتهت مهلة رفع الصورة، تحقق من اتصالك بالإنترنت');
        }
        throw err;
    }
}

// ==========================================
// ⚙️ إعدادات نظام العمل والمصانع (Work System)
// ==========================================
const WORK_ENERGY_REGEN_AMOUNT = 10;  // كمية الاسترجاع في كل دورة
const WORK_ENERGY_REGEN_MINUTES = 10; // كل كم دقيقة يسترجع مشروب الطاقة
const MIN_ENERGY_TO_WORK = 10;        // الحد الأدنى من الطاقة اللازم لتنفيذ عملية عمل واحدة

// سعة مخزون مشروب الطاقة: 100 أساس + 5 عن كل 50 مستوى من مستوى الطاقة
function getWorkEnergyCap(energyLevel) {
    const lvl = energyLevel ?? 1;
    return 100 + Math.floor(lvl / 50) * 5;
}

// أنواع الموارد المتاحة لاختيار نوع المصنع عند الإنشاء (لا يمكن تغييرها بعد الإنشاء)
const RESOURCE_TYPES = {
    gold:    { label: 'ذهب',  icon: '🪙' },
    iron:    { label: 'حديد', icon: '⚙️' },
    wheat:   { label: 'قمح',  icon: '🌾' },
    diamond: { label: 'ماس',  icon: '💎' }
};

// تكلفة فتح مصنع جديد (ثابتة بغض النظر عن نوع المصنع المختار) — تُخصم من محفظة اللاعب الشخصية
const FACTORY_OPEN_COST = { gold: 50, iron: 100, money: 1000, oil: 2000 };

// نصيب اللاعب من ضغطة العمل: كل 10 طاقة تُستهلك = 1 وحدة مورد (الضغطة تستهلك كل الطاقة الحالية دفعة واحدة)
function getPlayerWorkYield(energyAmount) {
    return Math.floor(energyAmount / 10);
}

// معدل إنتاج المصنع نفسه لكل 100 طاقة متراكمة من كل العمال: يزيد وحدة واحدة كل 10 مستويات
function getFactoryRatePer100Energy(level) {
    const lvl = level ?? 1;
    return Math.floor(lvl / 10) + 1;
}

// تكلفة تطوير المصنع مستوى واحد (من نفس نوع مورد المصنع، من محفظة صاحب المصنع الشخصية)
function getFactoryUpgradeCost(level) {
    const lvl = level ?? 1;
    return 50 * lvl;
}

// سعر بيع المصنع المقترح (يزيد كل ما ارتفع المستوى) — يُستخدم لاحقاً في صفحة البيع
function getFactorySalePrice(level) {
    const lvl = level ?? 1;
    return 500 * lvl;
}

let currentFactoriesCache = [];
let unsubscribeCountryResources = null;
let unsubscribeFactoriesList = null;
let lastSubscribedWorkLocation = null;
let selectedFactoryFile = null;
let editingFactoryId = null;

// المستوى الحالي للمهارة (عداد مستقل عن القيمة المعروضة للمهارة نفسها)
function getStatLevel(data, statName) {
    return data[`${statName}Level`] ?? 1;
}

// حساب الوقت اللازم بالثواني للترقية عبر المال
function calcUpgradeTimeSeconds(level) {
    return Math.round(TIME_BASE_MINUTES * 60 * Math.pow(level, TIME_EXPONENT));
}

// حساب السعر (مال أو ذهب) حسب المستوى الحالي
function calcUpgradeCost(level, baseAmount) {
    return Math.round(baseAmount * Math.pow(level, COST_EXPONENT));
}

export function initGameSystem() {
    const userNameSpan = document.getElementById('user-name');
    if (!userNameSpan) return;

    function waitForFirebase() {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
            const db = firebase.firestore();

            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    const userUid = user.uid;
                    
                    db.collection('players').doc(userUid).onSnapshot((doc) => {
                        if (!doc.exists) {
                            createNewPlayerProfile(user);
                            return;
                        }

                        const data = doc.data();
                        localPlayerData = data;

                        if (data) {
                            startLiveCounters(data.residence_country || "morocco", data.current_location || "morocco");
                        }
                        
                        let playerName = data.name || user.displayName || user.email.split('@')[0];
                        playerName = playerName.replace(/قائد/g, '').replace(/مجهول/g, '').trim();
                        
                        userNameSpan.textContent = playerName || "قائد";
                        const profileNameDisp = document.getElementById('profile-name-display');
                        if (profileNameDisp) profileNameDisp.textContent = playerName || "قائد مجهول";

                        const profileImg = document.getElementById('profile-avatar');
                        if (profileImg) profileImg.src = data.photo || data.avatarUrl || user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + userUid;
                        
                        const profileMoneyVal = document.getElementById('profile-money-val');
                        if (profileMoneyVal) profileMoneyVal.textContent = data.money ?? 0;

                        const profileGoldVal = document.getElementById('profile-gold-val');
                        if (profileGoldVal) profileGoldVal.textContent = data.gold ?? 0;

                        updateXPProgressBar(data.experience ?? 1);

                        const currentLoc = data.current_location || "morocco";
                        updateCountryBlockOnScreen(currentLoc);

                        const nationalityText = document.getElementById('profile-nationality');
                        if (nationalityText) {
                            const nation = data.nationality || data.residence_country || "morocco";
                            nationalityText.textContent = africanCountries[nation]?.name || "لم تحدد";
                        }

                        if (document.getElementById('stat-power-val')) {
                            document.getElementById('stat-power-val').textContent = data.power ?? 1;
                        }
                        if (document.getElementById('stat-education-val')) {
                            document.getElementById('stat-education-val').textContent = data.education ?? 1;
                        }
                        if (document.getElementById('stat-energy-val')) {
                            document.getElementById('stat-energy-val').textContent = data.energy ?? 1;
                        }
                        if (document.getElementById('stat-energy-level-val')) {
                            document.getElementById('stat-energy-level-val').textContent = data.energy ?? 1;
                        }

                        // تحديث أسعار وأزمنة الترقية المعروضة بناءً على المستوى الحالي لكل مهارة
                        refreshUpgradeCards(data);

                        checkActiveTraining(data);
                        handleWorkViewUpdate(data);
                    });

                    db.collection('players').doc(userUid).update({
                        isOnline: true,
                        lastActive: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(err => console.error("Error setting online status:", err));

                    window.addEventListener('beforeunload', () => {
                        db.collection('players').doc(userUid).update({ isOnline: false });
                    });

                } else {
                    userNameSpan.textContent = "زائر";
                }
            });

            db.collection('players').onSnapshot((snapshot) => {
                const totalPlayers = snapshot.size; 
                let onlinePlayers = 0;

                snapshot.forEach((doc) => {
                    if (doc.data().isOnline === true) onlinePlayers++;
                });

                if (onlinePlayers === 0 && firebase.auth().currentUser) onlinePlayers = 1;

                updateStatsOnScreen(totalPlayers, onlinePlayers);
            }, (error) => {
                console.error("خطأ أثناء جلب إحصائيات اللاعبين:", error);
            });

            // ربط الدوال بالنافذة لكي تعمل مباشرة من ملف الـ HTML عند الحاجة
            window.startStatUpgrade = startStatUpgrade;
            window.travelToCountry = travelToCountry;
            window.changePlayerName = changePlayerName;
            window.saveProfileChanges = saveProfileChanges;
            window.doWork = doWork;
            window.openFactoryModal = openFactoryModal;
            window.closeFactoryModal = closeFactoryModal;
            window.saveFactory = saveFactory;
            window.addFactoryBalance = addFactoryBalance;
            window.upgradeFactory = upgradeFactory;
            window.withdrawFactoryStock = withdrawFactoryStock;
            window.sellFactory = sellFactory;
            window.closeFactoryPermanently = closeFactoryPermanently;

        } else {
            setTimeout(waitForFirebase, 100);
        }
    }
    waitForFirebase();
}

function startLiveCounters(playerCountry, playerRegion) {
    const db = firebase.firestore();

    db.collection('players').onSnapshot((snapshot) => {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000; 

        let globalPopulation = 0;
        let globalOnline = 0;
        let countryPopulation = 0;
        let countryOnline = 0;

        const normalizeCountry = (text) => {
            const clean = String(text || "").trim().toLowerCase();
            if (clean === "morocco" || clean === "المغرب") return "morocco";
            return clean;
        };

        const pCountryClean = normalizeCountry(playerCountry);
        const pRegionClean = normalizeCountry(playerRegion);

        snapshot.forEach((doc) => {
            const data = doc.data();
            globalPopulation++; 

            let lastActiveTime = 0;
            if (data.lastActive) {
                lastActiveTime = typeof data.lastActive.toDate === 'function' 
                    ? data.lastActive.toDate().getTime() 
                    : data.lastActive;
            }
            const timeDiff = now - lastActiveTime;
            
            const isUserGloballyOnline = data.isOnline === true && timeDiff <= fiveMinutes;

            if (isUserGloballyOnline) {
                globalOnline++;
            }

            const userLocation = normalizeCountry(data.current_location);
            const userResidence = normalizeCountry(data.residence_country || data.nationality);

            if ((userLocation !== "" && userLocation === pRegionClean) || 
                (userResidence !== "" && userResidence === pCountryClean)) {
                countryPopulation++;
            }

            if (isUserGloballyOnline && userLocation !== "" && userLocation === pRegionClean) {
                countryOnline++;
            }
        });

        const gPop = document.getElementById('global-pop-val');
        const gOnline = document.getElementById('global-online-val');
        const cPop = document.getElementById('country-pop-val');
        const cOnline = document.getElementById('country-online-val');

        if (gPop) gPop.textContent = globalPopulation;
        if (gOnline) gOnline.textContent = globalOnline;
        if (cPop) cPop.textContent = countryPopulation;
        if (cOnline) cOnline.textContent = countryOnline;
    });
}

function createNewPlayerProfile(user) {
    const db = firebase.firestore();
    db.collection('players').doc(user.uid).set({
        name: user.displayName || "قائد جديد",
        avatarUrl: user.photoURL || '',
        experience: 1,      
        current_location: "morocco",
        residence_country: "morocco",
        nationality: "morocco",
        power: 1,
        education: 1,
        energy: 1,
        powerLevel: 1,
        educationLevel: 1,
        energyLevel: 1,
        money: 1000, 
        gold: 23230,      
        activeTraining: null 
    }, { merge: true });
}

function updateXPProgressBar(totalXP) {
    const currentLevel = Math.floor(Math.sqrt(totalXP / 100)) + 1;
    const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
    const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
    
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    
    const progressPercent = Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForNext) * 100));

    const levelDisplay = document.getElementById('profile-level-number');
    const progressBar = document.getElementById('profile-xp-bar');
    const progressText = document.getElementById('profile-xp-text');

    if (levelDisplay) levelDisplay.textContent = `المستوى ${currentLevel}`;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${Math.floor(totalXP)} / ${xpForNextLevel} XP`;
}

// تحديث نصوص الأزرار وزمن كل مهارة بناءً على مستواها الحالي
function refreshUpgradeCards(data) {
    Object.keys(STAT_CONFIG).forEach(statName => {
        const config = STAT_CONFIG[statName];
        const level = getStatLevel(data, statName);

        const moneyCost = calcUpgradeCost(level, config.baseMoney);
        const goldCost = calcUpgradeCost(level, config.baseGold);
        const moneyTimeSec = calcUpgradeTimeSeconds(level);
        const goldTimeSec = Math.round(moneyTimeSec / 2);

        const moneyBtn = document.querySelector(`.btn-upgrade-action[data-skill="${statName}"][data-currency="money"]`);
        const goldBtn = document.querySelector(`.btn-upgrade-action[data-skill="${statName}"][data-currency="gold"]`);
        const timeLabel = document.getElementById(`time-${statName}`);

        // الوقت الآن داخل نص الزر نفسه حتى يقارن اللاعب بسهولة بين خيار المال والذهب
        if (moneyBtn) moneyBtn.innerHTML = `${moneyCost} مال<br><span style="font-size:11px; font-weight:normal; opacity:0.85;">⏱ ${formatTimeShort(moneyTimeSec * 1000)}</span>`;
        if (goldBtn) goldBtn.innerHTML = `${goldCost} ذهب<br><span style="font-size:11px; font-weight:normal; opacity:0.85;">⏱ ${formatTimeShort(goldTimeSec * 1000)}</span>`;
        if (timeLabel) {
            timeLabel.textContent = `المستوى ${level} ⬅ ${level + 1}`;
        }
    });
}

export function startStatUpgrade(statName, currencyType) {
    if (!localPlayerData) return;
    const config = STAT_CONFIG[statName];
    if (!config) return;

    if (localPlayerData.activeTraining) {
        alert("⚠️ هناك عملية تطوير جارية بالفعل! انتظر حتى تنتهي قبل تطوير مهارة أخرى.");
        return;
    }

    const currentLevel = getStatLevel(localPlayerData, statName);
    const moneyCost = calcUpgradeCost(currentLevel, config.baseMoney);
    const goldCost = calcUpgradeCost(currentLevel, config.baseGold);
    const moneyTimeSec = calcUpgradeTimeSeconds(currentLevel);
    const goldTimeSec = Math.round(moneyTimeSec / 2);

    const user = firebase.auth().currentUser;
    const db = firebase.firestore();
    const updates = {};
    let timeInSeconds;

    if (currencyType === 'money') {
        if ((localPlayerData.money ?? 0) < moneyCost) { return alert("🔴 لا تملك المال الكافي!"); }
        updates['money'] = firebase.firestore.FieldValue.increment(-moneyCost);
        timeInSeconds = moneyTimeSec;
    } else if (currencyType === 'gold') {
        if ((localPlayerData.gold ?? 0) < goldCost) { return alert("🔴 لا تملك الذهب الكافي!"); }
        updates['gold'] = firebase.firestore.FieldValue.increment(-goldCost);
        timeInSeconds = goldTimeSec;
    } else {
        return;
    }

    const finishTime = Date.now() + (timeInSeconds * 1000);
    updates['activeTraining'] = {
        stat: statName,
        finishAt: finishTime,
        nextLevel: currentLevel + 1
    };

    if (trainingInterval) clearInterval(trainingInterval);
    isUpgradingNow = false; 

    db.collection('players').doc(user.uid).update(updates)
        .then(() => alert(`⏳ بدأ تطوير مهارة ${config.label} الآن... (${formatTimeShort(timeInSeconds * 1000)})`))
        .catch(err => console.error(err));
}

function checkActiveTraining(data) {
    const stats = Object.keys(STAT_CONFIG);
    const hasActiveTraining = !!data.activeTraining;
    const activeStat = data.activeTraining ? data.activeTraining.stat : null;

    stats.forEach(stat => {
        const btnContainer = document.getElementById(`actions-${stat}`);
        const timerContainer = document.getElementById(`timer-container-${stat}`);
        const isThisStatActive = hasActiveTraining && activeStat === stat;

        if (timerContainer) timerContainer.style.display = isThisStatActive ? 'block' : 'none';
        if (btnContainer) btnContainer.style.display = isThisStatActive ? 'none' : 'flex';

        // تعطيل أزرار المهارات الأخرى بصرياً أثناء وجود تطوير جارٍ في مهارة مختلفة
        const moneyBtn = document.querySelector(`.btn-upgrade-action[data-skill="${stat}"][data-currency="money"]`);
        const goldBtn = document.querySelector(`.btn-upgrade-action[data-skill="${stat}"][data-currency="gold"]`);
        const shouldDisable = hasActiveTraining && !isThisStatActive;

        [moneyBtn, goldBtn].forEach(btn => {
            if (!btn) return;
            btn.disabled = shouldDisable;
            btn.style.opacity = shouldDisable ? '0.4' : '1';
            btn.style.cursor = shouldDisable ? 'not-allowed' : 'pointer';
        });
    });

    if (trainingInterval) clearInterval(trainingInterval);

    if (!hasActiveTraining) {
        isUpgradingNow = false;
        return;
    }

    const timerContainer = document.getElementById(`timer-container-${activeStat}`);
    const timerVal = document.getElementById(`timer-val-${activeStat}`);

    trainingInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = data.activeTraining.finishAt - now;

        if (timeLeft <= 0) {
            clearInterval(trainingInterval);
            if (timerContainer) timerContainer.style.display = 'none';
            
            if (!isUpgradingNow) {
                isUpgradingNow = true; 
                completeUpgrade(activeStat, data.activeTraining.nextLevel);
            }
        } else {
            if (timerVal) {
                timerVal.textContent = `متبقي: ⏳ ${formatTimeShort(timeLeft)}`;
            }
        }
    }, 1000);
}

function completeUpgrade(statName, nextLevel) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();
    const updates = {
        [statName]: firebase.firestore.FieldValue.increment(1),
        activeTraining: null
    };

    // ضبط المستوى بقيمة صريحة (وليس increment) حتى لا يتأثر بغياب الحقل في مستندات قديمة
    if (Number.isFinite(nextLevel)) {
        updates[`${statName}Level`] = nextLevel;
    } else {
        // توافق احتياطي في حال عدم توفر nextLevel لأي سبب
        updates[`${statName}Level`] = firebase.firestore.FieldValue.increment(1);
    }

    db.collection('players').doc(user.uid).update(updates).then(() => {
        isUpgradingNow = false; 
        const label = STAT_CONFIG[statName]?.label || statName;
        alert(`🎉 تهانينا! تم ترقية ${label} بنجاح.`);
    }).catch(err => {
        isUpgradingNow = false;
        console.error("خطأ أثناء إنهاء الترقية:", err);
    });
}

// ==========================================
// 💼 نظام العمل والمصانع
// ==========================================
function handleWorkViewUpdate(data) {
    const countryKey = data.current_location || "morocco";

    if (countryKey !== lastSubscribedWorkLocation) {
        lastSubscribedWorkLocation = countryKey;
        subscribeCountryResources(countryKey);
        subscribeFactoriesList(countryKey);
    }

    refreshSelectedFactoryDisplay(data);
    refreshWorkEnergyDisplay(data);
    refreshPlayerResourcesDisplay(data);
    maybeRegenWorkEnergy(data);
}

// عرض موارد اللاعب الشخصية (بلوك جديد)
function refreshPlayerResourcesDisplay(data) {
    setText('player-res-gold', data.gold ?? 0);
    setText('player-res-oil', data.oil ?? 0);
    setText('player-res-wheat', data.wheat ?? 0);
    setText('player-res-diamond', data.diamond ?? 0);
    setText('player-res-iron', data.iron ?? 0);
}

function subscribeCountryResources(countryKey) {
    if (unsubscribeCountryResources) unsubscribeCountryResources();

    const nameEl = document.getElementById('work-country-name');
    if (nameEl) nameEl.textContent = africanCountries[countryKey]?.name || "الدولة";

    unsubscribeCountryResources = firebase.firestore().collection('countries').doc(countryKey)
        .onSnapshot((doc) => {
            const resData = doc.exists ? doc.data() : {};
            setText('res-gold', resData.gold ?? 0);
            setText('res-oil', resData.oil ?? 0);
            setText('res-wheat', resData.wheat ?? 0);
            setText('res-diamond', resData.diamond ?? 0);
            setText('res-iron', resData.iron ?? 0);
        }, (err) => console.error("خطأ في جلب موارد الدولة:", err));
}

function subscribeFactoriesList(countryKey) {
    if (unsubscribeFactoriesList) unsubscribeFactoriesList();

    unsubscribeFactoriesList = firebase.firestore().collection('factories')
        .where('countryKey', '==', countryKey)
        .onSnapshot((snapshot) => {
            currentFactoriesCache = [];
            snapshot.forEach(doc => currentFactoriesCache.push({ id: doc.id, ...doc.data() }));
            renderFactoriesList();
            if (localPlayerData) refreshSelectedFactoryDisplay(localPlayerData);
        }, (err) => console.error("خطأ في جلب المصانع:", err));
}

function setText(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = value;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderFactoriesList() {
    const container = document.getElementById('factories-list-container');
    if (!container) return;

    if (currentFactoriesCache.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد مصانع بعد في هذه الدولة</p>';
        return;
    }

    container.innerHTML = '';
    const currentUid = firebase.auth().currentUser?.uid;

    currentFactoriesCache.forEach(factory => {
        const isMine = factory.ownerUid === currentUid;
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:10px;background:#0f1620;border:1px solid #2d3748;border-radius:10px;padding:10px;';

        const imgHtml = factory.imageUrl
            ? `<img src="${factory.imageUrl}" style="width:45px;height:45px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
            : `<div style="width:45px;height:45px;border-radius:8px;background:#2d3748;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏭</div>`;

        const resInfo = RESOURCE_TYPES[factory.resourceType];
        const workerCount = (factory.workers || []).length;

        card.innerHTML = `
            ${imgHtml}
            <div style="flex:1; min-width:0;">
                <div style="color:#fff;font-weight:bold;font-size:14px;">${escapeHtml(factory.name || 'مصنع بدون اسم')}</div>
                <div style="color:#a0aec0;font-size:12px;">المستوى ${factory.level ?? 1} · 💵 ${factory.wage ?? 0} / عملية</div>
                <div style="color:#a0aec0;font-size:12px;">${resInfo ? `${resInfo.icon} ${resInfo.label}` : '⚠️ نوع غير محدد'} · 👥 ${workerCount} عامل</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                <button class="btn-select-factory" data-factory-id="${factory.id}" style="background:#3182ce;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">اختيار</button>
                ${isMine ? `<button class="btn-edit-factory" data-factory-id="${factory.id}" style="background:#2d3748;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">تعديل</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-select-factory').forEach(btn => {
        btn.addEventListener('click', () => selectFactory(btn.getAttribute('data-factory-id')));
    });
    container.querySelectorAll('.btn-edit-factory').forEach(btn => {
        btn.addEventListener('click', () => {
            const factory = currentFactoriesCache.find(f => f.id === btn.getAttribute('data-factory-id'));
            if (factory) openFactoryModal(factory);
        });
    });
}

async function selectFactory(factoryId) {
    const user = firebase.auth().currentUser;
    if (!user || !localPlayerData) return;

    const db = firebase.firestore();
    const workerEntry = { uid: user.uid, name: (localPlayerData.name || "لاعب").trim() };
    const oldFactoryId = localPlayerData.selectedFactoryId;

    try {
        const batch = db.batch();

        if (oldFactoryId && oldFactoryId !== factoryId) {
            const oldFactory = currentFactoriesCache.find(f => f.id === oldFactoryId);
            if (oldFactory) {
                const oldWorkerEntry = { uid: user.uid, name: (oldFactory.workers || []).find(w => w.uid === user.uid)?.name || workerEntry.name };
                batch.update(db.collection('factories').doc(oldFactoryId), {
                    workers: firebase.firestore.FieldValue.arrayRemove(oldWorkerEntry)
                });
            }
        }

        batch.update(db.collection('factories').doc(factoryId), {
            workers: firebase.firestore.FieldValue.arrayUnion(workerEntry)
        });

        batch.update(db.collection('players').doc(user.uid), {
            selectedFactoryId: factoryId
        });

        await batch.commit();
    } catch (err) {
        console.error("خطأ أثناء اختيار المصنع:", err);
    }
}

function refreshSelectedFactoryDisplay(data) {
    const nameEl = document.getElementById('selected-factory-name');
    const wageEl = document.getElementById('selected-factory-wage');
    const imgEl = document.getElementById('selected-factory-img');
    if (!nameEl || !wageEl || !imgEl) return;

    const factory = currentFactoriesCache.find(f => f.id === data.selectedFactoryId);
    if (!factory) {
        nameEl.textContent = "لم يتم اختيار مصنع";
        wageEl.textContent = "اختر مصنعاً من القائمة أدناه";
        imgEl.style.display = 'none';
        return;
    }

    nameEl.textContent = factory.name || "مصنع";
    const resInfo = RESOURCE_TYPES[factory.resourceType];
    wageEl.textContent = `💵 ${factory.wage ?? 0} · المستوى ${factory.level ?? 1} · ينتج ${resInfo ? `${resInfo.icon} ${resInfo.label}` : '؟'}`;
    if (factory.imageUrl) {
        imgEl.src = factory.imageUrl;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
}

function refreshWorkEnergyDisplay(data) {
    const cap = getWorkEnergyCap(data.energyLevel);
    const current = Math.max(0, Math.min(data.workEnergy ?? cap, cap));

    setText('work-energy-text', `${current} / ${cap}`);
    const barEl = document.getElementById('work-energy-bar');
    if (barEl) barEl.style.width = `${(current / cap) * 100}%`;

    const btn = document.getElementById('btn-work-now');
    if (btn) {
        const notEnough = current < MIN_ENERGY_TO_WORK || !data.selectedFactoryId;
        btn.disabled = notEnough;
        btn.style.opacity = notEnough ? '0.5' : '1';
        btn.style.cursor = notEnough ? 'not-allowed' : 'pointer';

        const expectedYield = getPlayerWorkYield(current);
        btn.textContent = notEnough
            ? '🛠️ اعمل الآن'
            : `🛠️ اعمل الآن (يستهلك كل الطاقة ← ${expectedYield} مورد)`;
    }

    const regenTextEl = document.getElementById('work-energy-regen-text');
    if (regenTextEl) {
        if (current >= cap) {
            regenTextEl.textContent = "المخزون ممتلئ";
        } else {
            const last = data.workEnergyLastUpdate || Date.now();
            const cycleMs = WORK_ENERGY_REGEN_MINUTES * 60000;
            const elapsedInCycle = (Date.now() - last) % cycleMs;
            const msLeft = cycleMs - elapsedInCycle;
            const minutesLeft = Math.max(1, Math.ceil(msLeft / 60000));
            regenTextEl.textContent = `⏳ +${WORK_ENERGY_REGEN_AMOUNT} خلال ${minutesLeft} دقيقة`;
        }
    }
}

function maybeRegenWorkEnergy(data) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const cap = getWorkEnergyCap(data.energyLevel);

    // تهيئة الحقل لأول مرة لأي لاعب لا يملكه أصلاً
    if (data.workEnergy === undefined || data.workEnergyLastUpdate === undefined) {
        firebase.firestore().collection('players').doc(user.uid).update({
            workEnergy: data.workEnergy ?? cap,
            workEnergyLastUpdate: Date.now()
        }).catch(err => console.error(err));
        return;
    }

    if (data.workEnergy >= cap) return;

    const now = Date.now();
    const cycleMs = WORK_ENERGY_REGEN_MINUTES * 60000;
    const ticks = Math.floor((now - data.workEnergyLastUpdate) / cycleMs);

    if (ticks > 0) {
        const newValue = Math.min(cap, data.workEnergy + ticks * WORK_ENERGY_REGEN_AMOUNT);
        const newLast = data.workEnergyLastUpdate + ticks * cycleMs;

        firebase.firestore().collection('players').doc(user.uid).update({
            workEnergy: newValue,
            workEnergyLastUpdate: newLast
        }).catch(err => console.error(err));
    }
}

async function doWork() {
    const user = firebase.auth().currentUser;
    if (!user || !localPlayerData) return;

    const factory = currentFactoriesCache.find(f => f.id === localPlayerData.selectedFactoryId);
    if (!factory) { alert("⚠️ اختر مصنعاً أولاً من القائمة"); return; }

    const resourceType = factory.resourceType;
    const resourceConfig = RESOURCE_TYPES[resourceType];
    if (!resourceConfig) { alert("⚠️ نوع مورد المصنع غير محدد، تواصل مع صاحب المصنع لتعديله"); return; }

    const cap = getWorkEnergyCap(localPlayerData.energyLevel);
    const currentEnergy = localPlayerData.workEnergy ?? cap;
    if (currentEnergy < MIN_ENERGY_TO_WORK) {
        alert(`🔴 تحتاج ${MIN_ENERGY_TO_WORK} طاقة على الأقل للعمل! انتظر حتى يتجدد المخزون.`);
        return;
    }

    const db = firebase.firestore();
    const playerRef = db.collection('players').doc(user.uid);
    const factoryRef = db.collection('factories').doc(factory.id);
    const countryRef = db.collection('countries').doc(factory.countryKey);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const [playerDoc, factoryDoc, countryDoc] = await Promise.all([
                transaction.get(playerRef),
                transaction.get(factoryRef),
                transaction.get(countryRef)
            ]);

            const playerData = playerDoc.data() || {};
            const factoryData = factoryDoc.exists ? factoryDoc.data() : factory;
            const countryData = countryDoc.exists ? countryDoc.data() : {};

            const playerEnergyCap = getWorkEnergyCap(playerData.energyLevel);
            const spentEnergy = playerData.workEnergy ?? playerEnergyCap;
            if (spentEnergy < MIN_ENERGY_TO_WORK) {
                throw new Error(`تحتاج ${MIN_ENERGY_TO_WORK} طاقة على الأقل للعمل!`);
            }

            // نصيب اللاعب: كل 10 طاقة = 1 وحدة مورد، والضغطة تستهلك كل الطاقة الحالية دفعة واحدة
            const playerYield = getPlayerWorkYield(spentEnergy);

            const countryStock = countryData[resourceType] ?? 0;
            if (countryStock < playerYield) {
                throw new Error(`لا يوجد مخزون كافٍ من ${resourceConfig.label} في الدولة حالياً`);
            }

            // الأجرة تُدفع فقط لو رصيد المصنع كافٍ
            const wage = factory.wage || 0;
            const factoryBalance = factoryData.balance ?? 0;
            const wagePaid = (wage > 0 && factoryBalance >= wage) ? wage : 0;

            // إنتاج المصنع نفسه: يتراكم بالطاقة المُستهلكة، ويُصرف كل 100 طاقة تراكمية
            let factoryGain = 0;
            let newAccumulated = (factoryData.energyAccumulated ?? 0) + spentEnergy;
            const chunks = Math.floor(newAccumulated / 100);

            if (chunks > 0) {
                const ratePer100 = getFactoryRatePer100Energy(factoryData.level ?? 1);
                const potentialGain = chunks * ratePer100;
                const availableForFactory = Math.max(0, countryStock - playerYield);
                factoryGain = Math.min(potentialGain, availableForFactory);
                newAccumulated = newAccumulated % 100;
            }

            const countryDeduction = playerYield + factoryGain;

            transaction.update(countryRef, {
                [resourceType]: firebase.firestore.FieldValue.increment(-countryDeduction)
            });

            const factoryUpdates = { energyAccumulated: newAccumulated };
            if (wagePaid > 0) factoryUpdates.balance = firebase.firestore.FieldValue.increment(-wagePaid);
            if (factoryGain > 0) factoryUpdates.stock = firebase.firestore.FieldValue.increment(factoryGain);
            transaction.update(factoryRef, factoryUpdates);

            const playerUpdates = {
                workEnergy: 0 // الضغطة تستهلك كل الطاقة الحالية دفعة واحدة
            };
            if (playerYield > 0) {
                playerUpdates[resourceType] = firebase.firestore.FieldValue.increment(playerYield);
                // كل 10 طاقة مُستهلكة = 1 نقطة خبرة (نفس نسبة إنتاج المورد تماماً)
                playerUpdates.experience = firebase.firestore.FieldValue.increment(playerYield);
            }
            if (wagePaid > 0) playerUpdates.money = firebase.firestore.FieldValue.increment(wagePaid);
            transaction.update(playerRef, playerUpdates);

            return { playerYield, wagePaid, factoryGain };
        });

        let msg = result.playerYield > 0
            ? `${resourceConfig.icon} حصلت على ${result.playerYield} ${resourceConfig.label} + ⭐ ${result.playerYield} XP`
            : `لم تحصل على موارد (الطاقة غير كافية لإنتاج وحدة كاملة)`;
        if (result.wagePaid > 0) msg += ` + 💵 ${result.wagePaid} مال أجرة`;
        else if (factory.wage > 0) msg += `\n⚠️ المصنع بدون رصيد كافٍ لدفع الأجرة هذه المرة`;
        if (result.factoryGain > 0) msg += `\n🏭 المصنع حصل على ${result.factoryGain} ${resourceConfig.label} إضافية (إنتاج تراكمي)`;
        alert(msg);
    } catch (err) {
        console.error("خطأ أثناء العمل:", err);
        alert(`🔴 ${err.message || 'حدث خطأ أثناء تنفيذ العمل'}`);
    }
}

// نافذة إنشاء / تعديل مصنع
function openFactoryModal(existingFactory) {
    const modal = document.getElementById('factory-modal');
    const title = document.getElementById('factory-modal-title');
    const nameInput = document.getElementById('factory-name-input');
    const wageInput = document.getElementById('factory-wage-input');
    const typeInput = document.getElementById('factory-type-input');
    const previewImg = document.getElementById('factory-preview-img');
    const errorEl = document.getElementById('factory-modal-error');
    const balanceSection = document.getElementById('factory-balance-section');
    const balanceVal = document.getElementById('factory-balance-value');
    const workersSection = document.getElementById('factory-workers-section');
    const workersList = document.getElementById('factory-workers-list');
    const ownerActionsSection = document.getElementById('factory-owner-actions-section');
    const upgradeBtn = document.getElementById('factory-upgrade-btn');
    const withdrawBtn = document.getElementById('factory-withdraw-btn');
    const sellBtn = document.getElementById('factory-sell-btn');
    const closeFactoryBtn = document.getElementById('factory-close-btn');
    const openCostNote = document.getElementById('factory-open-cost-note');

    selectedFactoryFile = null;
    editingFactoryId = existingFactory ? existingFactory.id : null;

    if (errorEl) errorEl.textContent = '';
    if (title) title.textContent = existingFactory ? "تعديل المصنع" : "إنشاء مصنع جديد";
    if (nameInput) nameInput.value = existingFactory?.name || '';
    if (wageInput) wageInput.value = existingFactory?.wage || '';
    if (previewImg) previewImg.src = existingFactory?.imageUrl || '';

    // نوع المصنع: يُختار فقط عند الإنشاء، ويُقفل نهائياً بعد ذلك
    if (typeInput) {
        typeInput.value = existingFactory?.resourceType || '';
        typeInput.disabled = !!existingFactory;
    }
    if (openCostNote) {
        openCostNote.style.display = existingFactory ? 'none' : 'block';
    }

    const showOwnerTools = !!existingFactory;
    if (balanceSection) balanceSection.style.display = showOwnerTools ? 'block' : 'none';
    if (workersSection) workersSection.style.display = showOwnerTools ? 'block' : 'none';
    if (ownerActionsSection) ownerActionsSection.style.display = showOwnerTools ? 'flex' : 'none';

    if (showOwnerTools) {
        if (balanceVal) balanceVal.textContent = existingFactory.balance ?? 0;

        const workers = existingFactory.workers || [];
        if (workersList) {
            workersList.textContent = workers.length > 0
                ? workers.map(w => w.name).join('، ')
                : 'لا يوجد عمال حالياً';
        }

        const level = existingFactory.level ?? 1;
        const resInfo = RESOURCE_TYPES[existingFactory.resourceType];
        const upgradeCost = getFactoryUpgradeCost(level);
        if (upgradeBtn) upgradeBtn.textContent = `⬆️ تطوير المصنع (يكلف ${upgradeCost} ${resInfo?.label || ''} من محفظتك)`;
        if (withdrawBtn) withdrawBtn.textContent = `📤 سحب المخزون (${existingFactory.stock ?? 0} ${resInfo?.label || ''})`;
        if (sellBtn) sellBtn.textContent = `💰 بيع المصنع (السعر المقترح: ${getFactorySalePrice(level)} مال)`;
        if (closeFactoryBtn) closeFactoryBtn.style.display = 'block';
    }

    if (modal) modal.style.display = 'flex';
}

function closeFactoryModal() {
    const modal = document.getElementById('factory-modal');
    if (modal) modal.style.display = 'none';
    selectedFactoryFile = null;
    editingFactoryId = null;
    const fileInput = document.getElementById('factory-file-input');
    if (fileInput) fileInput.value = '';
    const typeInput = document.getElementById('factory-type-input');
    if (typeInput) typeInput.disabled = false;
}

function handleFactoryFileSelect(event) {
    const file = event.target.files[0];
    const errorEl = document.getElementById('factory-modal-error');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        if (errorEl) errorEl.textContent = 'الرجاء اختيار ملف صورة صالح';
        return;
    }
    if (file.size > 3 * 1024 * 1024) {
        if (errorEl) errorEl.textContent = 'حجم الصورة كبير جداً (الحد الأقصى 3MB)';
        return;
    }

    if (errorEl) errorEl.textContent = '';
    selectedFactoryFile = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const previewImg = document.getElementById('factory-preview-img');
        if (previewImg) previewImg.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

async function saveFactory() {
    const nameInput = document.getElementById('factory-name-input');
    const wageInput = document.getElementById('factory-wage-input');
    const typeInput = document.getElementById('factory-type-input');
    const errorEl = document.getElementById('factory-modal-error');
    const saveBtn = document.getElementById('save-factory-btn');

    const name = nameInput ? nameInput.value.trim() : '';
    const wage = wageInput ? parseInt(wageInput.value, 10) : NaN;
    const resourceType = typeInput ? typeInput.value : '';

    if (name === '') { if (errorEl) errorEl.textContent = 'اسم المصنع مطلوب'; return; }
    if (!Number.isFinite(wage) || wage <= 0) { if (errorEl) errorEl.textContent = 'أدخل أجرة عمل صحيحة (راتب العمال)'; return; }

    const user = firebase.auth().currentUser;
    if (!user || !localPlayerData) { if (errorEl) errorEl.textContent = 'حدث خطأ، أعد تحميل الصفحة'; return; }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...'; }
    if (errorEl) errorEl.textContent = '';

    try {
        const db = firebase.firestore();
        let imageUrl = null;

        if (selectedFactoryFile) {
            imageUrl = await uploadImageToCloudinary(selectedFactoryFile);
        }

        if (editingFactoryId) {
            // تعديل مصنع موجود: الاسم، الأجرة، الصورة فقط — نوع المصنع مقفل ولا يُرسل إطلاقاً
            const payload = { name, wage };
            if (imageUrl) payload.imageUrl = imageUrl;
            await db.collection('factories').doc(editingFactoryId).update(payload);
        } else {
            // إنشاء مصنع جديد: يتطلب اختيار نوع + توفر تكلفة الفتح كاملة في محفظة اللاعب
            if (!RESOURCE_TYPES[resourceType]) {
                throw new Error('اختر نوع المصنع (نوع المورد الذي ينتجه)');
            }

            const wallet = {
                gold: localPlayerData.gold ?? 0,
                iron: localPlayerData.iron ?? 0,
                money: localPlayerData.money ?? 0,
                oil: localPlayerData.oil ?? 0
            };
            const missing = Object.entries(FACTORY_OPEN_COST)
                .filter(([res, cost]) => wallet[res] < cost)
                .map(([res, cost]) => `${cost} ${res === 'money' ? 'مال' : RESOURCE_TYPES[res]?.label || res}`);

            if (missing.length > 0) {
                throw new Error(`لا تملك موارد كافية لفتح مصنع، ناقصك: ${missing.join('، ')}`);
            }

            const countryKey = localPlayerData.current_location || "morocco";
            const newFactoryRef = db.collection('factories').doc();
            const batch = db.batch();

            batch.set(newFactoryRef, {
                name, wage, resourceType, countryKey,
                ownerUid: user.uid,
                imageUrl: imageUrl || null,
                level: 1,
                balance: 0,
                stock: 0,
                energyAccumulated: 0,
                workers: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            batch.update(db.collection('players').doc(user.uid), {
                gold: firebase.firestore.FieldValue.increment(-FACTORY_OPEN_COST.gold),
                iron: firebase.firestore.FieldValue.increment(-FACTORY_OPEN_COST.iron),
                money: firebase.firestore.FieldValue.increment(-FACTORY_OPEN_COST.money),
                oil: firebase.firestore.FieldValue.increment(-FACTORY_OPEN_COST.oil)
            });

            await batch.commit();
        }

        closeFactoryModal();
    } catch (err) {
        console.error("خطأ أثناء حفظ المصنع:", err);
        if (errorEl) errorEl.textContent = `فشل الحفظ: ${err.message || err.code || 'خطأ غير معروف'}`;
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'حفظ'; }
    }
}

// إضافة رصيد لصندوق أجور المصنع (من مال صاحب المصنع الشخصي)
async function addFactoryBalance() {
    const errorEl = document.getElementById('factory-modal-error');
    const amountInput = document.getElementById('factory-balance-amount-input');
    const balanceVal = document.getElementById('factory-balance-value');

    const amount = amountInput ? parseInt(amountInput.value, 10) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
        if (errorEl) errorEl.textContent = 'أدخل مبلغاً صحيحاً لإضافته';
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user || !editingFactoryId || !localPlayerData) return;

    if ((localPlayerData.money ?? 0) < amount) {
        if (errorEl) errorEl.textContent = 'لا تملك رصيداً شخصياً كافياً';
        return;
    }

    try {
        const db = firebase.firestore();
        const batch = db.batch();
        batch.update(db.collection('players').doc(user.uid), {
            money: firebase.firestore.FieldValue.increment(-amount)
        });
        batch.update(db.collection('factories').doc(editingFactoryId), {
            balance: firebase.firestore.FieldValue.increment(amount)
        });
        await batch.commit();

        if (balanceVal) balanceVal.textContent = (parseInt(balanceVal.textContent, 10) || 0) + amount;
        if (amountInput) amountInput.value = '';
        if (errorEl) errorEl.textContent = '';
    } catch (err) {
        console.error("خطأ أثناء إضافة رصيد المصنع:", err);
        if (errorEl) errorEl.textContent = 'فشلت إضافة الرصيد، حاول مرة أخرى';
    }
}

// تطوير مستوى المصنع: يكلف موارد من نفس نوع المصنع، تُخصم من محفظة صاحب المصنع الشخصية
async function upgradeFactory() {
    const errorEl = document.getElementById('factory-modal-error');
    const user = firebase.auth().currentUser;
    if (!user || !editingFactoryId || !localPlayerData) return;

    const factory = currentFactoriesCache.find(f => f.id === editingFactoryId);
    if (!factory) return;

    const resourceType = factory.resourceType;
    const resInfo = RESOURCE_TYPES[resourceType];
    const currentLevel = factory.level ?? 1;
    const cost = getFactoryUpgradeCost(currentLevel);

    if ((localPlayerData[resourceType] ?? 0) < cost) {
        if (errorEl) errorEl.textContent = `لا تملك ${cost} ${resInfo?.label || ''} كافية لتطوير المصنع`;
        return;
    }

    try {
        const db = firebase.firestore();
        const batch = db.batch();
        batch.update(db.collection('players').doc(user.uid), {
            [resourceType]: firebase.firestore.FieldValue.increment(-cost)
        });
        batch.update(db.collection('factories').doc(editingFactoryId), {
            level: firebase.firestore.FieldValue.increment(1)
        });
        await batch.commit();

        alert(`⬆️ تم تطوير المصنع إلى المستوى ${currentLevel + 1}!`);
        closeFactoryModal();
    } catch (err) {
        console.error("خطأ أثناء تطوير المصنع:", err);
        if (errorEl) errorEl.textContent = 'فشل التطوير، حاول مرة أخرى';
    }
}

// سحب كامل مخزون المصنع إلى محفظة صاحب المصنع الشخصية
async function withdrawFactoryStock() {
    const errorEl = document.getElementById('factory-modal-error');
    const user = firebase.auth().currentUser;
    if (!user || !editingFactoryId) return;

    const factory = currentFactoriesCache.find(f => f.id === editingFactoryId);
    if (!factory) return;

    const stock = factory.stock ?? 0;
    if (stock <= 0) {
        if (errorEl) errorEl.textContent = 'لا يوجد مخزون لسحبه حالياً';
        return;
    }

    const resourceType = factory.resourceType;
    const resInfo = RESOURCE_TYPES[resourceType];

    try {
        const db = firebase.firestore();
        const batch = db.batch();
        batch.update(db.collection('players').doc(user.uid), {
            [resourceType]: firebase.firestore.FieldValue.increment(stock)
        });
        batch.update(db.collection('factories').doc(editingFactoryId), {
            stock: 0
        });
        await batch.commit();

        alert(`📤 تم سحب ${stock} ${resInfo?.label || ''} إلى محفظتك الشخصية`);
        closeFactoryModal();
    } catch (err) {
        console.error("خطأ أثناء سحب المخزون:", err);
        if (errorEl) errorEl.textContent = 'فشل السحب، حاول مرة أخرى';
    }
}

// عرض المصنع للبيع (سيتم استخدامه لاحقاً في صفحة سوق البيع)
async function sellFactory() {
    const errorEl = document.getElementById('factory-modal-error');
    if (!editingFactoryId) return;

    const factory = currentFactoriesCache.find(f => f.id === editingFactoryId);
    if (!factory) return;

    const alreadyForSale = !!factory.forSale;
    const salePrice = getFactorySalePrice(factory.level ?? 1);

    const confirmMsg = alreadyForSale
        ? 'المصنع معروض للبيع حالياً. هل تريد إلغاء العرض؟'
        : `سيتم عرض المصنع للبيع بسعر ${salePrice} مال (ستُضاف صفحة البيع قريباً). هل تريد المتابعة؟`;

    if (!confirm(confirmMsg)) return;

    try {
        await firebase.firestore().collection('factories').doc(editingFactoryId).update({
            forSale: !alreadyForSale,
            salePrice: alreadyForSale ? null : salePrice
        });
        alert(alreadyForSale ? '✅ تم إلغاء عرض البيع' : '✅ تم عرض المصنع للبيع بنجاح');
        closeFactoryModal();
    } catch (err) {
        console.error("خطأ أثناء عرض المصنع للبيع:", err);
        if (errorEl) errorEl.textContent = 'فشلت العملية، حاول مرة أخرى';
    }
}

// إغلاق المصنع وحذفه نهائياً
async function closeFactoryPermanently() {
    if (!editingFactoryId) return;

    if (!confirm('⚠️ هذا الإجراء نهائي ولا يمكن التراجع عنه! سيتم حذف المصنع بكل بياناته (المخزون، الرصيد، العمال). هل أنت متأكد؟')) {
        return;
    }

    try {
        await firebase.firestore().collection('factories').doc(editingFactoryId).delete();
        alert('🗑️ تم إغلاق المصنع نهائياً');
        closeFactoryModal();
    } catch (err) {
        console.error("خطأ أثناء إغلاق المصنع:", err);
        alert('فشل إغلاق المصنع، حاول مرة أخرى');
    }
}

function updateStatsOnScreen(totalPlayers, onlinePlayers, countryPop = totalPlayers, countryOnline = onlinePlayers) {
    document.querySelectorAll('.global-population').forEach(el => el.textContent = totalPlayers);
    document.querySelectorAll('.global-online').forEach(el => el.textContent = onlinePlayers);
    document.querySelectorAll('.country-population').forEach(el => el.textContent = countryPop);
    document.querySelectorAll('.country-online').forEach(el => el.textContent = countryOnline);
}

function updateCountryBlockOnScreen(countryKey) {
    const flagElement = document.getElementById('country-flag');
    const nameElement = document.getElementById('country-name-text');
    const regionText = document.getElementById('profile-region');
    
    if (africanCountries[countryKey]) {
        const countryData = africanCountries[countryKey];
        if (flagElement) flagElement.textContent = countryData.flag;
        if (nameElement) nameElement.textContent = countryData.name;
        if (regionText) regionText.textContent = countryData.name;
    } else {
        if (flagElement) flagElement.textContent = "🌍";
        if (nameElement) nameElement.textContent = "أفريقيا";
        if (regionText) regionText.textContent = "أفريقيا";
    }
}

export function travelToCountry(targetCountryKey) {
    if (!africanCountries[targetCountryKey]) return;
    const user = firebase.auth().currentUser;
    if (!user) return alert("يجب عليك تسجيل الدخول أولاً لتتمكن من السفر!");

    firebase.firestore().collection('players').doc(user.uid).update({
        current_location: targetCountryKey
    })
    .then(() => alert(`✈️ تم السفر بنجاح إلى ${africanCountries[targetCountryKey].name}!`))
    .catch(err => console.error(err));
}

// حفظ تعديلات البروفايل: الاسم الجديد + رفع صورة جديدة (إن وُجدت) إلى Firebase Storage
export async function saveProfileChanges(newName, avatarFile) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("المستخدم غير مسجل الدخول");

    const updates = {};
    const trimmedName = (newName || "").trim();
    if (trimmedName !== "") {
        updates.name = trimmedName;
    }

    if (avatarFile) {
        const downloadUrl = await uploadImageToCloudinary(avatarFile);
        updates.photo = downloadUrl;
        updates.avatarUrl = downloadUrl; // للحفاظ على التوافق مع أي كود قديم يقرأ هذا الحقل
    }

    if (Object.keys(updates).length === 0) return;

    await firebase.firestore().collection('players').doc(user.uid).update(updates);
}

export function changePlayerName(newName) {
    const trimmedName = newName.trim();
    if (trimmedName === "") return alert("الاسم لا يمكن أن يكون فارغاً");

    const user = firebase.auth().currentUser;
    if (!user) return;

    firebase.firestore().collection('players').doc(user.uid).update({
        name: trimmedName
    }).then(() => alert("تم تحديث الاسم بنجاح"));
}


// ربط حقل رفع صورة المصنع (يعمل مباشرة لأن العنصر موجود في الصفحة عند تحميل هذا الموديول)
const factoryFileInputEl = document.getElementById('factory-file-input');
if (factoryFileInputEl) factoryFileInputEl.addEventListener('change', handleFactoryFileSelect);

// فحص دوري كل 30 ثانية لتحديث عرض مشروب الطاقة واسترجاعه تلقائياً حتى دون أي تغيير آخر في البيانات
setInterval(() => {
    if (localPlayerData) {
        refreshWorkEnergyDisplay(localPlayerData);
        maybeRegenWorkEnergy(localPlayerData);
    }
}, 30000);

// استماع عام لأي نقرة تحدث في المستند (يتجاوز مشاكل الحقن الديناميكي و الـ Modules)
document.addEventListener('click', function(event) {

    // 1. التعامل مع الضغط على أزرار التطوير (يجب فحصها أولاً لأنها متداخلة داخل البطاقة نفسها،
    //    وإلا فإن فحص البطاقة يعترض الحدث ويقفل/يفتح القائمة فقط بدل تشغيل الترقية)
    const upgradeBtn = event.target.closest('.btn-upgrade-action');
    if (upgradeBtn) {
        event.stopPropagation(); // منع فتح/إغلاق القائمة عند النقر على الزر
        if (upgradeBtn.disabled) return; // زر معطّل بسبب تطوير جارٍ في مهارة أخرى

        const skill = upgradeBtn.getAttribute('data-skill');
        const currency = upgradeBtn.getAttribute('data-currency');
        
        startStatUpgrade(skill, currency);
        return;
    }

    // 2. التعامل مع الضغط على رأس البطاقة لفتح/إغلاق القائمة المنسدلة فقط
    //    (نفحص .card-header-main تحديداً وليس البطاقة كلها، حتى لا نعترض ضغطات الأزرار الداخلية)
    const cardHeader = event.target.closest('.card-header-main');
    if (cardHeader) {
        const cardBox = cardHeader.closest('.stat-card-box');
        if (!cardBox) return;

        const dropdownId = cardBox.getAttribute('data-dropdown');
        const dropdown = document.getElementById(dropdownId);
        
        if (dropdown) {
            // إغلاق أي قوائم أخرى مفتوحة
            document.querySelectorAll('.upgrade-dropdown').forEach(item => {
                if (item.id !== dropdownId) {
                    item.style.display = 'none';
                }
            });

            // تبديل الحالة للقائمة الحالية
            if (dropdown.style.display === 'none' || dropdown.style.display === '') {
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        }
        return;
    }
});
