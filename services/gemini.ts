import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：将图片源转换为 Gemini 要求的 Base64 格式
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
      console.error("Image Fetch Error:", e);
      throw new Error("이미지 데이터를 가져오지 못했습니다.");
    }
  }
  return { inlineData: { data: base64Data, mimeType } };
}

/**
 * 辅助函数：将 DataURL 转为 Blob 用于上传
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

/**
 * 核心生成函数
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // --- 环境变量读取 (兼容多种读取方式) ---
  const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY || "";
  const FAL_KEY = import.meta.env.VITE_FAL_KEY || "";

  // 🔴 关键调试日志：请在浏览器 F12 控制台查看
  console.log("[DEBUG] Current Engine:", engine);
  console.log("[DEBUG] Gemini Key loaded?", !!GEMINI_KEY);
  if (GEMINI_KEY) console.log("[DEBUG] Gemini Key Prefix:", GEMINI_KEY.substring(0, 4));

  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. Ensure breed features are consistent. 8k, professional studio lighting, photorealistic.`;

  // --- Gemini 引擎逻辑 ---
  if (engine === 'gemini') {
    if (!GEMINI_KEY || GEMINI_KEY.trim() === "") {
      throw new Error("Gemini API Key가 비어있습니다. Vercel 환경변수 설정을 확인하세요.");
    }

    try {
      const genAI = new GoogleGenAI(GEMINI_KEY.trim());
      // 建议使用 gemini-1.5-flash，它的响应最快且最适合图像任务
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const petPart = await imageToGeminiPart(petImageSource);
      const result = await model.generateContent([petPart, prompt]);
      const response = await result.response;
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      
      if (part?.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      throw new Error("Gemini 가 이미지를 생성하지 못했습니다.");
    } catch (error: any) {
      console.error("Gemini Details:", error);
      throw new Error(`Gemini 오류: ${error.message}`);
    }
  } 
  
  // --- Fal.ai 引擎逻辑 ---
  else {
    if (!FAL_KEY || FAL_KEY.trim() === "") {
      throw new Error("Fal.ai API Key가 비어있습니다. Vercel 환경변수 설정을 확인하세요.");
    }

    fal.config({ credentials: FAL_KEY.trim() });

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

      throw new Error("이미지 URL을 추출할 수 없습니다.");
    } catch (err: any) {
      console.error("Fal.ai Details:", err);
      throw new Error(`Fal.ai 오류: ${err.message}`);
    }
  }
};
