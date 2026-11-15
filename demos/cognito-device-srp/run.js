// 端末の登録 → 正しい DeviceSecret でログイン → 間違った DeviceSecret でログイン、を順番に試す。
// クライアントとサーバーの間でやり取りした値をすべて記録し、DeviceSecret が含まれていないかも確かめる。
import { randomUUID } from 'node:crypto';
import { createMockServer } from './mock-server.js';
import { createDeviceSecretVerifier, authenticateDevice } from './client.js';

const USER_POOL_NAME = 'DemoPool';
const USERNAME = 'demo-user';
const DEVICE_GROUP_KEY = `-${randomUUID().slice(0, 8)}`;
const DEVICE_KEY = `ap-northeast-1_${randomUUID()}`;
const PREVIEW_LENGTH = 24;

const server = createMockServer();
const wireLog = [];

const preview = (value) =>
  typeof value === 'string' && value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}…(${value.length}文字)` : value;
const show = (direction, name, payload) => {
  wireLog.push({ direction, name, payload });
  const entries = Object.entries(payload).map(([key, value]) => `    ${key}: ${preview(value)}`);
  console.log(`  ${direction} ${name}\n${entries.join('\n')}`);
};

const handlers = {
  DEVICE_SRP_AUTH: (body) => server.deviceSrpAuth(body),
  DEVICE_PASSWORD_VERIFIER: (body) => server.devicePasswordVerifier(body),
};
const send = (name, body) => {
  show('→ サーバーへ', name, body);
  const response = handlers[name](body);
  show('← クライアントへ', name, response);
  return response;
};

// 1. 端末の登録（ConfirmDevice）
console.log('\n## 1. 端末の登録（ConfirmDevice）');
const { deviceSecret, verifierConfig } = await createDeviceSecretVerifier(USER_POOL_NAME, DEVICE_GROUP_KEY, DEVICE_KEY);
console.log(`  端末にだけ保存する DeviceSecret: ${preview(deviceSecret)}`);
const confirmBody = { DeviceKey: DEVICE_KEY, DeviceGroupKey: DEVICE_GROUP_KEY, DeviceSecretVerifierConfig: verifierConfig };
show('→ サーバーへ', 'ConfirmDevice', { DeviceKey: DEVICE_KEY, ...verifierConfig });
server.confirmDevice(confirmBody);
wireLog.push({ direction: '→', name: 'ConfirmDevice', payload: confirmBody });

// 2. 正しい DeviceSecret でログイン
console.log('\n## 2. 正しい DeviceSecret でログイン');
const success = await authenticateDevice({ send, username: USERNAME, deviceGroupKey: DEVICE_GROUP_KEY, deviceKey: DEVICE_KEY, deviceSecret });

// 3. 間違った DeviceSecret でログイン
console.log('\n## 3. 間違った DeviceSecret でログイン');
const failure = await authenticateDevice({ send, username: USERNAME, deviceGroupKey: DEVICE_GROUP_KEY, deviceKey: DEVICE_KEY, deviceSecret: `${deviceSecret}x` });

// 4. 結果
const leaked = JSON.stringify(wireLog).includes(deviceSecret);
console.log('\n## 結果');
console.log(`  正しい DeviceSecret: ${success.ok ? '認証成功' : '認証失敗'}`);
console.log(`  間違った DeviceSecret: ${failure.ok ? '認証成功' : '認証失敗'}`);
console.log(`  通信の中に DeviceSecret が含まれていたか: ${leaked ? 'はい' : 'いいえ'}`);

if (!success.ok || failure.ok || leaked) {
  process.exitCode = 1;
}
