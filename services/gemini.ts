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
    const match = header.match(/:(.*?);/);
    mimeType = match ? match[1] : "image/png";
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
      console.error("Failed to fetch image", e);
      throw new Error("이미지 데이터를 가져오지 못했습니다.");
    }
  }

  return { inlineData: { data: base64Data, mimeType: mimeType } };
}

/**
 * 辅助函数：DataURL 转 Blob
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
 * 核心生成接口
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. 8k, professional studio lighting, photorealistic.`;

  // ---------------------------------------------------------
  // 1. 设置明文 API KEY (请确保下方填入正确的 Key)
  // ---------------------------------------------------------
  const geminiApiKey = "AIzaSyDnj72Pn4Yf8gNq6VK15xkADQJPYmwMNcg"; 
  const falApiKey = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // --- Gemini 引擎实现 (修复逻辑) ---
  if (engine === 'gemini') {
    try {
      // 初始化 SDK (正确姿势)
      const genAI = new GoogleGenAI(geminiApiKey);
      
      // 获取模型实例 (建议用 gemini-1.5-flash，速度快且稳定)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const petPart = await imageToGeminiPart(petImageSource);
      
      // 执行生成请求
      const result = await model.generateContent([petPart, prompt]);
      const response = await result.response;
      
      // 提取返回的图片数据
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      
      if (part?.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      throw new Error("Gemini가 이미지를 생성하지 못했습니다.");
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(`Gemini 오류: ${error.message}`);
    }
  } 
  
  // --- Fal.ai Flux 引擎实现 ---
  else {
    fal.config({ credentials: falApiKey });

    try {
      let petUrl = petImageSource;
      if (petImageSource.startsWith('data:')) {
        const blob = dataUrlToBlob(petImageSource);
        const uploaded = await fal.storage.upload(blob);
        petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
      }

      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl, 
          prompt: prompt,
          strength: 0.65, 
          num_inference_steps: 28
        }
      });

      const finalImageUrl = result?.images?.[0]?.url || result?.image?.url || result?.data?.images?.[0]?.url;

      if (finalImageUrl) return finalImageUrl;
      throw new Error("Fal.ai 이미지 URL 추출 실패");
    } catch (err: any) {
      throw new Error(`Fal.ai 오류: ${err.message}`);
    }
  }
};
