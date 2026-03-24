

export function cleanupBlobUrls(obj) {
  if (!obj) return;
  Object.values(obj).forEach(url => URL.revokeObjectURL(url));
}

export function fileToBlob(file) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

export function base64ToBlob(dataUrl) {
  try {
    const [meta, base64] = dataUrl.split(",");
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    const blob = new Blob([byteArray], { type: mime });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("base64ToBlob failed:", e);
    return dataUrl; // Fallback to original dataUrl if conversion fails
  }
}

export async function resizeImageToBlob(imageSrc, targetSize = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      
      // Draw image onto canvas (fixed square 1280x1280)
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/jpeg", 0.95);
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}
