import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

/**
 * 修复逻辑说明：
 * 1. 修正了 Gemini 模型路径，去除了导致 404 的 "-latest" 并确保路径完整。
 * 2. 显式定义了 API Keys，解决了截图中的 ReferenceError: FAL_API_KEY is not defined。
 * 3. 优化了 Fal 存储上传逻辑，确保 Flux 引擎能正确获取图片 URL。
 */

const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { inlineData: { data, mimeType } };
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(base64);
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
  
  // 🔐 关键：直接在函数内部定义 Key，彻底解决浏览器端 ReferenceError 问题
  const GEMINI_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  fal.config({ credentials: FAL_KEY });

  // 1. 将图片上传到 Fal 存储以获取公开 URL
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(petImageSource);
      const uploaded = await fal.storage.upload(blob);
      petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
    } catch (e) {
      throw new Error("图片云端同步失败，请检查网络");
    }
  }

  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      
      // 🚨 修复 404：使用官方推荐的稳定路径
      // 截图显示 models/gemini-1.5-flash-latest 报错，此处改为标准路径
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `Analyze this pet photo. Create a high-quality descriptive English prompt for: the pet wearing ${description}, in a ${style} setting. Output ONLY the refined prompt text.`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      // 2. 使用 Flux 引擎完成图生图渲染
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6,
          num_inference_steps: 28
        },
      });

      const resUrl = finalResult.images?.[0]?.url || finalResult.image?.url;
      if (!resUrl) throw new Error("AI 引擎未返回有效图片地址");
      return resUrl;

    } catch (error: any) {
      throw new Error(`Gemini 模式生成失败: ${error.message}`);
    }
  } else {
    // Fal 直接生成逻辑
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `A cute pet wearing ${description}, ${style} background, high fashion photography, 8k resolution`,
          strength: 0.65,
        }
      });
      const resUrl = result.images?.[0]?.url || result.image?.url;
      if (!resUrl) throw new Error("Fal 引擎未返回有效图片地址");
      return resUrl;
    } catch (err: any) {
      throw new Error(`Fal 模式生成失败: ${err.message}`);
    }
  }
};
