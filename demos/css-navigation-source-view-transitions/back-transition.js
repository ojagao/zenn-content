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
