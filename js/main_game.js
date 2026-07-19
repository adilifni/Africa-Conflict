// ==========================================
// 🌍 البيانات العالمية والمغيرات الأساسية للعبة
// ==========================================
const africanCountries = {
    morocco: { name: "المغرب", flag: "🇲🇦" },
    algeria: { name: "الجزائر", flag: "🇩🇿" },
    egypt: { name: "مصر", flag: "🇪🇬" },
    tunisia: { name: "تونس", flag: "🇹🇳" },
    libya: { name: "ليبيا", flag: "🇱🇾" },
    south_africa: { name: "جنوب إفريقيا", flag: "🇿🇦" },
    nigeria: { name: "نيجيريا", flag: "🇳🇬" },
    senegal: { name: "السنغال", flag: "🇸🇳" }
};

let localPlayerData = null;
let trainingInterval = null; 
let isUpgradingNow = false;  

// ==========================================
// 📥 نظام استماع البيانات والـ Firestore المباشر
// ==========================================
function initGameSystem() {
    const userNameSpan = document.getElementById('user-name');
    if (!userNameSpan) return;

    function waitForFirebase() {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
            const db = firebase.firestore();

            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    const userUid = user.uid;

                    // 1. الاستماع المباشر لبيانات حساب اللاعب وتحديث الواجهات بناءً عليها
                    db.collection('players').doc(userUid).onSnapshot((doc) => {
                        if (!doc.exists) {
                            createNewPlayerProfile(user);
                            return;
                        }

                        const data = doc.data();
                        localPlayerData = data;

                        // تحديث الاسم والصورة العلوية وفي الحساب الشخصي
                        let playerName = data.name || user.displayName || user.email.split('@')[0];
                        playerName = playerName.replace(/قائد/g, '').replace(/مجهول/g, '').trim();
                        
                        userNameSpan.textContent = playerName || "قائد";
                        const profileNameDisp = document.getElementById('profile-name-display');
                        if (profileNameDisp) profileNameDisp.textContent = playerName || "قائد مجهول";

                        const profileImg = document.getElementById('profile-avatar');
                        if (profileImg) profileImg.src = data.avatarUrl || user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + userUid;
// كود الذهب والمال
const profileMoneyVal = document.getElementById('profile-money-val');
if (profileMoneyVal) profileMoneyVal.textContent = data.money || 0;

const profileGoldVal = document.getElementById('profile-gold-val');
if (profileGoldVal) profileGoldVal.textContent = data.gold || 0;

                        // تحديث شريط المستوى والـ XP بالمعادلة الأصلية
                        updateXPProgressBar(data.xp || 0);

                        // تحديث بيانات الموقع والجنسية الحالية
                        const currentLoc = data.current_location || "morocco";
                        updateCountryBlockOnScreen(currentLoc);

                        const nationalityText = document.getElementById('profile-nationality');
                        if (nationalityText) {
                            const nation = data.nationality || "morocco";
                            nationalityText.textContent = africanCountries[nation]?.name || "لم تحدد";
                        }

                        // تحديث أرقام التطوير الثلاثة الأساسية
                        if (document.getElementById('stat-power-val')) document.getElementById('stat-power-val').textContent = data.power || 0;
                        if (document.getElementById('stat-education-val')) document.getElementById('stat-education-val').textContent = data.education || 0;
                        if (document.getElementById('stat-experience-val')) document.getElementById('stat-experience-val').textContent = data.experience || 0;

                        // فحص ومراقبة عداد التطوير التنازلي الحالي النشط
                        checkActiveTraining(data);
                    });

                    // 2. تحديث حالة اتصال اللاعب الحالي بالشبكة
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

            // 3. الاستماع الحي لإحصائيات اللاعبين المتصلين والسكان الكلية للقارة
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

            // ربط القوائم المنزلقة الخاصة بالتطوير لمرة واحدة عند التهيئة
            setupStatDropdowns();

        } else {
            setTimeout(waitForFirebase, 100);
        }
    }
    waitForFirebase();
}

// دالة إنشاء ملف لاعب جديد لأول مرة بدقة
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
        money: 5000, 
        gold: 50,      
        activeTraining: null 
    }, { merge: true });
}

// ==========================================
// 📈 معادلة المستوى وشريط الـ XP التباطئي الأصلي
// ==========================================
function updateXPProgressBar(totalXP) {
    const currentLevel = Math.floor(Math.sqrt(totalXP / 100)) + 1;
    const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
    const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
    
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    
    const progressPercent = (xpInCurrentLevel / xpNeededForNext) * 100;

    const levelDisplay = document.getElementById('profile-level-number');
    const progressBar = document.getElementById('profile-xp-bar');
    const progressText = document.getElementById('profile-xp-text');

    if (levelDisplay) levelDisplay.textContent = `المستوى ${currentLevel}`;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${Math.floor(xpInCurrentLevel)} / ${xpNeededForNext} XP`;
}

// ==========================================

// ==========================================
// ⚙️ معالجة عمليات التطوير والأوقات وإنهائها
// ==========================================
function startStatUpgrade(statName, currencyType) {
    if (!localPlayerData) return;

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
        .then(() => alert(`⏳ بدأ تطوير ${statName} الآن...`))
        .catch(err => console.error(err));
}


// ==========================================
// ⏳ المطور الجديد لنظام الترقية والوقت والعدادات الحية
// ==========================================

function formatTimeDynamic(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    let timeString = "";
    if (days > 0) timeString += `${days} يوم و `;
    if (hours > 0 || days > 0) timeString += `${hours} ساعة و `;
    if (minutes > 0 || hours > 0 || days > 0) timeString += `${minutes} دقيقة و `;
    timeString += `${seconds} ثانية`;

    return timeString;
}

function setupStatDropdowns() {
    const stats = ['power', 'education', 'experience'];
    
    stats.forEach(stat => {
        const header = document.getElementById(`stat-${stat}-header`);
        const dropdown = document.getElementById(`stat-${stat}-dropdown`);
        
        if (header && dropdown) {
            header.addEventListener('click', () => {
                stats.forEach(s => {
                    if (s !== stat) {
                        const otherDropdown = document.getElementById(`stat-${s}-dropdown`);
                        if (otherDropdown) otherDropdown.style.maxHeight = "0px";
                    }
                });
                
                if (dropdown.style.maxHeight === "0px" || !dropdown.style.maxHeight || dropdown.style.maxHeight === "0") {
                    dropdown.style.maxHeight = "none";
                } else {
                    dropdown.style.maxHeight = "0px";
                }
                
                if (localPlayerData) {
                    const currentStatLevel = localPlayerData[stat] || 0;
                    
                    const moneyCost = (currentStatLevel + 1) * 1000;
                    const goldCost = (currentStatLevel + 1) * 5;
                    const timeInSeconds = (currentStatLevel + 1) * 30; 

                    if(document.getElementById(`cost-${stat}-money`)) document.getElementById(`cost-${stat}-money`).textContent = `${moneyCost} مال`;
                    if(document.getElementById(`cost-${stat}-gold`)) document.getElementById(`cost-${stat}-gold`).textContent = `${goldCost} ذهب`;
                    
                    if(document.getElementById(`time-${stat}`)) {
                        document.getElementById(`time-${stat}`).textContent = `الوقت المستغرق: ${formatTimeDynamic(timeInSeconds * 1000)}`;
                    }
                }
            });
        }
    });
}

function checkActiveTraining(data) {
    const stats = ['power', 'education', 'experience'];
    
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
    if (activeDropdown) activeDropdown.style.maxHeight = "none";

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
                timerVal.textContent = formatTimeDynamic(timeLeft);
            }
        }
    }, 1000);
}

// 👈 هنا تبدأ الدالة القديمة التي طلبت منك تركها كما هي دون تغيير 👇
function completeUpgrade(statName) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();
    db.collection('players').doc(user.uid).update({
        [statName]: firebase.firestore.FieldValue.increment(1),
        activeTraining: null 
    }).then(() => {
        isUpgradingNow = false; 
        alert(`🎉 تهانينا! تم ترقية ${statName} بنجاح.`);
    }).catch(err => {
        isUpgradingNow = false;
        console.error("خطأ أثناء إنهاء الترقية:", err);
    });
}

// ==========================================
// ✈️ دوال تحديث الشاشات وإدارة السفر والتنقل
// ==========================================
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

function travelToCountry(targetCountryKey) {
    if (!africanCountries[targetCountryKey]) return;
    const user = firebase.auth().currentUser;
    if (!user) return alert("يجب عليك تسجيل الدخول أولاً لتتمكن من السفر!");

    firebase.firestore().collection('players').doc(user.uid).update({
        current_location: targetCountryKey
    })
    .then(() => alert(`✈️ تم السفر بنجاح إلى ${africanCountries[targetCountryKey].name}!`))
    .catch(err => console.error(err));
}

function changePlayerName(newName) {
    const trimmedName = newName.trim();
    if (trimmedName === "") return alert("الاسم لا يمكن أن يكون فارغاً");

    const user = firebase.auth().currentUser;
    if (!user) return;

    firebase.firestore().collection('players').doc(user.uid).update({
        name: trimmedName
    }).then(() => alert("تم تحديث الاسم بنجاح"));
}

// ==========================================
// 💬 نظام الشات النشط (تصفية تلقائية 24 ساعة)
// ==========================================
function setupChatSystem() {
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');
    const chatMessagesBox = document.getElementById('chat-messages-box');

    if (!sendBtn || !chatInput || !chatMessagesBox) return;

    loadStoredMessages(chatMessagesBox);

    const handleSendMessage = () => {
        const textValue = chatInput.value.trim();
        if (textValue === '') return;

        const currentUserName = document.getElementById('user-name')?.textContent || 'لاعب مجهول';
        const messageData = { sender: currentUserName, text: textValue, time: Date.now() };

        saveMessageLocally(messageData);
        renderSingleMessage(chatMessagesBox, messageData, true);

        chatInput.value = '';
        chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight;
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(); }
    });
}

function saveMessageLocally(msg) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    storedMessages.push(msg);
    localStorage.setItem('chat_messages_v1', JSON.stringify(storedMessages));
}

function loadStoredMessages(container) {
    let storedMessages = JSON.parse(localStorage.getItem('chat_messages_v1')) || [];
    const currentTime = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; 

    const validMessages = storedMessages.filter(msg => (currentTime - msg.time) < twentyFourHours);
    localStorage.setItem('chat_messages_v1', JSON.stringify(validMessages));

    container.innerHTML = '';
    validMessages.forEach(msg => {
        const currentPlayerName = document.getElementById('user-name')?.textContent || 'لاعب مجهول';
        renderSingleMessage(container, msg, msg.sender === currentPlayerName);
    });
    container.scrollTop = container.scrollHeight;
}

function renderSingleMessage(container, msg, isMe) {
    const msgDate = new Date(msg.time);
    let hours = msgDate.getHours();
    const minutes = String(msgDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;

    const messageDiv = document.createElement('div');
    messageDiv.className = isMe ? 'chat-message me' : 'chat-message others';
    messageDiv.innerHTML = `
        <div class="msg-header">
            <span>${msg.sender} ${isMe ? '(أنت)' : ''}</span>
            <span>${hours}:${minutes} ${ampm}</span>
        </div>
        ${msg.text}
    `;
    container.appendChild(messageDiv);
}

// ==========================================
// 🔁 نظام السلايدشو التابع للواجهة
// ==========================================
function setupSliderSystem() {
    const slides = document.querySelectorAll('#slides-container .slide');
    const dot1 = document.getElementById('dot-1');
    const dot2 = document.getElementById('dot-2');
    const slidesContainer = document.getElementById('slides-container');

    if (slides.length >= 2 && dot1 && dot2) {
        if (slidesContainer) {
            slidesContainer.style.width = '100%';
            slidesContainer.style.transform = 'none'; 
        }
        const showSlide = (activeIndex) => {
            slides.forEach((slide, index) => {
                slide.style.display = (index === activeIndex) ? 'block' : 'none';
                if (index === activeIndex) slide.style.width = '100%';
            });
        };
        showSlide(0);

        dot1.addEventListener('click', (e) => {
            e.stopPropagation(); showSlide(0);
            dot1.classList.add('active'); dot2.classList.remove('active');
        });
        dot2.addEventListener('click', (e) => {
            e.stopPropagation(); showSlide(1);
            dot2.classList.add('active'); dot1.classList.remove('active');
        });
    }
}

// ==========================================
// 🎯 ربط التنقل الفرعي والـ Routing لشريط الأزرار
// ==========================================
function setupInteractiveElements() {
    const interactiveStats = [
        { id: 'btn-continent-map', page: 'continent-map' },
        { id: 'btn-continent-pop', page: 'continent-players' },
        { id: 'btn-continent-online', page: 'continent-online' },
        { id: 'btn-continent-parties', page: 'continent-parties' },
        { id: 'btn-continent-factories', page: 'continent-factories' },
        { id: 'btn-continent-countries', page: 'continent-countries' },
        { id: 'btn-continent-alliances', page: 'continent-alliances' },
        { id: 'btn-continent-independent', page: 'continent-independent' },
        { id: 'btn-country-flag', page: 'country-info' },
        { id: 'btn-country-pop', page: 'country-players' },
        { id: 'btn-country-online', page: 'country-online' },
        { id: 'btn-country-parties', page: 'country-parties' },
        { id: 'btn-country-factories', page: 'country-factories' }
    ];

    interactiveStats.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            element.addEventListener('click', (e) => { e.stopPropagation(); navigateTo(item.page); });
        }
    });
}

function navigateTo(targetPage) {
    const allViews = document.querySelectorAll('.game-view');
    allViews.forEach(view => { if (view) view.style.display = 'none'; });

    let viewId = 'view-main';
    switch (targetPage) {
        case 'main': viewId = 'view-main'; break;
        case 'work': viewId = 'view-work'; break;
        case 'wars': viewId = 'view-wars'; break;
        case 'profile': viewId = 'view-profile'; break;
        default: viewId = `view-${targetPage}`;
    }

    const targetElement = document.getElementById(viewId);
    if (targetElement) targetElement.style.display = 'flex';

    const allNavLinks = document.querySelectorAll('.bottom-nav .nav-link');
    allNavLinks.forEach(link => { if (link) link.classList.remove('active'); });

    allNavLinks.forEach(link => {
        const attr = link.getAttribute('onclick');
        if (attr && attr.includes(`'${targetPage}'`)) link.classList.add('active');
    });
}

function switchView(pageName) {
    navigateTo(pageName);
}

// ==========================================
// 🏁 بدء التشغيل الآمن عند اكتمال الـ DOM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // تشغيل الأنظمة بمهلة قصيرة لضمان تحميل مكتبات Firebase
    setTimeout(() => {
        initGameSystem();
        setupSliderSystem();
        setupChatSystem();
        setupInteractiveElements();
    }, 1000);
});