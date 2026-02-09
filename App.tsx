
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageAssets } from './types';
import { generateFitting } from './services/gemini';
import { Language, LANGUAGES, UI_STRINGS, PRODUCT_DATA } from './translations';

const DIQPET_ORANGE = '#FF6B00';
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
  happy: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=1200',
  ribbed: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&q=80&w=1200',
  puffer: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=1200'
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
  const isRTL = LANGUAGES.find(l => l.code === lang)?.isRTL;
  const currentLangData = LANGUAGES.find(l => l.code === lang);

  const products: Product[] = PRODUCT_DATA[lang].map((p, idx) => ({
    ...p,
    category: t[`category${idx+1}`],
    url: p.id === 'v3_puffer' ? 'https://www.diqpet.com/' : `https://www.coupang.com/vp/products/${p.id === 'happy_series_vton' ? '9312183755' : p.id}`,
    imageUrl: p.id === 'happy_series_vton' ? STATIC_IMAGES.happy : (p.id === 'v3_puffer' ? STATIC_IMAGES.puffer : STATIC_IMAGES.ribbed)
  }));

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];
  const [description, setDescription] = useState(activeProduct.description);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemParam = params.get('item');
    if (itemParam && PRODUCT_DATA.en.some(p => p.id === itemParam)) {
      handleProductSwitch(itemParam);
    }
    const langParam = params.get('lang') as Language;
    if (langParam && LANGUAGES.some(l => l.code === langParam)) {
      setLang(langParam);
    }
  }, []);

  const fileInputPet = useRef<HTMLInputElement>(null);

  const handleProductSwitch = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      setAssets(prev => ({ ...prev, clothing: product.imageUrl, result: null }));
      setDescription(product.description);
      setStatus(`${t.official}: ${product.name}`);
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAssets(prev => ({ ...prev, pet: reader.result as string, result: null }));
        setSelectedBreedId(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleAIGenerate = async () => {
    if (!assets.pet) {
      setStatus(t.petNotSelected);
      return;
    }
    setLoading(true);
    setStatus(`🚀 ${t.engineStarted}`);
    setAssets(prev => ({ ...prev, result: null }));
    try {
      const result = await generateFitting(engine, assets.pet as string, description, selectedStyle);
      setAssets(prev => ({ ...prev, result }));
      setStatus(`✨ ${t.success}`);
    } catch (error: any) {
      console.error(error);
      setStatus(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const engineConfigs = [
    { id: 'gemini', name: t.engine1, desc: 'ByteDance Model' },
    { id: 'fal', name: t.engine2, desc: 'Ultra-HD Flux' }
  ];

  return (
    <div className="h-screen w-full flex flex-col bg-[#050505] text-white selection:bg-orange-500 selection:text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Studio Navigation Bar */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-8">
           <h1 className="text-2xl font-black italic tracking-tighter">DIQPET<span className="text-orange-500">.</span></h1>
           <div className="h-4 w-[1px] bg-white/10 hidden md:block"></div>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 hidden md:block">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-6">
           <div className="relative group">
            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
              {currentLangData && <FlagIcon code={currentLangData.flag} />}
              <span className="hidden sm:inline">{currentLangData?.name}</span>
            </button>
            <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] overflow-hidden`}>
              <div className="grid grid-cols-1 py-2">
                {LANGUAGES.map((l) => (
                  <button 
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`flex items-center gap-4 px-5 py-3 hover:bg-zinc-800 text-left text-[10px] font-black uppercase tracking-widest transition-all ${lang === l.code ? 'text-orange-500 bg-orange-500/5' : ''}`}
                  >
                    <FlagIcon code={l.flag} />
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-[420px] shrink-0 border-r border-white/5 p-6 md:p-10 flex flex-col gap-8 overflow-y-auto scrollbar-hide bg-[#070707]">
          
          {/* Step 1: Model */}
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">{t.step1}</h3>
              <button onClick={() => fileInputPet.current?.click()} className="text-[8px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 hover:border-white px-3 py-1.5 transition-all">
                {t.upload}
              </button>
              <input type="file" ref={fileInputPet} onChange={handleFileChange} hidden accept="image/*" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bichon', url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=600' },
                { id: 'poodle', url: 'https://images.unsplash.com/photo-1516222338250-863216ce01ea?auto=format&fit=crop&q=80&w=600' },
                { id: 'golden', url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=600' },
              ].map((breed) => (
                <button
                  key={breed.id}
                  onClick={() => { setAssets(prev => ({ ...prev, pet: breed.url, result: null })); setSelectedBreedId(breed.id); }}
                  className={`relative aspect-square border transition-all overflow-hidden ${selectedBreedId === breed.id ? 'border-orange-500 shadow-[0_0_15px_rgba(255,107,0,0.2)] scale-95' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                >
                  <img src={breed.url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Item Selection */}
          <section className="flex flex-col gap-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b border-white/5 pb-2">{t.step2}</h3>
            <div className="flex flex-col gap-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductSwitch(product.id)}
                  className={`flex items-center gap-4 p-2 border transition-all ${selectedProductId === product.id ? 'border-white bg-white/5' : 'border-white/5 opacity-50 hover:opacity-100'}`}
                >
                  <div className="w-14 h-14 shrink-0 bg-zinc-900 overflow-hidden">
                    <img src={product.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black uppercase tracking-widest text-orange-500">{product.category}</p>
                    <p className="text-[11px] font-black uppercase mt-0.5 leading-tight">{product.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 3: Scene & Engine */}
          <section className="flex flex-col gap-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b border-white/5 pb-2">{t.step3}</h3>
            
            <div className="grid grid-cols-2 gap-2">
              {engineConfigs.map(e => (
                <button
                  key={e.id}
                  onClick={() => setEngine(e.id as any)}
                  className={`p-3 border text-left transition-all ${engine === e.id ? 'border-orange-500 bg-orange-500/5' : 'border-white/5'}`}
                >
                   <p className="text-[8px] font-black uppercase tracking-widest">{e.name}</p>
                   <p className="text-[7px] text-zinc-600 font-bold uppercase mt-1 leading-none">{e.desc}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {AI_STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedStyle(s)}
                  className={`flex-1 py-1.5 border text-[8px] font-black uppercase tracking-widest transition-all ${selectedStyle === s ? 'border-white bg-white text-black' : 'border-white/10 text-zinc-500 hover:text-white'}`}
                >
                  {t[s.toLowerCase()]}
                </button>
              ))}
            </div>

            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-transparent border border-white/5 p-4 text-[11px] text-zinc-400 focus:outline-none focus:border-white transition-all min-h-[100px] resize-none leading-relaxed"
              placeholder={t.placeholder}
            />
          </section>

          {/* Footer Action */}
          <div className="mt-auto pt-6">
            <button 
              disabled={loading || !assets.pet}
              onClick={handleAIGenerate}
              className="w-full py-6 font-black transition-all bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-20 flex flex-col items-center justify-center gap-1 uppercase tracking-[0.4em] text-sm shadow-[0_10px_30px_rgba(255,107,0,0.15)]"
            >
              {loading ? t.generating : t.generate}
            </button>
            {status && (
              <p className="text-[8px] text-center font-black uppercase tracking-widest text-zinc-600 mt-4 animate-pulse">{status}</p>
            )}
          </div>
        </aside>

        {/* Studio Viewport */}
        <main className="flex-grow bg-black flex flex-col relative overflow-hidden">
          <div className="flex-grow relative flex items-center justify-center">
            {assets.result ? (
              <img 
                src={assets.result} 
                className="w-full h-full object-contain animate-in fade-in zoom-in duration-1000 p-4 md:p-12" 
                alt="AI Result"
              />
            ) : assets.pet ? (
              <div className="relative w-full h-full flex items-center justify-center p-12">
                 <img 
                    src={assets.pet} 
                    className={`max-w-[70%] max-h-[70%] object-contain transition-all duration-1000 ${loading ? 'blur-3xl opacity-20 scale-110' : 'opacity-15 grayscale scale-100'}`} 
                    alt="Source Pet"
                 />
                 {loading && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                     <div className="w-12 h-12 border-t-2 border-orange-500 rounded-full animate-spin"></div>
                     <p className="text-white font-black text-[10px] tracking-[0.6em] uppercase animate-pulse">{t.rendering}</p>
                   </div>
                 )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8 opacity-5">
                <i className="fa-solid fa-camera-retro text-[120px]"></i>
                <p className="text-[12px] font-black uppercase tracking-[1em]">{t.waiting}</p>
              </div>
            )}
            
            {/* Viewport Status Indicator */}
            <div className="absolute top-8 left-8 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 italic">STUDIO FEED // LIVE</span>
            </div>
          </div>

          {/* Result Action Bar */}
          <footer className="h-28 border-t border-white/5 bg-[#050505]/80 backdrop-blur-xl px-10 flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">{t.official}</span>
                <h3 className="text-xl font-black uppercase tracking-tight italic leading-none">{activeProduct.name}</h3>
             </div>
             
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => window.open(activeProduct.url, "_blank")}
                  className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-xl"
                >
                  {t.buyNow}
                </button>
                <div className="flex gap-2">
                   <button className="w-12 h-12 border border-white/5 flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all">
                     <i className="fa-solid fa-share-nodes"></i>
                   </button>
                   <button className="w-12 h-12 border border-white/5 flex items-center justify-center text-zinc-600 hover:text-white hover:border-white transition-all">
                     <i className="fa-solid fa-download"></i>
                   </button>
                </div>
             </div>
          </footer>
        </main>
      </div>
      
      {/* Mini Legal Footer */}
      <footer className="h-10 shrink-0 border-t border-white/5 flex items-center justify-between px-10 bg-black">
        <div className="text-[7px] font-black text-zinc-700 uppercase tracking-[0.5em]">DIQPET DIGITAL STUDIO &bull; HYBRID RENDERING ENGINE V2.5</div>
        <div className="text-[7px] text-zinc-800 font-medium">© 2025 DIQPET LABS. AUTHENTIC PET FASHION.</div>
      </footer>
    </div>
  );
}
