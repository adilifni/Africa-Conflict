// ==========================================
// ☁️ رفع الصور عبر Cloudinary (بديل Firebase Storage - لا يتطلب خطة Blaze)
// ==========================================
const CLOUDINARY_CLOUD_NAME = 'ضع_اسم_حسابك_هنا';       // مثال: 'dxyzabc12'
const CLOUDINARY_UPLOAD_PRESET = 'ضع_اسم_البريست_هنا';   // مثال: 'africa_conflict_uploads'

export async function uploadImageToCloudinary(file) {
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
