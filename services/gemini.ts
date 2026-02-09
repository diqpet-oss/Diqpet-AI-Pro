import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：处理图片转 Base64
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
      throw new Error("이미지 데이터를 가져오지 못했습니다.");
    }
  }
  return { inlineData: { data: base64Data, mimeType } };
}

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
  
  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. 8k, professional studio lighting, photorealistic.`;

  // --- 关键修改：确保从 Vite 环境变量读取 ---
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY;
  const FAL_API_KEY = import.meta.env.VITE_FAL_KEY;

  if (engine === 'gemini') {
    // 显式检查 Key 是否存在，避免浏览器初始化失败
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API Key가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.");
    }
    
    // 初始化模型
    const genAI = new GoogleGenAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const petPart = await imageToGeminiPart(petImageSource);
    
    try {
      const result = await model.generateContent([petPart, prompt]);
      const response = await result.response;
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      
      if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      throw new Error("이미지 생성 결과가 없습니다.");
    } catch (error: any) {
      throw new Error(`Gemini 오류: ${error.message}`);
    }
  } 
  
  else {
    if (!FAL_API_KEY) {
      throw new Error("Fal.ai API Key가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.");
    }

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

      // 增加多层级 URL 解析
      const finalUrl = result?.images?.[0]?.url || result?.image?.url || result?.data?.images?.[0]?.url;
      if (finalUrl) return finalUrl;

      throw new Error("이미지 URL을 추출할 수 없습니다.");
    } catch (err: any) {
      throw new Error(`Fal.ai 오류: ${err.message}`);
    }
  }
};
