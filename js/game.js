// ==========================================
// 🎮 نظام اللعبة الأساسي والتواصل مع Firestore
// ==========================================
import { africanCountries } from './config.js';
import { formatTimeShort } from './app.js';

let localPlayerData = null;
let trainingInterval = null; 
let isUpgradingNow = false;  

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
                        if (profileMoneyVal) profileMoneyVal.textContent = data.money || 0;

                        const profileGoldVal = document.getElementById('profile-gold-val');
                        if (profileGoldVal) profileGoldVal.textContent = data.gold || 0;

                        updateXPProgressBar(data.experience || 1);

                        const currentLoc = data.current_location || "morocco";
                        updateCountryBlockOnScreen(currentLoc);

                        const nationalityText = document.getElementById('profile-nationality');
                        if (nationalityText) {
                            const nation = data.nationality || data.residence_country || "morocco";
                            nationalityText.textContent = africanCountries[nation]?.name || "لم تحدد";
                        }

                        if (document.getElementById('stat-power-val')) {
                            document.getElementById('stat-power-val').textContent = data.power || 10;
                        }
                        if (document.getElementById('stat-education-val')) {
                            document.getElementById('stat-education-val').textContent = data.education || 1;
                        }
                        if (document.getElementById('stat-energy-val')) {
                            document.getElementById('stat-energy-val').textContent = data.energy || 100;
                        }
                        if (document.getElementById('stat-energy-level-val')) {
                            document.getElementById('stat-energy-level-val').textContent = data.energy || 100;
                        }

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

export function startStatUpgrade(statName, currencyType) {
    if (!localPlayerData) return;

    if (localPlayerData.activeTraining) {
        alert("⚠️ هناك عملية تطوير جارية بالفعل! انتظر حتى تنتهي.");
        return;
    }

    const currentStatLevel = localPlayerData[statName] || 0;
    const moneyCost = (currentStatLevel + 1) * 1000;
    const goldCost = (currentStatLevel + 1) * 5;
    
    let timeInSeconds = Math.floor(Math.pow(currentStatLevel + 1, 1.5) * 60);

    const user = firebase.auth().currentUser;
    const db = firebase.firestore();
    const updates = {};

    if (currencyType === 'money') {
        if ((localPlayerData.money || 0) < moneyCost) { return alert("🔴 لا تملك المال الكافي!"); }
        updates['money'] = firebase.firestore.FieldValue.increment(-moneyCost);
    } else if (currencyType === 'gold') {
        if ((localPlayerData.gold || 0) < goldCost) { return alert("🔴 لا تملك الذهب الكافي!"); }
        updates['gold'] = firebase.firestore.FieldValue.increment(-goldCost);
        timeInSeconds = Math.floor(timeInSeconds / 2); 
    }

    const finishTime = Date.now() + (timeInSeconds * 1000);
    updates['activeTraining'] = {
        stat: statName,
        finishAt: finishTime
    };

    if (trainingInterval) clearInterval(trainingInterval);
    isUpgradingNow = false; 

    db.collection('players').doc(user.uid).update(updates)
        .then(() => alert(`⏳ بدأ تطوير مهارة ${statName} الآن...`))
        .catch(err => console.error(err));
}

function checkActiveTraining(data) {
    const stats = ['power', 'education', 'energy'];
    
    stats.forEach(stat => {
        const btnContainer = document.getElementById(`actions-${stat}`);
        const timerContainer = document.getElementById(`timer-container-${stat}`);
        if (btnContainer) btnContainer.style.display = 'flex';
        if (timerContainer) timerContainer.style.display = 'none';
    });

    if (trainingInterval) clearInterval(trainingInterval);

    if (!data.activeTraining) {
        isUpgradingNow = false;
        return;
    }

    const activeStat = data.activeTraining.stat;
    const btnContainer = document.getElementById(`actions-${activeStat}`);
    const timerContainer = document.getElementById(`timer-container-${activeStat}`);
    const timerVal = document.getElementById(`timer-val-${activeStat}`);
    const activeDropdown = document.getElementById(`stat-${activeStat}-dropdown`);

    if (btnContainer) btnContainer.style.display = 'none';
    if (timerContainer) timerContainer.style.display = 'block';
    
    if (activeDropdown && activeDropdown.style.maxHeight !== "0px" && activeDropdown.style.maxHeight !== "") {
        activeDropdown.style.maxHeight = activeDropdown.scrollHeight + "px";
    }

    trainingInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = data.activeTraining.finishAt - now;

        if (timeLeft <= 0) {
            clearInterval(trainingInterval);
            if (timerContainer) timerContainer.style.display = 'none';
            if (btnContainer) btnContainer.style.display = 'flex';
            
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
        activeTraining: null 
    }).then(() => {
        isUpgradingNow = false; 
        alert(`🎉 تهانينا! تم ترقية المهارة بنجاح.`);
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