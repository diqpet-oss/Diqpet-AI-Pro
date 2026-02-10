import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：DataURL 转 Base64 对象 (Gemini 需要)
 */
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return {
    inlineData: {
      data,
      mimeType,
    },
  };
};

/**
 * 辅助函数：DataURL 转 Blob (Fal.ai 需要)
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
  
  // ---------------------------------------------------------
  // 1. 配置
  // ---------------------------------------------------------
  const GEMINI_API_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_API_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // ---------------------------------------------------------
  // 2. 逻辑分发
  // ---------------------------------------------------------

  // --- Google Gemini 引擎 (视觉理解 + 创作) ---
  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      // 使用支持视觉的模型
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      
      // 注意：Gemini 1.5 并不直接生成图片 URL，而是作为“创作大脑”。
      // 这里的逻辑是：让 Gemini 分析图片并生成一个可以高度还原宠物的绘画提示词。
      // 然后通过 Imagen 或其他内置能力（如果你的账号有权限）生成图片。
      // 如果要直接返回图片，通常需要配合 Google Cloud 的 Vertex AI。
      // 这里的 Demo 逻辑演示如何获取 Gemini 生成的“精准图生图描述”：
      const prompt = `分析这张图片中的宠物，描述它的品种、花色和姿态。
      然后请想象它穿上"${description}"的样子，背景是"${style}"。
      请输出一段详细的英文提示词，用于 AI 生图模型，确保保持宠物原本的特征。`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text();

      // 这里演示：将 Gemini 生成的精准描述再喂给 Fal 进行高质量生成
      // 这是目前“强强联手”的最高效方案
      fal.config({ credentials: FAL_API_KEY });
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: refinedPrompt,
          image_url: await uploadToFal(petImageSource), // 参考原图
          strength: 0.6
        }
      });

      return finalResult.images[0].url;
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(`Google Gemini 生图逻辑失败: ${error.message}`);
    }
  } 
  
  // --- Fal.ai Flux 直接图生图 ---
  else {
    fal.config({ credentials: FAL_API_KEY });

    try {
      const petUrl = await uploadToFal(petImageSource);

      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl, 
          prompt: `High-end pet fashion photorealism, a pet wearing ${description}, ${style} background, 8k, highly detailed, maintain pet features`,
          strength: 0.65, 
        }
      });

      const finalUrl = result?.images?.[0]?.url || result?.image?.url;
      if (finalUrl) return finalUrl;
      throw new Error("Fal.ai 提取图片失败");
    } catch (err: any) {
      throw new Error(`Fal.ai 错误: ${err.message}`);
    }
  }
};

/**
 * 提取重复的上传逻辑
 */
async function uploadToFal(source: string): Promise<string> {
  if (source.startsWith('data:')) {
    const blob = dataUrlToBlob(source);
    const uploaded = await fal.storage.upload(blob);
    return typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
  }
  return source;
}
