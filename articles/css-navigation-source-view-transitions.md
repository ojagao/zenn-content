---
title: "【CSSだけ】遷移時に共通の画像をシームレスに見せる"
emoji: "🍇"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["css", "viewtransitions", "html", "frontend", "chrome"]
published: true
published_at: "2026-11-10 08:00"
---

## はじめに

Chrome 156で `:navigation-source` という疑似クラスが追加されたので、実際に触ってみました。

一覧ページのカードをクリックしたら、そのカードの画像が詳細ページの大きな画像へつながっていく、というよくある演出があると思います。これまではどのカードがクリックされたのかをJavaScriptで判断する必要がありましたが、`:navigation-source` を使うとCSSだけで書けるみたいです。

架空のECサイトのデモを作って試してみると、行きの遷移はCSSの数行で動きました。ただ、戻る遷移やCodeSandboxでの動作確認でいくつかハマったので、その過程も残しておこうと思います。

:::message
`:navigation-source` は、現時点（2026年11月）ではChrome 156以降のみの対応です。
:::

## 先に完成品

先に完成品です。商品をクリックすると、商品の画像と商品名が詳細ページの位置へつながるように変形します。Chromeで開いてみてください。

@[codesandbox](https://codesandbox.io/embed/wrnr9w?view=preview)

#### 環境

・macOS

・Google Chrome 157.0.8103.39

・CodeSandbox（ビルドなし、HTML・CSS・JavaScriptのみ）

## :navigation-sourceとは

簡単に言うと、ページ遷移のきっかけになった要素にマッチする疑似クラスです。

リンク（`<a>`）、ボタン、フォームなど、遷移を始めた要素が対象で、遷移している間はその要素にマッチし続けます。仕様（CSS Navigation Module Level 1）では、Navigation APIの `NavigateEvent.sourceElement` と同じ要素を指すものとして定義されています。

https://drafts.csswg.org/css-navigation-1/#navigation-source-pseudo-class

Chromeの実装時の告知（Intent to Ship）では、View Transitionsでの利用が主な動機だと書かれていました。

https://chromestatus.com/feature/6327898878377984

## 実装

まず、ページをまたぐView Transitions（cross-document view transitions）のおさらいです。遷移元と遷移先で同じ `view-transition-name` が付いた要素同士を、ブラウザがつなげてアニメーションしてくれます。

ただ、一覧には商品が6つ並んでいるのに、名前を付けていいのはクリックした1つだけです。同じ名前が複数の要素に付いているとトランジションが動かないので、これまではクリックされたカードをJavaScriptで判断して名前を付ける必要がありました。ここを `:navigation-source` で置き換えてみます。

↓ 各ページの `head` に書く、ページ遷移のView Transitionを有効にする宣言（理由は後述します）

```html
<style>
  @view-transition {
    navigation: auto;
  }
</style>
<link rel="stylesheet" href="style.css">
```

↓ 一覧ページ・詳細ページ共通のCSS

```css
/* 一覧ページ：クリックされたリンク（遷移のきっかけ）の中の画像と商品名にだけ名前を付ける */
a:navigation-source .thumb {
  view-transition-name: product-image;
}

a:navigation-source .name {
  view-transition-name: product-name;
}

/* 詳細ページ：対応する要素に同じ名前を付けると、一覧のカードから変形していくように見える */
.hero-img {
  view-transition-name: product-image;
}

.detail-name {
  view-transition-name: product-name;
}
```

これだけで、クリックした商品の画像と商品名が詳細ページへつながるようになりました。JavaScriptは1行も書いていません。

実際に、遷移の直前（`pageswap` イベントの時点）でどの要素に名前が付いているかを調べてみました。すると、クリックしたカードの画像と商品名にだけ `product-image` と `product-name` が付いていました。

## ハマったこと1：戻るときは画像がつながらない

行きはうまくいったのですが、詳細ページから一覧に戻ると、大きな画像がカードに縮んで戻らず、その場でふわっと消えるだけでした。

#### 原因

`:navigation-source` がマッチするのは、遷移を始めた側のページの要素だけです。

戻るときに遷移を始めるのは、詳細ページの「一覧に戻る」リンクです。一覧ページ側には `:navigation-source` にマッチする要素がないので、どのカードにも名前が付きません。ブラウザの戻るボタンの場合は、そもそも遷移のきっかけになった要素自体がありません。

その結果、詳細ページの画像（`::view-transition-old`）だけがあって、対になる一覧側の画像（`::view-transition-new`）がない状態になり、画像が消えるだけになっていました。

仕様には、リンク先のURLでマッチさせる `:link-to()` という疑似クラスも定義されていて、これが使えれば戻る方向もCSSで書けそうです。ただ、Chrome 157で `CSS.supports('selector(:link-to(url(a.html)))')` を試すと `false` で、まだ使えませんでした。

#### 解決策：戻ってきたときだけJavaScriptで名前を付ける

一覧ページが表示される直前の `pagereveal` イベントで、どの商品ページから戻ってきたのかを調べて、そのカードに名前を付けるようにしました。

↓ 一覧ページの `head` で読み込むJavaScript

```js
// 戻る遷移の補助：:navigation-source は「遷移を始めた側のページ」でしか使えないため、
// 一覧ページに戻ってきたときは、どの商品から戻ってきたのかを JS で判断して名前を付ける。
addEventListener('pagereveal', async (event) => {
  if (!event.viewTransition || !navigation.activation?.from) return;

  const fromFile = new URL(navigation.activation.from.url).pathname.split('/').pop();
  const card = document.querySelector(`a[href="${fromFile}"]`);
  if (!card) return;

  const targets = [
    [card.querySelector('.thumb'), 'product-image'],
    [card.querySelector('.name'), 'product-name'],
  ];
  targets.forEach(([el, name]) => {
    el.style.viewTransitionName = name;
  });

  await event.viewTransition.finished;
  targets.forEach(([el]) => {
    el.style.viewTransitionName = '';
  });
});
```

`pagereveal` は最初の描画の前に発火するので、それより前にリスナーを登録しておけるよう、`body` の最後ではなく `head` で読み込んでいます。

これで「一覧に戻る」リンクでも、ブラウザの戻るボタンでも、画像がカードの位置へ縮んで戻るようになりました。行きはCSSだけ、戻りだけ少しJavaScriptを足しています。

## ハマったこと2：CodeSandboxでは行きの遷移だけ動かない

手元のローカルサーバーでは動いていたのに、CodeSandboxにアップロードすると、一覧→詳細の遷移だけトランジションせずに普通に切り替わってしまいました。なぜか戻るときは動きます。

詳細ページ側で `pagereveal` イベントの `viewTransition` を確認すると `null` になっていて、トランジションが途中で打ち切られていました。

#### 切り分け

CodeSandboxのプレビューでは、HTMLの `head` の先頭と `body` の最後に、CodeSandbox側のスクリプトが差し込まれていました。最初はこれが原因かと思ったのですが、詳細ページのHTMLを少しずつ変えて試してみると、次のような結果になりました。

| 詳細ページに加えた変更 | 行きの遷移 |
|---|---|
| 変更なし | ❌ 動かない |
| CodeSandboxが差し込むスクリプトを全部止める | ❌ 動かない |
| `<link>` に `blocking="render"` を付ける | ❌ 動かない |
| CSSの後ろに外部スクリプトを置く | ✅ 動く |
| `head` に `@view-transition` を直接書く | ✅ 動く |

差し込まれたスクリプトは関係なく、`@view-transition` の宣言を外部CSS（style.css）にだけ書いていたのが原因のようでした。

CodeSandboxのプレビューは、HTMLやCSSをキャッシュなしで、毎回0.4秒ほどかけて返していました。そのため、遷移先のページが表示される時点で、宣言がまだ読み込まれていなかったのだと思います。ローカルではファイルが一瞬で返ってくるので、問題が表に出ていませんでした。一覧ページだけ動いていたのは、`head` で読み込んでいる上のJavaScriptを待つ間に、CSSが間に合っていたからのようです。

:::message
Chromeの内部でどのように判断しているかまでは確認できていないので、あくまで試してみた結果からの推測です。
:::

#### 解決策

最初に紹介したように、`@view-transition` は各ページの `head` に直接書くようにしました。これでCodeSandbox上でも、行き・戻りの両方でトランジションが動くようになりました。

ローカルではファイルがすぐ返ってくるので、CodeSandboxに上げるまでまったく気づけませんでした。`@view-transition` だけは、外部CSSにまとめずに `head` に書いておいたほうがよさそうです。

## 使ってみた感想

#### 良かったところ

クリックしたカードからそのまま詳細ページへシームレスにつながるので、体験として直感的で、すごく分かりやすかったです。

#### 気になったところ

・パスが切り替わる普通のページ遷移（MPA）なので、SPAの画面切り替えと比べると、遷移に少し時間がかかるのに違和感がありました。

・遷移の途中で、商品名が価格の上に一瞬重なって見える瞬間がありました。名前を付ける要素を増やすときは、周りの要素との重なり方も確認したほうがよさそうです。

・ページをまたぐ遷移なので、CodePenのような1ページで完結するサービスでは試せません。今回はCodeSandboxを使いました。

## 使いどころ

ECサイトの商品一覧や、会社のCase Study（事例紹介）の一覧のように、サムネイルが詳細ページでもそのまま大きく表示される場面では、メリットがすごく大きいと感じました。

逆に、遷移後のページで一番大きく表示されるのがそのサムネイルではなく、画面の一部分にしか出てこないような場合は、かえって違和感になりそうです。そういう場面では無理に使う必要はないかなと思いました。

## まとめ

`:navigation-source` を使うと、クリックした要素だけをつなげるView TransitionsがCSSだけで書けるようになりました。ただ、戻る方向はまだJavaScriptが必要で、`@view-transition` を書く場所によってはCodeSandboxで動かないこともありました。

今はChromeだけの対応ですが、対応していないブラウザでは `:navigation-source` を使ったルールが無視されて、画像がつながらないだけで遷移自体はできます。サムネイルが詳細ページでも大きく表示されるECサイトや事例紹介の一覧なら、メリットが大きいと思います。

ここまでお読みいただきありがとうございました。

## 参考

https://drafts.csswg.org/css-navigation-1/

http://www.mail-archive.com/blink-dev@chromium.org/msg17359.html

https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
