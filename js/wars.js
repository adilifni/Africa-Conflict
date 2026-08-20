// ==========================================
// ⚔️ نظام الحروب والتدريب والقتال وسوق الأسلحة — مستخرج من game.js
// ==========================================
import { africanCountries } from './config.js';
import { formatTimeShort } from './app.js';
import { setText, escapeHtml } from './dom-utils.js';
import { getPlayerData } from './player-state.js';
import { LEVEL_BONUS_PER_LEVEL } from './skills-config.js';

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
let selectedCombatMode = null;   // 'war' | 'training' — اختيار صريح كل مرة، مستقل تماماً عن حالة الحرب
let selectedCombatRole = null; // 'attacker' | 'defender' — يخص وضع التدريب فقط، حرية اختيار كاملة كل مرة
let selectedCombatWeaponId = null; // معرف السلاح المختار من مخزون اللاعب (إلزامي، لا يوجد قتال بدون سلاح)
let currentTrainingRound = null;   // جولة التدريب الدائمة الخاصة بدولة اللاعب الحالية
let unsubscribeTrainingRound = null;
let trainingRoundCountdownInterval = null;
let trainingRoundDetailsCountdownInterval = null; // عداد نافذة ترتيب مشاركي التدريب

export function handleWarsViewUpdate(data) {
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
        renderCombatModalBar(); // تُقرر تلقائياً عرض شريط الحرب أو شريط التدريب حسب currentCountryWar
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

// يقرر أي شريط يُعرض داخل نافذة "التدريب/القتال": شريط الحرب الفعلية فقط لو اختار اللاعب صراحةً وضع "الحرب"،
// وإلا شريط جولة التدريب الدائمة دائماً — الاختيار صريح الآن، لا يُفرض تلقائياً لمجرد وجود حرب نشطة
function renderCombatModalBar() {
    const barContainer = document.getElementById('training-round-bar-container');
    const countdownEl = document.getElementById('training-round-countdown');
    if (!barContainer) return;

    if (trainingRoundCountdownInterval) { clearInterval(trainingRoundCountdownInterval); trainingRoundCountdownInterval = null; }

    if (selectedCombatMode === 'war' && currentCountryWar) {
        const war = currentCountryWar;
        barContainer.innerHTML = `
            <div onclick="openWarDetailsModal('${war.id}')" style="cursor:pointer;" title="اضغط لعرض ترتيب المشاركين">
                ${renderTwoToneBarHtml(war.countryADamage || 0, war.countryBDamage || 0)}
                <div style="display:flex;justify-content:space-between;margin-top:5px;color:#a0aec0;font-size:11px;">
                    <span>${war.countryAFlag || '🏳️'} ${escapeHtml(war.countryAName || war.countryA)}</span>
                    <span>${war.countryBFlag || '🏳️'} ${escapeHtml(war.countryBName || war.countryB)}</span>
                </div>
                <div style="text-align:center;color:#4a5568;font-size:10px;margin-top:2px;">اضغط لعرض ترتيب المشاركين</div>
            </div>
        `;

        const endAt = war.endAt?.toMillis ? war.endAt.toMillis() : war.endAt;
        trainingRoundCountdownInterval = setInterval(() => {
            if (!currentCountryWar || !countdownEl) return;
            const msLeft = Math.max(0, (endAt || 0) - Date.now());
            countdownEl.textContent = msLeft > 0 ? `⏳ تنتهي الحرب خلال ${formatTimeShort(msLeft)}` : "⏳ انتهت الحرب";
            if (msLeft <= 0) clearInterval(trainingRoundCountdownInterval);
        }, 1000);
    } else {
        renderTrainingRoundBar();
    }
}

// تحديث نص السياق (توضيح الوضع الحالي) وإظهار/إخفاء اختيار الدور (مهاجم/مدافع) — الدور يخص التدريب فقط
function updateCombatContextUI() {
    const contextNote = document.getElementById('training-context-note');
    const roleSelectBox = document.getElementById('training-role-select');
    const roleNote = document.getElementById('training-role-note');

    if (selectedCombatMode === 'war') {
        if (contextNote) contextNote.textContent = '⚔️ ستشارك بالحرب الفعلية الآن — ضررك يُحتسب مباشرة لصالح دولتك';
        if (roleSelectBox) roleSelectBox.style.display = 'none'; // لا معنى لمهاجم/مدافع بحرب حقيقية بين دولتين، الضرر يُحتسب تلقائياً لصف دولتك
    } else {
        if (contextNote) contextNote.textContent = '🥋 وضع تدريب دائم لدولتك — الضرر يُحتسب بجولة التدريب، وتكسب XP فعلي';
        if (roleSelectBox) roleSelectBox.style.display = 'flex';
        if (roleNote) roleNote.textContent = selectedCombatRole
            ? `دورك المختار: ${selectedCombatRole === 'attacker' ? '⚔️ مهاجم' : '🛡️ مدافع'}`
            : 'اختر دورك أولاً';
    }
}


// اشتراك مزدوج (بلد كـ"دولة أ" أو "دولة ب") لأن Firestore ما يدعم OR مباشر بين حقلين
function subscribeCountryWar(countryKey) {
    if (unsubscribeCountryWarA) { unsubscribeCountryWarA(); unsubscribeCountryWarA = null; }
    if (unsubscribeCountryWarB) { unsubscribeCountryWarB(); unsubscribeCountryWarB = null; }

    const db = firebase.firestore();
    let warFromA = null, warFromB = null;

    const updateCombined = () => {
        currentCountryWar = warFromA || warFromB || null;
        maybeEndWar(currentCountryWar); // تفحص فوراً هل انتهى وقت الحرب لتصفيرها تلقائياً (بدل بقائها active للأبد)
        renderCountryWarBlock(countryKey);
        renderAllWarsList(); // إعادة رسم القائمة العامة فوراً لاستبعاد/إعادة إدراج حرب دولتك بمجرد تغيّر حالتها
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

// إنهاء الحرب تلقائياً لما ينتهي وقتها (endAt) — بمعاملة آمنة تمنع الإنهاء المزدوج من أكثر من لاعب بنفس اللحظة
// الفائز = صاحب الضرر الأعلى، أو null في حال التعادل
// محاولتان: الأولى تسجّل الفائز، ولو رفضتها قواعد Firestore (حقل winner غير مسموح بعد) نعيد المحاولة
// بتحديث status فقط — حتى لا تبقى الحرب عالقة للأبد بانتظار تعديل القواعد يدوياً
async function maybeEndWar(war) {
    if (!war) return;
    const endAt = war.endAt?.toMillis ? war.endAt.toMillis() : war.endAt;
    if (!endAt || Date.now() < endAt) return;

    const warRef = firebase.firestore().collection('wars').doc(war.id);

    const computeWinner = (data) => {
        const aDamage = data.countryADamage || 0;
        const bDamage = data.countryBDamage || 0;
        if (aDamage > bDamage) return data.countryA;
        if (bDamage > aDamage) return data.countryB;
        return null;
    };

    try {
        await firebase.firestore().runTransaction(async (transaction) => {
            const doc = await transaction.get(warRef);
            const data = doc.data();
            if (!data || data.status !== 'active') return; // انتهت أصلاً أو لاعب آخر سبقنا بالإنهاء
            transaction.update(warRef, { status: 'ended', winner: computeWinner(data) });
        });
        return; // نجحت المحاولة الأولى، لا حاجة للخطة البديلة
    } catch (err) {
        console.warn("تعذر إنهاء الحرب مع تسجيل الفائز (على الأرجح حقل winner غير مسموح بقواعد Firestore بعد) — إعادة المحاولة بدونه:", err.message);
    }

    try {
        await firebase.firestore().runTransaction(async (transaction) => {
            const doc = await transaction.get(warRef);
            const data = doc.data();
            if (!data || data.status !== 'active') return;
            transaction.update(warRef, { status: 'ended' });
        });
    } catch (err2) {
        console.error("فشل إنهاء الحرب حتى بدون حقل الفائز — تحقق من قواعد Firestore لمجموعة wars:", err2);
    }
}

function subscribeAllWars() {
    unsubscribeAllWars = firebase.firestore().collection('wars')
        .where('status', '==', 'active')
        .onSnapshot((snapshot) => {
            currentAllWarsCache = [];
            snapshot.forEach(doc => {
                const war = { id: doc.id, ...doc.data() };
                currentAllWarsCache.push(war);
                maybeEndWar(war); // فحص نفس الآلية لكل حروب القارة أيضاً، وليس فقط حرب دولتي
            });
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

    // نعرض زر السفر لدولة فقط لو اللاعب ليس موجوداً بها أصلاً — لا داعي لزر سفر لدولة أنت فيها بالفعل
    const playerLocation = getPlayerData()?.current_location;
    const showTravelToA = playerLocation !== war.countryA;
    const showTravelToB = playerLocation !== war.countryB;

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
            ${!showOpenButton && (showTravelToA || showTravelToB) ? `
            <div style="display:flex;gap:8px;margin-top:10px;">
                ${showTravelToA ? `<button onclick="travelToCountry('${war.countryA}')" style="flex:1;background:#2d3748;color:#fff;border:none;padding:8px;border-radius:6px;font-size:12px;cursor:pointer;">✈️ سافر لـ ${escapeHtml(war.countryAName || war.countryA)}</button>` : ''}
                ${showTravelToB ? `<button onclick="travelToCountry('${war.countryB}')" style="flex:1;background:#2d3748;color:#fff;border:none;padding:8px;border-radius:6px;font-size:12px;cursor:pointer;">✈️ سافر لـ ${escapeHtml(war.countryBName || war.countryB)}</button>` : ''}
            </div>` : ''}
        </div>
    `;
}

// بلوك 3: كل الحروب النشطة بأفريقيا
// بلوك 3: كل الحروب النشطة بأفريقيا
function renderAllWarsList() {
    const container = document.getElementById('all-wars-container');
    if (!container) return;

    // عرض جميع الحروب النشطة في القارة دون استثناء حرب الدولة الحالية، 
    // لكي تظهر حرب مصر والمغرب وباقي حروب القارة بشكل دائم.
    const allWars = currentAllWarsCache;

    if (allWars.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد حروب نشطة أخرى بالقارة حالياً</p>';
        return;
    }

    container.innerHTML = allWars.map(war => renderWarCardHtml(war, false)).join('<div style="height:10px;"></div>');
}

    // نستبعد حرب دولتك الحالية من هذه القائمة لأنها معروضة أصلاً ببلوك "حرب دولتك الحالية" أعلاه
    // بزر "ادخل الحرب" الصحيح — عرضها هنا أيضاً بأزرار سفر كان يسبب تكراراً مربكاً (خصوصاً وأنت أصلاً بنفس الدولة)
    const otherWars = currentAllWarsCache.filter(war => !currentCountryWar || war.id !== currentCountryWar.id);

    if (otherWars.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد حروب نشطة أخرى بالقارة حالياً</p>';
        return;
    }

    container.innerHTML = otherWars.map(war => renderWarCardHtml(war, false)).join('<div style="height:10px;"></div>');
}

let warDetailsCountdownInterval = null;

// البحث عن حرب في أي من الكاشات المتاحة (حرب دولتي، أو كل حروب القارة)
function findWarById(warId) {
    if (currentCountryWar && currentCountryWar.id === warId) return currentCountryWar;
    return currentAllWarsCache.find(w => w.id === warId) || null;
}

export async function openWarDetailsModal(warId) {
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

export function closeWarDetailsModal() {
    const modal = document.getElementById('war-details-modal');
    if (modal) modal.style.display = 'none';
    if (warDetailsCountdownInterval) { clearInterval(warDetailsCountdownInterval); warDetailsCountdownInterval = null; }
}

// نافذة ترتيب مشاركي جولة التدريب الدائمة — نفس فكرة تفاصيل الحرب، بس على مستوى الدولة/التدريب
export async function openTrainingRoundDetailsModal() {
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

export function closeTrainingRoundDetailsModal() {
    const modal = document.getElementById('training-round-details-modal');
    if (modal) modal.style.display = 'none';
    if (trainingRoundDetailsCountdownInterval) { clearInterval(trainingRoundDetailsCountdownInterval); trainingRoundDetailsCountdownInterval = null; }
}

// إعلان حرب — آلية مؤقتة: أي لاعب بالدولة يقدر يعلنها لحين نظام الرئيس/البرلمان
export async function declareWar() {
    if (currentCountryWar) { alert('⚠️ دولتك بحرب نشطة أصلاً!'); return; }
    if (!getPlayerData()) return;

    const targetKey = prompt('أدخل رمز الدولة المستهدفة (مثال: egypt):');
    if (!targetKey || !africanCountries[targetKey]) { alert('🔴 رمز دولة غير صحيح'); return; }

    const myCountryKey = getPlayerData().current_location || "morocco";
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

// نافذة التدريب/القتال — يختار اللاعب صراحةً كل مرة: تدريب أم مشاركة بالحرب الفعلية (لو كانت موجودة)
export function openTrainingModal() {
    // لو لا توجد حرب نشطة بدولتك، الوضع تدريب تلقائياً (لا حاجة لإلزام اللاعب باختيار من نافذة فارغة)
    // لو توجد حرب، لا نفرض شيئاً — اللاعب يختار صراحةً كل مرة بين الاثنين
    selectedCombatMode = currentCountryWar ? null : 'training';
    selectedCombatRole = null;
    selectedCombatWeaponId = null;

    const modal = document.getElementById('training-modal');
    const modeSelectBox = document.getElementById('training-mode-select');
    const modeNote = document.getElementById('training-mode-note');
    const weaponSelect = document.getElementById('training-weapon-select');
    const executeBtn = document.getElementById('btn-execute-combat');
    const weaponWarning = document.getElementById('training-no-weapon-warning');

    // بلوك اختيار الوضع (حرب فعلية / تدريب) يظهر فقط لو توجد حرب نشطة بدولتك — وإلا لا داعي له إطلاقاً
    if (modeSelectBox) modeSelectBox.style.display = currentCountryWar ? 'flex' : 'none';
    if (modeNote) modeNote.textContent = currentCountryWar ? 'اختر أولاً: المشاركة بالحرب الفعلية أم التدريب؟' : '';
    document.querySelectorAll('.btn-combat-mode').forEach(btn => { btn.style.outline = 'none'; });

    updateCombatContextUI();

    const inventory = getPlayerData()?.weaponInventory || {};
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

    renderCombatModalBar();
    refreshCombatEnergyDisplay(getPlayerData());

    if (modal) modal.style.display = 'flex';
}

// اختيار صريح بين "المشاركة بالحرب الفعلية" و"التدريب" — يظهر فقط لو توجد حرب نشطة بدولتك
export function selectCombatMode(mode) {
    selectedCombatMode = mode;

    document.querySelectorAll('.btn-combat-mode').forEach(btn => {
        const isSelected = btn.getAttribute('data-mode') === mode;
        btn.style.outline = isSelected ? '2px solid #fff' : 'none';
    });

    updateCombatContextUI();
    renderCombatModalBar();
}

export function onTrainingWeaponChange(weaponId) {
    selectedCombatWeaponId = weaponId;
}

export function closeTrainingModal() {
    const modal = document.getElementById('training-modal');
    if (modal) modal.style.display = 'none';
    if (trainingRoundCountdownInterval) { clearInterval(trainingRoundCountdownInterval); trainingRoundCountdownInterval = null; }
}

export function selectCombatRole(role) {
    selectedCombatRole = role;
    const roleNote = document.getElementById('training-role-note');
    if (roleNote) roleNote.textContent = `دورك المختار: ${role === 'attacker' ? '⚔️ مهاجم' : '🛡️ مدافع'}`;

    document.querySelectorAll('.btn-combat-role').forEach(btn => {
        const isSelected = btn.getAttribute('data-role') === role;
        btn.style.outline = isSelected ? '2px solid #fff' : 'none';
    });
}

export async function executeCombatRound() {
    // الاختيار الآن صريح: لو توجد حرب نشطة بدولتك، يجب اختيار وضع (حرب/تدريب) أولاً قبل أي شيء
    if (currentCountryWar && !selectedCombatMode) { alert('⚠️ اختر أولاً: المشاركة بالحرب الفعلية أم التدريب؟'); return; }
    const effectiveMode = selectedCombatMode || 'training'; // لا توجد حرب أصلاً ← تدريب دائماً

    // الدور (مهاجم/مدافع) مطلوب فقط بوضع التدريب — لا معنى له بحرب حقيقية بين دولتين
    if (effectiveMode === 'training' && !selectedCombatRole) { alert('⚠️ اختر دورك (مهاجم أو مدافع) أولاً'); return; }
    if (!selectedCombatWeaponId) { alert('🔴 يجب اختيار سلاح من مخزونك لتتمكن من القتال! اشترِ سلاحاً أولاً من سوق الأسلحة'); return; }

    const user = firebase.auth().currentUser;
    if (!user || !getPlayerData()) return;

    const cap = getCombatEnergyCap(getPlayerData().energyLevel);
    const currentEnergy = getPlayerData().combatEnergy ?? cap;
    if (currentEnergy < MIN_ENERGY_TO_FIGHT) {
        alert(`🔴 تحتاج ${MIN_ENERGY_TO_FIGHT} طاقة قتال على الأقل!`);
        return;
    }

    const weaponId = selectedCombatWeaponId;
    const db = firebase.firestore();
    const playerRef = db.collection('players').doc(user.uid);

    try {
        if (effectiveMode === 'war') {
            if (!currentCountryWar) { alert('⚠️ لم تعد هناك حرب نشطة بدولتك، أعد فتح النافذة وحاول مجدداً'); return; }

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

                const warEndAt = warData.endAt?.toMillis ? warData.endAt.toMillis() : warData.endAt;
                if (warEndAt && Date.now() >= warEndAt) throw new Error('انتهت الحرب، لم يعد بالإمكان القتال بها');

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
    if (!weapon || !getPlayerData()) return;

    if (!Number.isFinite(quantity) || quantity <= 0) {
        alert('🔴 أدخل كمية صحيحة');
        return;
    }

    const unitPrice = getWeaponPrice(weapon.basePrice, getPlayerData().educationLevel);
    const totalPrice = unitPrice * quantity;

    if ((getPlayerData().money ?? 0) < totalPrice) {
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

// فحص دوري كل 30 ثانية لتحديث عرض طاقة القتال واسترجاعها تلقائياً، وفحص انتهاء جولة التدريب
setInterval(() => {
    const data = getPlayerData();
    if (data) {
        refreshCombatEnergyDisplay(data);
        maybeRegenCombatEnergy(data);
    }
    if (currentTrainingRound) {
        maybeResetTrainingRound();
    }
}, 30000);
