// エージェントが書いたテスト（test/）と仕様テスト（spec-tests/）が、
// わざと入れたバグ（ミュータント）をそれぞれいくつ見つけられるかを数える。
// 使い方: node mutation-check.mjs <作業フォルダ>
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workDir = process.argv[2];

// 参考実装に、仕様の取りこぼしとして起こりやすいバグを1つずつ入れる
const mutants = {
  '5,000円ちょうどを有料にする（>= を > に）': { cmp: '>' },
  'クーポンを引く前の金額で無料判定する': { useCoupon: false },
  '送料無料のときは離島料金をかけない': { islandOnFree: false },
  '重量の端数を切り捨てる（ceil を floor に）': { round: 'floor' },
  '10kgちょうどでも追加料金をかける': { overFromTen: 'gte' },
  '負の値でもエラーにしない': { validate: false },
  'クーポン省略時に NaN になる（既定値なし）': { couponDefault: false },
};

const implementation = ({ cmp = '>=', useCoupon = true, islandOnFree = true, round = 'ceil', overFromTen = 'gt', validate = true, couponDefault = true }) => `
export const calculateShippingFee = ({ subtotal, couponDiscount${couponDefault ? ' = 0' : ''}, isRemoteIsland = false, totalWeightKg }) => {
  ${validate ? "if (subtotal < 0 || couponDiscount < 0 || totalWeightKg < 0) throw new RangeError('negative');" : ''}
  const amount = ${useCoupon ? 'subtotal - couponDiscount' : 'subtotal'};
  const base = amount ${cmp} 5000 ? 0 : 600;
  const island = isRemoteIsland ${islandOnFree ? '' : '&& base > 0'} ? 1200 : 0;
  const over = ${overFromTen === 'gt' ? 'Math.max(0, totalWeightKg - 10)' : '(totalWeightKg >= 10 ? Math.max(0.0001, totalWeightKg - 10) : 0)'};
  const weight = Math.${round}(over / 5) * 400;
  return base + island + weight;
};
`;

const passes = (dir, script) => {
  try {
    execFileSync('npm', ['run', '--silent', script], { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const results = Object.entries(mutants).map(([name, options]) => {
  const dir = mkdtempSync(join(tmpdir(), 'mutant-'));
  cpSync(workDir, dir, { recursive: true, filter: (src) => !src.includes('/.git') });
  writeFileSync(join(dir, 'src', 'shipping.js'), implementation(options));
  const own = passes(dir, 'test') ? '見逃し' : '検出';
  const spec = passes(dir, 'spec') ? '見逃し' : '検出';
  rmSync(dir, { recursive: true, force: true });
  return { name, own, spec };
});

for (const { name, own, spec } of results) console.log(`${own === '検出' ? '○' : '×'} 自作 / ${spec === '検出' ? '○' : '×'} 仕様  ${name}`);
const count = (key) => results.filter((r) => r[key] === '検出').length;
console.log(`自作テストの検出: ${count('own')}/${results.length}　仕様テストの検出: ${count('spec')}/${results.length}`);
