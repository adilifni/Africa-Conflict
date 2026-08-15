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
// 🧬 نظام تأثير المهارات الموحّد (Skills Impact System)
// ==========================================
// مستوى اللاعب (XP): يؤثر على ضرر القتال وإنتاجية العمل معاً
const LEVEL_BONUS_PER_LEVEL = 0.02; // +2% لكل مستوى لاعب، يُطبَّق على القتال والعمل

// مستوى التعليم: معدلان منفصلان — إنتاجية العمل تزيد ببطء، خصم سعر السلاح يزيد بسرعة (×2)
const EDUCATION_YIELD_BONUS_PER_LEVEL = 0.001; // +0.1% إنتاجية عمل لكل مستوى تعليم
const MAX_EDUCATION_YIELD_BONUS = 1.0;         // سقف +100% (مضاعفة الإنتاج كحد أقصى)

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

// أنواع الموارد القابلة للبيع/الشراء في السوق العالمي بين اللاعبين — الذهب مستبعد عمداً (عملة أساسية، ليس سلعة سوق)
const MARKET_RESOURCE_TYPES = {
    oil:     { label: 'نفط',  icon: '🛢️' },
    iron:    { label: 'حديد', icon: '⚙️' },
    wheat:   { label: 'قمح',  icon: '🌾' },
    diamond: { label: 'ماس',  icon: '💎' }
};

// تكلفة فتح مصنع جديد (ثابتة بغض النظر عن نوع المصنع المختار) — تُخصم من محفظة اللاعب الشخصية
const FACTORY_OPEN_COST = { gold: 50, iron: 100, money: 1000, oil: 2000 };

// نصيب اللاعب من ضغطة العمل: كل 10 طاقة تُستهلك = 1 وحدة مورد أساسية، معدَّلة بمستوى اللاعب (XP) ومستوى التعليم
// playerData: بيانات اللاعب الكاملة (لقراءة experience و educationLevel)
// energyAmount: كمية الطاقة المستهلكة بهذه الضغطة
function getPlayerWorkYield(playerData, energyAmount) {
    const baseUnits = Math.floor(energyAmount / 10);
    if (baseUnits <= 0) return 0;

    // مضاعف مستوى اللاعب (XP) — نفس المعدل المستخدم بالقتال، مطبَّق هنا على الإنتاجية
    const playerLevel = Math.floor(Math.sqrt((playerData?.experience ?? 1) / 100)) + 1;
    const levelMultiplier = 1 + (playerLevel - 1) * LEVEL_BONUS_PER_LEVEL;

    // مضاعف مستوى التعليم — ينمو ببطء (نصف سرعة خصم سعر السلاح)
    const educationLevel = playerData?.educationLevel ?? 1;
    const educationBonus = 1 + Math.min(MAX_EDUCATION_YIELD_BONUS, educationLevel * EDUCATION_YIELD_BONUS_PER_LEVEL);

    return Math.floor(baseUnits * levelMultiplier * educationBonus);
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

// ==========================================
// 🛒 إعدادات السوق العالمي
// ==========================================
// نسبة الضريبة الافتراضية لو الدولة لسه ما حددت نسبتها الخاصة (عبر البرلمان مستقبلاً)
const DEFAULT_MARKET_TAX_RATE = 0.05; // 5%

let currentMarketListingsCache = [];
let unsubscribeMarketListings = null;
let activeBuyListingId = null;

// ==========================================
// ⚔️ إعدادات نظام الحروب والأسلحة
// ==========================================
const WAR_DURATION_HOURS = 24;
const TRAINING_ROUND_DURATION_HOURS = 24; // جولة التدريب الخاصة بكل دولة تتجدد كل 24 ساعة، دائماً عند 00:00 غرينتش

// يرجع توقيت منتصف الليل القادم بتوقيت غرينتش (00:00 UTC) — تبدأ عنده كل جولة تدريب جديدة
function getNextUtcMidnightMs() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
}

// معرّف فريد لكل جولة تدريب — يميّز مشاركي الجولة الحالية عن جولات سابقة انتهت وتصفّرت
function generateRoundId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
const COMBAT_ENERGY_REGEN_AMOUNT = 10;
const COMBAT_ENERGY_REGEN_MINUTES = 10;
const MIN_ENERGY_TO_FIGHT = 10;
const TRAINING_XP_PER_DAMAGE = 0.5;  // كل نقطة ضرر بالتدريب = 0.5 XP
const WAR_XP_PER_DAMAGE = 0.6;       // كل نقطة ضرر بحرب حقيقية = 0.6 XP (أعلى شوي من التدريب)

// شريط ثنائي اللون مشترك (أحمر=مهاجمين، أزرق=مدافعين) والأرقام تظهر داخل كل قسم مباشرة
function renderTwoToneBarHtml(attackerValue, defenderValue) {
    const total = attackerValue + defenderValue;
    const pctA = total > 0 ? (attackerValue / total) * 100 : 50;
    const pctB = 100 - pctA;

    return `
        <div style="width:100%;height:24px;background:#2d3748;border-radius:12px;overflow:hidden;display:flex;">
            <div style="width:${pctA}%;height:100%;background:#e53e3e;display:flex;align-items:center;justify-content:center;transition:width .4s ease;overflow:hidden;">
                <span style="color:#fff;font-size:12px;font-weight:bold;white-space:nowrap;">${attackerValue}</span>
            </div>
            <div style="width:${pctB}%;height:100%;background:#3182ce;display:flex;align-items:center;justify-content:center;transition:width .4s ease;overflow:hidden;">
                <span style="color:#fff;font-size:12px;font-weight:bold;white-space:nowrap;">${defenderValue}</span>
            </div>
        </div>
    `;
}

// كتالوج الأسلحة الثابت — كل ما زاد الضرر زاد السعر الأساسي
const WEAPONS_CATALOG = [
    { id: 'knife',   name: 'سكين',        icon: '🔪', damage: 5,   basePrice: 200 },
    { id: 'pistol',  name: 'مسدس',        icon: '🔫', damage: 15,  basePrice: 800 },
    { id: 'rifle',   name: 'بندقية',      icon: '🎯', damage: 40,  basePrice: 2500 },
    { id: 'grenade', name: 'قنبلة يدوية', icon: '💣', damage: 80,  basePrice: 6000 },
    { id: 'tank',    name: 'دبابة',       icon: '🛡️', damage: 200, basePrice: 20000 }
];

// خصم سعر السلاح من التعليم ينمو بسرعة (ضعف سرعة مضاعف الإنتاجية أعلاه)
const EDUCATION_PRICE_DISCOUNT_PER_LEVEL = 0.002; // 0.2% خصم لكل مستوى تعليم
const MAX_EDUCATION_DISCOUNT = 0.5;               // سقف الخصم 50%

// سعة مخزون طاقة القتال: نفس معادلة طاقة العمل بالضبط، وعلى أساس مستوى الطاقة (وليس القوة القتالية)
// توحيد الطاقة: نفس المهارة (energyLevel) تتحكم بسعة طاقة العمل وطاقة القتال معاً
function getCombatEnergyCap(energyLevel) {
    const lvl = energyLevel ?? 1;
    return 100 + Math.floor(lvl / 50) * 5;
}

// سعر السلاح بعد خصم مستوى التعليم
function getWeaponPrice(basePrice, educationLevel) {
    const lvl = educationLevel ?? 1;
    const discount = Math.min(MAX_EDUCATION_DISCOUNT, lvl * EDUCATION_PRICE_DISCOUNT_PER_LEVEL);
    return Math.round(basePrice * (1 - discount));
}

// حساب الضرر: (القوة + ضرر السلاح) × مضاعف مستوى اللاعب × وحدات الطاقة المستهلكة
// ملاحظة: القوة القتالية تؤثر فقط عبر قيمتها الخام (power) — لا يوجد مضاعف إضافي مرتبط بمستوى الطاقة بعد الآن
function calculateCombatDamage(playerData, energySpent, weaponId, availableWeaponUnits) {
    const rawEnergyUnits = Math.floor(energySpent / 10); // كل 10 طاقة = وحدة واحدة كحد أقصى نظري
    if (rawEnergyUnits <= 0) return { damage: 0, energyUnits: 0 };

    // الوحدات الفعلية المستخدمة = الأقل بين ما تسمح به الطاقة وما تملكه فعلياً من السلاح
    const energyUnits = Math.max(0, Math.min(rawEnergyUnits, availableWeaponUnits ?? rawEnergyUnits));
    if (energyUnits <= 0) return { damage: 0, energyUnits: 0 };

    const power = playerData.power ?? 1;
    const weapon = WEAPONS_CATALOG.find(w => w.id === weaponId);
    const weaponDamage = weapon?.damage ?? 0;

    // نفس معادلة حساب مستوى اللاعب المستخدمة بشريط الـXP، ومطبَّقة أيضاً على إنتاجية العمل
    const playerLevel = Math.floor(Math.sqrt((playerData.experience ?? 1) / 100)) + 1;
    const levelMultiplier = 1 + (playerLevel - 1) * LEVEL_BONUS_PER_LEVEL;

    const baseDamagePerUnit = power + weaponDamage;
    const damage = Math.max(1, Math.round(energyUnits * baseDamagePerUnit * levelMultiplier));
    return { damage, energyUnits };
}

let currentCountryWar = null;
let unsubscribeCountryWarA = null;
let unsubscribeCountryWarB = null;
let currentAllWarsCache = [];
let unsubscribeAllWars = null;
let lastSubscribedWarLocation = null;
let selectedCombatRole = null; // 'attacker' | 'defender'
let selectedCombatWeaponId = null; // معرف السلاح المختار من مخزون اللاعب (إلزامي، لا يوجد قتال بدون سلاح)
let currentTrainingRound = null;   // جولة التدريب الدائمة الخاصة بدولة اللاعب الحالية
let unsubscribeTrainingRound = null;
let trainingRoundCountdownInterval = null;
let trainingRoundDetailsCountdownInterval = null; // عداد نافذة ترتيب مشاركي التدريب

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
                            // لا يُفترض حدوث هذا أبداً: auth.js هو المصدر الوحيد لإنشاء مستند اللاعب،
                            // ويشتغل قبل وصول المستخدم لهذه الصفحة أصلاً. لو ظهرت هذه الرسالة بالـ Console،
                            // فهذا يعني وجود مشكلة حقيقية (مثلاً حذف يدوي للمستند أثناء الجلسة).
                            console.warn("مستند اللاعب غير موجود! تأكد أن auth.js أنشأه بنجاح قبل الدخول لهذه الصفحة.");
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

    if (!unsubscribeMarketListings) {
        subscribeMarketListings();
    }

    refreshSelectedFactoryDisplay(data);
    refreshWorkEnergyDisplay(data);
    refreshPlayerResourcesDisplay(data);
    renderMyMarketListings();
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

            // تحديث عدد المصانع المعروض في صفحة العمل والصفحة الرئيسية
            const count = currentFactoriesCache.length;
            setText('work-factories-count', count);
            setText('country-factories-count', count);

            // تحديث الحقل الحقيقي بمستند الدولة (بدل الحقل الثابت القديم غير المُحدَّث)
            firebase.firestore().collection('countries').doc(countryKey)
                .update({ factories: count })
                .catch(() => { /* تجاهل الخطأ لو المستخدم غير مسجل دخول بعد أو صلاحية الكتابة غير متاحة */ });
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

        // الناتج المتوقع الآن يعكس مضاعف مستوى اللاعب (XP) ومضاعف التعليم أيضاً، وليس فقط الطاقة
        const expectedYield = getPlayerWorkYield(data, current);
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

            // نصيب اللاعب: كل 10 طاقة = 1 وحدة مورد أساسية، معدَّلة بمستوى اللاعب (XP) ومستوى التعليم
            const playerYield = getPlayerWorkYield(playerData, spentEnergy);

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
                // كل 10 طاقة مُستهلكة = 1 نقطة خبرة (نفس نسبة إنتاج المورد الأساسية، قبل مضاعفات XP/التعليم)
                playerUpdates.experience = firebase.firestore.FieldValue.increment(Math.floor(spentEnergy / 10));
            }
            if (wagePaid > 0) playerUpdates.money = firebase.firestore.FieldValue.increment(wagePaid);
            transaction.update(playerRef, playerUpdates);

            return { playerYield, wagePaid, factoryGain };
        });

        let msg = result.playerYield > 0
            ? `${resourceConfig.icon} حصلت على ${result.playerYield} ${resourceConfig.label}`
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

// ==========================================
// 🛒 نظام السوق العالمي (بيع وشراء الموارد بين اللاعبين)
// ==========================================

// اشتراك عالمي واحد (بدون تقييد بدولة) — يعمل مرة واحدة فقط طوال الجلسة
function subscribeMarketListings() {
    unsubscribeMarketListings = firebase.firestore().collection('market_listings')
        .where('status', '==', 'active')
        .onSnapshot((snapshot) => {
            currentMarketListingsCache = [];
            snapshot.forEach(doc => currentMarketListingsCache.push({ id: doc.id, ...doc.data() }));
            renderMarketListings();
            renderMyMarketListings();
        }, (err) => console.error("خطأ في جلب إعلانات السوق:", err));
}

function renderMarketListings() {
    const container = document.getElementById('market-listings-container');
    if (!container) return;

    const user = firebase.auth().currentUser;
    const othersListings = currentMarketListingsCache.filter(l => l.sellerUid !== user?.uid);

    if (othersListings.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد إعلانات بيع نشطة حالياً</p>';
        return;
    }

    // ترتيب حسب الأرخص أولاً
    const sorted = [...othersListings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);

    container.innerHTML = '';
    sorted.forEach(listing => {
        const resInfo = MARKET_RESOURCE_TYPES[listing.resourceType];
        const totalCost = listing.quantity * listing.pricePerUnit;
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:10px;background:#0f1620;border:1px solid #2d3748;border-radius:10px;padding:10px;';
        card.innerHTML = `
            <div style="font-size:26px;flex-shrink:0;">${resInfo?.icon || '📦'}</div>
            <div style="flex:1;min-width:0;">
                <div style="color:#fff;font-weight:bold;font-size:14px;">${escapeHtml(listing.sellerName || 'لاعب')}</div>
                <div style="color:#a0aec0;font-size:12px;">${listing.quantity} ${resInfo?.label || ''} · 💵 ${listing.pricePerUnit}/وحدة</div>
                <div style="color:#718096;font-size:11px;">الإجمالي: ${totalCost} مال</div>
            </div>
            <button class="btn-buy-listing" data-listing-id="${listing.id}" style="background:#38a169;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;flex-shrink:0;">شراء</button>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-buy-listing').forEach(btn => {
        btn.addEventListener('click', () => openBuyModal(btn.getAttribute('data-listing-id')));
    });
}

function renderMyMarketListings() {
    const container = document.getElementById('my-listings-container');
    if (!container) return;

    const user = firebase.auth().currentUser;
    if (!user) return;

    const mine = currentMarketListingsCache.filter(l => l.sellerUid === user.uid);

    if (mine.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد إعلانات نشطة لك حالياً</p>';
        return;
    }

    container.innerHTML = '';
    mine.forEach(listing => {
        const resInfo = MARKET_RESOURCE_TYPES[listing.resourceType];
        const soldPortion = listing.originalQuantity - listing.quantity;
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:10px;background:#0f1620;border:1px solid #2d3748;border-radius:10px;padding:10px;';
        card.innerHTML = `
            <div style="font-size:26px;flex-shrink:0;">${resInfo?.icon || '📦'}</div>
            <div style="flex:1;min-width:0;">
                <div style="color:#fff;font-weight:bold;font-size:14px;">${listing.quantity} ${resInfo?.label || ''} متبقية</div>
                <div style="color:#a0aec0;font-size:12px;">💵 ${listing.pricePerUnit}/وحدة · بيع ${soldPortion} من ${listing.originalQuantity}</div>
            </div>
            <button class="btn-cancel-listing" data-listing-id="${listing.id}" style="background:#742a2a;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;flex-shrink:0;">إلغاء</button>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-cancel-listing').forEach(btn => {
        btn.addEventListener('click', () => cancelMarketListing(btn.getAttribute('data-listing-id')));
    });
}

// فتح نافذة نشر إعلان بيع جديد
function openCreateListingModal() {
    const modal = document.getElementById('listing-modal');
    const errorEl = document.getElementById('listing-modal-error');
    const resourceInput = document.getElementById('listing-resource-input');
    const qtyInput = document.getElementById('listing-quantity-input');
    const priceInput = document.getElementById('listing-price-input');

    if (errorEl) errorEl.textContent = '';
    if (resourceInput) resourceInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (priceInput) priceInput.value = '';

    if (modal) modal.style.display = 'flex';
}

function closeCreateListingModal() {
    const modal = document.getElementById('listing-modal');
    if (modal) modal.style.display = 'none';
}

async function submitCreateListing() {
    const errorEl = document.getElementById('listing-modal-error');
    const submitBtn = document.getElementById('submit-listing-btn');
    const resourceType = document.getElementById('listing-resource-input')?.value;
    const quantity = parseInt(document.getElementById('listing-quantity-input')?.value, 10);
    const pricePerUnit = parseInt(document.getElementById('listing-price-input')?.value, 10);

    if (!MARKET_RESOURCE_TYPES[resourceType]) { if (errorEl) errorEl.textContent = 'اختر نوع المورد'; return; }
    if (!Number.isFinite(quantity) || quantity <= 0) { if (errorEl) errorEl.textContent = 'أدخل كمية صحيحة'; return; }
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) { if (errorEl) errorEl.textContent = 'أدخل سعراً صحيحاً لكل وحدة'; return; }

    const user = firebase.auth().currentUser;
    if (!user || !localPlayerData) { if (errorEl) errorEl.textContent = 'حدث خطأ، أعد تحميل الصفحة'; return; }

    if ((localPlayerData[resourceType] ?? 0) < quantity) {
        if (errorEl) errorEl.textContent = `لا تملك ${quantity} ${MARKET_RESOURCE_TYPES[resourceType].label} كافية في محفظتك`;
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري النشر...'; }
    if (errorEl) errorEl.textContent = '';

    try {
        const db = firebase.firestore();
        const batch = db.batch();

        // خصم الكمية فوراً من محفظة البائع (Escrow) لمنع نشر كمية أكبر من رصيده الفعلي
        batch.update(db.collection('players').doc(user.uid), {
            [resourceType]: firebase.firestore.FieldValue.increment(-quantity)
        });

        const newListingRef = db.collection('market_listings').doc();
        batch.set(newListingRef, {
            sellerUid: user.uid,
            sellerName: (localPlayerData.name || 'لاعب').trim(),
            sellerCountryKey: localPlayerData.current_location || "morocco",
            resourceType,
            quantity,
            originalQuantity: quantity,
            pricePerUnit,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        closeCreateListingModal();
    } catch (err) {
        console.error("خطأ أثناء نشر الإعلان:", err);
        if (errorEl) errorEl.textContent = 'فشل النشر، حاول مرة أخرى';
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'نشر الإعلان'; }
    }
}

// إلغاء إعلان وإعادة الكمية المتبقية لمحفظة البائع
async function cancelMarketListing(listingId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if (!confirm('هل تريد إلغاء هذا الإعلان؟ سيتم إرجاع الكمية المتبقية لمحفظتك.')) return;

    const db = firebase.firestore();
    const listingRef = db.collection('market_listings').doc(listingId);

    try {
        await db.runTransaction(async (transaction) => {
            const listingDoc = await transaction.get(listingRef);
            if (!listingDoc.exists) throw new Error('الإعلان غير موجود');

            const listing = listingDoc.data();
            if (listing.sellerUid !== user.uid) throw new Error('هذا الإعلان ليس ملكك');
            if (listing.status !== 'active') throw new Error('الإعلان غير نشط أصلاً');

            transaction.update(listingRef, { status: 'cancelled' });
            if (listing.quantity > 0) {
                transaction.update(db.collection('players').doc(user.uid), {
                    [listing.resourceType]: firebase.firestore.FieldValue.increment(listing.quantity)
                });
            }
        });
    } catch (err) {
        console.error("خطأ أثناء إلغاء الإعلان:", err);
        alert(`🔴 ${err.message || 'فشل الإلغاء، حاول مرة أخرى'}`);
    }
}

// فتح نافذة الشراء لإعلان معيّن
function openBuyModal(listingId) {
    const listing = currentMarketListingsCache.find(l => l.id === listingId);
    if (!listing) return;

    activeBuyListingId = listingId;

    const modal = document.getElementById('buy-modal');
    const infoEl = document.getElementById('buy-modal-info');
    const qtyInput = document.getElementById('buy-quantity-input');
    const errorEl = document.getElementById('buy-modal-error');

    const resInfo = MARKET_RESOURCE_TYPES[listing.resourceType];
    if (infoEl) {
        infoEl.innerHTML = `
            البائع: <b>${escapeHtml(listing.sellerName || 'لاعب')}</b><br>
            المورد: ${resInfo?.icon || ''} ${resInfo?.label || ''}<br>
            الكمية المتاحة: ${listing.quantity}<br>
            السعر: ${listing.pricePerUnit} مال / وحدة
        `;
    }
    if (qtyInput) { qtyInput.value = ''; qtyInput.max = listing.quantity; }
    if (errorEl) errorEl.textContent = '';

    if (modal) modal.style.display = 'flex';
}

function closeBuyModal() {
    const modal = document.getElementById('buy-modal');
    if (modal) modal.style.display = 'none';
    activeBuyListingId = null;
}

// تنفيذ عملية الشراء داخل معاملة واحدة تلمس 4 مستندات: الإعلان، المشتري، البائع، دولة البائع (للضريبة)
async function confirmBuyListing() {
    if (!activeBuyListingId) return;

    const errorEl = document.getElementById('buy-modal-error');
    const confirmBtn = document.getElementById('confirm-buy-btn');
    const purchaseQty = parseInt(document.getElementById('buy-quantity-input')?.value, 10);

    if (!Number.isFinite(purchaseQty) || purchaseQty <= 0) {
        if (errorEl) errorEl.textContent = 'أدخل كمية صحيحة';
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user) return;

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'جاري الشراء...'; }
    if (errorEl) errorEl.textContent = '';

    const db = firebase.firestore();
    const listingRef = db.collection('market_listings').doc(activeBuyListingId);
    const buyerRef = db.collection('players').doc(user.uid);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const listingDoc = await transaction.get(listingRef);
            if (!listingDoc.exists) throw new Error('الإعلان لم يعد متاحاً');

            const listing = listingDoc.data();
            if (listing.status !== 'active') throw new Error('الإعلان لم يعد نشطاً');
            if (listing.sellerUid === user.uid) throw new Error('لا يمكنك الشراء من إعلانك الخاص');
            if (purchaseQty > listing.quantity) throw new Error(`الكمية المتاحة فقط ${listing.quantity}`);

            const sellerRef = db.collection('players').doc(listing.sellerUid);
            const sellerCountryRef = db.collection('countries').doc(listing.sellerCountryKey || "morocco");

            const [buyerDoc, sellerCountryDoc] = await Promise.all([
                transaction.get(buyerRef),
                transaction.get(sellerCountryRef)
            ]);

            const buyerData = buyerDoc.data() || {};
            const totalCost = purchaseQty * listing.pricePerUnit;

            if ((buyerData.money ?? 0) < totalCost) throw new Error('لا تملك مالاً كافياً لإتمام الشراء');

            const taxRate = sellerCountryDoc.exists && typeof sellerCountryDoc.data().marketTaxRate === 'number'
                ? sellerCountryDoc.data().marketTaxRate
                : DEFAULT_MARKET_TAX_RATE;
            const taxAmount = Math.round(totalCost * taxRate);
            const sellerReceives = totalCost - taxAmount;

            const remainingQty = listing.quantity - purchaseQty;
            transaction.update(listingRef, {
                quantity: remainingQty,
                status: remainingQty <= 0 ? 'sold_out' : 'active'
            });

            transaction.update(buyerRef, {
                money: firebase.firestore.FieldValue.increment(-totalCost),
                [listing.resourceType]: firebase.firestore.FieldValue.increment(purchaseQty)
            });

            transaction.update(sellerRef, {
                money: firebase.firestore.FieldValue.increment(sellerReceives)
            });

            if (taxAmount > 0) {
                transaction.update(sellerCountryRef, {
                    treasury: firebase.firestore.FieldValue.increment(taxAmount)
                });
            }

            return { totalCost, taxAmount, resourceType: listing.resourceType, purchaseQty };
        });

        const resInfo = MARKET_RESOURCE_TYPES[result.resourceType];
        alert(`✅ اشتريت ${result.purchaseQty} ${resInfo?.label || ''} بـ ${result.totalCost} مال (ضريبة الدولة: ${result.taxAmount})`);
        closeBuyModal();
    } catch (err) {
        console.error("خطأ أثناء الشراء:", err);
        if (errorEl) errorEl.textContent = err.message || 'فشلت عملية الشراء، حاول مرة أخرى';
    } finally {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'تأكيد الشراء'; }
    }
}

// ==========================================
// ⚔️ نظام الحروب
// ==========================================
function handleWarsViewUpdate(data) {
    const countryKey = data.current_location || "morocco";

    if (countryKey !== lastSubscribedWarLocation) {
        lastSubscribedWarLocation = countryKey;
        subscribeCountryWar(countryKey);
        subscribeTrainingRound(countryKey);
    }

    if (!unsubscribeAllWars) {
        subscribeAllWars();
    }

    refreshCombatEnergyDisplay(data);
    maybeRegenCombatEnergy(data);
    renderWeaponsMarket(data);
}

// جولة التدريب الدائمة الخاصة بدولة اللاعب — مستند واحد لكل دولة، يتجدد تلقائياً كل 24 ساعة
function subscribeTrainingRound(countryKey) {
    if (unsubscribeTrainingRound) { unsubscribeTrainingRound(); unsubscribeTrainingRound = null; }

    const roundRef = firebase.firestore().collection('training_rounds').doc(countryKey);

    unsubscribeTrainingRound = roundRef.onSnapshot((doc) => {
        if (!doc.exists) {
            // أول جولة لهذه الدولة — ينشئها أول لاعب يفتح صفحة الحروب فيها
            roundRef.set({
                countryKey,
                attackerDamage: 0,
                defenderDamage: 0,
                roundEndAt: getNextUtcMidnightMs(),
                roundId: generateRoundId()
            }).catch(err => console.error("خطأ أثناء إنشاء جولة التدريب:", err));
            return;
        }

        currentTrainingRound = { id: doc.id, ...doc.data() };
        maybeResetTrainingRound();
        renderTrainingRoundBar();
    }, (err) => console.error("خطأ في جلب جولة التدريب:", err));
}

// إعادة تدوير الجولة تلقائياً لما ينتهي وقتها (بمعاملة آمنة تمنع التصفير المزدوج من أكثر من لاعب بنفس اللحظة)
async function maybeResetTrainingRound() {
    if (!currentTrainingRound) return;
    if (Date.now() < currentTrainingRound.roundEndAt) return;

    const roundRef = firebase.firestore().collection('training_rounds').doc(currentTrainingRound.id);
    try {
        await firebase.firestore().runTransaction(async (transaction) => {
            const doc = await transaction.get(roundRef);
            const data = doc.data();
            if (!data || Date.now() < data.roundEndAt) return; // لاعب ثاني سبقنا بالتصفير

            transaction.update(roundRef, {
                attackerDamage: 0,
                defenderDamage: 0,
                roundEndAt: getNextUtcMidnightMs(),
                roundId: generateRoundId() // جولة جديدة = معرّف جديد، لتمييز مشاركي الجولة الجديدة عن السابقة
            });
        });
    } catch (err) {
        console.error("خطأ أثناء إعادة تدوير جولة التدريب:", err);
    }
}

function renderTrainingRoundBar() {
    const barContainer = document.getElementById('training-round-bar-container');
    const countdownEl = document.getElementById('training-round-countdown');
    if (!barContainer || !currentTrainingRound) return;

    barContainer.innerHTML = `
        <div onclick="openTrainingRoundDetailsModal()" style="cursor:pointer;" title="اضغط لعرض ترتيب المشاركين">
            ${renderTwoToneBarHtml(currentTrainingRound.attackerDamage || 0, currentTrainingRound.defenderDamage || 0)}
            <div style="display:flex;justify-content:space-between;margin-top:5px;color:#a0aec0;font-size:11px;">
                <span>👊 المهاجمون</span>
                <span>🛡️ المدافعون</span>
            </div>
            <div style="text-align:center;color:#4a5568;font-size:10px;margin-top:2px;">اضغط لعرض ترتيب المشاركين</div>
        </div>
    `;

    if (trainingRoundCountdownInterval) clearInterval(trainingRoundCountdownInterval);
    trainingRoundCountdownInterval = setInterval(() => {
        if (!currentTrainingRound || !countdownEl) return;
        const msLeft = Math.max(0, currentTrainingRound.roundEndAt - Date.now());
        countdownEl.textContent = msLeft > 0 ? `⏳ جولة جديدة خلال ${formatTimeShort(msLeft)}` : "⏳ جاري بدء جولة جديدة...";
        if (msLeft <= 0) { clearInterval(trainingRoundCountdownInterval); maybeResetTrainingRound(); }
    }, 1000);
}

// اشتراك مزدوج (بلد كـ"دولة أ" أو "دولة ب") لأن Firestore ما يدعم OR مباشر بين حقلين
function subscribeCountryWar(countryKey) {
    if (unsubscribeCountryWarA) { unsubscribeCountryWarA(); unsubscribeCountryWarA = null; }
    if (unsubscribeCountryWarB) { unsubscribeCountryWarB(); unsubscribeCountryWarB = null; }

    const db = firebase.firestore();
    let warFromA = null, warFromB = null;

    const updateCombined = () => {
        currentCountryWar = warFromA || warFromB || null;
        renderCountryWarBlock(countryKey);
    };

    unsubscribeCountryWarA = db.collection('wars')
        .where('status', '==', 'active')
        .where('countryA', '==', countryKey)
        .onSnapshot((snap) => {
            warFromA = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
            updateCombined();
        }, (err) => console.error("خطأ في جلب حرب الدولة (أ):", err));

    unsubscribeCountryWarB = db.collection('wars')
        .where('status', '==', 'active')
        .where('countryB', '==', countryKey)
        .onSnapshot((snap) => {
            warFromB = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
            updateCombined();
        }, (err) => console.error("خطأ في جلب حرب الدولة (ب):", err));
}

function subscribeAllWars() {
    unsubscribeAllWars = firebase.firestore().collection('wars')
        .where('status', '==', 'active')
        .onSnapshot((snapshot) => {
            currentAllWarsCache = [];
            snapshot.forEach(doc => currentAllWarsCache.push({ id: doc.id, ...doc.data() }));
            renderAllWarsList();
        }, (err) => console.error("خطأ في جلب كل الحروب:", err));
}

// بلوك 1: حالة حرب دولة اللاعب الحالية
function renderCountryWarBlock(countryKey) {
    const container = document.getElementById('country-war-container');
    if (!container) return;

    if (!currentCountryWar) {
        container.innerHTML = `
            <p style="color:#718096;font-size:14px;text-align:center;margin:10px 0;">لا توجد حروب قائمة في دولتك حالياً</p>
            <button onclick="declareWar()" style="width:100%;background:#742a2a;color:#fff;border:none;padding:12px;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer;">🚨 إعلان حرب (مؤقت لحين نظام الرئيس/البرلمان)</button>
        `;
        return;
    }

    container.innerHTML = renderWarCardHtml(currentCountryWar, true);
}

// بطاقة حرب موحّدة (تُستخدم ببلوك 1 وبلوك 3 معاً)
function renderWarCardHtml(war, showOpenButton) {
    const endAt = war.endAt?.toMillis ? war.endAt.toMillis() : war.endAt;
    const msLeft = Math.max(0, (endAt || 0) - Date.now());
    const timeLeftText = msLeft > 0 ? formatTimeShort(msLeft) : "انتهت";

    return `
        <div style="background:#0f1620;border:1px solid #2d3748;border-radius:10px;padding:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="text-align:center;flex:1;">
                    <div style="font-size:28px;">${war.countryAFlag || '🏳️'}</div>
                    <div style="color:#fff;font-size:12px;font-weight:bold;">${escapeHtml(war.countryAName || war.countryA)}</div>
                </div>
                <div style="text-align:center;flex:1;">
                    ${showOpenButton ? `<button onclick="openTrainingModal()" style="background:#742a2a;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:bold;font-size:13px;cursor:pointer;">⚔️ ادخل الحرب</button>` : ''}
                </div>
                <div style="text-align:center;flex:1;">
                    <div style="font-size:28px;">${war.countryBFlag || '🏳️'}</div>
                    <div style="color:#fff;font-size:12px;font-weight:bold;">${escapeHtml(war.countryBName || war.countryB)}</div>
                </div>
            </div>
            <div style="text-align:center;color:#fc8181;font-weight:bold;font-size:13px;margin-bottom:6px;">⏳ ${timeLeftText}</div>
            <div onclick="openWarDetailsModal('${war.id}')" style="cursor:pointer;" title="اضغط لعرض تفاصيل المشاركين">
                ${renderTwoToneBarHtml(war.countryADamage || 0, war.countryBDamage || 0)}
                <div style="display:flex;justify-content:space-between;margin-top:5px;color:#a0aec0;font-size:11px;">
                    <span>👊 المهاجمون</span>
                    <span>🛡️ المدافعون</span>
                </div>
                <div style="text-align:center;color:#4a5568;font-size:10px;margin-top:2px;">اضغط لعرض ترتيب المشاركين</div>
            </div>
            ${!showOpenButton ? `
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button onclick="travelToCountry('${war.countryA}')" style="flex:1;background:#2d3748;color:#fff;border:none;padding:8px;border-radius:6px;font-size:12px;cursor:pointer;">✈️ سافر لـ ${escapeHtml(war.countryAName || war.countryA)}</button>
                <button onclick="travelToCountry('${war.countryB}')" style="flex:1;background:#2d3748;color:#fff;border:none;padding:8px;border-radius:6px;font-size:12px;cursor:pointer;">✈️ سافر لـ ${escapeHtml(war.countryBName || war.countryB)}</button>
            </div>` : ''}
        </div>
    `;
}

// بلوك 3: كل الحروب النشطة بأفريقيا
function renderAllWarsList() {
    const container = document.getElementById('all-wars-container');
    if (!container) return;

    if (currentAllWarsCache.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد حروب نشطة بالقارة حالياً</p>';
        return;
    }

    container.innerHTML = currentAllWarsCache.map(war => renderWarCardHtml(war, false)).join('<div style="height:10px;"></div>');
}

let warDetailsCountdownInterval = null;

// البحث عن حرب في أي من الكاشات المتاحة (حرب دولتي، أو كل حروب القارة)
function findWarById(warId) {
    if (currentCountryWar && currentCountryWar.id === warId) return currentCountryWar;
    return currentAllWarsCache.find(w => w.id === warId) || null;
}

async function openWarDetailsModal(warId) {
    const war = findWarById(warId);
    if (!war) return;

    const modal = document.getElementById('war-details-modal');
    const attackersList = document.getElementById('war-details-attackers-list');
    const defendersList = document.getElementById('war-details-defenders-list');
    const attackersTitle = document.getElementById('war-details-attackers-title');
    const defendersTitle = document.getElementById('war-details-defenders-title');
    const countdownEl = document.getElementById('war-details-countdown');

    if (attackersTitle) attackersTitle.textContent = `👊 ${war.countryAName || war.countryA}`;
    if (defendersTitle) defendersTitle.textContent = `🛡️ ${war.countryBName || war.countryB}`;
    if (attackersList) attackersList.innerHTML = '<p style="color:#718096;font-size:12px;text-align:center;">جاري التحميل...</p>';
    if (defendersList) defendersList.innerHTML = '<p style="color:#718096;font-size:12px;text-align:center;">جاري التحميل...</p>';

    if (modal) modal.style.display = 'flex';

    // عداد تنازلي حي يتحدث كل ثانية طالما النافذة مفتوحة
    if (warDetailsCountdownInterval) clearInterval(warDetailsCountdownInterval);
    const endAt = war.endAt?.toMillis ? war.endAt.toMillis() : war.endAt;
    warDetailsCountdownInterval = setInterval(() => {
        const msLeft = Math.max(0, (endAt || 0) - Date.now());
        if (countdownEl) countdownEl.textContent = msLeft > 0 ? `⏳ متبقي: ${formatTimeShort(msLeft)}` : "⏳ انتهت الحرب";
        if (msLeft <= 0) clearInterval(warDetailsCountdownInterval);
    }, 1000);

    try {
        const snapshot = await firebase.firestore()
            .collection('wars').doc(warId).collection('participants')
            .orderBy('totalDamage', 'desc')
            .get();

        const attackers = [];
        const defenders = [];
        snapshot.forEach(doc => {
            const p = doc.data();
            (p.side === 'A' ? attackers : defenders).push(p);
        });

        const renderList = (list) => list.length === 0
            ? '<p style="color:#718096;font-size:12px;text-align:center;">لا يوجد مشاركون بعد</p>'
            : list.map((p, i) => `
                <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#0f1620;border-radius:6px;margin-bottom:4px;font-size:12px;">
                    <span style="color:#fff;">${i + 1}. ${escapeHtml(p.name || 'لاعب')}</span>
                    <span style="color:#fc8181;font-weight:bold;">${p.totalDamage || 0}</span>
                </div>
            `).join('');

        if (attackersList) attackersList.innerHTML = renderList(attackers);
        if (defendersList) defendersList.innerHTML = renderList(defenders);
    } catch (err) {
        console.error("خطأ أثناء جلب تفاصيل المشاركين:", err);
        if (attackersList) attackersList.innerHTML = '<p style="color:#fc8181;font-size:12px;text-align:center;">تعذر التحميل</p>';
        if (defendersList) defendersList.innerHTML = '<p style="color:#fc8181;font-size:12px;text-align:center;">تعذر التحميل</p>';
    }
}

function closeWarDetailsModal() {
    const modal = document.getElementById('war-details-modal');
    if (modal) modal.style.display = 'none';
    if (warDetailsCountdownInterval) { clearInterval(warDetailsCountdownInterval); warDetailsCountdownInterval = null; }
}

// نافذة ترتيب مشاركي جولة التدريب الدائمة — نفس فكرة تفاصيل الحرب، بس على مستوى الدولة/التدريب
async function openTrainingRoundDetailsModal() {
    if (!currentTrainingRound) return;

    const modal = document.getElementById('training-round-details-modal');
    const attackersList = document.getElementById('training-round-attackers-list');
    const defendersList = document.getElementById('training-round-defenders-list');
    const countdownEl = document.getElementById('training-round-details-countdown');

    if (attackersList) attackersList.innerHTML = '<p style="color:#718096;font-size:12px;text-align:center;">جاري التحميل...</p>';
    if (defendersList) defendersList.innerHTML = '<p style="color:#718096;font-size:12px;text-align:center;">جاري التحميل...</p>';

    if (modal) modal.style.display = 'flex';

    // عداد تنازلي حي (نفس عداد الجولة، لكن داخل النافذة) طالما هي مفتوحة
    if (trainingRoundDetailsCountdownInterval) clearInterval(trainingRoundDetailsCountdownInterval);
    trainingRoundDetailsCountdownInterval = setInterval(() => {
        if (!currentTrainingRound || !countdownEl) return;
        const msLeft = Math.max(0, currentTrainingRound.roundEndAt - Date.now());
        countdownEl.textContent = msLeft > 0 ? `⏳ جولة جديدة خلال ${formatTimeShort(msLeft)}` : "⏳ جاري بدء جولة جديدة...";
        if (msLeft <= 0) clearInterval(trainingRoundDetailsCountdownInterval);
    }, 1000);

    try {
        const snapshot = await firebase.firestore()
            .collection('training_rounds').doc(currentTrainingRound.id).collection('participants')
            .orderBy('totalDamage', 'desc')
            .get();

        // الكولكشن يحتفظ بمشاركي كل الجولات القديمة أيضاً — نعرض فقط من ينتمي لمعرّف الجولة الحالية
        const currentRoundId = currentTrainingRound.roundId;
        const attackers = [];
        const defenders = [];
        snapshot.forEach(doc => {
            const p = doc.data();
            if (p.roundId !== currentRoundId) return;
            (p.role === 'attacker' ? attackers : defenders).push(p);
        });

        const renderList = (list) => list.length === 0
            ? '<p style="color:#718096;font-size:12px;text-align:center;">لا يوجد مشاركون بعد</p>'
            : list.map((p, i) => `
                <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#0f1620;border-radius:6px;margin-bottom:4px;font-size:12px;">
                    <span style="color:#fff;">${i + 1}. ${escapeHtml(p.name || 'لاعب')}</span>
                    <span style="color:#fc8181;font-weight:bold;">${p.totalDamage || 0}</span>
                </div>
            `).join('');

        if (attackersList) attackersList.innerHTML = renderList(attackers);
        if (defendersList) defendersList.innerHTML = renderList(defenders);
    } catch (err) {
        console.error("خطأ أثناء جلب ترتيب مشاركي التدريب:", err);
        if (attackersList) attackersList.innerHTML = '<p style="color:#fc8181;font-size:12px;text-align:center;">تعذر التحميل</p>';
        if (defendersList) defendersList.innerHTML = '<p style="color:#fc8181;font-size:12px;text-align:center;">تعذر التحميل</p>';
    }
}

function closeTrainingRoundDetailsModal() {
    const modal = document.getElementById('training-round-details-modal');
    if (modal) modal.style.display = 'none';
    if (trainingRoundDetailsCountdownInterval) { clearInterval(trainingRoundDetailsCountdownInterval); trainingRoundDetailsCountdownInterval = null; }
}

// إعلان حرب — آلية مؤقتة: أي لاعب بالدولة يقدر يعلنها لحين نظام الرئيس/البرلمان
async function declareWar() {
    if (currentCountryWar) { alert('⚠️ دولتك بحرب نشطة أصلاً!'); return; }
    if (!localPlayerData) return;

    const targetKey = prompt('أدخل رمز الدولة المستهدفة (مثال: egypt):');
    if (!targetKey || !africanCountries[targetKey]) { alert('🔴 رمز دولة غير صحيح'); return; }

    const myCountryKey = localPlayerData.current_location || "morocco";
    if (targetKey === myCountryKey) { alert('🔴 لا يمكنك إعلان حرب على دولتك نفسها'); return; }

    if (!confirm(`هل أنت متأكد من إعلان الحرب على ${africanCountries[targetKey].name}؟`)) return;

    try {
        const db = firebase.firestore();
        const now = Date.now();
        await db.collection('wars').add({
            countryA: myCountryKey,
            countryAName: africanCountries[myCountryKey]?.name || myCountryKey,
            countryAFlag: africanCountries[myCountryKey]?.flag || '🏳️',
            countryB: targetKey,
            countryBName: africanCountries[targetKey]?.name || targetKey,
            countryBFlag: africanCountries[targetKey]?.flag || '🏳️',
            countryADamage: 0,
            countryBDamage: 0,
            status: 'active',
            winner: null,
            startAt: firebase.firestore.FieldValue.serverTimestamp(),
            endAt: now + WAR_DURATION_HOURS * 60 * 60 * 1000
        });
        alert('🚨 تم إعلان الحرب!');
    } catch (err) {
        console.error("خطأ أثناء إعلان الحرب:", err);
        alert('فشل إعلان الحرب، حاول مرة أخرى');
    }
}

// نافذة التدريب/القتال
function openTrainingModal() {
    selectedCombatRole = null;
    selectedCombatWeaponId = null;

    const modal = document.getElementById('training-modal');
    const roleNote = document.getElementById('training-role-note');
    const contextNote = document.getElementById('training-context-note');
    const weaponSelect = document.getElementById('training-weapon-select');
    const executeBtn = document.getElementById('btn-execute-combat');
    const weaponWarning = document.getElementById('training-no-weapon-warning');

    if (contextNote) {
        contextNote.textContent = currentCountryWar
            ? '⚔️ دولتك بحرب فعلية — ضررك الآن يُحتسب حقيقياً بنتيجة الحرب!'
            : '🥋 وضع تدريب دائم لدولتك — الضرر يُحتسب بجولة التدريب، وتكسب XP فعلي';
    }
    if (roleNote) roleNote.textContent = 'اختر دورك أولاً';

    const inventory = localPlayerData?.weaponInventory || {};
    const ownedWeapons = WEAPONS_CATALOG.filter(w => (inventory[w.id] ?? 0) > 0);

    if (weaponSelect) {
        if (ownedWeapons.length === 0) {
            weaponSelect.innerHTML = '<option value="">لا تملك أي سلاح</option>';
            weaponSelect.disabled = true;
        } else {
            weaponSelect.disabled = false;
            weaponSelect.innerHTML = ownedWeapons
                .map(w => `<option value="${w.id}">${w.icon} ${w.name} (متبقي ${inventory[w.id]} وحدة)</option>`)
                .join('');
            selectedCombatWeaponId = ownedWeapons[0].id;
        }
    }

    // قفل القتال بالكامل لو اللاعب ما يملك أي سلاح إطلاقاً
    const canFight = ownedWeapons.length > 0;
    if (executeBtn) {
        executeBtn.disabled = !canFight;
        executeBtn.style.opacity = canFight ? '1' : '0.5';
        executeBtn.style.cursor = canFight ? 'pointer' : 'not-allowed';
    }
    if (weaponWarning) {
        weaponWarning.style.display = canFight ? 'none' : 'block';
    }

    renderTrainingRoundBar();
    refreshCombatEnergyDisplay(localPlayerData);

    if (modal) modal.style.display = 'flex';
}

function onTrainingWeaponChange(weaponId) {
    selectedCombatWeaponId = weaponId;
}

function closeTrainingModal() {
    const modal = document.getElementById('training-modal');
    if (modal) modal.style.display = 'none';
    if (trainingRoundCountdownInterval) { clearInterval(trainingRoundCountdownInterval); trainingRoundCountdownInterval = null; }
}

function selectCombatRole(role) {
    selectedCombatRole = role;
    const roleNote = document.getElementById('training-role-note');
    if (roleNote) roleNote.textContent = `دورك المختار: ${role === 'attacker' ? '⚔️ مهاجم' : '🛡️ مدافع'}`;

    document.querySelectorAll('.btn-combat-role').forEach(btn => {
        const isSelected = btn.getAttribute('data-role') === role;
        btn.style.outline = isSelected ? '2px solid #fff' : 'none';
    });
}

async function executeCombatRound() {
    if (!selectedCombatRole) { alert('⚠️ اختر دورك (مهاجم أو مدافع) أولاً'); return; }
    if (!selectedCombatWeaponId) { alert('🔴 يجب اختيار سلاح من مخزونك لتتمكن من القتال! اشترِ سلاحاً أولاً من سوق الأسلحة'); return; }

    const user = firebase.auth().currentUser;
    if (!user || !localPlayerData) return;

    const cap = getCombatEnergyCap(localPlayerData.energyLevel);
    const currentEnergy = localPlayerData.combatEnergy ?? cap;
    if (currentEnergy < MIN_ENERGY_TO_FIGHT) {
        alert(`🔴 تحتاج ${MIN_ENERGY_TO_FIGHT} طاقة قتال على الأقل!`);
        return;
    }

    const weaponId = selectedCombatWeaponId;
    const db = firebase.firestore();
    const playerRef = db.collection('players').doc(user.uid);

    try {
        if (currentCountryWar) {
            const warRef = db.collection('wars').doc(currentCountryWar.id);
            const participantRef = warRef.collection('participants').doc(user.uid);

            const result = await db.runTransaction(async (transaction) => {
                const [playerDoc, warDoc] = await Promise.all([
                    transaction.get(playerRef),
                    transaction.get(warRef)
                ]);
                const playerData = playerDoc.data() || {};
                const warData = warDoc.data();

                if (!warData || warData.status !== 'active') throw new Error('الحرب لم تعد نشطة');

                const spentEnergy = playerData.combatEnergy ?? getCombatEnergyCap(playerData.energyLevel);
                if (spentEnergy < MIN_ENERGY_TO_FIGHT) throw new Error(`تحتاج ${MIN_ENERGY_TO_FIGHT} طاقة قتال على الأقل`);

                const availableUnits = (playerData.weaponInventory || {})[weaponId] ?? 0;
                if (availableUnits <= 0) {
                    const weaponInfo = WEAPONS_CATALOG.find(w => w.id === weaponId);
                    throw new Error(`لا تملك أي وحدات من ${weaponInfo?.name || 'هذا السلاح'} حالياً`);
                }

                const { damage, energyUnits } = calculateCombatDamage(playerData, spentEnergy, weaponId, availableUnits);

                const xpGain = Math.round(damage * WAR_XP_PER_DAMAGE);
                const myCountry = playerData.current_location || "morocco";
                const isSideA = warData.countryA === myCountry;
                const damageField = isSideA ? 'countryADamage' : 'countryBDamage';

                transaction.update(warRef, {
                    [damageField]: firebase.firestore.FieldValue.increment(damage)
                });
                transaction.set(participantRef, {
                    name: (playerData.name || 'لاعب').trim(),
                    countryKey: myCountry,
                    side: isSideA ? 'A' : 'B',
                    totalDamage: firebase.firestore.FieldValue.increment(damage)
                }, { merge: true });

                transaction.update(playerRef, {
                    combatEnergy: 0,
                    experience: firebase.firestore.FieldValue.increment(xpGain),
                    [`weaponInventory.${weaponId}`]: firebase.firestore.FieldValue.increment(-energyUnits)
                });

                return { damage, xpGain };
            });

            alert(`⚔️ ألحقت ${result.damage} نقطة ضرر بصف دولتك! + ⭐ ${result.xpGain} XP`);
        } else {
            if (!currentTrainingRound) { alert('⚠️ جولة التدريب لسه ما جهزت، انتظر ثانية وحاول مجدداً'); return; }

            const roundRef = db.collection('training_rounds').doc(currentTrainingRound.id);
            const participantRef = roundRef.collection('participants').doc(user.uid);

            const result = await db.runTransaction(async (transaction) => {
                // كل القراءات أولاً (متطلب إلزامي بمعاملات Firestore) قبل أي كتابة بالأسفل
                const [playerDoc, roundDoc, participantDoc] = await Promise.all([
                    transaction.get(playerRef),
                    transaction.get(roundRef),
                    transaction.get(participantRef)
                ]);

                const playerData = playerDoc.data() || {};
                const roundData = roundDoc.data();
                if (!roundData) throw new Error('جولة التدريب غير موجودة، حاول مجدداً');

                // إصلاح ذاتي: مستندات الجولات القديمة (قبل إضافة roundId) لا تملك هذا الحقل بعد —
                // نولّد له قيمة الآن بدل انتظار إعادة التدوير القادمة كل 24 ساعة
                const effectiveRoundId = roundData.roundId || generateRoundId();

                const spentEnergy = playerData.combatEnergy ?? getCombatEnergyCap(playerData.energyLevel);
                if (spentEnergy < MIN_ENERGY_TO_FIGHT) throw new Error(`تحتاج ${MIN_ENERGY_TO_FIGHT} طاقة قتال على الأقل`);

                const availableUnits = (playerData.weaponInventory || {})[weaponId] ?? 0;
                if (availableUnits <= 0) {
                    const weaponInfo = WEAPONS_CATALOG.find(w => w.id === weaponId);
                    throw new Error(`لا تملك أي وحدات من ${weaponInfo?.name || 'هذا السلاح'} حالياً`);
                }

                const { damage, energyUnits } = calculateCombatDamage(playerData, spentEnergy, weaponId, availableUnits);

                const xpGain = Math.round(damage * TRAINING_XP_PER_DAMAGE);
                const damageField = selectedCombatRole === 'attacker' ? 'attackerDamage' : 'defenderDamage';

                // إجمالي ضرر المشارك: يتراكم فقط إذا كان من نفس الجولة الحالية (roundId مطابق)،
                // وإلا يبدأ من الصفر لأن مستنده يعود لجولة قديمة انتهت وتصفّرت
                const existingParticipant = participantDoc.exists ? participantDoc.data() : null;
                const isSameRound = existingParticipant && existingParticipant.roundId === effectiveRoundId;
                const newTotalDamage = (isSameRound ? (existingParticipant.totalDamage || 0) : 0) + damage;

                transaction.update(roundRef, {
                    [damageField]: firebase.firestore.FieldValue.increment(damage),
                    roundId: effectiveRoundId // يثبّت الحقل لو كان مفقوداً، ولا يغيّر شيئاً لو كان موجوداً أصلاً
                });
                transaction.set(participantRef, {
                    name: (playerData.name || 'لاعب').trim(),
                    role: selectedCombatRole, // 'attacker' | 'defender'
                    totalDamage: newTotalDamage,
                    roundId: effectiveRoundId
                });
                transaction.update(playerRef, {
                    combatEnergy: 0,
                    experience: firebase.firestore.FieldValue.increment(xpGain),
                    [`weaponInventory.${weaponId}`]: firebase.firestore.FieldValue.increment(-energyUnits)
                });

                return { damage, xpGain };
            });

            alert(`🥋 ضرر تدريبي: ${result.damage} + ⭐ ${result.xpGain} XP`);
        }
    } catch (err) {
        console.error("خطأ أثناء تنفيذ المعركة:", err);
        alert(`🔴 ${err.message || 'حدث خطأ'}`);
    }
}

function refreshCombatEnergyDisplay(data) {
    if (!data) return;
    const cap = getCombatEnergyCap(data.energyLevel);
    const current = Math.max(0, Math.min(data.combatEnergy ?? cap, cap));

    setText('combat-energy-text', `${current} / ${cap}`);
    const barEl = document.getElementById('combat-energy-bar');
    if (barEl) barEl.style.width = `${(current / cap) * 100}%`;

    const btn = document.getElementById('btn-execute-combat');
    if (btn) {
        const notEnough = current < MIN_ENERGY_TO_FIGHT;
        btn.disabled = notEnough;
        btn.style.opacity = notEnough ? '0.5' : '1';
        btn.style.cursor = notEnough ? 'not-allowed' : 'pointer';
    }

    const regenTextEl = document.getElementById('combat-energy-regen-text');
    if (regenTextEl) {
        if (current >= cap) {
            regenTextEl.textContent = "المخزون ممتلئ";
        } else {
            const last = data.combatEnergyLastUpdate || Date.now();
            const cycleMs = COMBAT_ENERGY_REGEN_MINUTES * 60000;
            const elapsedInCycle = (Date.now() - last) % cycleMs;
            const msLeft = cycleMs - elapsedInCycle;
            const minutesLeft = Math.max(1, Math.ceil(msLeft / 60000));
            regenTextEl.textContent = `⏳ +${COMBAT_ENERGY_REGEN_AMOUNT} خلال ${minutesLeft} دقيقة`;
        }
    }
}

function maybeRegenCombatEnergy(data) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const cap = getCombatEnergyCap(data.energyLevel);

    if (data.combatEnergy === undefined || data.combatEnergyLastUpdate === undefined) {
        firebase.firestore().collection('players').doc(user.uid).update({
            combatEnergy: data.combatEnergy ?? cap,
            combatEnergyLastUpdate: Date.now()
        }).catch(err => console.error(err));
        return;
    }

    if (data.combatEnergy >= cap) return;

    const now = Date.now();
    const cycleMs = COMBAT_ENERGY_REGEN_MINUTES * 60000;
    const ticks = Math.floor((now - data.combatEnergyLastUpdate) / cycleMs);

    if (ticks > 0) {
        const newValue = Math.min(cap, data.combatEnergy + ticks * COMBAT_ENERGY_REGEN_AMOUNT);
        const newLast = data.combatEnergyLastUpdate + ticks * cycleMs;

        firebase.firestore().collection('players').doc(user.uid).update({
            combatEnergy: newValue,
            combatEnergyLastUpdate: newLast
        }).catch(err => console.error(err));
    }
}

// بلوك 4: سوق الأسلحة
function renderWeaponsMarket(data) {
    const container = document.getElementById('weapons-market-container');
    if (!container || !data) return;

    const inventory = data.weaponInventory || {};
    const educationLevel = data.educationLevel ?? 1;

    container.innerHTML = WEAPONS_CATALOG.map(weapon => {
        const unitPrice = getWeaponPrice(weapon.basePrice, educationLevel);
        const owned = inventory[weapon.id] ?? 0;

        return `
            <div style="background:#0f1620;border:1px solid #2d3748;border-radius:10px;padding:10px;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <div style="font-size:26px;flex-shrink:0;">${weapon.icon}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="color:#fff;font-weight:bold;font-size:14px;">${weapon.name}</div>
                        <div style="color:#a0aec0;font-size:12px;">⚔️ ضرر ${weapon.damage} · 💵 ${unitPrice}/وحدة</div>
                    </div>
                    <div style="color:#38a169;font-weight:bold;font-size:13px;flex-shrink:0;">لديك: ${owned}</div>
                </div>
                <div style="display:flex;gap:8px;">
                    <input type="number" class="weapon-qty-input" data-weapon-id="${weapon.id}" value="1" min="1" style="flex:1;box-sizing:border-box;background:#1a1f26;border:1px solid #2d3748;color:#fff;padding:8px;border-radius:6px;font-size:13px;text-align:center;">
                    <button class="btn-buy-weapon" data-weapon-id="${weapon.id}" style="background:#3182ce;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;white-space:nowrap;">شراء</button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.btn-buy-weapon').forEach(btn => {
        btn.addEventListener('click', () => {
            const weaponId = btn.getAttribute('data-weapon-id');
            const qtyInput = container.querySelector(`.weapon-qty-input[data-weapon-id="${weaponId}"]`);
            const quantity = parseInt(qtyInput?.value, 10);
            buyWeaponUnits(weaponId, quantity);
        });
    });
}

async function buyWeaponUnits(weaponId, quantity) {
    const weapon = WEAPONS_CATALOG.find(w => w.id === weaponId);
    if (!weapon || !localPlayerData) return;

    if (!Number.isFinite(quantity) || quantity <= 0) {
        alert('🔴 أدخل كمية صحيحة');
        return;
    }

    const unitPrice = getWeaponPrice(weapon.basePrice, localPlayerData.educationLevel);
    const totalPrice = unitPrice * quantity;

    if ((localPlayerData.money ?? 0) < totalPrice) {
        alert(`🔴 لا تملك مالاً كافياً (التكلفة الإجمالية: ${totalPrice})`);
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        await firebase.firestore().collection('players').doc(user.uid).update({
            money: firebase.firestore.FieldValue.increment(-totalPrice),
            [`weaponInventory.${weaponId}`]: firebase.firestore.FieldValue.increment(quantity)
        });
        alert(`✅ اشتريت ${quantity} وحدة ${weapon.name} بـ ${totalPrice} مال`);
    } catch (err) {
        console.error("خطأ أثناء شراء السلاح:", err);
        alert('فشل الشراء، حاول مرة أخرى');
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


// ربط حقل رفع صورة المصنع عبر Event Delegation (وليس ربطاً مباشراً)
// لأن صفحة العمل الآن تُحقن ديناميكياً بعد تحميل هذا الموديول — الربط المباشر
// كان سيفشل بصمت لأن العنصر ما يكون موجوداً بالـ DOM وقت تنفيذ هذا السطر
document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'factory-file-input') {
        handleFactoryFileSelect(event);
    }
});

// فحص دوري كل 30 ثانية لتحديث عرض مشروب الطاقة واسترجاعه تلقائياً حتى دون أي تغيير آخر في البيانات
setInterval(() => {
    if (localPlayerData) {
        refreshWorkEnergyDisplay(localPlayerData);
        maybeRegenWorkEnergy(localPlayerData);
        refreshCombatEnergyDisplay(localPlayerData);
        maybeRegenCombatEnergy(localPlayerData);
    }
    if (currentTrainingRound) {
        maybeResetTrainingRound();
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
