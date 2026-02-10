import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

// 辅助函数：DataURL 转 Gemini 格式
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { inlineData: { data, mimeType } };
};

// 辅助函数：DataURL 转 Blob
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
  
  // 🔐 关键：在函数内部直接定义 Key，确保绝不会报 ReferenceError
  const GEMINI_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // 配置 Fal 凭据
  fal.config({ credentials: FAL_KEY });

  // 1. 预处理：上传原图到 Fal 获取公开 URL (图生图必备)
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    const blob = dataUrlToBlob(petImageSource);
    const uploaded = await fal.storage.upload(blob);
    petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
  }

  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      // 修正 Gemini 404: 必须使用完整路径 models/gemini-1.5-flash
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `Analyze this pet photo and describe its breed. Then create an English prompt for: the pet wearing ${description}, ${style} background. Return ONLY the prompt text.`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      // 调用 FAL 的 Flux 模型完成绘图
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6
        }
      });
      return finalResult.images?.[0]?.url || finalResult.image?.url;
    } catch (error: any) {
      throw new Error(`Gemini 模式运行失败: ${error.message}`);
    }
  } else {
    // Fal 直接调用模式
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `High-end pet fashion, a pet wearing ${description}, ${style} background, 8k photorealistic`,
          strength: 0.65,
        }
      });
      return result.images?.[0]?.url || result.image?.url;
    } catch (err: any) {
      throw new Error(`Fal 模式运行失败: ${err.message}`);
    }
  }
};
