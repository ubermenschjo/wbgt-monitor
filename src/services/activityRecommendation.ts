/**
 * 活動別 WBGT 推奨上限（環境省ガイドライン + 運動強度を簡易反映）。
 */

const ACTIVITY_MAX_WBGT: Record<string, number> = {
  散歩: 28,
  ランニング: 23,
  スポーツ: 21,
  買い物: 31,
  '通勤・通学': 28,
  レジャー: 25,
};

const DEFAULT_MAX_WBGT = 28;

const MESSAGES_BELOW: Record<string, string> = {
  散歩: 'ゆっくりなら今外出できます',
  ランニング: '走るのは控えましょう',
  スポーツ: '屋外スポーツは危険です',
  買い物: '短時間なら大丈夫ですが水分を',
  '通勤・通学': '日陰を選んでください',
  レジャー: '活動内容に応じて休憩を',
};

export type RecommendedTimeSlot = { start: number; end: number };

export function getRecommendedMaxWbgt(activity: string): number {
  return ACTIVITY_MAX_WBGT[activity] ?? DEFAULT_MAX_WBGT;
}

export function getRecommendationMessage(activity: string, currentWbgt: number): string {
  const max = getRecommendedMaxWbgt(activity);
  const base = MESSAGES_BELOW[activity] ?? '暑さに注意して外出してください';
  if (currentWbgt <= max) {
    return base;
  }
  return `推奨上限 ${max}℃を超えています。${base}`;
}

/** 連続して上限以下の時間帯（インデックス範囲、end は排他的）を返す。 */
export function getRecommendedTimeSlots(
  hourlyWbgt: number[],
  maxWbgt: number,
): RecommendedTimeSlot[] {
  const slots: RecommendedTimeSlot[] = [];
  let start: number | null = null;

  hourlyWbgt.forEach((wbgt, index) => {
    if (wbgt <= maxWbgt) {
      if (start === null) start = index;
    } else if (start !== null) {
      slots.push({ start, end: index });
      start = null;
    }
  });

  if (start !== null) {
    slots.push({ start, end: hourlyWbgt.length });
  }

  return slots;
}
