// ==========================================
// 🎮 المنسّق العام للعبة (Orchestrator) — يربط كل الوحدات المقسّمة معاً
// بعد التقسيم: هذا الملف لم يعد يحتوي منطق أي نظام بذاته، فقط:
// 1) الاشتراك الرئيسي ببيانات اللاعب من Firestore وتوزيعها على كل وحدة
// 2) الإحصائيات العالمية (عدد اللاعبين المتصلين)
// 3) وظائف عامة صغيرة لا تتبع نظاماً بعينه (السفر، تعديل البروفايل)
// 4) ربط كل الدوال بـwindow حتى تعمل من خصائص onclick بالـHTML
// ==========================================
import { africanCountries } from './config.js';
import { uploadImageToCloudinary } from './cloudinary.js';
import { setPlayerData } from './player-state.js';

import { updateXPProgressBar, refreshUpgradeCards, checkActiveTraining, startStatUpgrade } from './profile.js';

import {
    handleWorkViewUpdate, doWork, openFactoryModal, closeFactoryModal, saveFactory,
    addFactoryBalance, upgradeFactory, withdrawFactoryStock, sellFactory, closeFactoryPermanently,
    openCreateListingModal, closeCreateListingModal, submitCreateListing, cancelMarketListing,
    openBuyModal, closeBuyModal, confirmBuyListing
} from './work.js';

import {
    handleWarsViewUpdate, declareWar, openTrainingModal, closeTrainingModal, selectCombatRole,
    selectCombatMode, executeCombatRound, onTrainingWeaponChange, openWarDetailsModal, closeWarDetailsModal,
    openTrainingRoundDetailsModal, closeTrainingRoundDetailsModal
} from './wars.js';

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
                            // لا يُفترض حدوث هذا أبداً: auth.js هو المصدر الوحيد لإنشاء مستند اللاعب،
                            // ويشتغل قبل وصول المستخدم لهذه الصفحة أصلاً. لو ظهرت هذه الرسالة بالـ Console،
                            // فهذا يعني وجود مشكلة حقيقية (مثلاً حذف يدوي للمستند أثناء الجلسة).
                            console.warn("مستند اللاعب غير موجود! تأكد أن auth.js أنشأه بنجاح قبل الدخول لهذه الصفحة.");
                            return;
                        }

                        const data = doc.data();
                        setPlayerData(data);

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
                        handleWarsViewUpdate(data);
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

            // ربط الدوال بالنافذة لكي تعمل مباشرة من ملف الـ HTML عند الحاجة (onclick="...")
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
            window.openCreateListingModal = openCreateListingModal;
            window.closeCreateListingModal = closeCreateListingModal;
            window.submitCreateListing = submitCreateListing;
            window.cancelMarketListing = cancelMarketListing;
            window.openBuyModal = openBuyModal;
            window.closeBuyModal = closeBuyModal;
            window.confirmBuyListing = confirmBuyListing;
            window.declareWar = declareWar;
            window.openTrainingModal = openTrainingModal;
            window.closeTrainingModal = closeTrainingModal;
            window.selectCombatRole = selectCombatRole;
            window.selectCombatMode = selectCombatMode;
            window.executeCombatRound = executeCombatRound;
            window.onTrainingWeaponChange = onTrainingWeaponChange;
            window.openWarDetailsModal = openWarDetailsModal;
            window.closeWarDetailsModal = closeWarDetailsModal;
            window.openTrainingRoundDetailsModal = openTrainingRoundDetailsModal;
            window.closeTrainingRoundDetailsModal = closeTrainingRoundDetailsModal;

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
