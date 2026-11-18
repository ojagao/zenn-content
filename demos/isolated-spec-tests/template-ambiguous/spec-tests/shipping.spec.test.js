// 仕様テスト（別チームが管理。実装するエージェントには見せない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateShippingFee } from '../src/shipping.js';

const base = { subtotal: 3000, couponDiscount: 0, isRemoteIsland: false, totalWeightKg: 2 };
const fee = (override) => calculateShippingFee({ ...base, ...override });

test('小計5,000円未満は基本送料600円', () => assert.equal(fee({ subtotal: 4999 }), 600));
test('小計ちょうど5,000円は送料無料', () => assert.equal(fee({ subtotal: 5000 }), 0));
test('クーポン適用後に5,000円を下回ったら有料', () => assert.equal(fee({ subtotal: 5200, couponDiscount: 300 }), 600));
test('クーポンを省略したら0円扱い', () => assert.equal(calculateShippingFee({ subtotal: 5000, totalWeightKg: 1 }), 0));
test('離島は+1,200円', () => assert.equal(fee({ isRemoteIsland: true }), 1800));
test('送料無料でも離島料金はかかる', () => assert.equal(fee({ subtotal: 8000, isRemoteIsland: true }), 1200));
test('10kgちょうどは重量の追加なし', () => assert.equal(fee({ totalWeightKg: 10 }), 600));
test('10kgを少しでも超えたら+400円', () => assert.equal(fee({ totalWeightKg: 10.1 }), 1000));
test('15kgちょうどは+400円', () => assert.equal(fee({ totalWeightKg: 15 }), 1000));
test('15kgを少しでも超えたら+800円', () => assert.equal(fee({ totalWeightKg: 15.1 }), 1400));
test('全部のせ（無料・離島・重量）', () => assert.equal(fee({ subtotal: 9000, isRemoteIsland: true, totalWeightKg: 21 }), 2400));
test('負の小計はRangeError', () => assert.throws(() => fee({ subtotal: -1 }), RangeError));
test('負のクーポンはRangeError', () => assert.throws(() => fee({ couponDiscount: -1 }), RangeError));
test('負の重量はRangeError', () => assert.throws(() => fee({ totalWeightKg: -0.1 }), RangeError));
