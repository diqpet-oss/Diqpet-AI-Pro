import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

// 辅助：DataURL 转 Gemini 格式
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { inlineData: { data, mimeType } };
};

// 辅助：DataURL 转 Blob
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
  
  // 🔐 关键修复：硬编码 Key 以确保部署即用（生产环境建议换回环境变量）
  const GEMINI_API_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_API_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // 配置凭据
  fal.config({ credentials: FAL_API_KEY });

  // 1. 预处理：上传原图到 Fal 获取 URL
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    const blob = dataUrlToBlob(petImageSource);
    const uploaded = await fal.storage.upload(blob);
    petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
  }

  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      // ❗ 修复 404：移除 -latest 后缀
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `Task: Analyze this pet photo. Create an English prompt for: the pet wearing ${description}, background is ${style}. High detail, 8k, photorealistic. Return ONLY the prompt text.`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      // 调用图生图
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6
        }
      });
      return finalResult.images?.[0]?.url || finalResult.image?.url;
    } catch (error: any) {
      console.error("Gemini 链条故障:", error);
      throw new Error(`Gemini 模式生图失败: ${error.message}`);
    }
  } else {
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `Professional pet photo, wearing ${description}, ${style} background, 8k photorealistic`,
          strength: 0.65,
        }
      });
      return result.images?.[0]?.url || result.image?.url;
    } catch (err: any) {
      throw new Error(`Fal.ai 模式失败: ${err.message}`);
    }
  }
};
