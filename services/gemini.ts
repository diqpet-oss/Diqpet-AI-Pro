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
      console.error("获取图片失败:", e);
      throw new Error("이미지 데이터를 가져오지 못했습니다. 로컬 파일을 업로드해 보세요.");
    }
  }

  return { inlineData: { data: base64Data, mimeType: mimeType } };
}

/**
 * 辅助函数：将 Base64 转换为 Blob 以便上传到 Fal 存储
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  try {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("DataURL 转换 Blob 错误:", e);
    throw new Error("이미지 전처리에 실패했습니다. 업로드한 이미지를 확인해 주세요.");
  }
};

/**
 * 统一生成接口：支持 Gemini 和 Fal.ai Flux
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. Ensure the pet's face, fur texture, and breed features are 100% consistent with the source image. The clothing should fit the pet's body realistically with high-detail fabric textures and studio shadows. 8k, professional studio lighting, photorealistic.`;

  // 安全获取环境变量 (兼容 Vite 和标准 Node 环境)
  const GEMINI_KEY = import.meta.env?.VITE_GEMINI_KEY || process.env.API_KEY || process.env.VITE_GEMINI_KEY;
  const FAL_KEY = import.meta.env?.VITE_FAL_KEY || process.env.FAL_KEY || process.env.VITE_FAL_KEY;

  // --- Gemini 引擎实现 ---
  if (engine === 'gemini') {
    if (!GEMINI_KEY) throw new Error("Gemini API Key 未配置，请检查环境变量。");

    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const petPart = await imageToGeminiPart(petImageSource);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // 修正为当前可用模型
      contents: { parts: [petPart, { text: prompt }] },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("Gemini AI가 생성된 이미지를 반환하지 못했습니다.");
  } 
  
  // --- Fal.ai Flux 引擎实现 ---
  else {
    if (!FAL_KEY) throw new Error("Fal.ai API Key 未配置，请检查环境变量。");

    fal.config({ 
      credentials: FAL_KEY
    });

    try {
      // 1. 处理图片上传
      let petUrl = petImageSource;
      if (petImageSource.startsWith('data:')) {
        const blob = dataUrlToBlob(petImageSource);
        const uploaded = await fal.storage.upload(blob);
        petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
      }

      // 2. 执行 Flux 推理
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image: petUrl, // 部分版本使用 'image' 字段
          prompt: prompt,
          strength: 0.65, 
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true
        }
      });

      console.debug("Fal.ai 原始响应:", result);

      // 3. 增强版结果解析逻辑 (兼容多种返回结构)
      let finalImageUrl = "";
      
      const extractUrl = (obj: any) => {
          if (!obj) return null;
          // 检查 images 数组
          if (obj.images && Array.isArray(obj.images) && obj.images.length > 0) {
              return typeof obj.images[0] === 'string' ? obj.images[0] : obj.images[0].url;
          }
          // 检查单个 image 对象
          if (obj.image?.url) return obj.image.url;
          // 检查 URL 直接属性
          if (obj.url) return obj.url;
          return null;
      };

      // 尝试从根部或 data 字段提取
      finalImageUrl = extractUrl(result) || extractUrl(result?.data);

      if (finalImageUrl && typeof finalImageUrl === 'string') {
        return finalImageUrl;
      }

      throw new Error(`이미지 URL을 추출하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 100)}...`);

    } catch (err: any) {
      console.error("Fal.ai 详细错误:", err);
      const details = err.body?.detail || err.message || "알 수 없는 오류";
      if (details.includes("Authentication") || details.includes("401")) {
        throw new Error("Fal.ai 인증 실패: API Key가 유효하지 않거나 잔액이 부족합니다.");
      }
      throw new Error(`Fal.ai 렌더링 실패: ${details}`);
    }
  }
};
