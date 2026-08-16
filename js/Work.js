// ==========================================
// 💼 نظام العمل والمصانع والسوق العالمي — مستخرج من game.js
// ==========================================
import { africanCountries } from './config.js';
import { setText, escapeHtml } from './dom-utils.js';
import { uploadImageToCloudinary } from './cloudinary.js';
import { getPlayerData } from './player-state.js';
import { LEVEL_BONUS_PER_LEVEL, EDUCATION_YIELD_BONUS_PER_LEVEL, MAX_EDUCATION_YIELD_BONUS } from './skills-config.js';

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

let currentFactoriesCache = [];
let unsubscribeCountryResources = null;
let unsubscribeFactoriesList = null;
let lastSubscribedWorkLocation = null;
let selectedFactoryFile = null;
let editingFactoryId = null;

export function handleWorkViewUpdate(data) {
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
            if (getPlayerData()) refreshSelectedFactoryDisplay(getPlayerData());

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
    if (!user || !getPlayerData()) return;

    const db = firebase.firestore();
    const workerEntry = { uid: user.uid, name: (getPlayerData().name || "لاعب").trim() };
    const oldFactoryId = getPlayerData().selectedFactoryId;

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

export async function doWork() {
    const user = firebase.auth().currentUser;
    if (!user || !getPlayerData()) return;

    const factory = currentFactoriesCache.find(f => f.id === getPlayerData().selectedFactoryId);
    if (!factory) { alert("⚠️ اختر مصنعاً أولاً من القائمة"); return; }

    const resourceType = factory.resourceType;
    const resourceConfig = RESOURCE_TYPES[resourceType];
    if (!resourceConfig) { alert("⚠️ نوع مورد المصنع غير محدد، تواصل مع صاحب المصنع لتعديله"); return; }

    const cap = getWorkEnergyCap(getPlayerData().energyLevel);
    const currentEnergy = getPlayerData().workEnergy ?? cap;
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
export function openFactoryModal(existingFactory) {
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

export function closeFactoryModal() {
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

export async function saveFactory() {
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
    if (!user || !getPlayerData()) { if (errorEl) errorEl.textContent = 'حدث خطأ، أعد تحميل الصفحة'; return; }

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
                gold: getPlayerData().gold ?? 0,
                iron: getPlayerData().iron ?? 0,
                money: getPlayerData().money ?? 0,
                oil: getPlayerData().oil ?? 0
            };
            const missing = Object.entries(FACTORY_OPEN_COST)
                .filter(([res, cost]) => wallet[res] < cost)
                .map(([res, cost]) => `${cost} ${res === 'money' ? 'مال' : RESOURCE_TYPES[res]?.label || res}`);

            if (missing.length > 0) {
                throw new Error(`لا تملك موارد كافية لفتح مصنع، ناقصك: ${missing.join('، ')}`);
            }

            const countryKey = getPlayerData().current_location || "morocco";
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
export async function addFactoryBalance() {
    const errorEl = document.getElementById('factory-modal-error');
    const amountInput = document.getElementById('factory-balance-amount-input');
    const balanceVal = document.getElementById('factory-balance-value');

    const amount = amountInput ? parseInt(amountInput.value, 10) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
        if (errorEl) errorEl.textContent = 'أدخل مبلغاً صحيحاً لإضافته';
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user || !editingFactoryId || !getPlayerData()) return;

    if ((getPlayerData().money ?? 0) < amount) {
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
export async function upgradeFactory() {
    const errorEl = document.getElementById('factory-modal-error');
    const user = firebase.auth().currentUser;
    if (!user || !editingFactoryId || !getPlayerData()) return;

    const factory = currentFactoriesCache.find(f => f.id === editingFactoryId);
    if (!factory) return;

    const resourceType = factory.resourceType;
    const resInfo = RESOURCE_TYPES[resourceType];
    const currentLevel = factory.level ?? 1;
    const cost = getFactoryUpgradeCost(currentLevel);

    if ((getPlayerData()[resourceType] ?? 0) < cost) {
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
export async function withdrawFactoryStock() {
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
export async function sellFactory() {
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
export async function closeFactoryPermanently() {
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
export function openCreateListingModal() {
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

export function closeCreateListingModal() {
    const modal = document.getElementById('listing-modal');
    if (modal) modal.style.display = 'none';
}

export async function submitCreateListing() {
    const errorEl = document.getElementById('listing-modal-error');
    const submitBtn = document.getElementById('submit-listing-btn');
    const resourceType = document.getElementById('listing-resource-input')?.value;
    const quantity = parseInt(document.getElementById('listing-quantity-input')?.value, 10);
    const pricePerUnit = parseInt(document.getElementById('listing-price-input')?.value, 10);

    if (!MARKET_RESOURCE_TYPES[resourceType]) { if (errorEl) errorEl.textContent = 'اختر نوع المورد'; return; }
    if (!Number.isFinite(quantity) || quantity <= 0) { if (errorEl) errorEl.textContent = 'أدخل كمية صحيحة'; return; }
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) { if (errorEl) errorEl.textContent = 'أدخل سعراً صحيحاً لكل وحدة'; return; }

    const user = firebase.auth().currentUser;
    if (!user || !getPlayerData()) { if (errorEl) errorEl.textContent = 'حدث خطأ، أعد تحميل الصفحة'; return; }

    if ((getPlayerData()[resourceType] ?? 0) < quantity) {
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
            sellerName: (getPlayerData().name || 'لاعب').trim(),
            sellerCountryKey: getPlayerData().current_location || "morocco",
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
export async function cancelMarketListing(listingId) {
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
export function openBuyModal(listingId) {
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

export function closeBuyModal() {
    const modal = document.getElementById('buy-modal');
    if (modal) modal.style.display = 'none';
    activeBuyListingId = null;
}

// تنفيذ عملية الشراء داخل معاملة واحدة تلمس 4 مستندات: الإعلان، المشتري، البائع، دولة البائع (للضريبة)
export async function confirmBuyListing() {
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

document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'factory-file-input') {
        handleFactoryFileSelect(event);
    }
});

// فحص دوري كل 30 ثانية لتحديث عرض مشروب الطاقة واسترجاعه تلقائياً حتى دون أي تغيير آخر في البيانات
setInterval(() => {
    const data = getPlayerData();
    if (data) {
        refreshWorkEnergyDisplay(data);
        maybeRegenWorkEnergy(data);
    }
}, 30000);
