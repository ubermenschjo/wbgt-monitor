/**
 * アプリアイコン・スプラッシュ画像を SVG から生成するスクリプト。
 * sharp で SVG 文字列を PNG に変換し、biz / consumer 両フレーバー分を出力する。
 *
 *   npx tsx scripts/generate-assets.ts
 */
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '..');

// ---- フレーバー定義 ----------------------------------------------------------
type Flavor = 'biz' | 'consumer';

const SPLASH_W = 1284;
const SPLASH_H = 2778;
const ICON = 1024;

// ---- 共通パーツ --------------------------------------------------------------

/** biz: 白い体温計（中央）＋ 盾＋チェックマークのバッジ */
function bizIconGroup(): string {
  // 体温計（チューブ＋球部）
  const tube = `
    <rect x="467" y="250" width="90" height="470" rx="45" fill="#ffffff" />
    <circle cx="512" cy="760" r="98" fill="#ffffff" />
    <rect x="487" y="430" width="50" height="320" rx="25" fill="#1a237e" />
    <circle cx="512" cy="760" r="62" fill="#1a237e" />
  `;
  // 盾（右上）＋チェックマーク
  const sx = 690;
  const stop = 250;
  const sw = 150;
  const sh = 230;
  const shield = `
    <path d="
      M ${sx - sw} ${stop}
      L ${sx + sw} ${stop}
      L ${sx + sw} ${stop + sh * 0.45}
      Q ${sx + sw} ${stop + sh * 0.85} ${sx} ${stop + sh}
      Q ${sx - sw} ${stop + sh * 0.85} ${sx - sw} ${stop + sh * 0.45}
      Z" fill="#ffffff" />
    <path d="M ${sx - 70} ${stop + 95} L ${sx - 18} ${stop + 145} L ${sx + 78} ${stop + 50}"
      fill="none" stroke="#1a237e" stroke-width="34"
      stroke-linecap="round" stroke-linejoin="round" />
  `;
  return tube + shield;
}

/** consumer: 白い太陽（左上）＋ 水滴（右下） */
function consumerIconGroup(): string {
  const sunCx = 415;
  const sunCy = 415;
  const sunR = 150;
  const rays: string[] = [];
  const rayCount = 12;
  for (let i = 0; i < rayCount; i++) {
    const a = (i / rayCount) * Math.PI * 2;
    const inner = sunR + 34;
    const outer = sunR + 110;
    const x1 = sunCx + Math.cos(a) * inner;
    const y1 = sunCy + Math.sin(a) * inner;
    const x2 = sunCx + Math.cos(a) * outer;
    const y2 = sunCy + Math.sin(a) * outer;
    rays.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffffff" stroke-width="36" stroke-linecap="round" />`,
    );
  }
  const sun = `
    <circle cx="${sunCx}" cy="${sunCy}" r="${sunR}" fill="#ffffff" />
    ${rays.join('\n    ')}
  `;
  // 水滴（先端が上、丸い底）
  const dCx = 705;
  const dCy = 720;
  const dw = 170;
  const dh = 205;
  const drop = `
    <path d="
      M ${dCx} ${dCy - dh}
      C ${dCx + dw} ${dCy - dh * 0.2} ${dCx + dw} ${dCy + dh * 0.55} ${dCx} ${dCy + dh}
      C ${dCx - dw} ${dCy + dh * 0.55} ${dCx - dw} ${dCy - dh * 0.2} ${dCx} ${dCy - dh}
      Z" fill="#ffffff" />
  `;
  return sun + drop;
}

function bizBackground(w: number, h: number): string {
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="#1a237e" />`;
}

function consumerBackground(w: number, h: number): string {
  return `
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FF6B35" />
        <stop offset="100%" stop-color="#FFB347" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#grad)" />
  `;
}

// ---- 各画像の SVG 組み立て ---------------------------------------------------

/** アイコン（1024x1024 フルブリード） */
function iconSvg(flavor: Flavor): string {
  const bg = flavor === 'biz' ? bizBackground(ICON, ICON) : consumerBackground(ICON, ICON);
  const motif = flavor === 'biz' ? bizIconGroup() : consumerIconGroup();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}" viewBox="0 0 ${ICON} ${ICON}">
    ${bg}
    ${motif}
  </svg>`;
}

/** Android アダプティブアイコン（中央 66% セーフエリアにモチーフを収める） */
function adaptiveIconSvg(flavor: Flavor): string {
  const bg = flavor === 'biz' ? bizBackground(ICON, ICON) : consumerBackground(ICON, ICON);
  const motif = flavor === 'biz' ? bizIconGroup() : consumerIconGroup();
  // モチーフは 1024 座標系で描いているので、中心基準で 0.66 倍に縮小してパディングを確保。
  const scale = 0.66;
  const offset = (ICON * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}" viewBox="0 0 ${ICON} ${ICON}">
    ${bg}
    <g transform="translate(${offset} ${offset}) scale(${scale})">
      ${motif}
    </g>
  </svg>`;
}

/** スプラッシュ（1284x2778, iPhone 14 Pro Max） */
function splashSvg(flavor: Flavor): string {
  const bg =
    flavor === 'biz' ? bizBackground(SPLASH_W, SPLASH_H) : consumerBackground(SPLASH_W, SPLASH_H);
  const motif = flavor === 'biz' ? bizIconGroup() : consumerIconGroup();
  const title = flavor === 'biz' ? '熱中症レコーダー Pro' : '熱中症アラート';
  // モチーフ(1024座標系) を中央上寄りに配置。
  const motifSize = 560;
  const motifX = (SPLASH_W - motifSize) / 2;
  const motifY = SPLASH_H * 0.32;
  const motifScale = motifSize / ICON;
  const textY = motifY + motifSize + 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_W}" height="${SPLASH_H}" viewBox="0 0 ${SPLASH_W} ${SPLASH_H}">
    ${bg}
    <g transform="translate(${motifX} ${motifY}) scale(${motifScale})">
      ${motif}
    </g>
    <text x="${SPLASH_W / 2}" y="${textY}" text-anchor="middle"
      font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans CJK JP, sans-serif"
      font-size="96" font-weight="700" fill="#ffffff">${title}</text>
  </svg>`;
}

// ---- 出力 --------------------------------------------------------------------

async function render(svg: string, outPath: string): Promise<void> {
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`✓ ${path.relative(ROOT, outPath)}`);
}

async function main(): Promise<void> {
  const flavors: Flavor[] = ['biz', 'consumer'];
  for (const flavor of flavors) {
    const dir = path.join(ROOT, 'assets', flavor);
    await render(iconSvg(flavor), path.join(dir, 'icon.png'));
    await render(adaptiveIconSvg(flavor), path.join(dir, 'adaptive-icon.png'));
    await render(splashSvg(flavor), path.join(dir, 'splash.png'));
  }
  console.log('完了: 全 6 ファイルを生成しました。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
