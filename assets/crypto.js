/* Client reports are stored encrypted. Only the right client code can find and open a report. */
(function () {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

  function normCode(code) { return String(code || "").trim().toUpperCase().replace(/\s+/g, ""); }

  async function reportId(code) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode(window.SITE.key + "|id|" + normCode(code)));
    return hex(h).slice(0, 24);
  }
  async function deriveKey(code, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(window.SITE.key + "|" + normCode(code)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptReport(code, obj) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(code, salt);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
    return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) };
  }
  async function decryptReport(code, file) {
    const key = await deriveKey(code, unb64(file.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) }, key, unb64(file.data));
    return JSON.parse(dec.decode(plain));
  }
  window.Vault = { normCode, reportId, encryptReport, decryptReport };
})();
