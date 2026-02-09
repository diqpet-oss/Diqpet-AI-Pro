import OpenAI from "openai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：将 DataURL 转为 Blob (用于 Fal.ai 上传)
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
 * 核心生成函数：保持导出名不变，内部切换为豆包生图逻辑
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // ---------------------------------------------------------
  // 1. 核心配置 (根据火山引擎控制台填入)
  // ---------------------------------------------------------
  // 豆包 API Key 和 终端 Endpoint
  const DOUBAO_API_KEY = "ff9cbd45-18a5-4acf-9db0-a684c415120d"; 
  const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3";
  // 关键：这里填入你在“方舟”控制台创建的【Doubao-Pixel】推理终端 ID
  const DOUBAO_MODEL_ID = "doubao-seedream-4-5-251128"; 

  // Fal.ai Key (保持原样)
  const FAL_API_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // ---------------------------------------------------------
  // 2. 引擎分发
  // ---------------------------------------------------------

  // 按钮选 GEMINI 时，实际运行豆包 Pixel 逻辑
  if (engine === 'gemini') {
    try {
      const openai = new OpenAI({
        apiKey: DOUBAO_API_KEY,
        baseURL: DOUBAO_ENDPOINT,
        dangerouslyAllowBrowser: true 
      });

      // 针对豆包优化的中文提示词
      const prompt = `专业宠物摄影。一只宠物正在穿着：${description}。场景背景为${style}。画面真实，细节丰富，8k分辨率。`;

      const response = await openai.images.generate({
        model: DOUBAO_MODEL_ID,
        prompt: prompt,
        size: "1024x1024",
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      if (imageUrl) return imageUrl;
      
      throw new Error("豆包未能生成有效图片链接。");
    } catch (error: any) {
      console.error("Doubao Service Error:", error);
      throw new Error(`豆包生成失败: ${error.message}`);
    }
  } 
  
  // --- Fal.ai Flux 引擎逻辑 ---
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
