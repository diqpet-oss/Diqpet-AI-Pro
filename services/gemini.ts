import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";

/**
 * Helper function: Convert image source to Base64 InlineData for Gemini
 */
async function imageToGeminiPart(imageSource: string) {
  let base64Data = "";
  let mimeType = "image/png";

  if (imageSource.startsWith("data:")) {
    const [header, data] = imageSource.split(",");
    const match = header.match(/:(.*?);/);
    mimeType = match ? match[1] : "image/png";
    base64Data = data;
  } else {
    try {
      const response = await fetch(imageSource);
      const blob = await response.blob();
      mimeType = blob.type;
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Data = btoa(binary);
    } catch (e) {
      console.error("Failed to fetch image", e);
      throw new Error("이미지 데이터를 가져오지 못했습니다. 로컬 파일을 업로드해 보세요.");
    }
  }

  return { inlineData: { data: base64Data, mimeType: mimeType } };
}

/**
 * Helper function: Convert Base64 to Blob for Fal storage upload
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  try {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("DataURL to Blob conversion error:", e);
    throw new Error("이미지 전처리에 실패했습니다. 업로드한 이미지를 확인해 주세요.");
  }
};

/**
 * Unified generation interface supporting both Gemini and Fal.ai Flux
 */
export const generateFitting = async (
  engine: 'gemini' | 'fal',
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  const prompt = `High-end pet fashion editorial photography. The exact pet from the input image is now wearing this outfit: ${description}. The photo is taken in a ${style} background. Ensure the pet's face, fur texture, and breed features are 100% consistent with the source image. The clothing should fit the pet's body realistically with high-detail fabric textures and studio shadows. 8k, professional studio lighting, photorealistic.`;

  // --- Gemini Engine Implementation ---
  if (engine === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const petPart = await imageToGeminiPart(petImageSource);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [petPart, { text: prompt }] },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("Gemini AI가 생성된 이미지를 반환하지 못했습니다.");
  } 
  
  // --- Fal.ai Flux Engine Implementation ---
  else {
    const falApiKey = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";

    fal.config({ 
      credentials: falApiKey
    });

    try {
      // 1. Upload image if it's base64/data URL
      let petUrl = petImageSource;
      if (petImageSource.startsWith('data:')) {
        const blob = dataUrlToBlob(petImageSource);
        const uploaded = await fal.storage.upload(blob);
        petUrl = typeof uploaded === 'string' ? uploaded : (uploaded as any).url;
      }

      // 2. Perform Inference
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petUrl, 
          prompt: prompt,
          strength: 0.65, 
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true
        }
      });

      console.debug("Fal.ai Raw Response:", result);

      // 3. Ultra-Robust result parsing to handle nested 'data' objects
      let finalImageUrl = "";
      
      const extractFromContainer = (container: any) => {
          if (!container) return null;
          if (container.images && Array.isArray(container.images) && container.images.length > 0) {
              const first = container.images[0];
              return typeof first === 'string' ? first : first.url;
          }
          if (container.image?.url) return container.image.url;
          if (container.data && Array.isArray(container.data) && container.data.length > 0) {
              const first = container.data[0];
              return first?.url || (typeof first === 'string' ? first : null);
          }
          if (typeof container === 'string' && container.startsWith('http')) return container;
          if (container.url) return container.url;
          
          return null;
      };

      finalImageUrl = extractFromContainer(result);

      if (!finalImageUrl && result?.data) {
          finalImageUrl = extractFromContainer(result.data);
      }

      if (finalImageUrl && typeof finalImageUrl === 'string') {
        return finalImageUrl;
      }

      throw new Error(`응답에서 이미지 URL을 추출하지 못했습니다. 응답 요약: ${JSON.stringify(result).substring(0, 150)}...`);

    } catch (err: any) {
      console.error("Fal.ai Error Detailed:", err);
      const details = err.body?.detail || err.message || "알 수 없는 오류";
      if (details.includes("Authentication") || details.includes("Unauthorized") || details.includes("401")) {
        throw new Error("Fal.ai 인증 실패: API Key 권한을 확인해 주세요.");
      }
      throw new Error(`Fal.ai 렌더링 실패: ${details}`);
    }
  }
};
