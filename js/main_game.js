function startLiveUpdates() {
    const loadingMsg = document.getElementById('loading-msg');
    const mainBlocks = document.getElementById('main-game-blocks');
    
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (mainBlocks) mainBlocks.style.display = 'flex';

    // 1. بناء العناصر أولاً داخل الصفحة
    initializeContinentSlideshow(); 
    initializeCountryCard(); 
    
    // 2. ربط أزرار الضغط بعد أن تم رسم العناصر بنجاح
    setupClickListeners(); 

    // 3. تشغيل جلب البيانات المباشرة والشات
    listenToContinentAndCountryStats();
    if (currentUserUid) {
        activateOnlineStatus(currentUserUid, userCurrentLocation);
    }
    listenToLiveChat();
}