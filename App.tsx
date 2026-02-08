
import React, { useState, useCallback, useRef } from 'react';
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
  happy: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=800',
  ribbed: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&q=80&w=800',
  puffer: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=800'
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
    url: p.id === 'v3_puffer' ? '#' : `https://www.coupang.com/vp/products/${p.id === 'happy_series_vton' ? '9312183755' : p.id}`,
    imageUrl: p.id === 'happy_series_vton' ? STATIC_IMAGES.happy : (p.id === 'v3_puffer' ? STATIC_IMAGES.puffer : STATIC_IMAGES.ribbed)
  }));

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];
  const [description, setDescription] = useState(activeProduct.description);

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
    { id: 'gemini', name: 'Gemini 2.5', desc: 'Google Smart AI', icon: 'fa-wand-magic-sparkles' },
    { id: 'fal', name: 'Flux Pro', desc: 'Fal.ai High-Def', icon: 'fa-bolt-lightning' }
  ];

  return (
    <div className="min-h-screen p-4 md:p-10 max-w-7xl mx-auto flex flex-col gap-8 text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800/50 pb-8">
        <div className="flex items-center gap-4">
          <div className="bg-[#FF6B00] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center rotate-3">
            <i className="fa-solid fa-wand-magic-sparkles text-3xl"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-black tracking-tighter">
              <span style={{ color: DIQPET_ORANGE }}>DIQPET</span> AI
            </h1>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{t.subtitle}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <button className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-xl hover:bg-zinc-800 transition-all">
              {currentLangData && <FlagIcon code={currentLangData.flag} />}
              <span className="text-xs font-bold">{currentLangData?.name}</span>
              <i className="fa-solid fa-chevron-down text-[10px] opacity-50"></i>
            </button>
            <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden`}>
              <div className="grid grid-cols-1 max-h-[400px] overflow-y-auto py-2">
                {LANGUAGES.map((l) => (
                  <button 
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800 text-left text-xs font-bold transition-all ${lang === l.code ? 'text-orange-500 bg-orange-500/5' : ''}`}
                  >
                    <FlagIcon code={l.flag} />
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900/50 backdrop-blur-xl px-5 py-3 rounded-2xl border border-zinc-800">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">{engine === 'gemini' ? 'Gemini 2.5' : 'Flux Pro'} {t.engineReady}</span>
                <span className="text-[9px] text-zinc-500 font-mono">Verified API Key</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
               <i className={`fa-solid ${engine === 'gemini' ? 'fa-wand-sparkles' : 'fa-bolt-lightning'} text-xs text-orange-500`}></i>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="flex flex-col gap-8">
          <section className="bg-zinc-900/80 border border-zinc-800/50 p-8 rounded-[2.5rem] flex flex-col gap-8 shadow-2xl backdrop-blur-md">
            
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black flex items-center gap-3">
                <i className="fa-solid fa-camera-retro text-orange-500"></i>
                {t.step1}
              </h2>
              <button onClick={() => fileInputPet.current?.click()} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                {t.upload}
              </button>
              <input type="file" ref={fileInputPet} onChange={handleFileChange} hidden accept="image/*" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'bichon', url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=600' },
                { id: 'poodle', url: 'https://images.unsplash.com/photo-1516222338250-863216ce01ea?auto=format&fit=crop&q=80&w=600' },
                { id: 'golden', url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=600' },
              ].map((breed) => (
                <button
                  key={breed.id}
                  onClick={() => { setAssets(prev => ({ ...prev, pet: breed.url, result: null })); setSelectedBreedId(breed.id); }}
                  className={`relative aspect-square rounded-3xl overflow-hidden border-2 transition-all ${selectedBreedId === breed.id ? 'border-orange-500 scale-105 shadow-2xl' : 'border-zinc-800 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                >
                  <img src={breed.url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <div className="border-t border-zinc-800 pt-8 flex flex-col gap-6">
              <h2 className="text-xl font-black flex items-center gap-3">
                <i className="fa-solid fa-layer-group text-orange-500"></i>
                {t.step2}
              </h2>
              <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductSwitch(product.id)}
                    className={`relative shrink-0 w-48 aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all ${selectedProductId === product.id ? 'border-orange-500 shadow-lg' : 'border-zinc-800 opacity-70 hover:opacity-100'}`}
                  >
                    <img src={product.imageUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[10px] font-bold text-center">{product.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-8 flex flex-col gap-6">
              <h2 className="text-xl font-black flex items-center gap-3">
                <i className="fa-solid fa-sliders text-orange-500"></i>
                {t.step3}
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                {engineConfigs.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setEngine(e.id as any)}
                    className={`p-4 rounded-3xl border-2 transition-all flex items-center gap-4 ${engine === e.id ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-800 hover:border-zinc-700'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${engine === e.id ? 'bg-orange-500' : 'bg-zinc-800'}`}>
                      <i className={`fa-solid ${e.icon}`}></i>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black uppercase tracking-widest">{e.name}</p>
                      <p className="text-[9px] text-zinc-500 font-bold">{e.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {AI_STYLES.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedStyle(s)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${selectedStyle === s ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {t[s.toLowerCase()]}
                  </button>
                ))}
              </div>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-5 text-sm text-zinc-300 focus:outline-none focus:border-orange-500/50 min-h-[80px]"
                placeholder={t.placeholder}
              />
            </div>

            <button 
              disabled={loading || !assets.pet}
              onClick={handleAIGenerate}
              className="w-full py-6 rounded-[2rem] font-black transition-all bg-[#FF6B00] hover:scale-[1.02] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-4 text-xl shadow-2xl"
            >
              {loading ? <><i className="fa-solid fa-spinner animate-spin"></i> {t.generating}</> : <><i className="fa-solid fa-wand-sparkles"></i> {t.generate}</>}
            </button>

            {status && (
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 text-[10px] font-bold tracking-widest text-center uppercase text-zinc-400">
                {status}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section className="bg-zinc-900 border border-zinc-800 p-2 rounded-[3rem] flex flex-col h-full shadow-2xl relative overflow-hidden">
            <div className="flex-grow relative rounded-[2.5rem] overflow-hidden bg-black flex items-center justify-center">
              {assets.result ? (
                <img src={assets.result} className="w-full h-full object-contain animate-in fade-in zoom-in duration-1000" />
              ) : assets.pet ? (
                <div className="relative w-full h-full flex items-center justify-center">
                   <img src={assets.pet} className={`w-full h-full object-contain transition-all duration-1000 ${loading ? 'blur-3xl opacity-30 scale-125' : 'opacity-40 grayscale blur-sm'}`} />
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                     {loading && (
                       <div className="flex flex-col items-center gap-6">
                         <div className="w-24 h-24 border-b-4 border-orange-500 rounded-full animate-spin"></div>
                         <div className="text-center">
                           <p className="text-orange-500 font-black text-lg tracking-widest uppercase animate-pulse">{engine === 'fal' ? 'Flux Pro' : 'Gemini'} {t.rendering}</p>
                           <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Multi-Engine Cloud Studio</p>
                         </div>
                       </div>
                     )}
                   </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 opacity-10">
                  <i className="fa-solid fa-dog text-[120px]"></i>
                  <p className="text-sm font-black uppercase tracking-[0.4em]">{t.waiting}</p>
                </div>
              )}
            </div>

            <div className="p-8 flex flex-col gap-6 mt-auto">
              <button 
                onClick={() => activeProduct.url !== '#' && window.open(activeProduct.url, "_blank")}
                className="w-full py-7 bg-[#0074E9] hover:bg-[#0062c4] rounded-[2rem] font-black flex flex-col items-center justify-center transition-all shadow-2xl border-b-8 border-blue-900 active:border-b-0 active:translate-y-2"
              >
                <div className="flex items-center gap-4">
                  <i className="fa-solid fa-cart-arrow-down text-3xl"></i>
                  <span className="text-2xl tracking-tighter">{t.buyNow}</span>
                </div>
                <span className="text-[10px] opacity-60 font-black uppercase mt-1 tracking-widest">{activeProduct.name} - {t.official}</span>
              </button>

              <div className="grid grid-cols-2 gap-4">
                <button className="py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                  <i className="fa-solid fa-share-nodes text-orange-500"></i> {t.share}
                </button>
                <button className="py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                  <i className="fa-solid fa-cloud-arrow-down text-orange-500"></i> {t.save}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="mt-12 pt-10 border-t border-zinc-800 flex flex-col items-center gap-4 text-center">
        <div className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">DIQPET AI &bull; HYBRID RENDERING LAB &bull; VER 2.3</div>
        <p className="text-[9px] text-zinc-800 font-medium">© 2025 DIQPET Labs. Powered by Google Gemini & Fal.ai Flux.</p>
      </footer>
    </div>
  );
}
