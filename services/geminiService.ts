import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisType, ModelTier } from '../types';

const API_KEY = process.env.API_KEY;

// CRITICAL: Model Definitions
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

// Extended CNY Dates for lunar calculation approximation
const CNY_DATES: Record<number, string> = {
    1924: '1924-02-05', 1925: '1925-01-24', 1926: '1926-02-13', 1927: '1927-02-02', 1928: '1928-01-23',
    1929: '1929-02-10', 1930: '1930-01-30', 1931: '1931-02-17', 1932: '1932-02-06', 1933: '1933-01-26',
    1934: '1934-02-14', 1935: '1935-02-04', 1936: '1936-01-24', 1937: '1937-02-11', 1938: '1938-01-31',
    1939: '1939-02-19', 1940: '1940-02-08', 1941: '1941-01-27', 1942: '1942-02-15', 1943: '1943-02-05',
    1944: '1944-01-25', 1945: '1945-02-13', 1946: '1946-02-02', 1947: '1947-01-22', 1948: '1948-02-10',
    1949: '1949-01-29', 1950: '1950-02-17', 1951: '1951-02-06', 1952: '1952-01-27', 1953: '1953-02-14',
    1954: '1954-02-03', 1955: '1955-01-24', 1956: '1956-02-12', 1957: '1957-01-31', 1958: '1958-02-18',
    1959: '1959-02-08', 1960: '1960-01-28', 1961: '1961-02-15', 1962: '1962-02-05', 1963: '1963-01-25',
    1964: '1964-02-13', 1965: '1965-02-02', 1966: '1966-01-21', 1967: '1967-02-09', 1968: '1968-01-30',
    1969: '1969-02-17', 1970: '1970-02-06', 1971: '1971-01-27', 1972: '1972-02-15', 1973: '1973-02-03',
    1974: '1974-01-23', 1975: '1975-02-11', 1976: '1976-01-31', 1977: '1977-02-18', 1978: '1978-02-07',
    1979: '1979-01-28', 1980: '1980-02-16', 1981: '1981-02-05', 1982: '1982-01-25', 1983: '1983-02-13',
    1984: '1984-02-02', 1985: '1985-02-20', 1986: '1986-02-09', 1987: '1987-01-29', 1988: '1988-02-17',
    1989: '1989-02-06', 1990: '1990-01-27', 1991: '1991-02-15', 1992: '1992-02-04', 1993: '1993-01-23',
    1994: '1994-02-10', 1995: '1995-01-31', 1996: '1996-02-19', 1997: '1997-02-07', 1998: '1998-01-28',
    1999: '1999-02-16', 2000: '2000-02-05', 2001: '2001-01-24', 2002: '2002-02-12', 2003: '2003-02-01',
    2004: '2004-01-22', 2005: '2005-02-09', 2006: '2006-01-29', 2007: '2007-02-18', 2008: '2008-02-07',
    2009: '2009-01-26', 2010: '2010-02-14', 2011: '2011-02-03', 2012: '2012-01-23', 2013: '2013-02-10',
    2014: '2014-01-31', 2015: '2015-02-19', 2016: '2016-02-08', 2017: '2017-01-28', 2018: '2018-02-16',
    2019: '2019-02-05', 2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01', 2023: '2023-01-22',
    2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26',
    2029: '2029-02-13', 2030: '2030-02-03'
};

const getLunarDate = (dateStr: string) => {
    const today = dateStr ? new Date(dateStr) : new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    // Simple Approximation for Stem/Branch (BaZi)
    const baseYear = 1984; // Jia Zi year
    const offset = year - baseYear;
    const stemIndex = (offset % 10 + 10) % 10;
    const branchIndex = (offset % 12 + 12) % 12;
    
    const yearGanZhi = `${STEMS_CANON[stemIndex]}${BRANCHES_CANON[branchIndex]}`;
    return { year: yearGanZhi, fullDate: `${year}年${month}月${day}日` };
};

// --- TEMPERATURE CONTROL ---
// 命理分析需要精準，降低溫度以減少幻覺
const pickTemperature = (type: AnalysisType): number => {
    switch (type) {
        case AnalysisType.CAREER:
        case AnalysisType.WEALTH: 
        case AnalysisType.HEALTH:
        case AnalysisType.YEARLY: // 流年也要準
            return 0.2; // ❄️ 極低溫：接近事實描述，不瞎掰
        case AnalysisType.LOVE:
        case AnalysisType.COMPATIBILITY: 
            return 0.4; // 🌡️ 微溫：允許一點點情感潤飾，但邏輯仍需嚴謹
        default: 
            return 0.3;
    }
};

const getSystemInstruction = (chartText: string = "", isCouple: boolean = false) => {
  const dateInfo = getLunarDate(new Date().toISOString());
  
  return `
**【系統設定：紫微斗數戰略引擎】**
**角色:** **"首席戰略風控官" (Strategic Risk Auditor)**
**任務:** 提供基於「嚴格紫微斗數結構學」的邏輯分析。
**當前時間:** ${dateInfo.fullDate} (${dateInfo.year}年)

**【核心協議 1: 結構優先 (Structure First)】**
* **分析順序:** 宮位結構 (Environment) -> 星曜組合 (Energy) -> 四化流動 (Trigger) -> 結論 (Verdict)。
* **禁止跳躍:** 不可直接跳過「化忌」討論吉象。凡見煞忌，必須優先處理風險評估。

**【核心協議 1.5: 嚴禁造詞 (No Invented Patterns)】**
* **嚴格規定：** 「格局掃描」區塊僅能列出**紫微斗數古籍中記載**的正式格局（如三奇加會、鈴昌羅紋）。
* **禁止發明：** 嚴禁使用「單向輸血格」、「權忌交沖格」、「情緒內耗格」等現代自創詞彙作為格局名稱。若無古籍格局，請直接描述星曜互動（如：權忌交戰），不可加「格」字。
* **未知結構處理：** 若發現命盤結構特殊，但不在經典古籍格局之列，請直接描述其 「幾何結構」（例如：羊陀夾忌、權忌交戰）。

**【核心協議 2: 四化追蹤 (The Flow of Qi)】**
* **祿 (Opportunity):** 緣分起點，機會所在。
* **權 (Action):** 控制、爭執、執行力。
* **科 (Reputation):** 名聲、緩衝、舊情。
* **忌 (Debt/Karma):** 業力引爆點，必須深入分析「沖」與「自化」。
* **規則:** 分析流年或大限時，必須找出「忌沖何宮」，這是風險的核心。

**【核心協議 3: 現代化翻譯 (Contextual Translation)】**
* 將「血光之災」翻譯為「手術、車禍、或精密儀器操作失誤」。
* 將「官非」翻譯為「合約糾紛、法規遵循問題」。
* 將「桃花」翻譯為「人際魅力、異性緣、或公關能力」。

**【核心協議 4: 解讀防偽與因果鎖定 (Causality Lock)】**
* **拒絕巴納姆效應:** 嚴禁輸出「你外表堅強內心柔軟」、「你有潛在的才華」這種放諸四海皆準的廢話。
* **星曜證據法則:** 每一句推論，**必須**在括號內標註來源星曜。
    * ❌ 錯誤範例：「你會發大財。」 (無證據，視為幻覺)
    * ✅ 正確範例：「因財帛宮坐**武曲化祿**，且對宮**貪狼**見**火星**，主爆發性獲利。」 (有證據)
* **拒絕安慰劑:** 若命盤顯示凶象（如大限忌沖命），**必須直言不諱**，直接指出「破產」、「離婚」、「官司」等具體風險，**禁止**使用「稍微不順」、「需要注意」等模糊字眼來粉飾太平。

**【核心協議 5: 吉凶辯證法 (Dialectical Analysis)】**
* **凡吉必有凶:** 當你解讀吉格（如三奇加會）時，**必須**同時指出其「副作用」或「代價」。
    * 例如：「雖有權力（權），但因孤辰入命，恐陷入高處不勝寒的孤獨。」
* **凡凶必有解:** 當你解讀凶格（如鈴昌羅紋）時，**必須**指出其「轉化運用」的可能性。
    * 例如：「雖有文書失誤風險，但若從事除錯（Debug）或稽核工作，可應象化解。」

**【輸入資料】**
${chartText}

**【輸出結構 (Markdown)】**

**1. 格局掃描 (Pattern Recognition):**
*   **【格局名稱】** (證據：...星曜組合...)
    *   *效應：* (簡述)
*   *(若無特殊格局，請分析核心星群結構，勿強行套用格局名)*

**2. 核心命題 (The Core Theme):**
*   (一句話總結目前的命盤狀態，例如「殺破狼動盪變局」或「機月同梁吏人風格」)

**3. 深度推演 (Deep Dive Analysis):**
*   (針對用戶問題或整體運勢進行推演)
*   (必須包含「大限」與「流年」的四化引動分析)
*   (所有結論必須標註星曜證據)

**4. 風險與機遇 (Risks & Opportunities):**
*   ⚠️ **風險警報:** (具體指出化忌沖射的宮位與後果)
*   🚀 **戰略機遇:** (具體指出化祿、化權的運用方向)

**5. 戰略建議 (Strategic Action Plan):**
*   (3點具體可執行的建議，非心靈雞湯)

---
**Note:** Respond in Traditional Chinese (繁體中文). Tone should be professional, rational, slightly cold but extremely precise. No fluff.
`;
};

export const streamAnalysis = async (
  type: AnalysisType, 
  primaryChart: string, 
  secondaryChart: string | null,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal: AbortSignal,
  tier: ModelTier = 'pro'
) => {
  try {
    const isCouple = !!secondaryChart;
    const modelName = tier === 'pro' ? MODELS.pro : MODELS.flash;
    
    // Determine Temperature
    const temperature = pickTemperature(type);

    const prompt = `
      [Analysis Type]: ${type}
      [Mode]: ${isCouple ? 'Couple Compatibility (合盤)' : 'Single Chart (單人)'}
      
      Please analyze the provided Zi Wei Dou Shu chart(s).
    `;

    const systemInstruction = getSystemInstruction(
        `Chart 1: ${primaryChart}\n${isCouple ? `Chart 2: ${secondaryChart}` : ''}`, 
        isCouple
    );

    const response = await ai.models.generateContentStream({
      model: modelName,
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        temperature: temperature, // Using stricter temperature
        topK: 64,
        topP: 0.95,
        maxOutputTokens: 8192,
        systemInstruction: systemInstruction,
      },
    });

    for await (const chunk of response) {
      if (signal.aborted) break;
      const text = chunk.text;
      if (text) onChunk(text);
    }
    
    if (!signal.aborted) onComplete();

  } catch (error: any) {
    if (signal.aborted) return;
    console.error("Gemini API Error:", error);
    if (error.message?.includes('429') || error.message?.includes('quota')) {
        onError("QUOTA_EXCEEDED");
    } else {
        onError(error.message || "Unknown error");
    }
  }
};

export const sendMessageToChat = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  image: { mimeType: string; data: string } | null,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal: AbortSignal,
  tier: ModelTier = 'pro'
) => {
  try {
    const modelName = tier === 'pro' ? MODELS.pro : MODELS.flash;
    
    // Default low temperature for chat to maintain consistency
    const temperature = 0.3; 

    const contents = [...history];
    const userParts: any[] = [{ text: message }];
    
    if (image) {
        userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }
    
    contents.push({ role: 'user', parts: userParts });

    const systemInstruction = getSystemInstruction("", false); // Context is passed in history

    const response = await ai.models.generateContentStream({
      model: modelName,
      contents: contents as any,
      config: {
        temperature: temperature,
        topK: 64,
        topP: 0.95,
        maxOutputTokens: 8192,
        systemInstruction: systemInstruction,
      },
    });

    for await (const chunk of response) {
      if (signal.aborted) break;
      const text = chunk.text;
      if (text) onChunk(text);
    }

    if (!signal.aborted) onComplete();

  } catch (error: any) {
    if (signal.aborted) return;
    console.error("Gemini Chat Error:", error);
    if (error.message?.includes('429') || error.message?.includes('quota')) {
        onError("QUOTA_EXCEEDED");
    } else {
        onError(error.message || "Unknown error");
    }
  }
};
