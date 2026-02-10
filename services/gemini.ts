import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：DataURL 转 Base64
 */
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return {
    inlineData: { data, mimeType },
  };
};

/**
 * 辅助函数：DataURL 转 Blob
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

export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  const GEMINI_API_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_API_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // 1. 预处理：无论哪个引擎，Flux 图生图都需要一个公开 URL
  fal.config({ credentials: FAL_API_KEY });
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
      // 修正点：使用 -latest 确保指向当前 beta 可用版本
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `你是一个图像分析专家。请根据这张宠物照片，生成一段详细的英文提示词。
      内容要求：描述宠物原本的品种、颜色，并加上“正在穿着${description}，背景是${style}”。
      风格要求：Photorealistic, 8k, high detail。只返回一段英文文本。`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text();

      // Gemini 理解图片后，调用 Fal 进行像素级图生图
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6
        }
      });
      return finalResult.images?.[0]?.url || finalResult.image?.url;

    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw new Error(`Google Gemini 逻辑失败: ${error.message}`);
    }
  } 
  
  // --- Fal.ai 引擎逻辑 ---
  else {
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `A cute pet wearing ${description}, ${style} background, 8k photorealistic, high quality`,
          strength: 0.65,
        }
      });
      return result.images?.[0]?.url || result.image?.url;
    } catch (err: any) {
      throw new Error(`Fal.ai 错误: ${err.message}`);
    }
  }
};
