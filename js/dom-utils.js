// ==========================================
// 🧰 أدوات DOM عامة مشتركة بين كل أنظمة اللعبة (العمل، الحروب، البروفايل)
// ==========================================

export function setText(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = value;
}

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
