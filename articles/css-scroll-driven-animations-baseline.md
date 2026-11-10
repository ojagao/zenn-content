---
title: "【CSSだけ】スクロールでふわっと表示するアニメーションを作る"
emoji: "🌀"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["css", "animation", "aos", "frontend", "html"]
published: true
published_at: "2026-11-12 08:00"
---

## はじめに

数年前は、スクロールに合わせて要素をふわっと表示したいとき、JavaScriptでスクロール位置を取得して、画面の高さも計算して、ちょうどいい表示位置を探してクラスを付け替えて……ということをやっていました。

2023年には、それが面倒でAOSというライブラリに乗り換えた記事も書いています。

https://zenn.dev/h_aso/articles/0d599bdcb98083

それが今は、CSSのScroll-driven AnimationsでJavaScriptなしに書けるようになっています。2026年10月にFirefox 159が対応して、Chrome・Safari・Firefoxの全部で使えるようになった（Baseline Newly available）ので、AOSでやっていたような演出をCSSだけで作り直してみました。

## 先に完成品

架空のカフェのLPに、AOSの `fade-up` のような演出や、スクロール量に合わせて伸びるプログレスバー、ヘッダーの背景の切り替え、ヒーロー画像のパララックスを付けています。JavaScriptは、対応しているかを画面に表示するためだけに使っていて、演出には一切使っていません。

@[codepen](https://codepen.io/o_jaga_o/pen/QwpYNpq)

#### 環境

・macOS

・Google Chrome 157.0.8103.39

・CodePen

## Scroll-driven Animationsとは

簡単に言うと、アニメーションの進み具合を、時間ではなくスクロール量に結びつける仕組みです。

普通の `animation` は「1秒かけて再生する」のように時間で進みますが、Scroll-driven Animationsでは「スクロールした分だけ進む」「要素が画面に入ってくる分だけ進む」という動きになります。指定するのは `animation-timeline` というプロパティで、主に次の2つを使います。

・`scroll()`：スクロールコンテナ（ページ全体など）のスクロール量に合わせて進む

・`view()`：その要素が画面に入ってきてから出ていくまでの見え方に合わせて進む

↓ 対応状況（web.dev の2026年10月のまとめ）

https://web.dev/blog/web-platform-10-2026

## 実装

#### 1. AOSのfade-upをCSSで書く

AOSでいう `data-aos="fade-up"` を、クラスで付けられるようにしました。

↓ HTML（クラスを付けるだけ）

```html
<article class="menu-card sda-fade-up">...</article>
```

↓ CSS

```css
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(60px);
  }
}

.sda-fade-up {
  animation: linear both;
  animation-timeline: view();
  /* 画面に入り始めてから、要素の30%が見えるまでの間で再生する */
  animation-range: entry 0% cover 30%;
  animation-name: fade-up;
}
```

`animation-timeline: view()` で、要素の見え方に合わせてアニメーションが進むようになります。`animation-range` は、どこからどこまでで再生するかの指定で、ここでは画面の下から入り始めたところ（`entry 0%`）から、要素の30%が見えたところ（`cover 30%`）までで再生しています。

実際にChromeでスクロール位置を変えながら透明度を測ってみると、カードが画面に入り始めたところから 0 → 0.14 → 0.48 → 0.82 → 1 と、スクロールした分だけ少しずつ表示されていました。

#### 2. data-aos-delayの代わり

AOSでは `data-aos-delay` で表示を遅らせていましたが、Scroll-driven Animationsには時間がないので、代わりに再生を始める位置をずらします。

↓ 横に3つ並んだカードを、少しずつずらして表示する

```css
.sda-delay-1 {
  animation-range: entry 10% cover 40%;
}

.sda-delay-2 {
  animation-range: entry 20% cover 50%;
}
```

時間ではなくスクロール量で遅れるので、ゆっくりスクロールするとゆっくり、速くスクロールすると速く表示されます。

#### 3. プログレスバーとヘッダー

ページ全体のスクロール量を使うときは `scroll(root)` を指定します。

↓ 読んだ量に合わせて伸びるプログレスバーと、最初の200pxで透明から白背景に変わるヘッダー

```css
/* 最初は透明 → スクロールすると、.site-header に指定した白背景に戻る */
@keyframes header-solid {
  from {
    color: #fff;
    background: transparent;
    box-shadow: none;
  }
}

.progress {
  animation: grow-progress linear both;
  animation-timeline: scroll(root);
}

.site-header {
  animation: header-solid linear both;
  animation-timeline: scroll(root);
  animation-range: 0 200px;
}
```

ヘッダーは `animation-range: 0 200px` にしているので、最初の200pxをスクロールする間だけ変化して、あとは白いままです。以前ならスクロールイベントで `scrollY` を見てクラスを付け替えていたところです。

ヘッダーの白背景を `to` ではなく、普段のスタイル（`.site-header` 自体）に書いて、`from` で透明にしているのには理由があります。これは下の「気をつけたいこと3」で書きます。

#### 4. 対応していないブラウザと、視差効果を減らす設定

演出は `@supports` と `prefers-reduced-motion` の中に入れています。

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    /* ここに演出を書く */
  }
}
```

対応していないブラウザでは演出なしで普通に表示されるだけなので、表示されないまま透明で止まってしまう、ということがありません。手元にあった未対応のFirefox 149でも開いてみて、カードや画像が最初から表示されていることを確認しました。

OSで「視差効果を減らす」をオンにしている人にも、アニメーションなしで最初から表示されます（Chromeでこの設定を再現して、アニメーションが付かないことを確認しました）。

## 気をつけたいこと1：animation-timelineを書く順番

`animation-timeline` は、`animation` の一括指定との順番に気をつける必要があります。試しに `animation` の前に書いてみると、スクロールに合わせて動かず、ページを開いた瞬間に1回再生されて終わってしまいました。

```css
/* ❌ スクロールに連動しない */
.sample {
  animation-timeline: view();
  animation: fade-up 1s linear both;
}
```

`animation` の一括指定は `animation-timeline` もリセットするので、後から書いた `animation` で、普通の時間で進むアニメーションに戻ってしまいます。Chromeで確認すると、タイムラインが `ViewTimeline` ではなく、時間で進む `DocumentTimeline` になっていました。

`animation-timeline` は、`animation` の一括指定より後に書けば大丈夫です。

## 気をつけたいこと2：overflow: hiddenの中ではview()の基準が変わる

ヒーローは、はみ出した背景画像を隠すために `overflow` を付けています。ここを `overflow: hidden` にして、中の背景画像に `view()` を指定すると、ページ全体のスクロールではなく、ヒーロー自体を基準にしてしまいます。

`overflow: hidden` を付けた要素はスクロールコンテナとして扱われるので、`view()` はその一番近いスクロールコンテナ（ここではヒーロー）を見るようになるためです。Chromeでタイムラインの基準になっている要素を確認すると、`hidden` のときはヒーロー（`.hero`）、`clip` のときはページ全体（`html`）でした。

```css
.hero {
  /* hidden だとヒーロー自体がスクロールコンテナ扱いになり、中の view() がページのスクロールを見なくなるので clip にする */
  overflow: clip;
}
```

はみ出しを隠すだけなら `overflow: clip` で十分なので、こちらに変えました。

さらに、ヒーローの見え方をタイムラインにして子要素から使いたかったので、`view-timeline-name` で名前を付けて、背景と文字の両方から参照しています。

```css
.hero {
  view-timeline-name: --hero;
}

.hero-bg {
  animation: parallax linear both;
  animation-timeline: --hero;
  animation-range: exit;
}

.hero-inner {
  animation: fade-out-up linear both;
  animation-timeline: --hero;
  animation-range: exit 0% exit 60%;
}
```

## 気をつけたいこと3：未対応ブラウザで「最初の状態」が残る

最初は、ヘッダーを普段は透明・白文字にしておいて、`@keyframes` の `to` で白背景にしていました。対応しているChromeでは問題なかったのですが、未対応のFirefox 149で開いてみると、アニメーションが付かないので透明・白文字のまま固定されて、明るい背景の上でロゴやメニューがほとんど読めなくなっていました。

カードのフェードインは「アニメーションなし＝最初から表示」になるので困らないのですが、ヘッダーのように「最初の状態」がスクロール前用の特別な見た目だと、未対応ブラウザではずっとその見た目のままになります。

そこで、普段のスタイルは白背景（スクロール後の見た目）にしておいて、対応ブラウザでだけ `from` で透明にする書き方に変えました。これでFirefox 149でも、最初から白背景で読めるようになりました。

↓ 普段は白背景にしておく

```css
.site-header {
  /* 未対応ブラウザでも読めるように、普段は白背景にしておく（透明にするのは対応ブラウザだけ） */
  color: var(--color-text);
  background: rgb(251 247 242 / 0.95);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
}
```

## 以前の書き方と比べて

数年前は、JavaScriptでスクロール位置を取得して、画面の高さも計算して、表示するのにちょうどいい位置を探してクラスを付け替えて、とやっていました。それが今はCSSだけでできるようになっていて、感動しました。

AOSのようなライブラリも読み込まなくてよくなります。参考までに、AOS（2.3.4）は `aos.js` が約14.7KB、`aos.css` が約26KBありました（gzip圧縮後はそれぞれ約4.7KBと約2.2KB）。今回のCSSだけの書き方なら、この2つのファイルを読み込まなくて済むので、軽くなるのもすごくいいなと思います。

## まとめ

Scroll-driven Animationsが全ブラウザで使えるようになって、スクロールでふわっと表示する演出は、JavaScriptもライブラリもなしで書けるようになりました。今回試したフェードイン、表示のずらし、ヘッダーの切り替え、パララックスは、全部CSSだけで書けました。そのぶん、`animation-timeline` を書く順番、`overflow: hidden` との組み合わせ、未対応ブラウザでの見え方の3つは、実際に動かして確認しておいたほうがよさそうです。

ここまでお読みいただきありがとうございました。

## 参考

https://web.dev/blog/web-platform-10-2026

https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/159
