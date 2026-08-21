// ==========================================
// ✈️ نظام السفر الزمني — يستبدل النقل الفوري بمؤقت حقيقي حسب المسافة بين الدولتين
// ==========================================
import { africanCountries } from './config.js';
import { getDistanceKm, getTravelMinutes } from './geo.js';
import { formatTimeShort } from './app.js';
import { getPlayerData } from './player-state.js';

let travelCheckInterval = null;

// بدء رحلة سفر لدولة جديدة — يُخزَّن وقت الوصول بمستند اللاعب، ولا يتغيّر current_location إلا عند الوصول فعلياً
export async function startTravel(destinationKey) {
    if (!africanCountries[destinationKey]) return;

    const user = firebase.auth().currentUser;
    if (!user) { alert("يجب عليك تسجيل الدخول أولاً لتتمكن من السفر!"); return; }

    const playerData = getPlayerData();
    if (!playerData) return;

    const originKey = playerData.current_location || "morocco";
    if (originKey === destinationKey) { alert("أنت في هذه الدولة أصلاً!"); return; }

    if (playerData.travelArrivesAt && Date.now() < playerData.travelArrivesAt) {
        alert("أنت في رحلة سفر بالفعل! انتظر حتى تصل الوجهة الحالية أولاً.");
        return;
    }

    const distanceKm = getDistanceKm(originKey, destinationKey);
    const minutes = getTravelMinutes(distanceKm);
    const arrivesAt = Date.now() + minutes * 60000;

    try {
        await firebase.firestore().collection('players').doc(user.uid).update({
            travelDestination: destinationKey,
            travelArrivesAt: arrivesAt
        });
        alert(`✈️ انطلقت نحو ${africanCountries[destinationKey].name}! ستصل خلال ${formatTimeShort(minutes * 60000)} تقريباً`);
    } catch (err) {
        console.error("خطأ أثناء بدء السفر:", err);
        alert("حدث خطأ أثناء بدء الرحلة، حاول مرة أخرى");
    }
}

// يُستدعى دورياً (من كل تحديث لبيانات اللاعب، ومن مؤقّت داخلي) — يتحقق هل انتهت الرحلة، وإن كانت فيتم إتمامها فعلياً
export async function checkTravelArrival(playerData) {
    if (!playerData || !playerData.travelDestination || !playerData.travelArrivesAt) {
        hideTravelBanner();
        return;
    }

    if (Date.now() < playerData.travelArrivesAt) {
        renderTravelBanner(playerData);
        return;
    }

    // انتهت الرحلة — نُتمّها فعلياً بتحديث current_location وحذف حقول السفر
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        await firebase.firestore().collection('players').doc(user.uid).update({
            current_location: playerData.travelDestination,
            travelDestination: firebase.firestore.FieldValue.delete(),
            travelArrivesAt: firebase.firestore.FieldValue.delete()
        });
    } catch (err) {
        console.error("خطأ أثناء إتمام السفر:", err);
    }
    hideTravelBanner();
}

// شريط عائم أعلى الصفحة يعرض حالة السفر الحالية والوقت المتبقي — يُنشأ ديناميكياً، لا يحتاج تعديل أي ملف HTML
function renderTravelBanner(playerData) {
    let banner = document.getElementById('travel-status-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'travel-status-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:500;background:#2b6cb0;color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.4);';
        document.body.appendChild(banner);
    }

    const country = africanCountries[playerData.travelDestination];
    const msLeft = Math.max(0, playerData.travelArrivesAt - Date.now());
    banner.textContent = `✈️ أنت في طريقك إلى ${country?.name || '؟'} — يتبقى ${formatTimeShort(msLeft)}`;
    banner.style.display = 'block';
}

function hideTravelBanner() {
    const banner = document.getElementById('travel-status-banner');
    if (banner) banner.style.display = 'none';
}

// فحص دوري كل 5 ثوانٍ — يُحدّث العدّاد المعروض، ويُتمّ الرحلة تلقائياً فور انتهاء وقتها حتى بدون أي تحديث خارجي آخر
export function startTravelWatcher() {
    if (travelCheckInterval) return; // لا داعي لأكثر من مؤقّت واحد طوال الجلسة
    travelCheckInterval = setInterval(() => {
        const data = getPlayerData();
        if (data) checkTravelArrival(data);
    }, 5000);
}
