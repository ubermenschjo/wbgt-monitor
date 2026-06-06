/**
 * expo-location のラッパー。
 *
 * 位置情報の権限要求・現在地取得・逆ジオコーディング（地名取得）を提供する。
 * 地名は日本語表記を優先して返す。
 */

import * as Location from 'expo-location';

import { DEFAULT_SETTINGS } from '../utils/constants';

/** 位置情報（座標と地名）。 */
export interface LocationInfo {
  latitude: number;
  longitude: number;
  /** 逆ジオコーディングで得た地名（日本語優先）。取得失敗時は null。 */
  placeName: string | null;
}

/**
 * 位置情報（前景）の権限を要求する。
 *
 * @returns 権限が許可された場合は true
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * 現在地の座標と地名を取得する。
 *
 * 権限が無い場合や取得に失敗した場合は、フォールバック座標（東京駅）を返す。
 *
 * @returns 現在地の位置情報
 */
export async function getCurrentLocation(): Promise<LocationInfo> {
  const granted = await requestLocationPermission();
  if (!granted) {
    return { ...DEFAULT_SETTINGS.fallbackLocation };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = position.coords;
  const placeName = await reverseGeocode(latitude, longitude);

  return { latitude, longitude, placeName };
}

/**
 * 座標から地名（日本語）を逆ジオコーディングする。
 *
 * 市区町村レベルを優先し、取得できない場合は上位の地域名へフォールバックする。
 *
 * @param latitude 緯度
 * @param longitude 経度
 * @returns 地名。取得できない場合は null
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = results[0];
    if (!place) return null;

    // 市区町村 > 地区 > 都道府県 > 都市 の順で日本語地名を優先する。
    return place.city ?? place.district ?? place.region ?? place.subregion ?? null;
  } catch {
    return null;
  }
}
