# 送料計算の仕様

`src/shipping.js` から `calculateShippingFee(order)` を export する。

## 入力

```js
{
  subtotal: number,        // 商品の小計（円、税込）
  couponDiscount: number,  // クーポンの割引額（円）。省略時は 0
  isRemoteIsland: boolean, // 離島への配送か。省略時は false
  totalWeightKg: number,   // 荷物の合計重量（kg）
}
```

## ルール

1. 基本送料は 600 円。ただし、クーポン適用後の金額（subtotal - couponDiscount）が 5,000 円以上なら基本送料は 0 円。
2. 離島への配送は、基本送料に 1,200 円を加える。基本送料が 0 円のときも加える。
3. 合計重量が 10kg を超える場合、10kg を超えた分について、5kg ごとに 400 円を加える（5kg に満たない端数も 5kg として数える）。
4. 返り値は送料（円、整数）。
5. subtotal・couponDiscount・totalWeightKg が負の数のときは RangeError を投げる。
