import crypto from "crypto";

export function hashObject(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}
