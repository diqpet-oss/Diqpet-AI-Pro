import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

// 数据转换辅助函数
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
  
  // 直接在函数内部定义，防止 ReferenceError
  const GEMINI_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // 配置 Fal
  fal.config({ credentials: FAL_KEY });

  // 1. 预处理：上传图片获取 URL
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    const blob = dataUrlToBlob(petImageSource);
    const uploaded = await fal.storage.upload(blob);
    petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
  }

  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      // ❗ 修复 404: 移除 -latest 后缀，使用基础名称以适配 v1beta 路径
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `Analyze this pet photo. Describe its appearance. Then create an English prompt for: the pet wearing ${description}, ${style} background. Photorealistic, 8k. Return ONLY the prompt text.`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      // 串联 Fal 进行图生图
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6
        }
      });
      return finalResult.images?.[0]?.url || finalResult.image?.url;
    } catch (error: any) {
      console.error("Gemini Logic Error:", error);
      throw new Error(`Gemini 模式失败: ${error.message}`);
    }
  } else {
    // Fal 模式逻辑
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `A professional photo of a pet wearing ${description}, ${style} background, 8k photorealistic`,
          strength: 0.65,
        }
      });
      return result.images?.[0]?.url || result.image?.url;
    } catch (err: any) {
      throw new Error(`Fal 模式失败: ${err.message}`);
    }
  }
};
