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

/** getCurrentPositionAsync の最大リトライ回数（初回含む）。 */
const POSITION_MAX_ATTEMPTS = 3;

/** リトライ間隔（ミリ秒）。 */
const POSITION_RETRY_DELAY_MS = 1000;

/** 1 回の位置取得タイムアウト（ミリ秒）。 */
const POSITION_TIMEOUT_MS = 8000;

/** 逆ジオコーディングのタイムアウト（ミリ秒）。 */
const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

/** 指定ミリ秒だけ待機する。 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Promise にタイムアウトを付与する。 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => null),
  ]);
}

/**
 * getCurrentPositionAsync を短い間隔でリトライする。
 * iOS シミュレーター等で一時的に kCLErrorLocationUnknown が出る場合に対応。
 */
async function tryGetCurrentPosition(): Promise<Location.LocationObject | null> {
  for (let attempt = 0; attempt < POSITION_MAX_ATTEMPTS; attempt++) {
    try {
      const position = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        POSITION_TIMEOUT_MS,
      );
      if (position) return position;
    } catch {
      // 次のリトライへ
    }
    if (attempt < POSITION_MAX_ATTEMPTS - 1) {
      await delay(POSITION_RETRY_DELAY_MS);
    }
  }
  return null;
}

/**
 * キャッシュ済みの最終既知位置を取得する。
 */
async function tryGetLastKnownPosition(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getLastKnownPositionAsync();
  } catch {
    return null;
  }
}

/** 座標から LocationInfo を組み立てる。 */
async function buildLocationInfo(
  latitude: number,
  longitude: number,
): Promise<LocationInfo> {
  const placeName = await reverseGeocode(latitude, longitude);
  return { latitude, longitude, placeName };
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

  const position =
    (await tryGetCurrentPosition()) ?? (await tryGetLastKnownPosition());

  if (!position) {
    return { ...DEFAULT_SETTINGS.fallbackLocation };
  }

  const { latitude, longitude } = position.coords;
  return buildLocationInfo(latitude, longitude);
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
    const results = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      REVERSE_GEOCODE_TIMEOUT_MS,
    );
    if (!results) return null;

    const place = results[0];
    if (!place) return null;

    // 市区町村 > 地区 > 都道府県 > 都市 の順で日本語地名を優先する。
    return place.city ?? place.district ?? place.region ?? place.subregion ?? null;
  } catch {
    return null;
  }
}
