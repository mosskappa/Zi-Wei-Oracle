import React, { useState, useEffect, useRef, useCallback } from 'react';
import StarryBackground from './components/StarryBackground';
import InputArea from './components/InputArea';
import AnalysisResult from './components/AnalysisResult';
import { AnalysisType, AppState, ChatMessage, ModelTier } from './types';
import { streamAnalysis, sendMessageToChat } from './services/geminiService';
import { 
  PaperAirplaneIcon, ArrowPathIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, 
  XMarkIcon, SparklesIcon, ChevronRightIcon, CameraIcon, ArchiveBoxArrowDownIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const STORAGE_KEY = 'ziwei_oracle_zen_v1';

const INITIAL_STATE: AppState = {
  mode: 'input',
  isCoupleMode: false,
  primaryChart: { rawText: '', isValid: false },
  secondaryChart: { rawText: '', isValid: false },
  chatHistory: [],
  isLoading: false,
  modelTier: 'pro',
};

const DEFAULT_QUESTIONS = [
  "🔮 十年大運詳解",
  "💰 這個命盤適合創業嗎",
  "💘 分析這十年的桃花運",
  "🚑 身體有哪些隱疾要注意",
  "🏠 適合買房置產的時機"
];

type LastAction = 
  | { type: 'analysis'; payload: AnalysisType }
  | { type: 'chat'; payload: string; image?: { mimeType: string, data: string } | null };

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { 
          ...INITIAL_STATE, 
          ...parsed,
          mode: parsed.mode || 'input',
          isLoading: false,
          chatHistory: Array.isArray(parsed.chatHistory) ? parsed.chatHistory.map((msg: ChatMessage) => ({ ...msg, isStreaming: false })) : []
        };
      }
    } catch (e) { console.error(e); }
    return INITIAL_STATE;
  });

  const [inputMessage, setInputMessage] = useState('');
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(DEFAULT_QUESTIONS);
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ mimeType: string, data: string, previewUrl: string } | null>(null);
  
  // 新增：控制輸入 Modal 的顯示狀態
  const [showInputModal, setShowInputModal] = useState(false);

  const isResettingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const memoryImportInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage]);

  useEffect(() => {
    if (isResettingRef.current) return;
    const stateToSave = { ...state, isLoading: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state]);

  const scrollToBottom = (instant = false) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    if (instant) { container.scrollTop = container.scrollHeight; } 
    else { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }
  };
  
  // Effect: Instant Scroll during streaming
  useEffect(() => {
    if (state.isLoading) {
        const container = scrollContainerRef.current;
        if (container) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            if (isNearBottom) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }
  }, [state.chatHistory]); 

  // Effect: Smooth scroll on new messages
  useEffect(() => {
    if (state.mode === 'analysis') {
        const lastMsg = state.chatHistory[state.chatHistory.length - 1];
        const timer = setTimeout(() => {
            if (lastMsg?.role === 'user' || state.chatHistory.length <= 2) {
                scrollToBottom(false);
            }
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [state.chatHistory.length, state.mode]);
  
  const handleChartChange = (text: string, isPrimary: boolean) => {
    const isValid = text.includes('命盤') || text.includes('紫微') || text.length > 50;
    setState(prev => ({
      ...prev,
      [isPrimary ? 'primaryChart' : 'secondaryChart']: { rawText: text, isValid }
    }));
  };

  const exportMemory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `ziwei_oracle_memory_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importMemory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsedState = JSON.parse(text);
        if (parsedState && typeof parsedState === 'object' && 'chatHistory' in parsedState) {
           setState({ ...INITIAL_STATE, ...parsedState, isLoading: false, chatHistory: parsedState.chatHistory.map((m: any) => ({...m, isStreaming: false})) });
           alert('✅ 記憶包已成功載入！');
        }
      } catch (err) { alert('❌ 記憶包格式錯誤'); }
    };
    reader.readAsText(file);
  };

  const handleResetClick = () => setShowResetConfirm(true);
  const confirmReset = () => { localStorage.removeItem(STORAGE_KEY); setState(INITIAL_STATE); setInputMessage(''); setSuggestedQuestions(DEFAULT_QUESTIONS); setLastAction(null); setPendingImage(null); setShowResetConfirm(false); };
  const cancelReset = () => setShowResetConfirm(false);
  
  const handleChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) setInputMessage(prev => prev + (prev ? '\n\n' : '') + `[引用檔案內容]:\n${text}\n`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  const handleChatImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
              const base64Data = result.split(',')[1];
              const mimeType = result.substring(result.indexOf(':') + 1, result.indexOf(';'));
              setPendingImage({ mimeType, data: base64Data, previewUrl: result });
          }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };
  
  const removePendingImage = () => setPendingImage(null);
  const handleQuotaError = () => { setShowQuotaWarning(true); setState(prev => ({ ...prev, modelTier: 'flash', isLoading: false })); };

  const startAnalysis = async (type: AnalysisType) => {
      if (!state.primaryChart.rawText) return;
      setShowInputModal(false); // Close modal when starting
      setSuggestedQuestions([]);
      setLastAction({ type: 'analysis', payload: type });
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      
      setState(prev => ({ ...prev, mode: 'analysis', isLoading: true }));
      
      const userMsg: ChatMessage = { id: 'init-user-' + Date.now(), role: 'user', content: `Analyzing ${type}`, timestamp: Date.now() };
      const botMsg: ChatMessage = { id: 'init-bot-' + Date.now(), role: 'model', content: '', timestamp: Date.now(), isStreaming: true };
      
      setState(prev => ({ ...prev, chatHistory: prev.mode === 'input' ? [userMsg, botMsg] : [...prev.chatHistory, userMsg, botMsg] }));

      await streamAnalysis(
        type, state.primaryChart.rawText, state.isCoupleMode ? state.secondaryChart.rawText : null,
        (chunk) => { setState(prev => { const h = [...prev.chatHistory]; h[h.length-1].content += chunk; return {...prev, chatHistory: h}; }); },
        () => { setState(prev => ({ ...prev, isLoading: false, chatHistory: prev.chatHistory.map(msg => msg.isStreaming ? { ...msg, isStreaming: false } : msg) })); abortControllerRef.current = null; },
        (error) => { 
            if (abortControllerRef.current) abortControllerRef.current = null;
            if (error === "QUOTA_EXCEEDED") handleQuotaError();
            else setState(prev => ({ ...prev, isLoading: false }));
        },
        abortControllerRef.current.signal, state.modelTier
      );
  };
  
  const handleSendMessage = async (textOverride?: string) => {
    const msgText = textOverride || inputMessage;
    if((!msgText.trim() && !pendingImage) || state.isLoading) return;

    const currentImage = pendingImage ? { mimeType: pendingImage.mimeType, data: pendingImage.data } : null;
    const currentPreviewUrl = pendingImage ? pendingImage.previewUrl : undefined;

    setSuggestedQuestions([]); 
    setLastAction({ type: 'chat', payload: msgText, image: currentImage });

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setInputMessage('');
    setPendingImage(null);
    setState(prev => ({ ...prev, isLoading: true }));

    const botMsgId = Date.now().toString();
    const newBotMsg: ChatMessage = { id: botMsgId, role: 'model', content: '', timestamp: Date.now(), isStreaming: true };
    const newUserMsg: ChatMessage = { id: 'user-' + botMsgId, role: 'user', content: msgText, image: currentPreviewUrl, timestamp: Date.now() };

    setState(prev => ({ ...prev, chatHistory: [...prev.chatHistory, newUserMsg, newBotMsg] }));

    const apiHistory = state.chatHistory.filter(m => (m.content.length > 0 || m.image) && !m.content.startsWith('Analyzing')).map(msg => {
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.image) {
            const mime = msg.image.substring(msg.image.indexOf(':') + 1, msg.image.indexOf(';'));
            const data = msg.image.split(',')[1];
            parts.push({ inlineData: { mimeType: mime, data: data } });
        }
        return { role: msg.role, parts };
    });

    const context = `[System Context] Chart 1: ${state.primaryChart.rawText} ${state.isCoupleMode ? `Chart 2: ${state.secondaryChart.rawText}` : ''}`;
    const effectiveHistory = [{ role: 'user', parts: [{ text: context }] }, ...apiHistory];

    await sendMessageToChat(
        effectiveHistory as any, msgText, currentImage,
        (chunk) => { setState(prev => ({ ...prev, chatHistory: prev.chatHistory.map(msg => msg.id === botMsgId ? { ...msg, content: msg.content + chunk } : msg) })); },
        () => { setState(prev => ({ ...prev, isLoading: false, chatHistory: prev.chatHistory.map(msg => msg.id === botMsgId ? { ...msg, isStreaming: false } : msg) })); abortControllerRef.current = null; },
        (error) => { 
            if (abortControllerRef.current) abortControllerRef.current = null;
            if (error === "QUOTA_EXCEEDED") handleQuotaError();
            else setState(prev => ({ ...prev, isLoading: false }));
        },
        abortControllerRef.current.signal, state.modelTier
    );
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setState(prev => {
        const history = [...prev.chatHistory];
        const lastMsg = history[history.length - 1];
        if (lastMsg && lastMsg.role === 'model' && lastMsg.isStreaming) {
            history.pop();
            const prevMsg = history[history.length - 1];
            if (prevMsg && prevMsg.role === 'user') {
                history.pop();
                setInputMessage(prevMsg.content);
                if (prevMsg.image) {
                     const mime = prevMsg.image.substring(prevMsg.image.indexOf(':') + 1, prevMsg.image.indexOf(';'));
                     const data = prevMsg.image.split(',')[1];
                     setPendingImage({ mimeType: mime, data, previewUrl: prevMsg.image });
                }
            }
        }
        return { ...prev, isLoading: false, chatHistory: history };
    });
  };

  const retryLastAction = () => {
    if (!lastAction) return;
    if (lastAction.type === 'analysis') startAnalysis(lastAction.payload);
    else {
      if (lastAction.image) setPendingImage({ ...lastAction.image, previewUrl: `data:${lastAction.image.mimeType};base64,${lastAction.image.data}` });
      handleSendMessage(lastAction.payload);
    }
  };

  const onRetryStable = useCallback(() => { retryLastAction(); }, [lastAction]);
  const onStopStable = useCallback(() => { handleStopGeneration(); }, []);
  const handleQuestionsUpdateStable = useCallback((questions: string[]) => { setSuggestedQuestions(questions); }, []);


  // --- UI RENDER START ---

  return (
    <div className="fixed inset-0 text-gray-200 font-serif flex flex-col selection:bg-rose-900/30 selection:text-rose-100 bg-[#0a0a0c]">
      <StarryBackground />

      {/* HEADER: Minimalist Zen Header */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-40 pointer-events-none">
        {/* Logo Area */}
        <div className="pointer-events-auto flex flex-col gap-1 cursor-pointer group" onClick={() => setState(prev => ({ ...prev, mode: 'input' }))}>
          <div className="w-8 h-8 border border-white/20 rounded-full flex items-center justify-center group-hover:border-white/40 transition-colors">
             <div className="w-1.5 h-1.5 bg-white/20 rounded-full group-hover:bg-white/60 transition-colors" />
          </div>
        </div>

        {/* Tools Area */}
        <div className="pointer-events-auto flex flex-col items-end gap-3">
             <div className="flex items-center gap-2">
                 <button 
                    onClick={() => setState(prev => ({...prev, modelTier: state.modelTier === 'pro' ? 'flash' : 'Flash 2.5'}))}
                    className={`text-[9px] uppercase tracking-[0.2em] px-3 py-1 rounded-full border transition-all ${state.modelTier === 'pro' ? 'border-indigo-500/30 text-indigo-300 bg-indigo-500/5' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'}`}
                 >
                    {state.modelTier === 'pro' ? 'Flash 2.5' : 'Flash 2.5'}
                 </button>
             </div>
             
             <div className="flex gap-4 text-white/30">
                <button onClick={handleResetClick} className="hover:text-rose-400 transition-colors" title="重置">
                    <ArrowPathIcon className="w-5 h-5" />
                </button>
                <button onClick={exportMemory} className="hover:text-white transition-colors" title="存檔">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                </button>
                <div className="relative">
                    <input type="file" ref={memoryImportInputRef} onChange={importMemory} className="hidden" accept=".json" />
                    <button onClick={() => memoryImportInputRef.current?.click()} className="hover:text-white transition-colors" title="讀取">
                        <ArrowUpTrayIcon className="w-5 h-5" />
                    </button>
                </div>
             </div>
        </div>
      </header>

      {/* MODAL: Input Chart (The "Hidden" Area) */}
      {showInputModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#121214] border border-white/10 w-full max-w-2xl rounded-sm shadow-2xl relative flex flex-col max-h-[90vh]">
             {/* Close Button */}
             <button 
                onClick={() => setShowInputModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors z-10"
             >
                <XMarkIcon className="w-6 h-6" />
             </button>

             <div className="overflow-y-auto custom-scrollbar p-8 md:p-12">
                <h3 className="text-2xl font-serif text-white/90 mb-2 tracking-widest text-center">命盤輸入</h3>
                <div className="w-12 h-px bg-white/20 mx-auto mb-10"></div>

                {/* Couple Toggle */}
                <div className="flex justify-center mb-8">
                     <div className="inline-flex border border-white/10 rounded-full p-1 bg-white/5">
                        <button 
                            onClick={() => setState(prev => ({...prev, isCoupleMode: false}))}
                            className={`px-6 py-2 rounded-full text-xs tracking-widest transition-all ${!state.isCoupleMode ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            單人詳批
                        </button>
                        <button 
                            onClick={() => setState(prev => ({...prev, isCoupleMode: true}))}
                            className={`px-6 py-2 rounded-full text-xs tracking-widest transition-all ${state.isCoupleMode ? 'bg-rose-500/20 text-rose-200 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            雙人合盤
                        </button>
                     </div>
                </div>

                <div className="space-y-8">
                    <InputArea 
                        label={state.isCoupleMode ? "乾造 (男/甲方)" : "命盤資料"} 
                        value={state.primaryChart.rawText} 
                        onChange={(val) => handleChartChange(val, true)} 
                        placeholder="請貼上紫微斗數命盤文字..." 
                    />
                    
                    {state.isCoupleMode && (
                        <div className="animate-fade-in pt-4 border-t border-white/5">
                            <InputArea 
                                label="坤造 (女/乙方)"
                                value={state.secondaryChart.rawText} 
                                onChange={(val) => handleChartChange(val, false)} 
                                placeholder="請貼上對方命盤文字..." 
                            />
                        </div>
                    )}
                </div>

                {/* Analysis Actions */}
                <div className="mt-12">
                    <p className="text-center text-xs text-gray-600 mb-6 tracking-widest">選擇分析項目</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                         {state.isCoupleMode ? (
                            <button 
                                onClick={() => startAnalysis(AnalysisType.COMPATIBILITY)}
                                disabled={!state.primaryChart.rawText || !state.secondaryChart.rawText}
                                className="col-span-2 md:col-start-2 py-4 border border-rose-900/50 bg-rose-900/10 hover:bg-rose-900/30 text-rose-200 text-sm tracking-widest transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                            >
                                <SparklesIcon className="w-4 h-4" /> 緣分合盤
                            </button>
                         ) : (
                             Object.values(AnalysisType).filter(t => t !== AnalysisType.COMPATIBILITY).map((type) => (
                                <button 
                                    key={type}
                                    onClick={() => startAnalysis(type as AnalysisType)}
                                    disabled={!state.primaryChart.rawText}
                                    className="py-3 px-2 border border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] text-gray-400 hover:text-white text-xs tracking-widest transition-all disabled:opacity-20"
                                >
                                    {type}
                                </button>
                             ))
                         )}
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative w-full h-full flex flex-col">
        
        {/* VIEW 1: LANDING (ZEN MODE) */}
        {state.mode === 'input' && (
           <div className="flex-1 flex flex-col items-center justify-center relative">
               
               {/* Central Typography */}
               <div className="flex flex-row-reverse gap-8 md:gap-16 h-[50vh] items-start animate-fade-in-up">
                   {/* Main Title - Vertical Writing */}
                   <div className="flex flex-col h-full" style={{ writingMode: 'vertical-rl' }}>
                       <h1 className="font-serif font-bold text-5xl md:text-7xl lg:text-8xl tracking-[0.2em] text-white/90 drop-shadow-2xl">
                           紫微斗數
                       </h1>
                   </div>
                   
                   {/* Subtitle / Description - Vertical */}
                   <div className="flex flex-col h-full pt-12 md:pt-24" style={{ writingMode: 'vertical-rl' }}>
                       <p className="text-white/40 text-xs md:text-sm tracking-[0.4em] font-light border-l border-white/10 pl-4 md:pl-6 leading-loose">
                           觀星・知命・掌運
                       </p>
                       <p className="text-white/40 text-xs md:text-sm tracking-[0.4em] font-light pl-4 md:pl-6 mt-4 leading-loose">
                           人工智慧深度演繹
                       </p>
                   </div>
               </div>

               {/* Call to Action - Seal Button */}
               <div className="absolute bottom-[15%] animate-fade-in delay-500">
                   <button 
                       onClick={() => setShowInputModal(true)}
                       className="group relative"
                   >
                       {/* Circle/Seal Graphics */}
                       <div className="absolute inset-0 bg-rose-900/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-700 opacity-60"></div>
                       <div className="relative w-32 h-32 md:w-40 md:h-40 border border-white/10 group-hover:border-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-500 group-hover:scale-105">
                           <div className="w-24 h-24 md:w-32 md:h-32 border border-white/5 rounded-full flex flex-col items-center justify-center gap-2 group-hover:bg-white/5 transition-colors">
                               <span className="font-serif text-lg md:text-xl tracking-[0.2em] text-white/80 group-hover:text-white">開啟</span>
                               <span className="font-serif text-lg md:text-xl tracking-[0.2em] text-white/80 group-hover:text-white">命盤</span>
                           </div>
                       </div>
                   </button>
                   
                   {/* Resume Chat Button (Small text below) */}
                   {state.chatHistory.length > 0 && (
                       <div className="absolute top-full left-1/2 -translate-x-1/2 mt-8 w-full text-center">
                            <button 
                                onClick={() => setState(prev => ({...prev, mode: 'analysis'}))}
                                className="text-[10px] text-emerald-400/60 hover:text-emerald-400 tracking-[0.3em] uppercase transition-colors"
                            >
                                Resume Session
                            </button>
                       </div>
                   )}
               </div>
           </div>
        )}

        {/* VIEW 2: ANALYSIS (CHAT MODE) */}
        {state.mode === 'analysis' && (
          <div className="flex flex-col h-full relative animate-fade-in">
             {/* Scrollable Content */}
             <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
                <div className="max-w-5xl mx-auto w-full pb-48 pt-12 md:pt-20 px-4">
                    <AnalysisResult 
                        history={state.chatHistory} 
                        isLoading={state.isLoading} 
                        onRetry={onRetryStable}
                        onStop={onStopStable}
                        onQuestionsUpdate={handleQuestionsUpdateStable}
                    />
                    <div ref={messagesEndRef} className="h-4" />
                </div>
             </div>

             {/* Input Bar (Zen Style) - Optimized Compact Version */}
             <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/90 to-transparent pt-8 pb-6 px-4 transition-all duration-300">
                <div className="max-w-4xl mx-auto">
                    {/* Image Preview */}
                    {pendingImage && (
                        <div className="mb-2 flex justify-center animate-fade-in">
                            <div className="relative">
                                <img src={pendingImage.previewUrl} alt="Preview" className="h-16 rounded border border-white/20 shadow-lg opacity-80" />
                                <button onClick={removePendingImage} className="absolute -top-2 -right-2 bg-rose-900 text-white rounded-full p-1 hover:bg-rose-700"><XMarkIcon className="w-3 h-3"/></button>
                            </div>
                        </div>
                    )}

                    {/* Optimized Suggestions: Scrollable Chips */}
                    {!state.isLoading && suggestedQuestions.length > 0 && !pendingImage && (
                        <div className="flex justify-center gap-2 mb-3 overflow-x-auto scrollbar-hide py-1 mask-linear-fade">
                            {suggestedQuestions.slice(0,3).map((q, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => handleSendMessage(q)} 
                                    className="whitespace-nowrap px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-[11px] text-indigo-200/80 hover:text-indigo-100 transition-all tracking-wide shadow-sm backdrop-blur-sm"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Compact Input Line */}
                    <div className="relative group">
                        <textarea 
                            ref={textareaRef}
                            value={inputMessage} 
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder="問命..." 
                            rows={1}
                            className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.08] text-gray-200 placeholder-gray-600 text-center text-base md:text-lg font-serif py-3 px-12 border border-white/10 rounded-full focus:border-white/30 focus:outline-none resize-none transition-all custom-scrollbar shadow-inner backdrop-blur-md"
                            disabled={state.isLoading}
                            style={{ minHeight: '50px', maxHeight: '120px' }}
                        />
                        
                        {/* Right Tools - Integrated inside pill */}
                        <div className="absolute right-3 bottom-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
                             <input type="file" ref={chatFileInputRef} onChange={handleChatFileChange} className="hidden" accept=".txt,.md,.json,.csv,.log" />
                             <button onClick={() => chatFileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10" disabled={state.isLoading} title="上傳文字">
                                <DocumentTextIcon className="w-5 h-5" />
                             </button>

                             <input type="file" ref={chatImageInputRef} onChange={handleChatImageChange} className="hidden" accept="image/*" />
                             <button onClick={() => chatImageInputRef.current?.click()} className="p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10" disabled={state.isLoading} title="上傳圖片">
                                <CameraIcon className="w-5 h-5" />
                             </button>
                             <button onClick={() => handleSendMessage()} disabled={!inputMessage.trim() && !pendingImage} className="p-2 text-indigo-400 hover:text-indigo-300 transition-colors rounded-full hover:bg-indigo-500/20 disabled:opacity-30">
                                <ChevronRightIcon className="w-5 h-5" />
                             </button>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        )}

        {/* --- MODALS (Reset & Quota) --- */}
        {showResetConfirm && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                 <div className="bg-[#1a1a1c] border border-white/10 p-8 w-full max-w-sm text-center shadow-2xl">
                     <h3 className="text-xl font-serif text-white mb-2 tracking-widest">確認重置</h3>
                     <p className="text-gray-500 text-xs mb-8">所有記憶將回歸虛無。</p>
                     <div className="flex gap-4 justify-center text-sm tracking-widest">
                         <button onClick={cancelReset} className="text-gray-400 hover:text-white px-4 py-2">保留</button>
                         <button onClick={confirmReset} className="text-rose-400 hover:text-rose-300 px-4 py-2 border border-rose-900/50 bg-rose-900/10 hover:bg-rose-900/30">重置</button>
                     </div>
                 </div>
             </div>
        )}
        {showQuotaWarning && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-amber-900/80 text-amber-100 px-4 py-2 text-xs tracking-wider rounded border border-amber-500/30 backdrop-blur">
                Pro 額度耗盡，已切換至 Flash 模型
            </div>
        )}

      </main>
    </div>
  );
}
