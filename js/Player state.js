// ==========================================
// 👤 حالة اللاعب المشتركة بين كل الوحدات (profile.js / work.js / wars.js)
// بديل المتغير المحلي الذي كان يعيش داخل game.js وحده قبل التقسيم — كل وحدة تقرأه عبر getPlayerData()
// ==========================================
let localPlayerData = null;

export function getPlayerData() {
    return localPlayerData;
}

export function setPlayerData(data) {
    localPlayerData = data;
}
