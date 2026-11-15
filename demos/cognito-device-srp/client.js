// クライアント側。Cognito の公式ライブラリ（amazon-cognito-identity-js）の AuthenticationHelper を使い、
// CognitoUser の端末登録・端末認証と同じ手順で値を計算する。
import { createHmac } from 'node:crypto';
import { AuthenticationHelper, DateHelper } from 'amazon-cognito-identity-js';

const withCallback = (fn) =>
  new Promise((resolve, reject) => fn((err, value) => (err ? reject(err) : resolve(value))));

// 端末の登録：DeviceSecret（ランダムなパスワード）を作り、そこから salt と verifier を計算する
export const createDeviceSecretVerifier = async (userPoolName, deviceGroupKey, deviceKey) => {
  const helper = new AuthenticationHelper(userPoolName);
  await withCallback((cb) => helper.generateHashDevice(deviceGroupKey, deviceKey, cb));

  return {
    deviceSecret: helper.getRandomPassword(), // 端末にだけ保存する
    verifierConfig: {
      Salt: Buffer.from(helper.getSaltDevices(), 'hex').toString('base64'),
      PasswordVerifier: Buffer.from(helper.getVerifierDevices(), 'hex').toString('base64'),
    },
  };
};

// 端末認証：DEVICE_SRP_AUTH → DEVICE_PASSWORD_VERIFIER
export const authenticateDevice = async ({ send, username, deviceGroupKey, deviceKey, deviceSecret }) => {
  const helper = new AuthenticationHelper(deviceGroupKey);
  const A = await withCallback((cb) => helper.getLargeAValue(cb));

  const challenge = send('DEVICE_SRP_AUTH', { USERNAME: username, DEVICE_KEY: deviceKey, SRP_A: A.toString(16) });

  // サーバーの B と salt から、共有鍵を計算する（DeviceSecret はここで使うだけで送らない）
  const BigInteger = helper.N.constructor;
  const key = await withCallback((cb) =>
    helper.getPasswordAuthenticationKey(
      deviceKey,
      deviceSecret,
      new BigInteger(challenge.SRP_B, 16),
      new BigInteger(challenge.SALT, 16),
      cb
    )
  );

  const timestamp = new DateHelper().getNowString();
  const message = Buffer.concat([
    Buffer.from(deviceGroupKey, 'utf8'),
    Buffer.from(deviceKey, 'utf8'),
    Buffer.from(challenge.SECRET_BLOCK, 'base64'),
    Buffer.from(timestamp, 'utf8'),
  ]);
  const signature = createHmac('sha256', key).update(message).digest('base64');

  return send('DEVICE_PASSWORD_VERIFIER', {
    USERNAME: username,
    DEVICE_KEY: deviceKey,
    PASSWORD_CLAIM_SECRET_BLOCK: challenge.SECRET_BLOCK,
    PASSWORD_CLAIM_SIGNATURE: signature,
    TIMESTAMP: timestamp,
  });
};
