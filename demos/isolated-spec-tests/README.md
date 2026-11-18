# Isolated Specification Tests の実験デモ

記事「AIがテストに合わせて実装していない？仕様テストを隠して確かめる」で使ったデモです。

> **注意**：`run-experiment.sh` と `probe-bypass.sh` は、中で `claude -p`（Claude Code）を実行します。
> 動かすと、その分だけ Claude Code の利用枠（API で使っている場合は料金）がかかります。

## 中身

| ファイル | 内容 |
|---|---|
| `template/` | 送料計算の仕様書（SPEC.md）と、エージェントに見せない仕様テスト（spec-tests/） |
| `template-ambiguous/` | 仕様書の重量のルールを曖昧にした版 |
| `settings/` | 条件ごとの `.claude/settings.json`（open：隔離なし／deny：権限ルール／deny-sandbox：権限ルール＋サンドボックス） |
| `run-experiment.sh` | 条件ごとに Claude Code に実装させ、仕様テストをエージェントの外で実行する |
| `probe-bypass.sh` | 4通りの方法で spec-tests を読ませ、どれが止まるかを確かめる |
| `mutation-check.mjs` | わざとバグを入れた実装で、自作テストと仕様テストがそれぞれ気づくかを数える（Claude Code は使わない） |

## 使い方

```bash
./run-experiment.sh ./out open deny deny-sandbox
TEMPLATE=template-ambiguous RUN_SUFFIX=-1 ./run-experiment.sh ./out open deny-sandbox
./probe-bypass.sh ./out deny deny-sandbox
node mutation-check.mjs ./out/open
```

確認した環境：macOS、Claude Code 2.1.326、Node.js 24
