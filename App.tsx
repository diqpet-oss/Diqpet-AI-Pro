import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageAssets } from './types';
import { generateFitting } from './services/gemini';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations';

const AI_STYLES = ['Studio', 'Park', 'Street'];

interface Product {
  id: string;
  name: string;
  category: string;
  url: string;
  imageUrl: string;
  description: string;
}

const STATIC_IMAGES = {
  happy: 'https://www.diqpet.com/products/happy_raincoat.jpg',
  ribbed: 'https://www.diqpet.com/products/ribbed_homewear.jpg',
  puffer: 'https://www.diqpet.com/products/winter.jpg'
};

const FlagIcon = ({ code, className }: { code: string; className?: string }) => (
  <img 
    src={`https://flagcdn.com/w40/${code}.png`} 
    alt={code} 
    className={`w-5 h-3.5 object-cover rounded-[2px] shadow-sm ${className || ''}`}
    loading="lazy"
  />
);

export default function App() {
  const [lang, setLang] = useState<Language>('ko');
  const [engine, setEngine] = useState<'gemini' | 'fal'>('gemini');
  const [selectedProductId, setSelectedProductId] = useState<string>('happy_series_vton');
  const [selectedStyle, setSelectedStyle] = useState('Studio');
  const [assets, setAssets] = useState<ImageAssets>({ 
    pet: null, 
    clothing: STATIC_IMAGES.happy, 
    result: null 
  });
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const t = UI_STRINGS[lang];
  const currentLangData = LANGUAGES.find(l => l.code === lang);
  const isRTL = currentLangData?.isRTL;

  const products: Product[] = PRODUCT_DATA[lang].map((p, idx) => ({
    ...p,
    category: t[`category${idx+1}`] || 'Fashion',
    url: p.id === 'v3_puffer' ? 'https://www.diqpet.com/' : `https://www.coupang.com/vp/products/${p.id === 'happy_series_vton' ? '9312183755' : p.id}`,
    imageUrl: p.id === 'happy_series_vton' ? STATIC_IMAGES.happy : (p.id === 'v3_puffer' ? STATIC_IMAGES.puffer : STATIC_IMAGES.ribbed)
  }));

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];
  const [description, setDescription] = useState(activeProduct.description);

  // 初始化 URL 参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemParam = params.get('item');
    if (itemParam) handleProductSwitch(itemParam);
    const langParam = params.get('lang') as Language;
    if (langParam && LANGUAGES.some(l => l.code === langParam)) setLang(langParam);
  }, []);

  const fileInputPet = useRef<HTMLInputElement>(null);

  const handleProductSwitch = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      setAssets(prev => ({ ...prev, clothing: product.imageUrl, result: null }));
      setDescription(product.description);
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAssets(prev => ({ ...prev, pet: reader.result as string, result: null }));
        setSelectedBreedId(null);
        setStatus('');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 核心生成逻辑修复
  const handleAIGenerate = async () => {
    if (!assets.pet) {
      setStatus(t.petNotSelected);
      return;
    }
    
    setLoading(true);
    setStatus(`🚀 ${t.engineStarted}...`);
    // 清除旧结果，防止用户误以为没反应
    setAssets(prev => ({ ...prev, result: null }));

    try {
      const resultUrl = await generateFitting(
        engine, 
        assets.pet as string, 
        description, 
        selectedStyle
      );

      if (resultUrl) {
        setAssets(prev => ({ ...prev, result: resultUrl }));
        setStatus(`✨ ${t.success}`);
      } else {
        throw new Error("Empty URL returned from engine");
      }
    } catch (error: any) {
      console.error("Generate Error:", error);
      // 将具体的错误信息（如 404 或 ReferenceError）反馈到 UI
      setStatus(`❌ Error: ${error.message || 'Unknown failure'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#050505] text-white overflow-hidden font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Navigation */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-8">
           <h1 className="text-2xl font-black italic tracking-tighter">DIQPET<span className="text-orange-500">.</span></h1>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 hidden md:block">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-6">
           <div className="relative group">
            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
              {currentLangData && <FlagIcon code={currentLangData.flag} />}
              <span className="hidden sm:inline">{currentLangData?.name}</span>
            </button>
            <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] overflow-hidden`}>
              {LANGUAGES.map((l) => (
                <button 
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`w-full flex items-center gap-4 px-5 py-3 hover:bg-zinc-800 text-[10px] font-black uppercase tracking-widest transition-all ${lang === l.code ? 'text-orange-500 bg-orange-500/5' : ''}`}
                >
                  <FlagIcon code={l.flag} />
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-[400px] shrink-0 border-r border-white/5 p-6 flex flex-col gap-6 overflow-y-auto bg-[#070707] custom-scrollbar">
          
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">{t.step1}</h3>
              <button onClick={() => fileInputPet.current?.click()} className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 hover:border-white px-4 py-2 transition-all">
                {t.upload}
              </button>
              <input type="file" ref={fileInputPet} onChange={handleFileChange} hidden accept="image/*" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'golden', url: 'https://www.diqpet.com/products/golden_retriever.jpg' },
                { id: 'corgi', url: 'https://www.diqpet.com/products/corgi.jpg' },
                { id: 'bulldog', url: 'https://www.diqpet.com/products/bulldog.jpg' },
              ].map((breed) => (
                <button
                  key={breed.id}
                  onClick={() => { 
                    setAssets(prev => ({ ...prev, pet: breed.url, result: null })); 
                    setSelectedBreedId(breed.id);
                    setStatus('');
                  }}
                  className={`aspect-square border transition-all overflow-hidden ${selectedBreedId === breed.id ? 'border-orange-500 scale-95 shadow-lg shadow-orange-500/20' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                >
                  <img src={breed.url} className="w-full h-full object-cover" alt={breed.id} />
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b border-white/5 pb-2">{t.step2}</h3>
            <div className="space-y-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductSwitch(product.id)}
                  className={`w-full flex items-center gap-4 p-2 border transition-all ${selectedProductId === product.id ? 'border-white bg-white/5' : 'border-white/5 opacity-50 hover:opacity-100'}`}
                >
                  <img src={product.imageUrl} className="w-14 h-14 object-cover bg-zinc-900" alt={product.name} />
                  <div className="text-left">
                    <p className="text-[8px] font-black uppercase text-orange-500 tracking-tighter">{product.category}</p>
                    <p className="text-[11px] font-black uppercase leading-tight">{product.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b border-white/5 pb-2">{t.step3}</h3>
            <div className="grid grid-cols-2 gap-2">
              {['gemini', 'fal'].map(id => (
                <button
                  key={id}
                  onClick={() => setEngine(id as any)}
                  className={`p-3 border text-left transition-all ${engine === id ? 'border-orange-500 bg-orange-500/5' : 'border-white/5'}`}
                >
                   <p className="text-[9px] font-black uppercase">{id === 'gemini' ? t.engine1 : t.engine2}</p>
                   <p className="text-[7px] text-zinc-500 uppercase mt-1">{id === 'gemini' ? 'AI Vision' : 'Flux Dev'}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {AI_STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedStyle(s)}
                  className={`flex-1 py-2 border text-[8px] font-black uppercase tracking-widest transition-all ${selectedStyle === s ? 'border-white bg-white text-black' : 'border-white/10 text-zinc-500'}`}
                >
                  {t[s.toLowerCase()] || s}
                </button>
              ))}
            </div>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/5 p-4 text-[11px] text-zinc-300 focus:border-orange-500 transition-all min-h-[80px] outline-none"
            />
          </section>

          <div className="mt-auto">
            <button 
              disabled={loading || !assets.pet}
              onClick={handleAIGenerate}
              className="w-full py-6 bg-orange-600 hover:bg-orange-500 disabled:opacity-20 font-black uppercase tracking-[0.3em] text-sm transition-all active:scale-[0.98]"
            >
              {loading ? t.generating : t.generate}
            </button>
            {status && (
              <p className="text-[9px] text-center font-bold uppercase tracking-widest mt-4 text-zinc-400 animate-pulse">
                {status}
              </p>
            )}
          </div>
        </aside>

        {/* Viewport */}
        <main className="flex-grow bg-[#020202] relative flex flex-col">
          <div className="flex-grow relative flex items-center justify-center p-8">
            {assets.result ? (
              <img 
                key={assets.result} // 关键：强制刷新
                src={assets.result} 
                className="max-w-full max-h-full object-contain shadow-2xl animate-in fade-in duration-700" 
                alt="AI Result"
              />
            ) : assets.pet ? (
              <div className="relative w-full h-full flex items-center justify-center">
                 <img 
                    src={assets.pet} 
                    className={`max-w-[80%] max-h-[80%] object-contain transition-all duration-1000 ${loading ? 'blur-2xl opacity-20 scale-110' : 'opacity-20 grayscale'}`} 
                    alt="Preview"
                 />
                 {loading && (
                   <div className="absolute flex flex-col items-center gap-4">
                     <div className="w-10 h-10 border-t-2 border-orange-500 rounded-full animate-spin" />
                     <p className="text-[10px] font-black tracking-[0.5em] uppercase text-orange-500">{t.rendering}</p>
                   </div>
                 )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-10">
                <div className="w-20 h-20 border-2 border-dashed border-white rounded-full flex items-center justify-center">
                   <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[1em]">{t.waiting}</p>
              </div>
            )}
            
            <div className="absolute top-8 left-8 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_red]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 italic">STUDIO FEED // 2.5 LIVE</span>
            </div>
          </div>

          {/* Buy Bar */}
          <footer className="h-24 border-t border-white/5 bg-black/80 backdrop-blur-md px-10 flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">{t.official}</span>
                <h3 className="text-xl font-black uppercase italic leading-none">{activeProduct.name}</h3>
             </div>
             
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => window.open(activeProduct.url, "_blank")}
                  className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-orange-500 hover:text-white transition-all active:scale-95"
                >
                  {t.buyNow}
                </button>
                <div className="flex gap-1">
                   {['share-nodes', 'download'].map(icon => (
                     <button key={icon} className="w-12 h-12 border border-white/5 flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all">
                       <i className={`fa-solid fa-${icon}`} />
                     </button>
                   ))}
                </div>
             </div>
          </footer>
        </main>
      </div>

      <footer className="h-10 shrink-0 border-t border-white/5 flex items-center justify-between px-10 bg-black text-[8px] font-black text-zinc-800 uppercase tracking-widest">
        <div>DIQPET DIGITAL STUDIO &bull; POWERED BY GOOGLE & FAL AI</div>
        <div>© 2026 DIQPET LABS. ALL RIGHTS RESERVED.</div>
      </footer>
    </div>
  );
}
