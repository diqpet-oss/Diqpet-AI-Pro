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
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Data = btoa(binary);
    } catch (e) {
      console.error("Image Processing Error:", e);
      throw new Error("이미지 처리 중 오류가 발생했습니다.");
    }
  }
  return { inlineData: { data: base64Data, mimeType } };
}

/**
 * 核心生成函数
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // 1. 获取 Key (添加 trim() 确保没有换行符或空格)
  const GEMINI_KEY = AIzaSyDnj72Pn4Yf8gNq6VK15xkADQJPYmwMNcg;
  const FAL_KEY = 81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2c;

  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. 8k, photorealistic.`;

  // --- Gemini 引擎 ---
  if (engine === 'gemini') {
    if (!GEMINI_KEY) {
      throw new Error("VITE_GEMINI_KEY is missing. Check Vercel Settings.");
    }

    try {
      // 关键修改：直接在函数内部实例化，不依赖外部静态声明
      const genAI = new GoogleGenAI(GEMINI_KEY);
      
      // 使用更稳定的 1.5-flash 模型名
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const petPart = await imageToGeminiPart(petImageSource);
      
      // 执行生成
      const result = await model.generateContent([petPart, prompt]);
      const response = await result.response;
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      
      if (part?.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      throw new Error("이미지가 생성되지 않았습니다.");
    } catch (error: any) {
      console.error("Gemini Technical Error:", error);
      // 如果依然报错 Key set 问题，通常是 Google SDK 的内部校验失败
      throw new Error(`Gemini 오류: ${error.message || "API 인증 실패"}`);
    }
  } 
  
  // --- Fal.ai 引擎 ---
  else {
    if (!FAL_KEY) throw new Error("VITE_FAL_KEY is missing.");
    
    fal.config({ credentials: FAL_KEY });

    try {
      // 执行 Fal.ai 逻辑 (保持不变)
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: { image: petImageSource, prompt: prompt, strength: 0.65 }
      });
      return result?.images?.[0]?.url || result?.image?.url || "";
    } catch (err: any) {
      throw new Error(`Fal.ai 오류: ${err.message}`);
    }
  }
};
