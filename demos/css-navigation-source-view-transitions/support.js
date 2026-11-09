// 表示確認用：このブラウザが :navigation-source に対応しているかを画面に出すだけ
const supported = CSS.supports('selector(:navigation-source)');
document.getElementById('support').textContent = supported
  ? 'このブラウザは :navigation-source に対応しています'
  : 'このブラウザは :navigation-source 未対応です（通常のクロスフェードになります）';
