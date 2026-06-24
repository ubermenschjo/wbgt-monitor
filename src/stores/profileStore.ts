/**
 * 個人プロフィールの状態管理（consumer 向け閾値補正）。
 */

import { create } from 'zustand';

import {
  getUserProfile,
  saveUserProfile,
  type AgeGroup,
  type HealthCondition,
  type UserProfile,
} from '../services/database';

interface ProfileState extends UserProfile {
  loaded: boolean;
  loadProfile: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  ageGroup: 'general',
  healthCondition: 'none',
  loaded: false,

  loadProfile: async () => {
    const profile = await getUserProfile();
    set({ ...profile, loaded: true });
  },

  updateProfile: async (patch) => {
    const next: UserProfile = {
      ageGroup: patch.ageGroup ?? get().ageGroup,
      healthCondition: patch.healthCondition ?? get().healthCondition,
    };
    set(next);
    await saveUserProfile(next);
  },
}));

export type { AgeGroup, HealthCondition };
