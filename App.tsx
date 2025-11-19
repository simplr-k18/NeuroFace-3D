
import React, { useState, useRef } from 'react';
import { Upload, Scan, RefreshCw, Rotate3D, ChevronRight, Layers, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { AppState, FaceAnalysisData } from './types';
import { detectFaceLandmarks } from './services/face-mesh';
import ThreeScene from './components/ThreeScene';

export default function App() {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FaceAnalysisData | null>(null);
  const [statsOpen, setStatsOpen] = useState(true); // For mobile collapse
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setState(AppState.ANALYZING);
        processImage(reader.result as string);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    try {
      const data = await detectFaceLandmarks(base64);
      setAnalysis(data);
      setState(AppState.GENERATING);
      // On mobile, auto-collapse stats after a moment to show face
      if (window.innerWidth < 768) {
          setTimeout(() => setStatsOpen(false), 2500);
      }
    } catch (error) {
      console.error(error);
      setState(AppState.IDLE);
      alert("Scan failed. Try a well-lit frontal photo.");
    }
  };

  const handleReset = () => {
    setImage(null);
    setAnalysis(null);
    setState(AppState.IDLE);
    setStatsOpen(true);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-white text-slate-900 font-sans overflow-hidden">
      
      {/* 3D SCENE */}
      <ThreeScene 
        analysisData={analysis}
        appState={state}
        onGenerationComplete={() => setState(AppState.COMPLETE)}
      />

      {/* LANDING SCREEN */}
      <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-700 ${state === AppState.LANDING ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="text-center px-6 animate-fade-in">
             <ShieldCheck className="w-10 h-10 text-slate-900 mx-auto mb-6" />
             <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-slate-900 mb-4">
                NEURO<span className="text-[#0ea5e9]">FACE</span>
             </h1>
             <p className="text-slate-500 text-base md:text-lg mb-8 leading-relaxed max-w-md mx-auto">
                Clinical biometric reconstruction. Generates high-fidelity 3D topology from 2D facial data.
             </p>
             <button 
                onClick={() => setState(AppState.IDLE)}
                className="px-8 py-3 bg-slate-900 text-white font-bold tracking-widest hover:bg-[#0ea5e9] transition-colors flex items-center gap-3 mx-auto"
             >
                INITIALIZE SYSTEM <ChevronRight className="w-4 h-4" />
             </button>
          </div>
      </div>

      {/* MAIN INTERFACE */}
      <div className={`absolute inset-0 z-40 pointer-events-none flex flex-col justify-between transition-opacity duration-500 ${state === AppState.LANDING ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Header */}
        <header className="w-full p-4 flex justify-between items-start">
             <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 border border-slate-200 shadow-sm pointer-events-auto rounded-sm">
                <Layers className="w-4 h-4 text-[#0ea5e9]" />
                <span className="font-bold font-mono text-xs tracking-tight">GRID: {state === AppState.COMPLETE ? 'LOCKED' : 'STANDBY'}</span>
             </div>

             {/* Thumbnail */}
             <div className={`transition-all duration-500 origin-top-right ${state !== AppState.IDLE ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                 <div className="bg-white p-1 shadow-lg pointer-events-auto w-20 border border-slate-100">
                    {image && <img src={image} className="w-full aspect-square object-cover grayscale" alt="Scan" />}
                 </div>
             </div>
        </header>

        {/* Controls Container (Bottom) */}
        <div className="w-full p-4 flex flex-col gap-3 items-center md:flex-row md:items-end md:justify-between">
            
            {/* Upload Button */}
            <div className={`pointer-events-auto transition-all duration-500 w-full md:w-auto ${state === AppState.IDLE ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 absolute'}`}>
                 <div className="bg-white/90 backdrop-blur p-6 border border-slate-200 shadow-xl max-w-sm mx-auto text-center">
                    <Scan className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <h3 className="font-bold text-slate-900 mb-1">INPUT SOURCE</h3>
                    <p className="text-xs text-slate-500 mb-4">Upload a clear frontal face image</p>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 bg-slate-900 text-white font-mono text-sm font-bold hover:bg-slate-800 flex items-center justify-center gap-2"
                    >
                        <Upload className="w-4 h-4" /> SELECT FILE
                    </button>
                 </div>
                 <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Results Panel */}
            {analysis && (
                 <div className={`w-full md:w-72 bg-white/95 backdrop-blur border-t md:border border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pointer-events-auto transition-all duration-500 ${state === AppState.COMPLETE ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                     
                     {/* Mobile Collapse Toggle */}
                     <button 
                        onClick={() => setStatsOpen(!statsOpen)}
                        className="w-full flex items-center justify-center p-2 md:hidden text-slate-400 hover:text-slate-600"
                     >
                        {statsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                     </button>

                     <div className={`p-4 space-y-4 ${statsOpen ? 'block' : 'hidden md:block'}`}>
                         <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                             <span className="text-xs font-mono text-slate-500">STATUS</span>
                             <span className="text-xs font-bold text-[#0ea5e9] font-mono">COMPLETED</span>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] text-slate-400 font-mono mb-1">VERTICES</div>
                                <div className="text-sm font-bold text-slate-900">{analysis.landmarks.length}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 font-mono mb-1">TOPOLOGY</div>
                                <div className="text-sm font-bold text-slate-900">HYBRID</div>
                            </div>
                         </div>

                         <div className="text-xs text-slate-500 leading-relaxed border-l-2 border-slate-200 pl-3 italic">
                            {analysis.description || "Biometric topology mapped successfully."}
                         </div>

                         <button onClick={handleReset} className="w-full py-3 border border-slate-200 text-slate-700 font-mono text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">
                             <RefreshCw className="w-3 h-3" /> NEW SCAN
                         </button>
                     </div>
                 </div>
            )}
        </div>

        {/* Rotation Hint */}
        {state === AppState.COMPLETE && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 animate-[fadeIn_1s_2s_forwards]">
                  {/* Only visible briefly or subtly if needed, kept minimal */}
             </div>
        )}

      </div>
    </div>
  );
}
