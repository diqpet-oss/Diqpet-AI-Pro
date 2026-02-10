import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

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
  
  const GEMINI_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  fal.config({ credentials: FAL_KEY });

  // 1. 统一图片上传逻辑
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(petImageSource);
      const uploaded = await fal.storage.upload(blob);
      petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
    } catch (e) {
      throw new Error("Image upload to cloud failed. Please check network.");
    }
  }

  // 2. 根据引擎执行逻辑
  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

      // 优化：Gemini 也可以直接通过 URL 获取图片信息，或者继续使用精简后的 Base64
      const prompt = `Task: Pet Fashion AI. 
      Analyze the pet in this image. Then generate a descriptive English prompt for Flux AI to render this exact pet wearing: ${description}. 
      Environment: ${style} background. 
      Output ONLY the final prompt text.`;

      // 注意：这里仍然保持 inlineData 兼容性，但确保是处理过的 source
      const imagePart = { inlineData: { data: petImageSource.split(',')[1], mimeType: "image/png" } };
      
      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6,
          num_inference_steps: 28 // 稍微降低步数可加快生成速度
        },
      });

      const outputUrl = finalResult.images?.[0]?.url || finalResult.image?.url;
      if (!outputUrl) throw new Error("AI generated an empty result.");
      return outputUrl;

    } catch (error: any) {
      throw new Error(`Gemini Logic Error: ${error.message}`);
    }
  } else {
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `Professional pet photography, a pet wearing ${description}, ${style} background, high quality, 8k, highly detailed fur`,
          strength: 0.65,
        }
      });
      return result.images?.[0]?.url || result.image?.url;
    } catch (err: any) {
      throw new Error(`Fal Direct Error: ${err.message}`);
    }
  }
};
