import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

/**
 * 辅助函数：将 DataURL 转换为 Gemini 所需的内联数据格式
 */
const dataUrlToInlineData = (dataUrl: string) => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { inlineData: { data, mimeType } };
};

/**
 * 辅助函数：将 DataURL 转换为 Blob 以便上传到 Fal 存储
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
 * 核心生成函数
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // 🔐 安全与环境修复：
  // 直接定义 Key 以彻底消除浏览器端的 ReferenceError
  const GEMINI_KEY = "AIzaSyBZXh2MhgkwWXV7V_uRofw4lT4dL9P4PnQ";
  const FAL_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

  // 配置 Fal 客户端凭据
  fal.config({ credentials: FAL_KEY });

  // 1. 预处理：将原图上传至 Fal 获取公开 URL (Flux 渲染必备)
  let petUrl = petImageSource;
  if (petImageSource.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(petImageSource);
      const uploaded = await fal.storage.upload(blob);
      petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
    } catch (e) {
      throw new Error("图片上传至云端失败，请检查网络连接");
    }
  }

  // 2. 引擎逻辑分发
  if (engine === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      
      // 🚨 关键修复 404：必须使用完整路径 "models/gemini-1.5-flash"
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

      const imagePart = dataUrlToInlineData(petImageSource);
      const prompt = `Task: Analyze the pet photo and its breed. 
      Generate a professional English photography prompt for: this pet wearing ${description}.
      Environment: ${style} background. 
      Result should be a single paragraph of descriptive text. 
      Return ONLY the text.`;

      const result = await model.generateContent([prompt, imagePart]);
      const refinedPrompt = result.response.text().trim();

      // 3. 调用 FAL Flux Dev 进行图像生成 (Image-to-Image)
      const finalResult: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: refinedPrompt,
          strength: 0.6, // 保持宠物特征的强度平衡
          num_inference_steps: 28,
          guidance_scale: 3.5
        }
      });

      const outputUrl = finalResult.images?.[0]?.url || finalResult.image?.url;
      if (!outputUrl) throw new Error("AI 引擎未能生成图片 URL");
      
      return outputUrl;

    } catch (error: any) {
      // 捕获具体的 API 错误并抛出给 UI 展示
      throw new Error(`Gemini 模式生成失败: ${error.message}`);
    }
  } else {
    // Fal 直接生成模式 (不经过 Gemini 优化 Prompt)
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl,
          prompt: `High-end pet fashion editorial, a pet wearing ${description}, ${style} background, 8k resolution, cinematic lighting, highly detailed fur`,
          strength: 0.65,
        }
      });
      
      const outputUrl = result.images?.[0]?.url || result.image?.url;
      if (!outputUrl) throw new Error("Fal 模式未返回结果");
      
      return outputUrl;
    } catch (err: any) {
      throw new Error(`Fal 模式运行失败: ${err.message}`);
    }
  }
};
