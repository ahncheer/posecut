// 앱에서 쓰는 Gemini 호출 (컷 편집 엔진의 'AI 연결'과 같은 키·한도·사용량을 같이 쓴다).
// 키는 이 브라우저의 localStorage에만 있고, 파일·서버·코드에는 남기지 않는다.
const KEY_STORE = 'rough.geminiKey', LIMIT_STORE = 'rough.aiLimitKRW', USAGE_STORE = 'rough.aiUsage';
const MODEL = 'gemini-2.5-flash';
// 1토큰당 달러 (Google 공개 가격 기준 Gemini 2.5 Flash: 입력 $0.30/1M, 출력 $2.50/1M)
const PRICE = { in: 0.30 / 1e6, out: 2.50 / 1e6 }, KRW_PER_USD = 1400;

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 저장소를 못 쓰는 환경 */ } };
const monthId = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; };

export const hasGeminiKey = () => !!get(KEY_STORE);
export function saveGeminiKey(key: string) { set(KEY_STORE, key.trim()); }

function usage(): { month: string; krw: number; calls: number } {
  try { const u = JSON.parse(get(USAGE_STORE) || 'null'); if (u && u.month === monthId()) return u; } catch { /* 처음 */ }
  return { month: monthId(), krw: 0, calls: 0 };
}

/** 그림 한 장 + 요청문 → 글자 답 (JSON으로 받기). estimateKrw: 한도 확인용 예상 비용 */
export async function geminiImageJSON(prompt: string, imageDataUrl: string, estimateKrw = 6): Promise<string> {
  const key = get(KEY_STORE);
  if (!key) throw new Error('Gemini API 키가 없어요. 아래에 키를 넣거나, "AI에게 줄 요청문 복사"로 다른 AI에 물어봐 주세요.');
  const limit = Number(get(LIMIT_STORE) ?? '1000');
  const u = usage();
  if (Number.isFinite(limit) && u.krw + estimateKrw > limit) throw new Error(`이번 달 AI 한도(${Math.round(limit)}원)를 넘게 돼서 멈췄어요. 컷 편집 → AI → "AI 연결"에서 한도를 올릴 수 있어요.`);
  const m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(imageDataUrl);
  if (!m) throw new Error('그림을 읽지 못했어요.');
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
  } catch { throw new Error('인터넷 연결을 확인해 주세요. AI 서버에 닿지 못했어요.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(`키가 올바르지 않거나 이 기능을 쓸 권한이 없어요. (${msg})`);
    if (res.status === 429) throw new Error('요청이 너무 많거나 무료 한도를 넘었어요. 잠시 뒤 다시 해 주세요.');
    throw new Error(`AI 요청이 실패했어요. (${msg})`);
  }
  const um = data.usageMetadata || {};
  const krw = ((um.promptTokenCount || 0) * PRICE.in + ((um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0)) * PRICE.out) * KRW_PER_USD;
  set(USAGE_STORE, JSON.stringify({ month: u.month, krw: u.krw + krw, calls: u.calls + 1 }));
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text || '').join('');
  if (!text) throw new Error('AI가 빈 답을 줬어요. 다시 해 주세요.');
  return text;
}

/** 큰 그림은 줄여서 보낸다 (긴 변 maxSide px, JPEG) */
export async function shrinkImage(file: File, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('그림 파일을 열지 못했어요.')); img.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  } finally { URL.revokeObjectURL(url); }
}
