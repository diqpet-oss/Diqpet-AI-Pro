import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：将 DataURL 转换为 Gemini 要求的 Base64 结构
 * 用于 Gemini 1.5 的视觉分析功能
 */
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return {
    inlineData: { data, mimeType },
  };
};

/**
 * 辅助函数：将 DataURL 转换为 Blob 对象
 * 用于 Fal.ai 的存储上传功能
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(base64);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
};

/**
 * 核心生成函数：支持 Google Gemini 视觉驱动和 Fal.ai 直接驱动
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // ---------------------------------------------------------
  // 1. 配置 (建议生产环境使用环境变量 import.meta.env.VITE_XXX)
  // ---------------------------------------------------------
  const GEMINI_API_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_API_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // 配置 Fal.ai 凭据
  fal.config({ credentials: FAL_API_KEY });

  // ---------------------------------------------------------
  // 2. 图片预处理：将本地图片上传到 Fal 存储以获取公开 URL
  // ---------------------------------------------------------
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(petImageSource);
      const uploaded = await fal.storage.upload(blob);
      petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
    } catch (uploadErr: any) {
      throw new Error(`图片上传失败: ${uploadErr.message}`);
    }
  }

  // ---------------------------------------------------------
  // 3. 逻辑分发
  // ---------------------------------------------------------

  // --- 方案 A: Google Gemini 引擎 (视觉理解 + Flux 绘图) ---
  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      
      // 使用 -latest 确保指向最新稳定的 1.5 模型，避免 404 错误
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `你是一个图像分析专家。请根据这张宠物照片，生成一段详细的英文生图提示词（Prompt）。
      内容要求：首先识别并描述宠物原本的品种和颜色特征，然后描述它正在穿着“${description}”，背景是“${style}”。
      风格要求：Photorealistic, 8k, high detail, masterpiece. 
      注意：只返回一段纯英文 Prompt，不要包含任何解释。`;

      // 步骤 1: Gemini 视觉分析生成 Prompt
      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      // 步骤 2: 将 Gemini 生成的高质量描述传给 Flux 进行图生图
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6 // 保持宠物长相一致性的关键参数 (0.0-1.0)
        }
      });

      const finalUrl = finalResult.images?.[0]?.url || finalResult.image?.url;
      if (finalUrl) return finalUrl;
      throw new Error("Gemini 链路中 Fal 提取图片失败");

    } catch (error: any) {
      console.error("Gemini Engine Error:", error);
      throw new Error(`Google Gemini 逻辑失败: ${error.message}`);
    }
  } 
  
  // --- 方案 B: Fal.ai 引擎 (直接 Flux 图生图) ---
  else {
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `A high-quality professional photo of a pet wearing ${description}, ${style} background, 8k photorealistic, high quality, maintaining pet's original features`,
          strength: 0.65,
        }
      });

      const finalUrl = result?.images?.[0]?.url || result?.image?.url;
      if (finalUrl) return finalUrl;
      throw new Error("Fal.ai 提取图片失败");
    } catch (err: any) {
      console.error("Fal Engine Error:", err);
      throw new Error(`Fal.ai 错误: ${err.message}`);
    }
  }
};
