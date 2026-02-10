import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

// 将图片转换为 Gemini 要求的格式
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { inlineData: { data, mimeType } };
};

// 将图片转换为 Fal.ai 要求的 Blob 格式
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
  
  // 环境变量建议：实际部署时请在 Vercel 后台设置这些 Key

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const FAL_KEY = import.meta.env.VITE_FAL_KEY;

  fal.config({ credentials: FAL_API_KEY });

  // 1. 预处理：将本地图片上传至 Fal 存储以获取公开 URL
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    const blob = dataUrlToBlob(petImageSource);
    const uploaded = await fal.storage.upload(blob);
    petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
  }

  // --- Google Gemini 引擎逻辑 ---
  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      
      // ❗ 修复 404 的关键：使用标准模型名称，不要带 -latest 别名
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `Analyze this pet photo. Describe its breed and main visual features. Then create a highly detailed English prompt for an AI image generator to make this pet wear "${description}" in a "${style}" setting. Return ONLY the prompt text.`;

      // Gemini 进行视觉分析
      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text();

      // 调用 Fal.ai 进行像素级图生图
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6 // 保持宠物一致性
        }
      });
      return finalResult.images?.[0]?.url || finalResult.image?.url;

    } catch (error: any) {
      console.error("Gemini 详情错误:", error);
      throw new Error(`Google Gemini 逻辑失败: ${error.message}`);
    }
  } 
  
  // --- Fal.ai 引擎逻辑 ---
  else {
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
      throw new Error(`Fal.ai 错误: ${err.message}`);
    }
  }
};
