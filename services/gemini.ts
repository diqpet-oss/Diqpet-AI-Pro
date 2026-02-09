import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";

/**
 * 이미지 데이터를 Gemini용 Base64 InlineData로 변환
 */
async function imageToGeminiPart(imageSource: string) {
  let base64Data = "";
  let mimeType = "image/png";

  if (imageSource.startsWith("data:")) {
    const [header, data] = imageSource.split(",");
    mimeType = header.match(/:(.*?);/)?.[1] || "image/png";
    base64Data = data;
  } else {
    try {
      const response = await fetch(imageSource);
      const blob = await response.blob();
      mimeType = blob.type;
      const arrayBuffer = await blob.arrayBuffer();
      base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    } catch (e) {
      throw new Error("이미지 데이터를 가져오지 못했습니다. 로컬 파일을 업로드해 보세요.");
    }
  }
  return { inlineData: { data: base64Data, mimeType } };
}

/**
 * Base64를 Fal 업로드용 Blob으로 변환
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
};

export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. Ensure the pet's face, fur texture, and breed features are 100% consistent with the source image. 8k, professional studio lighting, photorealistic.`;

  // --- 核心修复：使用 Vite 环境变量读取方式 ---
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY;
  const FAL_API_KEY = import.meta.env.VITE_FAL_KEY;

  if (engine === 'gemini') {
    if (!GEMINI_API_KEY) throw new Error("Vercel 설정에서 VITE_GEMINI_KEY를 확인해주세요.");
    
    const ai = new GoogleGenAI(GEMINI_API_KEY);
    const petPart = await imageToGeminiPart(petImageSource);
    
    const response = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent([petPart, prompt]);
    const result = await response.response;
    const part = result.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    throw new Error("Gemini AI가 이미지를 생성하지 못했습니다.");
  } 
  
  else {
    if (!FAL_API_KEY) throw new Error("Vercel 설정에서 VITE_FAL_KEY를 확인해주세요.");

    fal.config({ credentials: FAL_API_KEY });

    try {
      let petUrl = petImageSource;
      if (petImageSource.startsWith('data:')) {
        const blob = dataUrlToBlob(petImageSource);
        const uploaded = await fal.storage.upload(blob);
        petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
      }

      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: { image: petUrl, prompt: prompt, strength: 0.65 }
      });

      const finalUrl = result?.images?.[0]?.url || result?.image?.url || result?.data?.images?.[0]?.url;
      if (finalUrl) return finalUrl;

      throw new Error("이미지 URL을 추출하지 못했습니다.");
    } catch (err: any) {
      throw new Error(`Fal.ai 오류: ${err.message}`);
    }
  }
};
