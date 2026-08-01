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
                        if (profileImg) profileImg.src = data.avatarUrl || user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + userUid;
                        
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
                            document.getElementById('stat-power-val').textContent = data.power ?? 10;
                        }
                        if (document.getElementById('stat-education-val')) {
                            document.getElementById('stat-education-val').textContent = data.education ?? 1;
                        }
                        if (document.getElementById('stat-energy-val')) {
                            document.getElementById('stat-energy-val').textContent = data.energy ?? 100;
                        }
                        if (document.getElementById('stat-energy-level-val')) {
                            document.getElementById('stat-energy-level-val').textContent = data.energy ?? 100;
                        }

                        // تحديث أسعار وأزمنة الترقية المعروضة بناءً على المستوى الحالي لكل مهارة
                        refreshUpgradeCards(data);

                        checkActiveTraining(data);
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
        power: 10,          
        education: 1,       
        energy: 100,
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
        finishAt: finishTime
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
                completeUpgrade(activeStat);
            }
        } else {
            if (timerVal) {
                timerVal.textContent = `متبقي: ⏳ ${formatTimeShort(timeLeft)}`;
            }
        }
    }, 1000);
}

function completeUpgrade(statName) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();
    db.collection('players').doc(user.uid).update({
        [statName]: firebase.firestore.FieldValue.increment(1),
        [`${statName}Level`]: firebase.firestore.FieldValue.increment(1),
        activeTraining: null 
    }).then(() => {
        isUpgradingNow = false; 
        const label = STAT_CONFIG[statName]?.label || statName;
        alert(`🎉 تهانينا! تم ترقية ${label} بنجاح.`);
    }).catch(err => {
        isUpgradingNow = false;
        console.error("خطأ أثناء إنهاء الترقية:", err);
    });
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

export function changePlayerName(newName) {
    const trimmedName = newName.trim();
    if (trimmedName === "") return alert("الاسم لا يمكن أن يكون فارغاً");

    const user = firebase.auth().currentUser;
    if (!user) return;

    firebase.firestore().collection('players').doc(user.uid).update({
        name: trimmedName
    }).then(() => alert("تم تحديث الاسم بنجاح"));
}


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
