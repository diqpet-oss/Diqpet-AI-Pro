import OpenAI from "openai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：DataURL 转 Blob (供 Fal.ai 使用)
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
 * 核心生成函数 - 适配豆包与 Fal.ai
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // ---------------------------------------------------------
  // 1. 核心配置 (在这里填入你的明文信息)
  // ---------------------------------------------------------
  // 豆包 (火山引擎) 配置
  const DOUBAO_API_KEY = "ff9cbd45-18a5-4acf-9db0-a684c415120d"; 
  const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3";
  // 注意：此处填入 ep-xxxx 格式的推理终端 ID
  const DOUBAO_MODEL_ID = "doubao-seedream-4-5-251128"; 

  // Fal.ai 配置
  const FAL_API_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // ---------------------------------------------------------
  // 2. 逻辑分发
  // ---------------------------------------------------------

  // 即使 UI 传过来的是 'gemini'，内部也指向豆包逻辑
  if (engine === 'gemini') {
    try {
      const openai = new OpenAI({
        apiKey: DOUBAO_API_KEY,
        baseURL: DOUBAO_ENDPOINT,
        dangerouslyAllowBrowser: true 
      });

      // 豆包是国产模型，使用中文 Prompt 效果更惊艳
      const finalPrompt = `专业宠物摄影。一只宠物正在穿着：${description}。场景设在${style}背景下。写实风格，8k精细画质，构图完美。`;

      const response = await openai.images.generate({
        model: DOUBAO_MODEL_ID,
        prompt: finalPrompt,
        size: "1024x1024",
        n: 1,
      });

      // 豆包返回的是一个临时图片 URL
      const imageUrl = response.data[0]?.url;
      if (imageUrl) return imageUrl;
      
      throw new Error("豆包未能生成图片，请检查配额或推理终端状态。");
    } catch (error: any) {
      console.error("Doubao Error Detail:", error);
      throw new Error(`豆包生图失败: ${error.message}`);
    }
  } 
  
  // --- Fal.ai Flux 引擎 ---
  else {
    fal.config({ credentials: FAL_API_KEY });

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
          prompt: `High-end pet fashion, wearing ${description}, ${style} background, 8k photorealistic`,
          strength: 0.65, 
        }
      });

      const finalUrl = result?.images?.[0]?.url || result?.image?.url;
      if (finalUrl) return finalUrl;
      throw new Error("Fal.ai 이미지 추출 실패");
    } catch (err: any) {
      throw new Error(`Fal.ai 오류: ${err.message}`);
    }
  }
};
