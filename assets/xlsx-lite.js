/* Minimal .xlsx reader: unzips in the browser and reads the saved cell values. No outside libraries. */
(function () {
  async function inflate(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("This doesn't look like an Excel (.xlsx) file.");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {}, td = new TextDecoder();
    for (let n = 0; n < count; n++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
      const lnlen = dv.getUint16(lho + 26, true), lxlen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lxlen;
      files[name] = { method, data: u8.subarray(start, start + csize) };
      p += 46 + nlen + xlen + clen;
    }
    return {
      async text(name) {
        const f = files[name]; if (!f) return null;
        const raw = f.method === 0 ? f.data : await inflate(f.data);
        return td.decode(raw);
      }
    };
  }
  const xml = s => new DOMParser().parseFromString(s, "application/xml");
  const kids = (node, tag) => [...node.getElementsByTagName(tag)];

  function colNum(ref) { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n; }

  async function readWorkbook(buf) {
    const z = await unzip(buf);
    const wbx = xml(await z.text("xl/workbook.xml"));
    const rels = xml(await z.text("xl/_rels/workbook.xml.rels"));
    const relMap = {}; kids(rels, "Relationship").forEach(r => relMap[r.getAttribute("Id")] = r.getAttribute("Target"));
    const ssText = await z.text("xl/sharedStrings.xml");
    const shared = ssText ? kids(xml(ssText), "si").map(si => kids(si, "t").map(t => t.textContent).join("")) : [];
    const sheets = {};
    for (const s of kids(wbx, "sheet")) {
      const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      let target = relMap[rid]; if (!target) continue;
      target = target.replace(/^\/?xl\//, "").replace(/^\//, "");
      const doc = xml(await z.text("xl/" + target));
      const cells = {};
      for (const c of kids(doc, "c")) {
        const ref = c.getAttribute("r"), t = c.getAttribute("t");
        const r = parseInt(ref.replace(/[A-Z]+/g, ""), 10), col = colNum(ref);
        let v = null;
        const vn = c.getElementsByTagName("v")[0];
        if (t === "s") v = vn ? shared[+vn.textContent] : null;
        else if (t === "inlineStr") v = kids(c, "t").map(x => x.textContent).join("");
        else if (t === "str" || t === "e") v = vn ? vn.textContent : null;
        else if (t === "b") v = vn ? vn.textContent === "1" : null;
        else v = vn ? Number(vn.textContent) : null;
        if (v !== null && v !== "") cells[r + "," + col] = v;
      }
      sheets[s.getAttribute("name")] = { get: (r, c) => cells[r + "," + c] ?? null, maxRow: Math.max(0, ...Object.keys(cells).map(k => +k.split(",")[0])) };
    }
    return { names: Object.keys(sheets), sheet: n => sheets[n] };
  }
  window.XLSXLite = { readWorkbook };
})();
