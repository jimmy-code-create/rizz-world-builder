import { webcrypto } from "node:crypto";

const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const pair = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]);

console.log(`VAPID_PUBLIC_KEY=${toBase64Url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("Store the private key as a Cloudflare Worker secret; do not commit it.");