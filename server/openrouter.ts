import type { Job, CompatibilityResult, HHJob } from "@shared/schema";

// ================================
// GLOBAL DEBUG PROMPT STORAGE
// ================================
let LAST_DEBUG_PROMPT = "";
export function getLastOpenRouterPrompt(): string {
  return LAST_DEBUG_PROMPT;
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ================================
// MAIN GENERATOR
// ================================
export async function generateCoverLetter(resume: string, vacancy: Job): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not found");
    return fallbackLetter(vacancy);
  }

  // ================================
  // BUILD VACANCY BLOCK (полный, как в GigaChat)
  // ================================
  const vacancyBlock = `
=== ВАКАНСИЯ НАЧАЛО ===
Название вакансии: ${vacancy.title}
Компания: ${vacancy.company}
Зарплата: ${vacancy.salary || "—"}
Краткое описание / обязанности:
${vacancy.description || "—"}
Ключевые теги/направления:
${(vacancy.tags && vacancy.tags.length) ? vacancy.tags.join(", ") : "—"}
=== ВАКАНСИЯ КОНЕЦ ===
`.trim();

  // ================================
  // MAIN PROMPT — 100% КОПИЯ GIGACHAT
  // ================================
  const prompt = `
Ты пишешь короткое, содержательное сопроводительное письмо под КОНКРЕТНУЮ вакансию, строго опираясь на резюме кандидата.

Тебе даны два блока:
1) ВАКАНСИЯ — требования, задачи, контекст роли.
2) РЕЗЮМЕ — опыт кандидата.

Твоя задача:
1) Внимательно прочитай ВАКАНСИЮ и вытащи 3–7 ключевых требований и задач (желаемый опыт, тип проектов, инструменты, уровень ответственности).
2) Затем прочитай РЕЗЮМЕ и найди ТОЛЬКО те факты, кейсы, навыки и результаты, которые максимально соответствуют этим требованиям.
3) На основе этого напиши сопроводительное письмо так, чтобы было видно:
   — кандидат реально делал похожие вещи;
   — его опыт и результаты бьются с задачами вакансии;
   — он понимает, какой вклад может внести.

Жёсткие правила:
1) НЕЛЬЗЯ придумывать факты, достижения, цифры, компании, навыки, опыт. Только то, что есть в резюме.
2) Нельзя использовать информацию, отсутствующую в РЕЗЮМЕ.
3) Если в резюме нет цифр — не используй цифры.
4) Только plain-text. Без markdown, *, #, -, _, списков и заголовков.
5) Не использовать обращения ("уважаемый", "меня зовут", "добрый день" и т.п.).
6) Не упоминать название компании и название вакансии в тексте письма.
7) Пиши коротко, профессионально и по делу, максимум в 3–5 предложений.
8) Фокусируйся на самом свежем и релевантном опыте (последние 2–3 года). Старый опыт используй только если он напрямую попадает в требования вакансии.
9) Не используй в письме точное название должности/профессии из резюме.
10) Не пиши фразы вроде "готов обсудить", "буду рад стать частью команды", "буду рад обсудить детали".
11) Пиши письмо от моего лица ("Имею опыт...", "Занимался..."), не от третьего лица.

Структура письма:
1) Одно короткое предложение, которое описывает профиль кандидата и его релевантный фокус.
2) 1–3 предложения с конкретными примерами опыта.
3) Одно короткое завершающее предложение, почему кандидат полезен.

Единственные источники информации:

${vacancyBlock}

=== РЕЗЮМЕ НАЧАЛО ===
${resume}
=== РЕЗЮМЕ КОНЕЦ ===

Выведи только текст сопроводительного письма, без пояснений.
`.trim();

  // Save debug prompt
  LAST_DEBUG_PROMPT = prompt;

  // ================================
  // CALL OPENROUTER
  // ================================
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jobswiper.ru",
        "X-Title": "JobSwipe"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: "Ты — эксперт по созданию сопроводительных писем. Строго следуй правилам пользователя."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 700
      })
    });

    if (!response.ok) {
      console.error("OpenRouter API error:", response.status, await response.text());
      return fallbackLetter(vacancy);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) return fallbackLetter(vacancy);

    return sanitize(text.trim());
  } catch (err) {
    console.error("OpenRouter CALL ERROR:", err);
    return fallbackLetter(vacancy);
  }
}

// ================================
// REMOVE markdown symbols (как у GigaChat)
// ================================
function sanitize(text: string): string {
  return text.replace(/[*#_\-]/g, " ").replace(/\s+/g, " ").trim();
}

// ================================
// FALLBACK
// ================================
function fallbackLetter(_vacancy: Job): string {
  return `
Имею релевантный опыт работы и занимался развитием маркетинговых и продуктовых направлений. Работал с аналитикой, гипотезами, процессами и улучшением метрик.

Мой опыт и навыки позволяют закрывать задачи по развитию продукта и маркетинговых направлений.
`.trim();
}

// ================================
// AI COMPATIBILITY CALCULATION
// ================================

interface CompatibilityResponse {
  score: number;
  explanation: string;
}

function scoreToColor(score: number): "green" | "yellow" | "red" {
  if (score >= 75) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

export async function calculateCompatibility(
  resume: string,
  vacancy: Job | HHJob
): Promise<CompatibilityResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const vacancyId = String("id" in vacancy ? vacancy.id : "");

  if (!apiKey || !resume || resume.trim().length < 50) {
    return {
      vacancyId,
      score: 50,
      color: "yellow",
      explanation: "Недостаточно данных для анализа совместимости.",
    };
  }

  const vacancyBlock = `
Название: ${vacancy.title}
Компания: ${vacancy.company}
Зарплата: ${vacancy.salary || "—"}
Описание: ${vacancy.description || "—"}
Теги: ${(vacancy.tags && vacancy.tags.length) ? vacancy.tags.join(", ") : "—"}
`.trim();

  const prompt = `
Проанализируй РЕЗЮМЕ и ВАКАНСИЮ, оцени степень совместимости кандидата с вакансией по шкале 0–100%.

Критерии оценки:
- Совпадение навыков и технологий
- Релевантность опыта работы
- Соответствие уровня позиции
- Отраслевой опыт

Основывайся ТОЛЬКО на информации из резюме. Не придумывай факты.

=== ВАКАНСИЯ ===
${vacancyBlock}

=== РЕЗЮМЕ ===
${resume.slice(0, 3000)}

Верни ТОЛЬКО валидный JSON без markdown:
{"score": <число 0-100>, "explanation": "<1-2 предложения почему такой score>"}
`.trim();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jobswiper.ru",
        "X-Title": "JobSwipe"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: "Ты — HR-аналитик. Отвечай ТОЛЬКО JSON: {\"score\": число, \"explanation\": \"текст\"}"
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      console.error("[Compatibility] OpenRouter error:", response.status);
      return { vacancyId, score: 50, color: "yellow", explanation: "Ошибка анализа." };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed: CompatibilityResponse = JSON.parse(jsonMatch[0]);
        const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
        const color = scoreToColor(score);
        const explanation = sanitize(parsed.explanation || "Анализ выполнен.");
        return { vacancyId, score, color, explanation };
      } catch (parseErr) {
        console.log("[Compatibility] JSON parse failed, trying fallback extraction");
      }
    }

    // Fallback: extract score from text using regex
    const scoreMatch = text.match(/["']?score["']?\s*[:=]\s*(\d+)/i) || 
                       text.match(/(\d{1,3})\s*[%％]/) ||
                       text.match(/совместимость[^\d]*(\d{1,3})/i) ||
                       text.match(/оценк[аи][^\d]*(\d{1,3})/i);
    
    if (scoreMatch) {
      const score = Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10)));
      const color = scoreToColor(score);
      
      // Try to extract explanation
      const explMatch = text.match(/["']?explanation["']?\s*[:=]\s*["']([^"']+)["']/i) ||
                        text.match(/потому что[:\s]*(.+?)(?:\.|$)/i) ||
                        text.match(/так как[:\s]*(.+?)(?:\.|$)/i);
      const explanation = explMatch ? sanitize(explMatch[1]) : "Анализ на основе навыков и опыта.";
      
      return { vacancyId, score, color, explanation };
    }

    console.error("[Compatibility] Could not extract score from:", text.slice(0, 200));
    return { vacancyId, score: 50, color: "yellow", explanation: "Не удалось извлечь оценку совместимости." };
  } catch (err) {
    console.error("[Compatibility] Error:", err);
    return { vacancyId, score: 50, color: "yellow", explanation: "Ошибка при расчёте совместимости." };
  }
}
