import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisType, ModelTier } from '../types';

const API_KEY = process.env.API_KEY;

// CRITICAL: Model Definitions - FORCE FLASH ONLY
// 將 pro 也指向 flash，確保即使前端傳來 'pro' 也會使用免費模型
const MODELS = {
  pro: 'gemini-2.5-flash', 
  flash: 'gemini-2.5-flash'
};

const ai = new GoogleGenAI({ 
  apiKey: API_KEY
});

// --- SAFETY SETTINGS ---
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- CORE LOGIC: CANONICAL ARRAYS ---
const STEMS_CANON = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES_CANON = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// Extended CNY Dates
const CNY_DATES: Record<number, string> = {
    2010: '2010-02-14', 2011: '2011-02-03', 2012: '2012-01-23', 2013: '2013-02-10',
    2014: '2014-01-31', 2015: '2015-02-19', 2016: '2016-02-08', 2017: '2017-01-28',
    2018: '2018-02-16', 2019: '2019-02-05',
    2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01', 2023: '2023-01-22',
    2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
    2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03',
    2031: '2031-01-23', 2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19',
    2035: '2035-02-08', 2036: '2036-01-28', 2037: '2037-02-15', 2038: '2038-02-04',
    2039: '2039-01-24', 2040: '2040-02-12'
};

// --- CORE LOGIC: FULL SI_HUA_RULES ---
const SI_HUA_RULES: Record<string, { lu: string, quan: string, ke: string, ji: string }> = {
    '甲': { lu: '廉貞', quan: '破軍', ke: '武曲', ji: '太陽' },
    '乙': { lu: '天機', quan: '天梁', ke: '紫微', ji: '太陰' },
    '丙': { lu: '天同', quan: '天機', ke: '文昌', ji: '廉貞' },
    '丁': { lu: '太陰', quan: '天同', ke: '天機', ji: '巨門' },
    '戊': { lu: '貪狼', quan: '太陰', ke: '右弼', ji: '天機' },
    '己': { lu: '武曲', quan: '貪狼', ke: '天梁', ji: '文曲' },
    '庚': { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' },
    '辛': { lu: '巨門', quan: '太陽', ke: '文曲', ji: '文昌' },
    '壬': { lu: '天梁', quan: '紫微', ke: '左輔', ji: '武曲' },
    '癸': { lu: '破軍', quan: '巨門', ke: '太陰', ji: '貪狼' }
};

const ganzhiOfYear = (adjYear: number) => {
  const base = 1984; 
  const diff = adjYear - base;
  const stemIndex = ((diff % 10) + 10) % 10;
  const branchIndex = ((diff % 12) + 12) % 12;
  return { stem: STEMS_CANON[stemIndex], branch: BRANCHES_CANON[branchIndex] };
};

const extractTargetYear = (text: string): number | null => {
    const yearMatch = text.match(/(20[1-5][0-9])年/);
    if (yearMatch) {
        return parseInt(yearMatch[1], 10);
    }
    return null;
};

// --- TEMPERATURE CONTROL ---
// Flash 模型需要更嚴格的溫度控制以避免幻覺
const pickTemperature = (type: AnalysisType): number => {
    switch (type) {
        case AnalysisType.CAREER:
        case AnalysisType.WEALTH: 
        case AnalysisType.HEALTH:
        case AnalysisType.YEARLY:
            return 0.1; // ❄️ 極低溫：Flash 需要嚴格限制
        case AnalysisType.LOVE:
        case AnalysisType.COMPATIBILITY: 
            return 0.3; // 🌡️ 低溫：稍微放寬，但仍需嚴謹
        default: 
            return 0.3;
    }
};

// --- 核心邏輯更新：System Instruction ---
const getSystemInstruction = (chartText: string = "", isCouple: boolean = false) => {
  const now = new Date();
  let currentGregorianYear = now.getFullYear();
  
  const targetYear = extractTargetYear(chartText);
  if (targetYear) { currentGregorianYear = targetYear; }

  const thisCNYStr = CNY_DATES[currentGregorianYear] || `${currentGregorianYear}-02-01`;
  const thisCNY = new Date(thisCNYStr);
  const adjYear = (targetYear) ? currentGregorianYear : (now < thisCNY ? currentGregorianYear - 1 : currentGregorianYear);
  
  const current = ganzhiOfYear(adjYear);
  const next = ganzhiOfYear(adjYear + 1);
  const currentRule = SI_HUA_RULES[current.stem];
  const nextRule = SI_HUA_RULES[next.stem];
  
  return `
**【系統設定：紫微斗數戰略引擎】**
**角色:** **"首席戰略風控官" (Strategic Risk Auditor)**
**任務:** 提供基於「嚴格紫微斗數結構學」的邏輯分析，拒絕迷信與模糊解讀。

**【核心協議 0：語言與格式純淨度】**
* **絕對禁止英文：** 輸出內容必須是 **100% 繁體中文**。
* **禁止自我介紹：** 不要在開頭說「基於紫微斗數引擎...」，直接開始分析。
* **禁止專有名詞外露：** Logic-Check 等術語僅供內部運算，不可輸出。
* **關鍵字修正:** 地支 "Chou" 必須寫作 **"丑"**，嚴禁寫作 "醜"。

**【核心協議 1：格局優先鎖定 (Pattern Lock)】**
* **最高指令:** 在分析任何運勢前，**必須**先執行「格局掃描」。
* **窮盡原則 (Exhaustive List):** * 若為單人：必須列出命盤中**所有符合**的格局（無論吉凶、大小），不可只列出最大的一個。
    * 若為合盤：必須**分別**列出 [甲方] 與 [乙方] 各自的所有格局，**嚴禁**僅列出共同點或只寫其中一人。
* **掃描清單 (Override Rules - 需精準匹配):**
    * **極嚮離明:** 紫微在午宮坐命。
    * **月朗天門:** 太陰在亥宮坐命。
    * **日麗中天:** 太陽在午宮坐命。
    * **日照雷門:** 太陽在卯宮坐命。
    * **石中隱玉:** 巨門在子/午宮，有科/權/祿之一。
    * **陽梁昌祿:** 三方四正齊聚 {太陽, 天梁, 文昌, 祿(存/化)}。
    * **三奇加會:** 命宮三方四正全見 {化祿, 化權, 化科}。
    * **殺破狼:** 七殺、破軍、貪狼在命/財/官。
    * **機月同梁:** 天機、太陰、天同、天梁在命/財/官。
    * **日月並明:** 太陽在巳/辰，太陰在酉/戌。
    * **明珠出海:** 命宮在未無主星，對宮同巨，三方陽梁機陰。
    * **馬頭帶劍:** 擎羊在午宮坐命。
    * **羊陀夾命:** 祿存坐命，前後有擎羊陀羅。
    * **火貪/鈴貪:** 貪狼與火星/鈴星同宮或三合。
    * **空劫夾命:** 地空地劫在命宮左右。
* **命名規範:** 若符合上述定義，**必須**直接使用該經典名稱（如【日月並明格】），**禁止**使用「太陰坐酉格」這類描述性名稱。

**【核心協議 1.5: 嚴禁造詞 (No Invented Patterns)】**
* **嚴格規定：** 「格局掃描」區塊僅能列出**紫微斗數古籍中記載**的正式格局。
* **禁止發明：** 嚴禁使用「單向輸血格」、「權忌交沖格」、「情緒內耗格」等現代自創詞彙。若無古籍格局，請直接描述星曜互動（如：權忌交戰），不可加「格」字。

**【核心協議 2：運勢三層級 (隱形邏輯)】**
* **運算邏輯 (Internal Logic):** 1. **本命 (體):** 格局天花板與抗壓性。2. **大限 (用):** 十年環境順逆。3. **流年 (氣):** 當年事件觸發。
* **輸出要求:** 請將上述邏輯轉化為自然的「底層性格」、「十年走勢」與「流年詳解」，**嚴禁**在輸出中提及「體、用、氣」等術語。

**【核心協議 2.5: 飛化路徑掃描 (Flying Star Trace)】**
* **必須掃描:** 檢查生年四化、大限四化對本命盤的「入、沖、照」關係。
* **重點關注:** * 祿入/忌入 命、財、官、夫。
    * 自化 (離心力/耗散)。
    * 運限化忌沖擊本命宮位。
* **輸出要求:** 在「格局掃描」之後，「命格診斷」之前，獨立列出這些關鍵軌跡。

**【核心協議 3：特殊狀況處理】**
* **空宮:** 借對宮安星，力量打七折。
* **合盤:** (僅合盤模式) 檢查飛化互涉 (忌入/祿入)。

**【核心協議 4: 解讀防偽與因果鎖定 (Causality Lock)】**
* **拒絕巴納姆效應:** 嚴禁輸出「你外表堅強內心柔軟」這種放諸四海皆準的廢話。
* **星曜證據法則:** 每一句推論，**必須**在括號內標註來源星曜。例如：「(因財帛宮武曲化祿，主正財豐厚)」。若無法找到星曜證據，則該推論不成立。
* **拒絕安慰劑:** 若命盤顯示凶象（如大限忌沖命），**必須直言不諱**，直接指出「破產」、「離婚」等具體風險，**禁止**使用模糊字眼粉飾太平。

**【核心協議 5: 吉凶辯證法 (Dialectical Analysis)】**
* **凡吉必有凶:** 解讀吉格時，**必須**指出其「副作用」或「代價」。（例如：權力帶來的孤獨）。
* **凡凶必有解:** 解讀凶格時，**必須**指出其「轉化運用」的可能性。（例如：鈴昌羅紋適合從事除錯/稽核工作）。

**【輸出結構 (Strict Markdown)】**
請嚴格遵守此格式。

## 📊 命盤幾何與格局掃描
${isCouple ? `
### [乾造/甲方] 命格結構
* **格局總清單：** [列出該命盤所有符合的格局（含吉凶），如：三奇加會格、羊陀夾命格。若無特殊格局則填寫主星坐向]
* **幾何結構：** [描述關鍵架構，如：鈴星激發、火貪同行]
* **座標定位：** 本命[X]宮，大限[X]宮。

### [坤造/乙方] 命格結構
* **格局總清單：** [列出該命盤所有符合的格局（含吉凶），如：日月並明格。若無特殊格局則填寫主星坐向]
* **幾何結構：** [描述關鍵架構，如：雙忌沖命]
* **座標定位：** 本命[X]宮，大限[X]宮。
` : `
* **格局總清單：** [列出所有符合的格局（含吉凶），如：極嚮離明格、羊陀夾命格。若有多個請並列顯示]
* **幾何結構：** [描述關鍵架構，如：鈴星激發、祿忌交沖]
* **座標定位：** 本命[X]宮，大限[X]宮，${adjYear}流年[X]宮。
`}

## 🔗 關鍵飛化路徑 (能量軌跡)
* **[生年/大限] 化[祿/忌] 入 [某宮]：** [簡短解釋，例如：夫祿入命 (配偶對我有情)]
* **[生年/大限] 化[祿/忌] 沖 [某宮]：** [簡短解釋，例如：大限忌沖命 (運勢低谷)]
* **[某宮] 自化 [祿/忌]：** [簡短解釋，例如：官祿自化忌 (事業不穩)]

## 🧬 命格與大運診斷
* **${isCouple ? '甲方底層性格' : '底層性格 (本命)'}：** [分析]
* **${isCouple ? '乙方底層性格' : '十年走勢 (大限)'}：** [分析]
${isCouple ? '* **互動模式：** [分析兩者大限走勢的碰撞與飛化互涉]' : ''}

## 🗓️ ${adjYear} 流年戰略詳解
* **關鍵能量：** ${currentRule.lu}祿/${currentRule.quan}權/${currentRule.ke}科/**${currentRule.ji}忌**
* **綜合判定：** [最終吉凶結論]

## 🔮 戰略總結
* [總結建議]

## 🛡️ 風控審計：隱形債務
* **風險源頭：** **${nextRule.ji}化忌**
* **操作風險：** [情境]

> 🩸 **警世通言**：[一句話總結]

## ❓ 推薦追問
* [問題1]
* [問題2]
* [問題3]
`;
};

export const streamAnalysis = async (
  type: AnalysisType,
  chart1: string,
  chart2: string | null,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal: AbortSignal | undefined,
  modelTier: ModelTier = 'pro'
) => {
  if (!API_KEY) {
    onError("API Key is missing.");
    return;
  }

  const modelName = MODELS[modelTier];

  try {
    let strategicContext = "";
    switch (type) {
        case AnalysisType.LOVE:
        case AnalysisType.COMPATIBILITY:
            strategicContext = "領域：感情婚姻。重點：能量流動 (祿/忌) 與 風險控制。";
            break;
        case AnalysisType.WEALTH:
            strategicContext = "領域：財富資產。重點：現金流 vs 資產庫存。";
            break;
        case AnalysisType.CAREER:
            strategicContext = "領域：事業職場。重點：權力結構 & 執行力。";
            break;
        default:
            strategicContext = "領域：人生戰略。重點：生存與繁榮。";
    }

    const prompt = `
      【紫微斗數：全域戰略引擎 Strategy Engine v14.0】
      **模型引擎:** ${modelName}
      **諮詢領域:** ${type}
      **戰略視角:** ${strategicContext}

      **命盤資料:**
      ${chart1}
      ${chart2 ? `**合盤對象:**\n${chart2}` : ''}
      
      **指令:**
      1. **分析:** 使用正統紫微斗數邏輯。
      2. **邏輯檢查:** 嚴格遵守【核心協議】中的定義與排除法則。
      3. **語言:** 全繁體中文，禁止夾雜英文 (No English)。
      4. **結構:** 嚴格遵守輸出結構，使用 Markdown 標題 (##, ###) 來區分區塊。
    `;

    // Get temperature based on analysis type (already lowered for Flash in pickTemperature)
    const temperature = pickTemperature(type);
    
    const systemInstruction = getSystemInstruction(chart1, !!chart2);

    const config: any = {
      systemInstruction: systemInstruction,
      temperature: temperature,
      safetySettings: SAFETY_SETTINGS,
    };
    
    // --- IMPORTANT: REMOVE THINKING CONFIG FOR FLASH ---
    // thinkingConfig is only supported on Pro models in Thinking Mode
    /*
    if (modelTier === 'pro') {
        config.thinkingConfig = { thinkingBudget: 8192 };
    }
    */

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: config
    });

    let fullBuffer = "";

    for await (const chunk of responseStream) {
      if (signal?.aborted) {
        break;
      }
      const text = chunk.text;
      if (text) {
        fullBuffer += text;
        onChunk(text);
      }
    }

    if (!signal?.aborted) {
       onComplete();
    }

  } catch (error: any) {
    if (signal?.aborted) return;
    console.error("Gemini API Error:", error);
    const errorMsg = error.message || "Unknown Error";
    if (errorMsg.includes('429') || errorMsg.includes('ResourceExhausted') || errorMsg.includes('Quota')) {
        onError("QUOTA_EXCEEDED");
    } else {
        onError(errorMsg);
    }
  }
};

export const sendMessageToChat = async (
  history: { role: string, parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] }[],
  newMessage: string,
  image: { mimeType: string, data: string } | null,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal: AbortSignal | undefined,
  modelTier: ModelTier = 'pro'
) => {
    if (!API_KEY) { onError("API Key missing"); return; }

    const modelName = MODELS[modelTier];

    try {
         const chartMsg = history.find(m => m.parts.some(p => 'text' in p && p.text.includes('命盤')));
         const chartContext = chartMsg && 'text' in chartMsg.parts[0] ? chartMsg.parts[0].text : "";
         
         const isCouple = chartContext.includes('Chart 2') || chartContext.includes('合盤');

         const config: any = { 
            systemInstruction: getSystemInstruction(chartContext, isCouple),
            temperature: 0.3, // Lower temperature for chat as well
            safetySettings: SAFETY_SETTINGS
         };

         // --- IMPORTANT: REMOVE THINKING CONFIG FOR FLASH ---
         /*
         if (modelTier === 'pro') {
             config.thinkingConfig = { thinkingBudget: 8192 };
         }
         */

         const chat = ai.chats.create({
            model: modelName,
            history: history as any,
            config: config
         });

         const messageText = `用戶問題: ${newMessage} (請用繁體中文回答，禁止英文)`;
         
         let messageParam: any = messageText;

         if (image) {
             messageParam = {
                 role: 'user',
                 parts: [
                    { text: messageText },
                    { inlineData: { mimeType: image.mimeType, data: image.data } }
                 ]
             };
         }

         const resultStream = await chat.sendMessageStream({ message: messageParam });

         for await (const chunk of resultStream) {
            if (signal?.aborted) break;
            if (chunk.text) onChunk(chunk.text);
         }
         
         if (!signal?.aborted) {
            onComplete();
         }

    } catch (error: any) {
        if (signal?.aborted) return;
        console.error("Chat Error:", error);
        const errorMsg = error.message || "Unknown Error";
        if (errorMsg.includes('429') || errorMsg.includes('ResourceExhausted') || errorMsg.includes('Quota')) {
            onError("QUOTA_EXCEEDED");
        } else {
            onError(errorMsg);
        }
    }
}
