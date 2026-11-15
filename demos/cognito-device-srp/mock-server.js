// Cognito の「端末の記憶」を真似た、学習用の模擬サーバー。
// 保存するのは salt と verifier だけで、DeviceSecret（端末のパスワード）は一度も受け取らない。
// ※ 仕組みを確かめるためのもので、本番で使うことは想定していない。
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Cognito（amazon-cognito-identity-js）と同じ 3072bit の素数 N と生成元 g
const N = BigInt(
  '0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1' +
    '29024E088A67CC74020BBEA63B139B22514A08798E3404DD' +
    'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245' +
    'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
    'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D' +
    'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F' +
    '83655D23DCA3AD961C62F356208552BB9ED529077096966D' +
    '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
    'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9' +
    'DE2BCBF6955817183995497CEA956AE515D2261898FA0510' +
    '15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64' +
    'ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
    'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B' +
    'F12FFA06D98A0864D87602733EC86A64521F2B18177B200C' +
    'BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31' +
    '43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF'
);
const g = 2n;
const HKDF_INFO = 'Caldera Derived Key';
const SECRET_BLOCK_BYTES = 64;
const SMALL_B_BYTES = 128;

const modPow = (base, exp, mod) => {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
};

// Cognito と同じ16進数の詰め方（先頭ビットが立っていたら 00 を付ける）
const padHex = (n) => {
  const hex = n.toString(16);
  const even = hex.length % 2 === 0 ? hex : `0${hex}`;
  return /^[89a-f]/i.test(even) ? `00${even}` : even;
};
const hexHash = (hex) => createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex');
const toBigInt = (hex) => BigInt(`0x${hex}`);

const k = toBigInt(hexHash(padHex(N) + padHex(g)));

const hkdf = (ikmHex, saltHex) => {
  const prk = createHmac('sha256', Buffer.from(saltHex, 'hex')).update(Buffer.from(ikmHex, 'hex')).digest();
  const info = Buffer.concat([Buffer.from(HKDF_INFO, 'utf8'), Buffer.from([1])]);
  return createHmac('sha256', prk).update(info).digest().subarray(0, 16);
};

export const createMockServer = () => {
  const devices = new Map(); // deviceKey -> { deviceGroupKey, salt, verifier }
  const sessions = new Map(); // deviceKey -> 進行中の認証の状態

  return {
    // ConfirmDevice：端末の登録。受け取るのは salt と verifier だけ
    confirmDevice({ DeviceKey, DeviceGroupKey, DeviceSecretVerifierConfig }) {
      devices.set(DeviceKey, {
        deviceGroupKey: DeviceGroupKey,
        salt: Buffer.from(DeviceSecretVerifierConfig.Salt, 'base64').toString('hex'),
        verifier: toBigInt(Buffer.from(DeviceSecretVerifierConfig.PasswordVerifier, 'base64').toString('hex')),
      });
      return { UserConfirmationNecessary: false };
    },

    // DEVICE_SRP_AUTH：クライアントの A を受け取り、サーバーの B を返す
    deviceSrpAuth({ DEVICE_KEY, SRP_A }) {
      const device = devices.get(DEVICE_KEY);
      if (!device) throw new Error('未登録の端末です');
      const A = toBigInt(SRP_A);
      if (A % N === 0n) throw new Error('不正な A です');

      const b = toBigInt(randomBytes(SMALL_B_BYTES).toString('hex')) % N;
      const B = (k * device.verifier + modPow(g, b, N)) % N;
      const secretBlock = randomBytes(SECRET_BLOCK_BYTES).toString('base64');
      sessions.set(DEVICE_KEY, { A, B, b, secretBlock });

      return { SRP_B: B.toString(16), SALT: device.salt, SECRET_BLOCK: secretBlock };
    },

    // DEVICE_PASSWORD_VERIFIER：クライアントの署名が、サーバー側で計算した鍵の署名と一致するか確かめる
    devicePasswordVerifier({ DEVICE_KEY, PASSWORD_CLAIM_SIGNATURE, PASSWORD_CLAIM_SECRET_BLOCK, TIMESTAMP }) {
      const device = devices.get(DEVICE_KEY);
      const session = sessions.get(DEVICE_KEY);
      sessions.delete(DEVICE_KEY);
      if (!device || !session || session.secretBlock !== PASSWORD_CLAIM_SECRET_BLOCK) {
        return { ok: false };
      }

      const uHex = hexHash(padHex(session.A) + padHex(session.B));
      const u = toBigInt(uHex);
      // サーバー側の S = (A * v^u)^b mod N。クライアント側の S と同じ値になる
      const S = modPow((session.A * modPow(device.verifier, u, N)) % N, session.b, N);
      const key = hkdf(padHex(S), padHex(u));

      const message = Buffer.concat([
        Buffer.from(device.deviceGroupKey, 'utf8'),
        Buffer.from(DEVICE_KEY, 'utf8'),
        Buffer.from(PASSWORD_CLAIM_SECRET_BLOCK, 'base64'),
        Buffer.from(TIMESTAMP, 'utf8'),
      ]);
      const expected = createHmac('sha256', key).update(message).digest();
      const actual = Buffer.from(PASSWORD_CLAIM_SIGNATURE, 'base64');
      const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
      return { ok };
    },
  };
};
