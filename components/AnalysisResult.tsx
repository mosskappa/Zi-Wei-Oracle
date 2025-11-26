import React, { useEffect, useRef, useMemo, ReactElement } from 'react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StopIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface AnalysisResultProps {
  history: ChatMessage[];
  isLoading: boolean;
  onRetry?: () => void;
  onStop?: () => void;
  onQuestionsUpdate?: (questions: string[]) => void;
}

// --- 1. CONFIGURATION & CONSTANTS ---

const STAR_TYPES = {
  ji: ['化忌', '武曲化忌', '廉貞化忌', '巨門化忌', '天機化忌', '文昌化忌', '文曲化忌', '太陰化忌', '貪狼化忌', '太陽化忌'], 
  lu: ['化祿'],
  quan: ['化權'],
  ke: ['化科'],
  bad: ['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫', '空宮', '天刑', '孤辰', '寡宿', '大耗', '破碎', '天哭', '天虛'],
  good: ['祿存', '天馬', '左輔', '右弼', '天魁', '天鉞', '文昌', '文曲', '三台', '八座', '恩光', '天貴'],
  romance: ['紅鸞', '天喜', '咸池', '天姚', '沐浴', '大耗'], 
  imperial: ['紫微', '天府'], 
  action: ['七殺', '破軍', '貪狼', '廉貞', '武曲', '太陽'], 
  intellect: ['天機', '天梁', '天相', '天同', '太陰'], 
  dark: ['巨門'] 
};

// 1. 定義凶格/苦格/風險格清單 (Bad Patterns) - 亮紅燈
const BAD_PATTERNS_LIST = [
  '馬頭帶劍格', '馬頭帶劍', '羊陀夾祿格', '羊陀夾祿', '羊陀夾命格', '羊陀夾命',
  '鈴昌陀武格', '鈴昌羅紋格', '鈴昌羅紋', '鈴昌陀武', 
  '火貪格', '鈴貪格', '火貪', '鈴貪', 
  '泛水桃花格', '風流彩杖格', '刑囚夾印格', '路上埋屍格', '財與囚仇格', 
  '巨火羊格', '空劫夾命格', '刑忌夾印格', '雙忌夾命格', '三忌沖命', '雙忌沖命',
  '十惡格', '十惡', '刑杖格', '刑杖', '運忌沖命', '天機化忌', '太陰化忌', '雙忌沖', '三忌沖',
  '權忌交戰', '權忌交沖', '祿忌交沖', '忌沖'
];
const BAD_PATTERNS_SET = new Set(BAD_PATTERNS_LIST);

// 2. 定義完整格局白名單 (Array) - 嚴格模式 (Strict Whitelist)
const VALID_PATTERNS_LIST = [
  // 吉格 / 中性格
  '極嚮離明格', '極嚮離明', '紫府同宮格', '紫府朝垣格', '君臣慶會格', '府相朝垣格', '府相朝垣',
  '機月同梁格', '機月同梁', '機巨同臨格', '機巨同臨', '陽梁昌祿格', '陽梁昌祿', 
  '日照雷門格', '日照雷門', '金燦光輝格', '日麗中天',
  '月朗天門格', '月朗天門', '月生滄海格', '月生滄海', '明珠出海格', '明珠出海',
  '日月並明格', '日月並明', '日月同宮格', '巨日同宮格', '巨日同宮', '丹墀桂墀格',
  '石中隱玉格', '石中隱玉', '壽星入廟格', '壽星入廟', '英星入廟格', '英星入廟',
  '七殺朝斗格', '七殺朝斗', '雄宿朝元格', '雄宿朝元', 
  '三奇加會格', '三奇加會', '雙祿朝垣格', '雙祿朝垣', '祿馬交馳格', '祿馬交馳', '祿馬佩印格',
  '坐貴向貴格', '坐貴向貴', '文星拱命格', '文星拱命', '將星得地格',
  '權祿巡逢格', '權祿巡逢', '科權祿夾格', '財蔭夾印格', '財蔭夾印',
  '命無正曜格', '命無正曜', '殺破狼格', '殺破狼', '殺破狼局',
  '天同坐戌格', '太陰坐酉格', '巨門坐子格', '巨門坐午格', '天梁坐午格',
  '左右同宮格', '左右同宮', '魁鉞夾命格', '兼文武格',
  
  // 納入凶格 (確保 Tokenizer 能識別)
  ...BAD_PATTERNS_LIST 
];

const VALID_PATTERNS_SET = new Set(VALID_PATTERNS_LIST);

const FLOW_KEYWORDS = [
    '祿入', '忌入', '權入', '科入', '自化', 
    '互沖', '互照', '拱照', '會照', '會合',
    '夾命', '夾宮', '夾局',
    '->', '→', '轉化', '連結', '引爆', '刑剋', '相欠', '共振', 
    '沖', '沖射', '三合', '對宮'
];

const WARNING_KEYWORDS = ['警世', '注意', '警告', '風險', '危機', '破蕩', '刑傷', '血光', '官非', '糾紛', '分離', '災難', '煞氣', '破耗', '破局', '破損', '破壞', '水災', '止損', '沉沒成本', '內耗', '磨損', '殘酷', '紅色警報', '警報', '隱形債務'];
const VERDICT_KEYWORDS = ['機率極大', '極大', '必然', '肯定', '絕對', '優勢', '核心', '關鍵', '必定', '機率高', '指數高', '做多', '唯一解', '突破口', '戰略批註', '紅樓夢原型', '終局對齊', '戰略總結', '執行方案', '機率偏高', '風險偏高', '突破', '格局總覽', '判斷：', '綜合判定：', '座標定位：', '星曜取證：', '四化盤點：', '命盤讀取確認', '格局定位', '空間座標', '本命底色', '大限環境', '關鍵能量'];

const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const allStars = [
    ...STAR_TYPES.ji, ...STAR_TYPES.lu, ...STAR_TYPES.quan, ...STAR_TYPES.ke, 
    ...STAR_TYPES.bad, ...STAR_TYPES.good, ...STAR_TYPES.romance,
    ...STAR_TYPES.imperial, ...STAR_TYPES.action, ...STAR_TYPES.intellect, ...STAR_TYPES.dark
].sort((a, b) => b.length - a.length);

const allFlows = FLOW_KEYWORDS.sort((a, b) => b.length - a.length);
const allWarnings = WARNING_KEYWORDS.sort((a, b) => b.length - a.length);
const allVerdicts = VERDICT_KEYWORDS.sort((a, b) => b.length - a.length);

const patternList = VALID_PATTERNS_LIST.sort((a, b) => b.length - a.length);
const patternRegexString = patternList.map(escapeRegExp).join('|');

const starPattern = allStars.map(escapeRegExp).join('|');
const flowPattern = allFlows.map(escapeRegExp).join('|');
const warningPattern = allWarnings.map(escapeRegExp).join('|');
const verdictPattern = allVerdicts.map(escapeRegExp).join('|');
const bracketPattern = "【|】|「|」";
const BRACKET_PHRASE_REGEX = /([「【][^」】]+[」】])/g;

// Master Tokenizer Regex
const SPLIT_REGEX = new RegExp(
  `(${patternRegexString}|${flowPattern}|${warningPattern}|${verdictPattern}|${starPattern}|${bracketPattern})`, 
  'g'
);

const PATTERNS = {
  flow: new RegExp(`^(${flowPattern})$`),
  warning: new RegExp(`^(${warningPattern})$`),
  verdict: new RegExp(`^(${verdictPattern})$`),
  ji: new RegExp(`^(${STAR_TYPES.ji.map(escapeRegExp).join('|')})$`),
  lu: new RegExp(`^(${STAR_TYPES.lu.map(escapeRegExp).join('|')})$`),
  quan: new RegExp(`^(${STAR_TYPES.quan.map(escapeRegExp).join('|')})$`),
  ke: new RegExp(`^(${STAR_TYPES.ke.map(escapeRegExp).join('|')})$`),
  badStar: new RegExp(`^(${STAR_TYPES.bad.map(escapeRegExp).join('|')})$`),
  goodStar: new RegExp(`^(${STAR_TYPES.good.map(escapeRegExp).join('|')})$`),
  romance: new RegExp(`^(${STAR_TYPES.romance.map(escapeRegExp).join('|')})$`),
  imperial: new RegExp(`^(${STAR_TYPES.imperial.map(escapeRegExp).join('|')})$`),
  action: new RegExp(`^(${STAR_TYPES.action.map(escapeRegExp).join('|')})$`),
  intellect: new RegExp(`^(${STAR_TYPES.intellect.map(escapeRegExp).join('|')})$`),
  dark: new RegExp(`^(${STAR_TYPES.dark.map(escapeRegExp).join('|')})$`),
  labelPair: /^([^\n：:]{2,10})([：:])\s*(.*)/
};

// --- 2. STYLING LOGIC ---

const getStarStyle = (text: string) => {
    if (PATTERNS.ji.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-red-500/20 text-red-100 border border-red-500/50 align-baseline tracking-wide shadow-[0_0_10px_rgba(239,68,68,0.15)]";
    if (PATTERNS.lu.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 align-baseline tracking-wide shadow-[0_0_10px_rgba(52,211,153,0.15)]";
    if (PATTERNS.quan.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-amber-500/20 text-amber-100 border border-amber-400/40 align-baseline tracking-wide";
    if (PATTERNS.ke.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-sky-500/20 text-sky-100 border border-sky-400/40 align-baseline tracking-wide";
    if (PATTERNS.romance.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-pink-500/20 text-pink-100 border border-pink-400/40 align-baseline tracking-wide";
    if (PATTERNS.imperial.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-violet-500/25 text-violet-50 border border-violet-400/50 align-baseline tracking-wide shadow-[0_0_12px_rgba(139,92,246,0.2)]";
    if (PATTERNS.action.test(text)) return "text-indigo-100 font-bold border-b-2 border-indigo-500/40 hover:text-white transition-colors";
    if (PATTERNS.intellect.test(text)) return "text-cyan-100 font-bold border-b-2 border-cyan-500/40 hover:text-white transition-colors";
    if (PATTERNS.dark.test(text)) return "inline-flex items-center px-1.5 rounded text-[0.95em] font-bold bg-slate-700/50 text-slate-100 border border-slate-500/40 align-baseline tracking-wide";
    if (PATTERNS.badStar.test(text)) return "text-rose-300 font-bold drop-shadow-[0_0_2px_rgba(244,63,94,0.5)]";
    if (PATTERNS.goodStar.test(text)) return "text-gray-200 font-bold drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]";
    return "";
};

// --- Helper: Render Pattern (Gold vs Red) ---
const renderPatternBadge = (text: string, key: number) => {
    const isBad = BAD_PATTERNS_SET.has(text) || text.includes('忌') || text.includes('煞') || text.includes('凶') || text.includes('惡');
    
    if (isBad) {
        // 🔴 凶格/風險格：深紅警示
        return (
            <span key={key} className="inline-flex items-center px-2.5 py-0.5 mx-1 rounded border border-rose-500/50 bg-rose-900/20 text-rose-100 font-serif font-bold text-[1.05em] tracking-wide shadow-[0_0_10px_rgba(244,63,94,0.2)] align-baseline whitespace-nowrap">
               {text}
            </span>
        );
    } else {
        // 🌟 吉格/中性：精緻金框
        return (
            <span key={key} className="inline-flex items-center px-2.5 py-0.5 mx-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-100 font-serif font-bold text-[1.05em] tracking-wide shadow-sm align-baseline whitespace-nowrap">
               {text}
            </span>
        );
    }
};

const preprocessMarkdown = (text: string) => {
  if (!text) return { cleanedText: '', extractedQuestions: [] };
  let t = text;
  t = t.replace(/^\*\*【(?:System Upgrade|系統設定):[\s\S]*?(?=\n)/g, ''); 
  t = t.replace(/^(Role|角色):[\s\S]*?\n/gm, '');
  t = t.replace(/\[System Context\][\s\S]*?\n/g, '');
  t = t.replace(/\*\*/g, ''); 
  t = t.replace(/->/g, '→');

  const questionHeaderRegex = /##\s*❓\s*推薦追問|##\s*❓\s*Recommended Follow-up/;
  const parts = t.split(questionHeaderRegex);
  const mainContent = parts[0].trim();
  let questions: string[] = [];

  if (parts.length > 1) {
    const questionsBlock = parts[1];
    questions = questionsBlock.split('\n').map(line => line.trim())
        .filter(line => line.startsWith('*') || line.startsWith('❖') || line.startsWith('-'))
        .map(line => line.replace(/^[\*\-❖]\s*/, '').trim())
        .filter(q => q.length > 2);
  }
  return { cleanedText: mainContent, extractedQuestions: questions };
};

// --- TokenizedText Component ---
const TokenizedText: React.FC<{ text: string }> = React.memo(({ text }) => {
   const parts = text.split(SPLIT_REGEX);
   return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // 自動識別格局 (無括號)
        if (VALID_PATTERNS_SET.has(part)) {
             return renderPatternBadge(part, i);
        }

        const starStyle = getStarStyle(part);
        if (starStyle) return <span key={i} className={starStyle}>{part}</span>;
        
        if (PATTERNS.flow.test(part)) return <span key={i} className="text-cyan-300 font-bold mx-0.5">{part}</span>;
        if (PATTERNS.warning.test(part)) return <span key={i} className="text-red-300 font-bold mx-0.5">{part}</span>;
        if (PATTERNS.verdict.test(part)) return <span key={i} className="text-amber-200 font-bold mx-0.5 underline decoration-amber-500/30 underline-offset-4">{part}</span>;
        if (part === '【' || part === '】' || part === '「' || part === '」') return <span key={i} className="text-indigo-300/40 mx-0.5 font-light">{part}</span>;
        
        return <span key={i}>{part}</span>;
      })}
    </>
  );
});

// --- HighlightedText Component ---
const HighlightedText: React.FC<{ text: string }> = React.memo(({ text }) => {
  if (!text) return null;
  
  // Check for Label Pair (e.g., "機月同梁格：...")
  const labelMatch = text.match(PATTERNS.labelPair);
  if (labelMatch && !PATTERNS.flow.test(labelMatch[1]) && labelMatch[1].length < 20) { // 放寬長度限制到 20
      const label = labelMatch[1].trim();
      const content = labelMatch[3];
      
      // --- 核心修補：智慧判斷邏輯 ---
      // 1. 先把括號拿掉再比對白名單 (例如 "馬頭帶劍(大限)" -> "馬頭帶劍")
      const cleanLabel = label.replace(/[（(].*?[)）]/g, '').trim();

      // 2. 判斷條件：
      //    A. 在白名單內 (嚴格)
      //    B. 包含關鍵字 (寬鬆)：忌、沖、煞、刑、格、局
      const isPattern = VALID_PATTERNS_SET.has(cleanLabel) || 
                        label.includes('忌') || 
                        label.includes('沖') || 
                        label.includes('煞') || 
                        label.includes('刑') || 
                        (label.length <= 8 && (label.endsWith('格') || label.endsWith('局'))); // 放寬長度

      const labelElement = isPattern ? (
          renderPatternBadge(label, 0) // 這裡會自動根據字面判斷紅/金
      ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] md:text-xs font-bold tracking-[0.1em] text-indigo-200 bg-indigo-500/10 border border-indigo-500/20 uppercase whitespace-nowrap shadow-sm select-none">
              {label}
          </span>
      );

      return (
          <div className="grid grid-cols-[auto_1fr] gap-3 my-1.5 items-baseline">
            {labelElement}
            <span className="text-gray-200 leading-relaxed min-w-0 break-words"> {/* 修正這裡文字顏色為 gray-200 */}
                <HighlightedText text={content} />
            </span>
          </div>
      );
  }

  // Normal text with brackets
  const bracketParts = text.split(BRACKET_PHRASE_REGEX);
  if (bracketParts.length > 1) {
      return (
          <>
            {bracketParts.map((part, i) => {
                if (!part) return null;
                const cleanText = part.replace(/[「」【】]/g, '').trim();
                
                // 檢查括號內是否為正規格局 (嚴格白名單)
                const isValidPattern = VALID_PATTERNS_SET.has(cleanText);

                if (isValidPattern) {
                    return renderPatternBadge(cleanText, i);
                }
                
                // 普通強調
                if (BRACKET_PHRASE_REGEX.test(part)) {
                    return (
                        <span key={i} className="mx-1 text-indigo-200 font-bold border-b border-indigo-400/30 pb-0.5">
                           {part}
                        </span>
                    );
                }
                return <TokenizedText key={i} text={part} />;
            })}
          </>
      );
  }
  return <TokenizedText text={text} />;
});

// --- ModelResponse Component ---
const ModelResponse: React.FC<{ 
    message: ChatMessage;
    isStreaming: boolean;
    onQuestionsUpdate?: (q: string[]) => void;
    onStop?: () => void;
}> = React.memo(({ message, isStreaming, onQuestionsUpdate, onStop }) => {
    
    const { cleanedText, extractedQuestions } = useMemo(() => preprocessMarkdown(message.content), [message.content]);
    const hasContent = cleanedText.length > 0;

    useEffect(() => {
        if (onQuestionsUpdate && extractedQuestions.length > 0) {
            onQuestionsUpdate(extractedQuestions.slice(0, 5));
        }
    }, [extractedQuestions, onQuestionsUpdate]);

    return (
        <div className="w-full mx-auto px-2 md:px-0 mb-20 max-w-4xl transition-all duration-700">
            
            {/* Header: Only show when there is content */}
            {hasContent && (
                <div className="flex items-center justify-center gap-4 mb-12 animate-fade-in opacity-60">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-indigo-500/50"></div>
                    <SparklesIcon className="w-4 h-4 text-indigo-300" />
                    <span className="text-[10px] font-sans font-bold tracking-[0.4em] text-indigo-200 uppercase glow-text">Analysis Engine</span>
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-indigo-500/50"></div>
                </div>
            )}

            {/* Loading State: The Breathing Mandala */}
            {isStreaming && !hasContent && (
                <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                    <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border border-indigo-500/20 rounded-full animate-[spin_8s_linear_infinite]"></div>
                        <div className="absolute inset-4 border border-indigo-400/30 rounded-full border-t-transparent animate-[spin_3s_linear_infinite_reverse]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                             <div className="w-2 h-2 bg-indigo-100 rounded-full shadow-[0_0_20px_rgba(129,140,248,0.8)] animate-pulse"></div>
                        </div>
                    </div>
                    <p className="mt-8 text-xs font-serif text-indigo-300/50 tracking-[0.3em] animate-pulse">
                        推演命盤邏輯...
                    </p>
                </div>
            )}

            {/* Content Area */}
            {hasContent && (
                <div className="relative animate-fade-in-up">
                     {/* Zen Paper Container */}
                     <div className="bg-[#121215]/50 backdrop-blur-sm border border-white/5 rounded-sm p-8 md:p-12 shadow-2xl">
                        <div className="prose prose-invert max-w-none 
                            font-serif
                            prose-headings:font-serif prose-headings:text-gray-100 prose-headings:tracking-widest prose-headings:font-light
                            prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-8 prose-h2:pb-4 prose-h2:border-b prose-h2:border-white/10 prose-h2:text-center
                            prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-6 prose-h3:text-indigo-200/90 prose-h3:border-l-2 prose-h3:border-indigo-500/40 prose-h3:pl-4
                            prose-p:text-[1.1rem] prose-p:leading-9 prose-p:text-gray-200 prose-p:mb-6 prose-p:font-light
                            prose-ul:my-6 prose-ul:pl-0
                            prose-li:list-none prose-li:pl-0 prose-li:my-4
                            prose-strong:font-bold prose-strong:text-white
                        ">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({node, children}) => (
                                        <p className="mb-6">
                                            {React.Children.map(children, child => {
                                                if (typeof child === 'string') return <HighlightedText text={child} />;
                                                return child;
                                            })}
                                        </p>
                                    ),
                                    li: ({node, children}) => {
                                        const validChildren = React.Children.toArray(children).filter(child => {
                                            if (typeof child === 'string') return child.trim().length > 0;
                                            return child !== null;
                                        });
                                        if (validChildren.length === 0) return null;

                                        return (
                                            <li className="flex items-start gap-4 my-3 relative pl-2 group hover:bg-white/[0.02] p-2 rounded transition-colors">
                                                <div className="mt-3 w-1.5 h-1.5 rounded-full bg-indigo-500/50 group-hover:bg-indigo-300 transition-colors flex-shrink-0 shadow-[0_0_10px_currentColor]" />
                                                <div className="flex-1 min-w-0">
                                                    {validChildren.map((child, i) => (
                                                        <React.Fragment key={i}>
                                                            {typeof child === 'string' ? <HighlightedText text={child} /> : child}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </li>
                                        );
                                    },
                                    strong: ({node, children}) => <strong className="font-bold text-white border-b border-indigo-500/30 pb-0.5">{children}</strong>
                                }}
                            >
                                {cleanedText}
                            </ReactMarkdown>

                            {isStreaming && (
                               <div className="inline-block w-2 h-5 ml-1 bg-indigo-400 animate-pulse align-middle"></div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isStreaming && onStop && (
                <div className="flex justify-center mt-12 opacity-0 animate-fade-in animation-delay-500">
                    <button onClick={onStop} className="group flex items-center gap-3 px-6 py-2 rounded-full border border-rose-500/20 text-rose-300/60 hover:text-rose-300 hover:border-rose-500/50 text-xs tracking-[0.2em] transition-all hover:bg-rose-500/10">
                        <span className="group-hover:animate-pulse">🛑</span> 停止推演
                    </button>
                </div>
            )}
        </div>
    );
});

// --- UserMessage Component ---
const UserMessage: React.FC<{ content: string; image?: string }> = React.memo(({ content, image }) => {
    if (content.startsWith('Analyzing') || content.includes('[System Context]')) return null;
    const displayContent = content.replace(/\[引用檔案內容\]:[\s\S]*/, '📄 [已上傳命盤文本]').trim();
    
    return (
        <div className="w-full mx-auto flex justify-end mb-8 animate-fade-in-up px-2 md:px-0 max-w-4xl">
            <div className="flex flex-col items-end gap-2 max-w-[85%]">
                {image && (
                    <img 
                        src={image} 
                        alt="User Upload" 
                        className="max-h-64 rounded-xl border border-white/20 shadow-lg mb-2"
                    />
                )}
                {displayContent && (
                    <div className="bg-[#1e1642]/80 text-gray-200 px-6 py-4 rounded-2xl rounded-tr-sm shadow-lg backdrop-blur-md border border-white/10 text-[1rem] leading-relaxed font-serif tracking-wide">
                        {displayContent}
                    </div>
                )}
            </div>
        </div>
    );
});

// --- Main AnalysisResult Component ---
const AnalysisResult: React.FC<AnalysisResultProps> = ({ history, isLoading, onRetry, onStop, onQuestionsUpdate }) => {
    const endRef = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full pb-32 space-y-2">
            {history.map((msg, idx) => {
                const isLatest = idx === history.length - 1;
                if (msg.role === 'user') {
                    return <UserMessage key={msg.id} content={msg.content} image={msg.image} />;
                } else {
                    return (
                        <ModelResponse 
                            key={msg.id} 
                            message={msg} 
                            isStreaming={isLoading && isLatest}
                            onQuestionsUpdate={isLatest ? onQuestionsUpdate : undefined}
                            onStop={isLatest ? onStop : undefined}
                        />
                    );
                }
            })}
            
            {!isLoading && history.length > 0 && history[history.length-1].role === 'model' && (
                <div className="flex justify-center pt-4 pb-12">
                     <button onClick={onRetry} className="group flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 text-gray-400 hover:text-indigo-200 transition-all text-xs tracking-widest uppercase">
                        <ArrowPathIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" /> 
                        <span>Regenerate</span>
                     </button>
                </div>
            )}
            <div ref={endRef} />
        </div>
    );
};

export default React.memo(AnalysisResult);