// ==========================================
// ⚔️ نظام الحروب والتدريب والقتال وسوق الأسلحة
// ==========================================
import { africanCountries } from './config.js';
import { formatTimeShort } from './app.js';
import { setText, escapeHtml } from './dom-utils.js';
import { getPlayerData } from './player-state.js';
import { LEVEL_BONUS_PER_LEVEL } from './skills-config.js';

const WAR_DURATION_HOURS = 24;
const TRAINING_ROUND_DURATION_HOURS = 24;

function getNextUtcMidnightMs() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
}

function generateRoundId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const COMBAT_ENERGY_REGEN_AMOUNT = 10;
const COMBAT_ENERGY_REGEN_MINUTES = 10;
const MIN_ENERGY_TO_FIGHT = 10;
const TRAINING_XP_PER_DAMAGE = 0.5;
const WAR_XP_PER_DAMAGE = 0.6;

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

const WEAPONS_CATALOG = [
    { id: 'knife',   name: 'سكين',        icon: '🔪', damage: 5,   basePrice: 200 },
    { id: 'pistol',  name: 'مسدس',        icon: '🔫', damage: 15,  basePrice: 800 },
    { id: 'rifle',   name: 'بندقية',      icon: '🎯', damage: 40,  basePrice: 2500 },
    { id: 'grenade', name: 'قنبلة يدوية', icon: '💣', damage: 80,  basePrice: 6000 },
    { id: 'tank',    name: 'دبابة',       icon: '🛡️', damage: 200, basePrice: 20000 }
];

const EDUCATION_PRICE_DISCOUNT_PER_LEVEL = 0.002;
const MAX_EDUCATION_DISCOUNT = 0.5;

function getCombatEnergyCap(energyLevel) {
    const lvl = energyLevel ?? 1;
    return 100 + Math.floor(lvl / 50) * 5;
}

function getWeaponPrice(basePrice, educationLevel) {
    const lvl = educationLevel ?? 1;
    const discount = Math.min(MAX_EDUCATION_DISCOUNT, lvl * EDUCATION_PRICE_DISCOUNT_PER_LEVEL);
    return Math.round(basePrice * (1 - discount));
}

function calculateCombatDamage(playerData, energySpent, weaponId, availableWeaponUnits) {
    const rawEnergyUnits = Math.floor(energySpent / 10);
    if (rawEnergyUnits <= 0) return { damage: 0, energyUnits: 0 };

    const energyUnits = Math.max(0, Math.min(rawEnergyUnits, availableWeaponUnits ?? rawEnergyUnits));
    if (energyUnits <= 0) return { damage: 0, energyUnits: 0 };

    const power = playerData.power ?? 1;
    const weapon = WEAPONS_CATALOG.find(w => w.id === weaponId);
    const weaponDamage = weapon?.damage ?? 0;

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

let selectedTrainingRole = 'attacker'; // 'attacker' | 'defender'
let selectedTrainingWeaponId = null;

let selectedWarRole = 'attacker'; // للدفاع أو الهجوم في الحرب
let selectedWarWeaponId = null;

let currentTrainingRound = null;
let unsubscribeTrainingRound = null;
let trainingRoundCountdownInterval = null;
let trainingRoundDetailsCountdownInterval = null;
let warCombatCountdownInterval = null;

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

function subscribeTrainingRound(countryKey) {
    if (unsubscribeTrainingRound) { unsubscribeTrainingRound(); unsubscribeTrainingRound = null; }

    const roundRef = firebase.firestore().collection('training_rounds').doc(countryKey);

    unsubscribeTrainingRound = roundRef.onSnapshot((doc) => {
        if (!doc.exists) {
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

async function maybeResetTrainingRound() {
    if (!currentTrainingRound) return;
    if (Date.now() < currentTrainingRound.roundEndAt) return;

    const roundRef = firebase.firestore().collection('training_rounds').doc(currentTrainingRound.id);
    try {
        await firebase.firestore().runTransaction(async (transaction) => {
            const doc = await transaction.get(roundRef);
            const data = doc.data();
            if (!data || Date.now() < data.roundEndAt) return;

            transaction.update(roundRef, {
                attackerDamage: 0,
                defenderDamage: 0,
                roundEndAt: getNextUtcMidnightMs(),
                roundId: generateRoundId()
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

function subscribeCountryWar(countryKey) {
    if (unsubscribeCountryWarA) { unsubscribeCountryWarA(); unsubscribeCountryWarA = null; }
    if (unsubscribeCountryWarB) { unsubscribeCountryWarB(); unsubscribeCountryWarB = null; }

    const db = firebase.firestore();
    let warFromA = null, warFromB = null;

    const updateCombined = () => {
        currentCountryWar = warFromA || warFromB || null;
        maybeEndWar(currentCountryWar);
        renderCountryWarBlock(countryKey);
        renderAllWarsList();
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
            if (!data || data.status !== 'active') return;
            transaction.update(warRef, { status: 'ended', winner: computeWinner(data) });
        });
    } catch (err) {
        console.warn("تعذر إنهاء الحرب مع تسجيل الفائز:", err.message);
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
                maybeEndWar(war);
            });
            renderAllWarsList();
        }, (err) => console.error("خطأ في جلب كل الحروب:", err));
}

function renderCountryWarBlock(countryKey) {
    const container = document.getElementById('country-war-container');
    if (!container) return;

    if (!currentCountryWar) {
        container.innerHTML = `
            <p style="color:#718096;font-size:14px;text-align:center;margin:10px 0;">لا توجد حروب قائمة في دولتك حالياً</p>
            <button onclick="declareWar()" style="width:100%;background:#742a2a;color:#fff;border:none;padding:12px;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer;">🚨 إعلان حرب</button>
        `;
        return;
    }

    container.innerHTML = renderWarCardHtml(currentCountryWar, true);
}

function renderWarCardHtml(war, showOpenButton) {
    const endAt = war.endAt?.toMillis ? war.endAt.toMillis() : war.endAt;
    const msLeft = Math.max(0, (endAt || 0) - Date.now());
    const timeLeftText = msLeft > 0 ? formatTimeShort(msLeft) : "انتهت";

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
                    ${showOpenButton ? `<button onclick="openWarCombatModal()" style="background:#742a2a;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:bold;font-size:13px;cursor:pointer;">⚔️ ادخل الحرب</button>` : ''}
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

function renderAllWarsList() {
    const container = document.getElementById('all-wars-container');
    if (!container) return;

    // عرض جميع حروب القارة لكي تظهر حرب مصر والمغرب وباقي الحروب بشكل دائم
    const allWars = currentAllWarsCache;

    if (allWars.length === 0) {
        container.innerHTML = '<p style="color:#718096;font-size:13px;text-align:center;margin:10px 0;">لا توجد حروب نشطة أخرى بالقارة حالياً</p>';
        return;
    }

    container.innerHTML = allWars.map(war => renderWarCardHtml(war, false)).join('<div style="height:10px;"></div>');
}

function findWarById(warId) {
    if (currentCountryWar && currentCountryWar.id === warId) return currentCountryWar;
    return currentAllWarsCache.find(w => w.id === warId) || null;
}
