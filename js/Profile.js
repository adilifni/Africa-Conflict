// ==========================================
// 👤 نظام تطوير مهارات اللاعب (القوة القتالية / التعليم / الطاقة) وشريط الـXP
// ==========================================
import { formatTimeShort } from './app.js';
import { getPlayerData } from './player-state.js';

// ⚙️ إعدادات نظام التطوير المتصاعد (Upgrade Engine)
// عدّل هذه الثوابت وحدها لضبط سرعة/تكلفة اللعبة بالكامل
const STAT_CONFIG = {
    power:     { baseMoney: 100, baseGold: 5,  label: '💪 القوة القتالية' },
    education: { baseMoney: 200, baseGold: 10, label: '📚 مستوى التعليم' },
    energy:    { baseMoney: 50,  baseGold: 2,  label: '⚡ مستوى الطاقة' }
};

const TIME_BASE_MINUTES = 3;    // الوقت اللازم لترقية المستوى 1 (بالمال)
const TIME_EXPONENT     = 1.55; // معدل تسارع الوقت مع ارتفاع المستوى
const COST_EXPONENT     = 1.5;  // معدل تسارع السعر مع ارتفاع المستوى

let trainingInterval = null;
let isUpgradingNow = false;

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

export function updateXPProgressBar(totalXP) {
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
export function refreshUpgradeCards(data) {
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
    const localPlayerData = getPlayerData();
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

export function checkActiveTraining(data) {
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

// استماع عام لأي نقرة تحدث بقوائم التطوير المنسدلة (يتجاوز مشاكل الحقن الديناميكي والـModules)
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
