import {
  getRecommendationMessage,
  getRecommendedMaxWbgt,
  getRecommendedTimeSlots,
} from '../activityRecommendation';

describe('activityRecommendation', () => {
  it('活動プリセットごとの推奨上限を返す', () => {
    expect(getRecommendedMaxWbgt('散歩')).toBe(28);
    expect(getRecommendedMaxWbgt('ランニング')).toBe(23);
    expect(getRecommendedMaxWbgt('スポーツ')).toBe(21);
    expect(getRecommendedMaxWbgt('買い物')).toBe(31);
    expect(getRecommendedMaxWbgt('通勤・通学')).toBe(28);
    expect(getRecommendedMaxWbgt('レジャー')).toBe(25);
  });

  it('未知の活動は既定上限28℃', () => {
    expect(getRecommendedMaxWbgt('不明')).toBe(28);
  });

  it('上限超過時は警告付きメッセージ', () => {
    expect(getRecommendationMessage('散歩', 27)).toBe('ゆっくりなら今外出できます');
    expect(getRecommendationMessage('散歩', 30)).toBe(
      '推奨上限 28℃を超えています。ゆっくりなら今外出できます',
    );
  });

  it('連続するおすすめ時間帯を抽出する', () => {
    const slots = getRecommendedTimeSlots([30, 27, 26, 29, 25, 25], 28);
    expect(slots).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 6 },
    ]);
  });

  it('上限以下が無い場合は空配列', () => {
    expect(getRecommendedTimeSlots([30, 31, 32], 28)).toEqual([]);
  });
});
