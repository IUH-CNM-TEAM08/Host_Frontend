/**
 * useTranslateMessage
 * Dịch tự động tin nhắn không phải tiếng Việt sang tiếng Việt.
 * Dùng Google Translate unofficial API (miễn phí, không cần API key).
 *
 * Cách dùng:
 *   const { translation, isTranslating } = useTranslateMessage(msg.content, msg.type);
 */

import { useEffect, useRef, useState } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tách ngôn ngữ nguồn từ response Google Translate.
 * response[2] = detected language code (e.g. "en", "zh", "vi")
 */
function parseGoogleTranslate(data: any[]): { translatedText: string; detectedLang: string } {
  let translatedText = '';
  if (Array.isArray(data[0])) {
    for (const segment of data[0]) {
      if (Array.isArray(segment) && typeof segment[0] === 'string') {
        translatedText += segment[0];
      }
    }
  }
  const detectedLang = typeof data[2] === 'string' ? data[2] : 'und';
  return { translatedText: translatedText.trim(), detectedLang };
}

// Cache để tránh re-fetch cùng 1 đoạn text
const translationCache = new Map<string, string>();

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTranslateMessage(content: string, type: string, isSender: boolean) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Chỉ dịch tin nhắn NHẬN được (không dịch tin mình gửi)
    if (isSender) {
      setTranslation(null);
      return;
    }

    // Chỉ dịch text message (MessageType.TEXT = "text")
    if (type !== 'text') return;

    const text = (content || '').trim();

    // Bỏ qua: rỗng, quá ngắn (1 ký tự), hoặc là link
    if (!text || text.length < 2 || text.startsWith('http')) return;

    // Check cache
    if (translationCache.has(text)) {
      const cached = translationCache.get(text)!;
      setTranslation(cached || null);
      return;
    }

    setIsTranslating(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const url =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx&sl=auto&tl=vi&dt=t&dt=ld&q=${encodeURIComponent(text)}`;

    fetch(url, { signal: abortRef.current.signal })
      .then((res) => res.json())
      .then((data: any[]) => {
        const { translatedText, detectedLang } = parseGoogleTranslate(data);

        // Nếu ngôn ngữ phát hiện là tiếng Việt → không cần dịch
        if (detectedLang === 'vi') {
          translationCache.set(text, '');
          setTranslation(null);
          return;
        }

        // Nếu bản dịch giống với bản gốc (trường hợp không dịch được) → bỏ qua
        if (!translatedText || translatedText.toLowerCase() === text.toLowerCase()) {
          translationCache.set(text, '');
          setTranslation(null);
          return;
        }

        translationCache.set(text, translatedText);
        setTranslation(translatedText);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.warn('[Translate] Error:', err?.message);
        }
      })
      .finally(() => {
        setIsTranslating(false);
      });

    return () => {
      abortRef.current?.abort();
    };
  }, [content, type, isSender]);

  return { translation, isTranslating };
}
