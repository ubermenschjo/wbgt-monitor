import { getEffectiveThreshold } from '../thresholdUtils';

describe('getEffectiveThreshold', () => {
  const base = 28;

  it('一般・既往なしは補正なし', () => {
    expect(
      getEffectiveThreshold(base, { ageGroup: 'general', healthCondition: 'none' }),
    ).toBe(28);
  });

  it('こどもは+2℃', () => {
    expect(
      getEffectiveThreshold(base, { ageGroup: 'child', healthCondition: 'none' }),
    ).toBe(30);
  });

  it('高齢は-2℃', () => {
    expect(
      getEffectiveThreshold(base, { ageGroup: 'elderly', healthCondition: 'none' }),
    ).toBe(26);
  });

  it('既往「その他」は-1℃', () => {
    expect(
      getEffectiveThreshold(base, { ageGroup: 'general', healthCondition: 'other' }),
    ).toBe(27);
  });

  it('高齢+その他は累積補正', () => {
    expect(
      getEffectiveThreshold(base, { ageGroup: 'elderly', healthCondition: 'other' }),
    ).toBe(25);
  });

  it('心疾患・高血圧は補正なし（PRDどおり）', () => {
    expect(
      getEffectiveThreshold(base, { ageGroup: 'general', healthCondition: 'heart' }),
    ).toBe(28);
    expect(
      getEffectiveThreshold(base, {
        ageGroup: 'general',
        healthCondition: 'hypertension',
      }),
    ).toBe(28);
  });
});
