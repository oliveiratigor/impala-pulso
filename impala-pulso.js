/*! Impala · No seu pulso — v1.4.1
 * Simulador "relógio no pulso" para a página de produto da Loja Integrada.
 * Lê a primeira imagem do cadastro e as medidas da descrição (Diâmetro, Lug to Lug, Espessura),
 * recorta o relógio da foto e o monta em tamanho real num pulso ilustrado ou numa foto do pulso do cliente.
 * Uso: <script src=".../impala-pulso.js" data-estilo="completo|minimal" defer></script>
 *      opcional: <div data-impala-pulso data-estilo="minimal"></div> no ponto onde ele deve aparecer.
 */
(function () {
'use strict';
if (window.__IMPALA_PULSO__) return; window.__IMPALA_PULSO__ = true;

var VERSION = '1.4.1';
var SCRIPT = document.currentScript;
var CFG = { estilo: 'completo', alvo: '', posicao: 'auto', titulo: 'No seu pulso', escuro: false, foto: false, guia: '', debug: /[?&]pulso=debug\b/.test(location.search) };
try { Object.assign(CFG, window.IMPALA_PULSO || {}); } catch (e) {}
if (SCRIPT && SCRIPT.dataset) ['estilo', 'alvo', 'posicao', 'titulo', 'guia'].forEach(function (k) { if (SCRIPT.dataset[k]) CFG[k] = SCRIPT.dataset[k]; });
if (SCRIPT && SCRIPT.dataset) { if (SCRIPT.dataset.escuro != null) CFG.escuro = true; if (SCRIPT.dataset.foto != null) CFG.foto = true; }

/* ================= utilidades ================= */
function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function cx2d(c) { return c.getContext('2d', { willReadFrequently: true }); }
function num(v) { if (v == null) return null; var x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && x > 0 ? x : null; }
function fmt(v, d) { var s = Number(v).toFixed(d == null ? 1 : d).replace('.', ','); return s.replace(/,0+$/, ''); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function track(acao, extra) { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: 'pulso_interacao', pulso_acao: acao }, extra || {})); } catch (e) {} }
function log() { if (CFG.debug && window.console) console.log.apply(console, ['[impala-pulso]'].concat([].slice.call(arguments))); }

var LS_KEY = 'impala_pulso_v1';
function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; } }
function lsSet(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(Object.assign(lsGet(), o))); } catch (e) {} }

/* ================= leitura do produto ================= */
function textOf(el) {
  if (!el) return '';
  var h = el.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|summary|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  var t = document.createElement('textarea'); t.innerHTML = h; return t.value.replace(/[ \t ]+/g, ' ');
}
function sizeUrl(u, n) { if (!u) return u; return /awsli\.com\.br/.test(u) ? u.replace(/\/\d+x\d+\//, '/' + n + 'x' + n + '/') : u; }
function readProduct() {
  var q = function (s) { return document.querySelector(s); };
  var nameEl = q('h1.nome-produto') || q('.info-principal-produto h1') || q('[itemprop=name]') || q('h1');
  var name = nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : '';
  var skuEl = q('[itemprop=sku]') || q('.codigo-produto span') || q('.codigo-produto');
  var sku = skuEl ? skuEl.textContent.replace(/\s+/g, ' ').replace(/^.*?:\s*/, '').trim() : '';
  var a = q('.produto-thumbs a[data-imagem-grande]'), u = a && a.getAttribute('data-imagem-grande');
  if (!u) { var im = q('#imagemProduto'); u = im && (im.getAttribute('data-largeimg') || im.getAttribute('data-zoom-image') || im.currentSrc || im.src); }
  if (!u) { var og = q('meta[property="og:image"]'); u = og && og.content; }
  var box = q('#descricao') || q('[itemprop=description]') || q('.abas-custom') || document.body;
  var t = textOf(box);
  function f(re) { var m = t.match(re); return m ? num(m[1]) : null; }
  var P = {
    name: name, sku: sku, img: sizeUrl(u, 800),
    diam: f(/Di[âa]metro(?:\s+d[ae]\s+caixa)?\s*:\s*([\d.,]+)/i),
    l2l: f(/Lug\s*(?:to|a)\s*Lug\s*:\s*([\d.,]+)/i) || f(/Al[çc]a\s+a\s+al[çc]a\s*:\s*([\d.,]+)/i),
    esp: f(/Espessura\s*:\s*([\d.,]+)/i),
    text: t
  };
  if (!P.diam) { var dt = q('.detalhe-tecnico .numero span'); if (dt) P.diam = num(dt.textContent); }
  var semLume = /sem lume|n[ãa]o (possui|tem) lume|ponteiros n[ãa]o luminosos/i.test(t);
  P.ind = /indiglo/i.test(t);
  P.led = P.ind || /\bLED\b|luz de fundo|ilumina[çc][ãa]o (eletr|do mostrador|em LED)/i.test(t);
  P.lume = !semLume && (P.led || /lumin[oa]s|luminesc|luminova|lumibrite|neobrite|tr[íi]tio|tritium|\blume\b/i.test(t));
  P.full = /mostrador (inteiro |totalmente )?lumin|mostrador lumin/i.test(t);
  P.dig = /\bdigital\b|\bLCD\b/i.test(t + ' ' + name) && !/anal[óo]gico-digital|ana-?digi/i.test(t + ' ' + name);
  P.bgw9 = /bgw-?9|lume azul|luminosidade azul/i.test(t);
  /* sobrescritas manuais por produto: <span data-pulso data-diam="41" data-l2l="48" data-lume="nao" data-img="..."></span> na descrição */
  var ov = box && box.querySelector && box.querySelector('[data-pulso]');
  if (ov) {
    if (ov.dataset.off != null || ov.dataset.desligar != null) P.off = true;
    if (num(ov.dataset.diam)) P.diam = num(ov.dataset.diam);
    if (num(ov.dataset.l2l)) P.l2l = num(ov.dataset.l2l);
    if (ov.dataset.lume) P.lume = !/^(n|0|false)/i.test(ov.dataset.lume);
    if (ov.dataset.img) P.img = ov.dataset.img;
  }
  return P;
}

/* ================= imagens ================= */
function loadImg(u) {
  return new Promise(function (res) {
    if (!u) return res(null);
    var im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = function () { res(im); };
    im.onerror = function () {
      /* segunda tentativa: baixa como blob (evita cache sem CORS) */
      fetch(u, { mode: 'cors', cache: 'reload' }).then(function (r) { return r.blob(); }).then(function (b) {
        var j = new Image(); j.onload = function () { res(j); }; j.onerror = function () { res(null); }; j.src = URL.createObjectURL(b);
      }).catch(function () { res(null); });
    };
    im.src = u;
  });
}

/* ================= recorte automático do relógio a partir da foto do cadastro =================
   1) fundo: cor dominante da borda (branco ou transparente) e preenchimento a partir das bordas;
   2) mantém o maior objeto (o relógio) e pedaços alinhados a ele (pulseira), descarta o resto (pulseira extra, caixa…);
   3) caixa: perfil de largura linha a linha — a pulseira dá o eixo e a largura de referência; onde a silhueta
      alarga é a caixa; ajuste de círculo robusto nas bordas laterais (ignora coroa e alças); caixas retangulares usam a largura. */
function makeCut(img, P) {
  var W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height, s = Math.min(1, 900 / Math.max(W0, H0)),
      w = Math.round(W0 * s), h = Math.round(H0 * s), n = w * h, i, x, y, k;
  var cv = mk(w, h), g = cx2d(cv); g.drawImage(img, 0, 0, w, h);
  var id; try { id = g.getImageData(0, 0, w, h); } catch (e) { return { ok: false, why: 'cors' }; }
  var p = id.data;
  var R = [], G = [], B = [];
  function addB(j) { if (p[4 * j + 3] > 200) { R.push(p[4 * j]); G.push(p[4 * j + 1]); B.push(p[4 * j + 2]); } }
  for (x = 0; x < w; x++) { addB(x); addB((h - 1) * w + x); }
  for (y = 0; y < h; y++) { addB(y * w); addB(y * w + w - 1); }
  function med(a) { a = a.slice().sort(function (u, v) { return u - v; }); return a.length ? a[a.length >> 1] : 255; }
  var bc = R.length > (w + h) * 0.2 ? [med(R), med(G), med(B)] : [255, 255, 255];
  var T = 20, cd = new Uint8Array(n);
  for (i = 0; i < n; i++) cd[i] = Math.min(255, Math.max(Math.abs(p[4 * i] - bc[0]), Math.abs(p[4 * i + 1] - bc[1]), Math.abs(p[4 * i + 2] - bc[2])));
  /* fundo conectado à borda */
  var bg = new Uint8Array(n), st = new Int32Array(n), sp = 0;
  function sd(j) { if (!bg[j] && (p[4 * j + 3] < 40 || cd[j] < T)) { bg[j] = 1; st[sp++] = j; } }
  for (x = 0; x < w; x++) { sd(x); sd((h - 1) * w + x); }
  for (y = 0; y < h; y++) { sd(y * w); sd(y * w + w - 1); }
  while (sp) { i = st[--sp]; x = i % w; if (x > 0) sd(i - 1); if (x < w - 1) sd(i + 1); if (i >= w) sd(i - w); if (i < n - w) sd(i + w); }
  /* objetos (8-conectados) */
  var fg = new Uint8Array(n); for (i = 0; i < n; i++) fg[i] = (!bg[i] && p[4 * i + 3] >= 128) ? 1 : 0;
  var lb = new Int32Array(n), comps = [null], cur = 0;
  for (var s0 = 0; s0 < n; s0++) {
    if (!fg[s0] || lb[s0]) continue; cur++; var area = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sx = 0; sp = 0; st[sp++] = s0; lb[s0] = cur;
    while (sp) {
      var j = st[--sp], jx = j % w, jy = (j - jx) / w; area++; sx += jx; if (jx < x0) x0 = jx; if (jx > x1) x1 = jx; if (jy < y0) y0 = jy; if (jy > y1) y1 = jy;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; var X = jx + dx, Y = jy + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        var t2 = Y * w + X; if (fg[t2] && !lb[t2]) { lb[t2] = cur; st[sp++] = t2; }
      }
    }
    comps.push({ a: area, x0: x0, y0: y0, x1: x1, y1: y1, mx: sx / area });
  }
  if (cur < 1) return { ok: false, why: 'vazio' };
  var main = 1; for (k = 2; k <= cur; k++) if (comps[k].a > comps[main].a) main = k;
  var M0 = comps[main], keep = new Uint8Array(cur + 1); keep[main] = 1;
  for (k = 1; k <= cur; k++) if (k !== main && comps[k].a > n * 0.0015 && comps[k].mx > M0.x0 && comps[k].mx < M0.x1 && (comps[k].x1 - comps[k].x0) < (M0.x1 - M0.x0) * 1.1) keep[k] = 1;
  var M = new Uint8Array(n); for (i = 0; i < n; i++) M[i] = keep[lb[i]] ? 1 : 0;
  /* perfil por linha */
  var Lx = new Int32Array(h).fill(-1), Rx = new Int32Array(h).fill(-1), ya = -1, yb = -1;
  for (y = 0; y < h; y++) { var row = y * w; for (x = 0; x < w; x++) if (M[row + x]) { Lx[y] = x; break; } for (x = w - 1; x >= 0; x--) if (M[row + x]) { Rx[y] = x; break; } if (Lx[y] >= 0) { if (ya < 0) ya = y; yb = y; } }
  if (ya < 0) return { ok: false, why: 'vazio' };
  var H = yb - ya + 1, cs = [], ws = [];
  function band(a, b) { for (y = Math.round(a); y <= Math.round(b); y++) if (Lx[y] >= 0) { cs.push((Lx[y] + Rx[y]) / 2); ws.push(Rx[y] - Lx[y] + 1); } }
  band(ya + 0.02 * H, ya + 0.12 * H); band(yb - 0.12 * H, yb - 0.02 * H);
  var cxs = med(cs), sw = med(ws);
  /* trecho largo = caixa (+ alças) */
  var best = null, ra = -1, gap = 0, lim = Math.max(2, Math.round(0.012 * H));
  for (y = ya; y <= yb + 1; y++) {
    var wide = y <= yb && Lx[y] >= 0 && (Rx[y] - Lx[y] + 1) > sw * 1.1;
    if (wide) { if (ra < 0) ra = y; gap = 0; } else if (ra >= 0) { gap++; if (gap > lim || y > yb) { var rb = y - gap; if (!best || rb - ra > best[1] - best[0]) best = [ra, rb]; ra = -1; gap = 0; } }
  }
  var fallback = !best || (best[1] - best[0]) < 0.12 * H;
  if (fallback) best = [Math.round(ya + 0.3 * H), Math.round(yb - 0.3 * H)];
  var minL = 1e9, maxR = -1; for (y = best[0]; y <= best[1]; y++) if (Lx[y] >= 0) { if (Lx[y] < minL) minL = Lx[y]; if (Rx[y] > maxR) maxR = Rx[y]; }
  var hw = Math.min(cxs - minL, maxR - cxs), cy = (best[0] + best[1]) / 2, cx = cxs, r = hw, round = false;
  /* círculo robusto nas bordas laterais */
  var pts = []; for (y = best[0]; y <= best[1]; y += 2) if (Lx[y] >= 0) { pts.push([Lx[y], y]); pts.push([Rx[y], y]); }
  var fit = circRobust(pts);
  if (fit && !fallback) {
    var ok = Math.abs(fit.r - hw) / hw < 0.08 && Math.abs(fit.x - cxs) < 0.07 * hw && fit.inl > 0.4 && fit.res < 0.02 * fit.r;
    if (ok) { round = true; cx = fit.x; cy = fit.y; r = Math.min(fit.r, hw * 1.02); }
  }
  if (!(r > 0.06 * w && r < 0.55 * w)) return { ok: false, why: 'caixa' };
  var halfH = (best[1] - best[0]) / 2;
  /* limpa buracos de fundo fora da caixa (entre alças e pulseira, elos) */
  for (i = 0; i < n; i++) {
    if (!M[i] || cd[i] >= T || p[4 * i + 3] < 128) continue;
    x = i % w; y = (i - x) / w;
    var out = round ? Math.hypot(x - cx, y - cy) > r * 1.04 : (Math.abs(x - cx) > hw * 1.03 || Math.abs(y - cy) > halfH * 1.03);
    if (out) M[i] = 0;
  }
  /* alfa final com borda suave */
  for (i = 0; i < n; i++) {
    if (!M[i]) { p[4 * i + 3] = 0; continue; }
    x = i % w;
    var edge = (x > 0 && !M[i - 1]) || (x < w - 1 && !M[i + 1]) || (i >= w && !M[i - w]) || (i < n - w && !M[i + w]);
    if (edge && p[4 * i + 3] > 200) p[4 * i + 3] = Math.round(255 * clamp((cd[i] - T * 0.4) / (T * 2.6), 0.25, 1));
  }
  g.putImageData(id, 0, 0);
  var Lr = r * 1.28;
  if (P && P.l2l && P.diam) Lr = r * clamp(P.l2l / P.diam, 1.02, 1.9);
  var res = { ok: true, cv: cv, cx: cx, cy: cy, r: r, w: w, h: h, L: Lr, round: round, fb: fallback, sw: sw, hw: hw, y0: best[0], y1: best[1] };
  log('recorte', { round: round, fallback: fallback, r: Math.round(r), hw: Math.round(hw), sw: Math.round(sw), cx: Math.round(cx), cy: Math.round(cy) });
  return res;
}
function circFit(P) {
  var n = P.length; if (n < 8) return null; var mx = 0, my = 0, i; for (i = 0; i < n; i++) { mx += P[i][0]; my += P[i][1]; } mx /= n; my /= n;
  var Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (i = 0; i < n; i++) { var u = P[i][0] - mx, v = P[i][1] - my; Suu += u * u; Svv += v * v; Suv += u * v; Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u; }
  var A = Suu, Bm = Suv, C = Svv, D = 0.5 * (Suuu + Suvv), E = 0.5 * (Svvv + Svuu), det = A * C - Bm * Bm; if (Math.abs(det) < 1e-9) return null;
  var uc = (D * C - Bm * E) / det, vc = (A * E - Bm * D) / det; return { x: uc + mx, y: vc + my, r: Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / n) };
}
function circRobust(P) {
  var pts = P, f = null, n0 = P.length;
  for (var it = 0; it < 6; it++) {
    var g = circFit(pts); if (!g) break; f = g;
    var rs = pts.map(function (q) { return Math.abs(Math.hypot(q[0] - g.x, q[1] - g.y) - g.r); }), m = rs.slice().sort(function (a, b) { return a - b; })[rs.length >> 1];
    var nx = pts.filter(function (q, j) { return rs[j] <= Math.max(1.2, 2.2 * m); }); if (nx.length < 12 || nx.length === pts.length) { pts = nx.length >= 12 ? nx : pts; break; } pts = nx;
  }
  if (!f) return null;
  var rr = pts.map(function (q) { return Math.abs(Math.hypot(q[0] - f.x, q[1] - f.y) - f.r); }).sort(function (a, b) { return a - b; });
  return { x: f.x, y: f.y, r: f.r, inl: pts.length / n0, res: rr[rr.length >> 1] || 0 };
}

/* ================= lume: máscara das partes luminosas (mesma regra do app original) ================= */
function lumeV2(p, w, h, cx, cy, r, full, digital) {
  var n = w * h, i, x, y, k;
  function blur3(src) {
    var o = new Float32Array(n), t = new Float32Array(n);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var s = 0, c = 0; for (k = -1; k <= 1; k++) { var xx = x + k; if (xx < 0) xx = 0; if (xx >= w) xx = w - 1; var wt = k ? 1 : 2; s += wt * src(y * w + xx); c += wt; } t[y * w + x] = s / c; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var s2 = 0, c2 = 0; for (k = -1; k <= 1; k++) { var yy = y + k; if (yy < 0) yy = 0; if (yy >= h) yy = h - 1; var wt2 = k ? 1 : 2; s2 += wt2 * t[yy * w + x]; c2 += wt2; } o[y * w + x] = s2 / c2; }
    return o;
  }
  var Rb = blur3(function (j) { return p[4 * j]; }), Gb = blur3(function (j) { return p[4 * j + 1]; }), Bb = blur3(function (j) { return p[4 * j + 2]; });
  var A = new Uint8Array(n), L = new Float32Array(n), D = new Float32Array(n), LL = new Float32Array(n), La = new Float32Array(n), Lb = new Float32Array(n);
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
  for (i = 0; i < n; i++) {
    A[i] = p[4 * i + 3] > 128 ? 1 : 0; L[i] = (Rb[i] + Gb[i] + Bb[i]) / 3; x = i % w; y = (i - x) / w; D[i] = Math.hypot(x - cx, y - cy) / r;
    var R = lin(p[4 * i]), G = lin(p[4 * i + 1]), B = lin(p[4 * i + 2]), X = (0.412453 * R + 0.357580 * G + 0.180423 * B) / 0.950456, Y = 0.212671 * R + 0.715160 * G + 0.072169 * B, Z = (0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.088754;
    var fy = f(Y); LL[i] = (Y > 0.008856 ? 116 * fy - 16 : 903.3 * Y) * 2.55; La[i] = 500 * (f(X) - fy) + 128; Lb[i] = 200 * (fy - f(Z)) + 128;
  }
  function med(arr) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s.length ? s[s.length >> 1] : 0; }
  function pct(arr, q) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.min(s.length - 1, Math.floor(q / 100 * s.length))] : 0; }
  var ring = []; for (i = 0; i < n; i++) if (A[i] && D[i] > 0.25 && D[i] < 0.5) ring.push(i);
  if (ring.length < 20) { ring = []; for (i = 0; i < n; i++) if (A[i] && D[i] < 0.5) ring.push(i); }
  if (!ring.length) return null;
  var dl = [med(ring.map(function (j) { return LL[j]; })), med(ring.map(function (j) { return La[j]; })), med(ring.map(function (j) { return Lb[j]; }))];
  var dist = new Float32Array(n); for (i = 0; i < n; i++) dist[i] = Math.hypot(LL[i] - dl[0], La[i] - dl[1], Lb[i] - dl[2]);
  var md = med(ring.map(function (j) { return L[j]; })), tol = Math.max(14, pct(ring.map(function (j) { return dist[j]; }), 60) * 1.8);
  function morph(m, er, kw, kh, ox, oy) {
    var o = new Uint8Array(n);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var v = er ? 1 : 0;
      for (var dy = 0; dy < kh && (er ? v : !v); dy++) for (var dx = 0; dx < kw; dx++) { var X2 = x + dx - ox, Y2 = y + dy - oy; var q = (X2 < 0 || Y2 < 0 || X2 >= w || Y2 >= h) ? (er ? 1 : 0) : m[Y2 * w + X2]; if (er && !q) { v = 0; break; } if (!er && q) { v = 1; break; } }
      o[y * w + x] = v;
    }
    return o;
  }
  var sim = new Uint8Array(n); for (i = 0; i < n; i++) sim[i] = (dist[i] < tol && A[i] && D[i] < 1) ? 1 : 0; sim = morph(morph(sim, 0, 3, 3, 1, 1), 1, 3, 3, 1, 1);
  function label(m, conn8) {
    var lb = new Int32Array(n), st = [null], q = [], cur = 0;
    for (var s = 0; s < n; s++) {
      if (!m[s] || lb[s]) continue; cur++; var area = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; q.length = 0; q.push(s); lb[s] = cur;
      while (q.length) {
        var j = q.pop(), jx = j % w, jy = (j - jx) / w; area++; if (jx < x0) x0 = jx; if (jx > x1) x1 = jx; if (jy < y0) y0 = jy; if (jy > y1) y1 = jy;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; if (!conn8 && dx && dy) continue; var X3 = jx + dx, Y3 = jy + dy; if (X3 < 0 || Y3 < 0 || X3 >= w || Y3 >= h) continue; var t2 = Y3 * w + X3; if (m[t2] && !lb[t2]) { lb[t2] = cur; q.push(t2); } }
      }
      st.push({ a: area, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    }
    return { lb: lb, st: st, n: cur };
  }
  var c1 = label(sim, false), cnt = {};
  ring.forEach(function (j) { if (sim[j]) { var l = c1.lb[j]; cnt[l] = (cnt[l] || 0) + 1; } });
  var keep = {}; Object.keys(cnt).forEach(function (l) { if (cnt[l] > 0.08 * ring.length) keep[l] = 1; });
  var dial = new Uint8Array(n), ds = 0; for (i = 0; i < n; i++) if (keep[c1.lb[i]]) { dial[i] = 1; ds++; }
  if (ds < 0.3 * Math.PI * r * r * 0.25) for (i = 0; i < n; i++) dial[i] = (D[i] < 0.62 && A[i]) ? 1 : 0;
  var inv = new Uint8Array(n); for (i = 0; i < n; i++) inv[i] = dial[i] ? 0 : 1; var c2 = label(inv, false), bord = {};
  for (x = 0; x < w; x++) { bord[c2.lb[x]] = 1; bord[c2.lb[(h - 1) * w + x]] = 1; }
  for (y = 0; y < h; y++) { bord[c2.lb[y * w]] = 1; bord[c2.lb[y * w + w - 1]] = 1; }
  var region = new Uint8Array(n); for (i = 0; i < n; i++) region[i] = (dial[i] || (inv[i] && !bord[c2.lb[i]])) ? 1 : 0;
  var kr = Math.max(3, Math.floor(0.04 * r) | 1), rad = (kr - 1) / 2, reg2 = new Uint8Array(n);
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var v = 0; for (var dy = -rad; dy <= rad && !v; dy++) for (var dx = -rad; dx <= rad; dx++) { if (dx * dx + dy * dy > rad * rad + 0.5) continue; var X4 = x + dx, Y4 = y + dy; if (X4 >= 0 && Y4 >= 0 && X4 < w && Y4 < h && region[Y4 * w + X4]) { v = 1; break; } } reg2[y * w + x] = v; }
  region = reg2;
  var firsts = [];
  for (k = 0; k < 180; k++) {
    var t = k * Math.PI / 90, ux = Math.cos(t), uy = Math.sin(t), run = 0, start = null, found = null;
    for (var qq = 0.45; qq < 1.0; qq += 0.01) { var X5 = Math.round(cx + qq * r * ux), Y5 = Math.round(cy + qq * r * uy); if (X5 < 0 || Y5 < 0 || X5 >= w || Y5 >= h) { found = qq; break; } var j5 = Y5 * w + X5; if (dist[j5] > tol || !A[j5]) { if (run === 0) start = qq; run++; if (run >= 3) { found = start; break; } } else run = 0; }
    firsts.push(found !== null ? found : 0.97);
  }
  var edge = pct(firsts, 75) + 0.01;
  var gg = blur3(function (j) { return L[j]; }), Gx = new Float32Array(n), Gy = new Float32Array(n);
  for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; Gx[i] = (gg[i - w + 1] + 2 * gg[i + 1] + gg[i + w + 1]) - (gg[i - w - 1] + 2 * gg[i - 1] + gg[i + w - 1]); Gy[i] = (gg[i + w - 1] + 2 * gg[i + w] + gg[i + w + 1]) - (gg[i - w - 1] + 2 * gg[i - w] + gg[i - w + 1]); }
  var Eg = new Uint8Array(n), AN = new Int16Array(n);
  for (i = 0; i < n; i++) { x = i % w; y = (i - x) / w; var dd = Math.max(D[i] * r, 1e-3), gr = Math.abs(Gx[i] * (x - cx) + Gy[i] * (y - cy)) / dd, gt = Math.hypot(Gx[i], Gy[i]); Eg[i] = (gr > 50 && gr >= 0.85 * gt && A[i]) ? 1 : 0; AN[i] = Math.floor((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI) * 90) % 90; }
  for (var rr = 0.5; rr < 0.97; rr += 0.02) { var hit = new Uint8Array(90), hc = 0; for (i = 0; i < n; i++) if (Eg[i] && D[i] >= rr && D[i] < rr + 0.03 && !hit[AN[i]]) { hit[AN[i]] = 1; hc++; } if (hc / 90 >= 0.75) { edge = Math.min(edge, rr + 0.03); break; } }
  edge = Math.max(edge, 0.58); var lim = full ? edge - 0.005 : edge + 0.07;
  for (i = 0; i < n; i++) { if (D[i] < edge) region[i] = 1; if (!(A[i] && D[i] < lim)) region[i] = 0; }
  var S = new Float32Array(n);
  if (full) { for (i = 0; i < n; i++) if (region[i]) S[i] = Math.max(0.25, Math.min(1, (L[i] - 60) / 80)); }
  else {
    var cand = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      if (!region[i]) continue; var R2 = Rb[i], G2 = Gb[i], B2 = Bb[i], sat = Math.max(R2, G2, B2) - Math.min(R2, G2, B2);
      if (md > 150 && !digital) cand[i] = (dist[i] > tol * 1.2 && L[i] > md - 70 && L[i] < 255 && sat < 60 && B2 <= Math.max(R2, G2) + 12) ? 1 : 0;
      else { var thr = Math.max(md + 38, digital ? 95 : 110), cream = R2 >= B2 - 5 && G2 >= B2 - 10; cand[i] = (L[i] > thr && (sat < 70 || cream) && dist[i] > tol) ? 1 : 0; }
    }
    cand = morph(morph(cand, 1, 2, 2, 0, 0), 0, 2, 2, 1, 1);
    var c3 = label(cand, true), mn = (digital ? 0.0002 : 0.0008) * r * r, mx = (digital ? 0.25 : 0.12) * r * r, ok = new Uint8Array(c3.n + 1);
    var radL = {}, dmin = {};
    for (i = 0; i < n; i++) { var l3 = c3.lb[i]; if (l3) { (radL[l3] = radL[l3] || []).push(D[i]); if (!(dmin[l3] <= D[i])) dmin[l3] = D[i]; } }
    var rmed = {};
    for (var l = 1; l <= c3.n; l++) { var s3 = c3.st[l]; ok[l] = (s3.a >= mn && s3.a <= mx && !(s3.w > 0.9 * r && s3.h > 0.9 * r)) ? 1 : 0; rmed[l] = med(radL[l] || [0]); if (ok[l] && Math.max(s3.w, s3.h) > 0.3 * r && rmed[l] > 0.86) ok[l] = 0; if (ok[l] && dmin[l] >= edge - 0.01) ok[l] = 0; }
    var idx = []; for (l = 1; l <= c3.n; l++) if (ok[l]) idx.push(l);
    if (idx.length >= 4) {
      var rsx = idx.map(function (l2) { return Math.round(rmed[l2] * 1000) / 1000; }).filter(function (v2) { return v2 > 0.4; }).sort(function (a, b) { return a - b; }).filter(function (v2, j, a2) { return !j || v2 !== a2[j - 1]; }), cut = null;
      for (var z = 0; z + 1 < rsx.length; z++) if (rsx[z + 1] - rsx[z] >= 0.09 && rsx[z + 1] > 0.72) { cut = (rsx[z] + rsx[z + 1]) / 2; break; }
      if (cut !== null) idx.forEach(function (l2) { if (rmed[l2] > cut) ok[l2] = 0; });
    }
    for (i = 0; i < n; i++) if (ok[c3.lb[i]]) S[i] = Math.max(0.45, Math.min(1, (L[i] - md) / 90 + 0.55));
  }
  return { S: blur3(function (j) { return S[j]; }) };
}
function glowOf(C, P, colKey) {
  C.glow = C.glow || {}; if (C.glow[colKey] !== undefined) return C.glow[colKey];
  var col = P.ind ? [110, 225, 235] : (P.dig || P.led) ? [215, 232, 255] : colKey === 'bgw9' ? [130, 205, 255] : [120, 255, 150];
  var res = null;
  try {
    var ss = Math.min(1, 160 / C.r), w = Math.max(2, Math.round(C.w * ss)), h = Math.max(2, Math.round(C.h * ss)), cv = mk(w, h), g = cx2d(cv);
    g.drawImage(C.cv, 0, 0, w, h); var p = g.getImageData(0, 0, w, h).data;
    var m = lumeV2(p, w, h, C.cx * ss, C.cy * ss, C.r * ss, P.full || P.ind, P.dig);
    if (m) {
      var o = mk(w, h), q = o.getContext('2d'), idd = q.createImageData(w, h), d = idd.data, any = 0, gain = (P.full || P.ind) ? 0.75 : 1;
      for (var i = 0; i < m.S.length; i++) { var a = m.S[i] * gain; if (a > 0.01) { any = 1; d[4 * i] = col[0]; d[4 * i + 1] = col[1]; d[4 * i + 2] = col[2]; d[4 * i + 3] = Math.round(Math.min(1, a) * 255); } }
      if (any) {
        q.putImageData(idd, 0, 0);
        var small = function (f) { var c = mk(w / f, h / f), x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(o, 0, 0, c.width, c.height); return c; };
        res = { s: o, b1: small(5), b2: small(13) };
      }
    }
  } catch (e) { log('lume falhou', e); }
  C.glow[colKey] = res; return res;
}

/* ================= pulso renderizado (escala real: 11,4 px/mm) =================
   Sombreamento por pixel, como numa foto de estúdio: volume do braço (seção quase cilíndrica), relevos anatômicos
   (processo estiloide, tendões do dorso, prega do pulso) como mapa de altura, luz suave de cima-esquerda, cor de
   subsuperfície quente nas sombras, textura de pele em ruído (sem riscos) e sombra macia sobre o fundo da página. */
var TONES = [['#F1D2BD', 'Muito clara'], ['#E4B694', 'Clara'], ['#CE9A74', 'Média'], ['#A9734E', 'Morena'], ['#7E5137', 'Escura'], ['#553626', 'Muito escura']];
function toneBg(h) { var c = hex(h), f = function (k) { return 'rgb(' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * k))); }).join(',') + ')'; }; return 'radial-gradient(circle at 34% 30%,' + f(1.12) + ',' + h + ' 52%,' + f(0.8) + ')'; }
function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function parseColor(c) { var m = String(c || '').match(/rgba?\(([^)]+)\)/); if (m) { var a = m[1].split(',').map(parseFloat); if (a.length < 4 || a[3] > 0.5) return [a[0], a[1], a[2]]; return null; } if (/^#[0-9a-f]{6}$/i.test(c)) return hex(c); return null; }
function pageBg(el) { while (el && el.nodeType === 1) { var c = parseColor(getComputedStyle(el).backgroundColor); if (c) return c; el = el.parentElement; } return [255, 255, 255]; }
function s2l(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function l2s(v) { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
function hash2(ix, iy, sd) { var h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(sd, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s, sd) { var X = x / s, Y = y / s, ix = Math.floor(X), iy = Math.floor(Y), fx = X - ix, fy = Y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  var a = hash2(ix, iy, sd), b = hash2(ix + 1, iy, sd), c = hash2(ix, iy + 1, sd), d = hash2(ix + 1, iy + 1, sd); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; }
var WR_CACHE = {};
function makeWrist(o) {
  var bgc = o.bg || [255, 255, 255], key = [o.g, o.t, o.c, bgc.join(',')].join('|'); if (WR_CACHE[key]) return WR_CACHE[key];
  var PX = 11.4, W = 1200, H = 1200, cv = mk(W, H), g = cv.getContext('2d'), fem = o.g === 'f';
  var ww = 0.343 * o.c * 10 * PX / 2, yc = H / 2, xw = W / 2;
  var KB = fem ? [[-90, 1.18], [-50, 1.1], [-20, 1.03], [0, 1], [16, 0.97], [28, 1.0], [45, 1.1], [65, 1.26], [90, 1.38]] : [[-90, 1.3], [-50, 1.18], [-20, 1.05], [0, 1], [16, 0.97], [28, 1.01], [45, 1.13], [65, 1.32], [90, 1.46]],
      KT = fem ? [[-90, 1.15], [-50, 1.08], [-20, 1.02], [0, 1], [9, 1.025], [22, 0.98], [40, 1.04], [65, 1.13], [90, 1.2]] : [[-90, 1.26], [-50, 1.15], [-20, 1.04], [0, 1], [9, 1.05], [22, 0.99], [40, 1.07], [65, 1.18], [90, 1.26]];
  function itp(K, x) { var m = (x - xw) / PX; if (m <= K[0][0]) return K[0][1] * ww; for (var i = 1; i < K.length; i++) if (m <= K[i][0]) { var a = K[i - 1], b = K[i], t = (m - a[0]) / (b[0] - a[0]), u = t * t * (3 - 2 * t); return (a[1] + (b[1] - a[1]) * u) * ww; } return K[K.length - 1][1] * ww; }
  /* contorno por coluna, com leve ondulação orgânica */
  var TOP = new Float32Array(W), BOT = new Float32Array(W);
  for (var x = 0; x < W; x++) { var wob = (vnoise(x, 0, 140, 11) - 0.5) * 0.012 * ww; TOP[x] = yc - itp(KT, x) + wob; BOT[x] = yc + itp(KB, x) + wob * 0.6; }
  /* fundo da página */
  g.fillStyle = 'rgb(' + bgc.join(',') + ')'; g.fillRect(0, 0, W, H);
  /* sombra do braço sobre a superfície (shadowBlur funciona em todos os navegadores, inclusive Safari) */
  function armPath(dy) { g.beginPath(); g.moveTo(-60, TOP[0] + dy); for (var x2 = 0; x2 < W; x2 += 4) g.lineTo(x2, TOP[x2] + dy); g.lineTo(W + 60, TOP[W - 1] + dy); g.lineTo(W + 60, BOT[W - 1] + dy); for (x2 = W - 1; x2 >= 0; x2 -= 4) g.lineTo(x2, BOT[x2] + dy); g.lineTo(-60, BOT[0] + dy); g.closePath(); }
  var lum = (bgc[0] * 0.3 + bgc[1] * 0.59 + bgc[2] * 0.11) / 255, sh = 0.55 + 0.45 * lum;
  [[70, 0.16 * sh, 18, 46], [26, 0.2 * sh, 6, 18], [8, 0.22 * sh, 2, 7]].forEach(function (s) {
    g.save(); g.shadowColor = 'rgba(0,0,0,' + s[1] + ')'; g.shadowBlur = s[0]; g.shadowOffsetX = s[2]; g.shadowOffsetY = s[3] + 4000; armPath(-4000); g.fillStyle = '#000'; g.fill(); g.restore();
  });
  /* pele, pixel a pixel */
  /* a pele é lisa: calcula em meia resolução e suaviza na ampliação (4× mais rápido) */
  var R = 0.5, SW = Math.round(W * R), SH = Math.round(H * R), sc = mk(SW, SH), sgc = sc.getContext('2d'), id = sgc.createImageData(SW, SH), d = id.data, base = hex(TONES[o.t][0]).map(s2l);
  var dark = 1 - (0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]) / 0.6; /* 0 clara … ~1 escura */
  var L = [-0.28, -0.8, 0.52], Ln = Math.hypot(L[0], L[1], L[2]); L = L.map(function (v) { return v / Ln; });
  var Hh = [L[0], L[1], L[2] + 1], Hn = Math.hypot(Hh[0], Hh[1], Hh[2]); Hh = Hh.map(function (v) { return v / Hn; });
  var bgl = bgc.map(s2l), mm = function (v) { return xw + v * PX; };
  /* relevos: [x mm, v (-1 topo … 1 base), sx mm, sv, amplitude] */
  var B = [[10, -0.55, 9, 0.32, fem ? 0.06 : 0.1], [-38, -0.15, 38, 0.6, 0.18]];
  for (var ys = 0; ys < SH; ys++) {
    var y = (ys + 0.5) / R;
    for (var xs = 0; xs < SW; xs++) {
      x = Math.min(W - 1, Math.floor((xs + 0.5) / R));
      var t = TOP[x], b = BOT[x]; if (y < t - 2 || y > b + 2) continue;
      var a = Math.min(y - t, b - y) * R + 0.5; a = a < 0 ? 0 : a > 1 ? 1 : a; if (a <= 0) continue;
      var half = (b - t) / 2, mid = (b + t) / 2, v = (y - mid) / half; if (v < -0.999) v = -0.999; if (v > 0.999) v = 0.999;
      var nz = Math.sqrt(1 - v * v), ny = v, nx = 0;
      /* relevos (gradiente analítico das gaussianas) */
      var xm = (x - xw) / PX, hx = 0, hv = 0;
      for (var k = 0; k < B.length; k++) { var q = B[k], ex = (xm - q[0]) / q[2], ev = (v - q[1]) / q[3], e = q[4] * Math.exp(-0.5 * (ex * ex + ev * ev)); hx += -e * ex / q[2]; hv += -e * ev / q[3]; }
      /* tendões do dorso da mão (a partir da prega, ~28 mm) */
      if (xm > 24) { var gr = Math.min(1, (xm - 24) / 30) * (fem ? 0.05 : 0.08); for (k = 0; k < 4; k++) { var c0 = (-0.5 + k * 0.33) * (0.62 + (xm - 24) / 120), ev2 = (v - c0) / 0.11, e2 = gr * Math.exp(-0.5 * ev2 * ev2); hv += -e2 * ev2 / 0.11; } }
      /* prega dorsal do pulso: leve vinco */
      var ec = (xm - 28.5) / 1.2, ecr = -0.05 * Math.exp(-0.5 * ec * ec) * (1 - v * v); hx += -ecr * ec / 1.2;
      nx -= hx * 0.08; ny -= hv * 0.35 * nz;
      var nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      var dl = nx * L[0] + ny * L[1] + nz * L[2], dif = (dl + 0.32) / 1.32; if (dif < 0) dif = 0;
      var dh = nx * Hh[0] + ny * Hh[1] + nz * Hh[2], spec = dh > 0 ? 0.055 * Math.pow(dh, 22) + 0.03 * Math.pow(dh, 5) : 0;
      spec *= (1 - 0.55 * dark) * (fem ? 1.1 : 1);
      var rim = Math.pow(1 - nz, 3) * 0.06;
      /* textura: manchas suaves, rubor, poros */
      var n1 = vnoise(x, y, 180, 3) - 0.5, n2 = vnoise(x, y, 38, 5) - 0.5, n3 = vnoise(x, y, 7, 7) - 0.5, n4 = hash2(x, y, 9) - 0.5;
      var tex = 1 + n1 * 0.07 + n2 * 0.045 + n3 * (fem ? 0.02 : 0.035) + n4 * 0.018;
      var red = n1 * 0.05 + (xm > 30 ? Math.min(0.05, (xm - 30) / 900) : 0);
      var ar = base[0] * tex * (1 + red), ag = base[1] * tex * (1 - red * 0.6), ab = base[2] * tex * (1 - red * 0.4);
      /* subsuperfície: sombras puxam para o vermelho */
      var ss = (1 - dif); ss = ss * ss * 0.8;
      var tr = 1 - ss * 0.05, tg = 1 - ss * 0.32, tb = 1 - ss * 0.42;
      var nzc = Math.sqrt(1 - v * v), edge = 0.5 + 0.5 * Math.pow(nzc, 0.75), amb = 0.2, lit = (amb + dif * 1.0) * edge, bounce = ny > 0 ? ny * ny * 0.05 : 0;
      var r = ar * (lit * tr) + spec + rim + bgl[0] * bounce * ar, gg2 = ag * (lit * tg) + spec + rim + bgl[1] * bounce * ag, bb = ab * (lit * tb) + spec * 1.02 + rim + bgl[2] * bounce * ab;
      var i4 = (ys * SW + xs) * 4;
      d[i4] = l2s(r); d[i4 + 1] = l2s(gg2); d[i4 + 2] = l2s(bb); d[i4 + 3] = Math.round(a * 255);
    }
  }
  sgc.putImageData(id, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(sc, 0, 0, W, H);
  return (WR_CACHE[key] = { cv: cv, cx: xw, cy: yc, pxmm: PX, wmm: 0.343 * o.c * 10, ww: ww, top: TOP, bot: BOT });
}
/* pulseira contornando o pulso: caixa e alças planas, depois a pulseira segue a seção elíptica do pulso e escurece até a borda */
function covOf(C) {
  if (C._cov !== undefined) return C._cov; C._cov = null;
  try { var p = cx2d(C.cv).getImageData(0, 0, C.w, C.h).data, cov = new Float32Array(C.h), mx = 0; for (var y = 0; y < C.h; y++) { var n = 0; for (var x = 0; x < C.w; x++) if (p[(y * C.w + x) * 4 + 3] > 100) n++; cov[y] = n; if (n > mx) mx = n; } var t = mx * 0.22, a = 0, b = C.h - 1; while (a < C.h && cov[a] < t) a++; while (b > 0 && cov[b] < t) b--; C._cov = { top: a, bot: b, arr: cov }; } catch (e) {}
  return C._cov;
}
function drawWrapped(g, C, scale, A) {
  var cut = C.cv, B = 0.65 * A, L = C.L * scale, ih = C.h, iw = C.w, N = 240, TH = [], S = [0], x = -C.cx * scale, w = iw * scale;
  for (var i = 0; i <= N; i++) { TH[i] = i / N * Math.PI / 2; if (i) S[i] = S[i - 1] + Math.hypot(A * Math.cos(TH[i]), B * Math.sin(TH[i])) * (Math.PI / 2 / N); }
  function th(sv) { if (sv <= 0) return 0; if (sv >= S[N]) return Math.PI / 2; var lo = 0, hi = N; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (S[m] < sv) lo = m; else hi = m; } return TH[lo] + (TH[hi] - TH[lo]) * (sv - S[lo]) / (S[hi] - S[lo] || 1); }
  var thL = L < A ? Math.asin(L / A) : Math.PI / 2, sL = 0;
  for (var i2 = 1; i2 <= N; i2++) if (TH[i2] >= thL) { sL = S[i2 - 1] + (S[i2] - S[i2 - 1]) * (thL - TH[i2 - 1]) / (TH[i2] - TH[i2 - 1]); break; }
  var need = Math.max(0, S[N] - sL), Ym = Math.max(L, A * 1.12) + 4, O = mk(Math.ceil(w), Math.ceil(2 * Ym)), o = O.getContext('2d');
  var r0 = Math.max(0, C.cy - L / scale), r1 = Math.min(ih, C.cy + L / scale); o.drawImage(cut, 0, r0, iw, r1 - r0, 0, Ym + (r0 - C.cy) * scale, w, (r1 - r0) * scale);
  var cov = covOf(C), cr = C.r * scale;
  /* até onde a pulseira mantém a largura cheia (evita usar a ponta afinada da foto) */
  function fullEnd(sd) {
    if (!cov) return sd < 0 ? 0 : ih - 1;
    var arr = cov.arr, st = Math.round(C.cy + sd * (L / scale + 0.06 * C.r)), ref = 0, n = 0, r;
    for (var k = 0; k < 10; k++) { r = st + sd * k; if (r >= 0 && r < ih) { ref += arr[r]; n++; } } ref /= n || 1;
    r = st; while (r > 1 && r < ih - 2 && arr[r] >= 0.9 * ref) r += sd;
    return r - sd * 3;
  }
  [-1, 1].forEach(function (sd) {
    var endRow = fullEnd(sd), avail = Math.max(0, Math.abs(endRow - C.cy) * scale - L), t0 = Math.min(0.1 * cr, avail * 0.3), T = Math.max(4, Math.min(0.5 * cr, avail - t0 - 2)), dCut = avail >= need ? need : Math.max(0, avail - 2);
    /* repetição espelhada entre t0 e dCut: sem emendas (a textura vai e volta) */
    var Pm = dCut - t0; function mir(d) { if (Pm < 4) return t0 + ((d - dCut) % T); var u = (d - dCut) % (2 * Pm); return u < Pm ? dCut - u : t0 + (u - Pm); }
    var dd = 1.2, prev = A * Math.sin(th(sL)), lastSrc = 0;
    o.globalCompositeOperation = 'source-over';
    for (var d = 0; d < need; d += dd) {
      var t2 = th(sL + d + dd), xp = A * Math.sin(t2), src = d <= dCut ? d : mir(d);
      var sr = C.cy + sd * (L + src) / scale, sh = dd / scale; if (sd < 0) sr -= sh; if (sr < 0 || sr + sh > ih) { prev = xp; continue; }
      var dy0 = Ym + sd * prev, dy1 = Ym + sd * xp, yy = Math.min(dy0, dy1), hh = Math.max(0.7, Math.abs(dy1 - dy0) + 0.5);
      o.drawImage(cut, 0, sr, iw, sh, 0, yy, w, hh); prev = xp; lastSrc = src;
    }
    /* sobra além da lateral do pulso (a máscara do braço recorta seguindo o contorno) */
    var srx = C.cy + sd * (L + lastSrc) / scale;
    if (srx > 2 && srx < ih - 3) for (var e = 0; e < 0.1 * A; e += 1.5) { var yy2 = sd < 0 ? Ym - A - e - 1.5 : Ym + A + e; o.drawImage(cut, 0, sd < 0 ? srx - 1.5 / scale : srx, iw, 1.5 / scale, 0, yy2, w, 1.7); }
    /* sombreamento contínuo da curva (gradiente único, sem faixas) */
    var y0 = Ym + sd * A * Math.sin(th(sL)), y1 = Ym + sd * A * 1.12, gr = o.createLinearGradient(0, y0, 0, y1);
    for (var j = 0; j <= 20; j++) {
      var dj = need * j / 20, tj = th(sL + dj), yj = Ym + sd * A * Math.sin(tj), kj = A * Math.cos(tj) / Math.hypot(A * Math.cos(tj), B * Math.sin(tj));
      var f = (yj - y0) / (y1 - y0); if (f >= 0 && f <= 1) gr.addColorStop(f, 'rgba(0,0,0,' + Math.min(0.8, (1 - kj) * 0.85 + (j ? 0.04 : 0)).toFixed(3) + ')');
    }
    gr.addColorStop(1, 'rgba(0,0,0,.84)');
    o.globalCompositeOperation = 'source-atop'; o.fillStyle = gr; o.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0) + 2);
  });
  o.globalCompositeOperation = 'source-over'; g.drawImage(O, x, -Ym);
}

/* ================= foto do pulso do cliente: acha a caixa do relógio perto do toque ================= */
function ellFit(P, cx, cy, r) {
  var N = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], Y = [0, 0, 0, 0, 0], i, j, k;
  P.forEach(function (p) { var u = (p[0] - cx) / r, v = (p[1] - cy) / r, R = [u * u, u * v, v * v, u, v]; for (i = 0; i < 5; i++) { Y[i] += R[i]; for (j = 0; j < 5; j++) N[i][j] += R[i] * R[j]; } });
  for (i = 0; i < 5; i++) {
    var pv = i; for (k = i + 1; k < 5; k++) if (Math.abs(N[k][i]) > Math.abs(N[pv][i])) pv = k; var tmp = N[i]; N[i] = N[pv]; N[pv] = tmp; var ty = Y[i]; Y[i] = Y[pv]; Y[pv] = ty; if (Math.abs(N[i][i]) < 1e-12) return null;
    for (k = i + 1; k < 5; k++) { var fct = N[k][i] / N[i][i]; for (j = i; j < 5; j++) N[k][j] -= fct * N[i][j]; Y[k] -= fct * Y[i]; }
  }
  var X = [0, 0, 0, 0, 0]; for (i = 4; i >= 0; i--) { var sm = Y[i]; for (j = i + 1; j < 5; j++) sm -= N[i][j] * X[j]; X[i] = sm / N[i][i]; }
  var A = X[0], B = X[1], C = X[2], D = X[3], E = X[4], det = A * C - B * B / 4; if (det <= 0) return null;
  var u0 = -0.5 * (C * D - B / 2 * E) / det, v0 = -0.5 * (A * E - B / 2 * D) / det, kk = A * u0 * u0 + B * u0 * v0 + C * v0 * v0 + D * u0 + E * v0 - 1;
  var mid = (A + C) / 2, rad = Math.sqrt((A - C) * (A - C) / 4 + B * B / 4), l1 = mid - rad, l2 = mid + rad; if (l1 <= 0 || -kk / l1 <= 0) return null;
  return { x: cx + u0 * r, y: cy + v0 * r, a: Math.sqrt(-kk / l1) * r, b: Math.sqrt(-kk / l2) * r, phi: 0.5 * Math.atan2(B, A - C) + Math.PI / 2 };
}
function ellRes(f, p) { var dx = p[0] - f.x, dy = p[1] - f.y, c = Math.cos(f.phi), s = Math.sin(f.phi), X = dx * c + dy * s, Y = -dx * s + dy * c; return Math.abs(Math.hypot(X / f.a, Y / f.b) - 1) * f.a; }
function caseFind(im, px, py) {
  var W0 = im.naturalWidth || im.width, H0 = im.naturalHeight || im.height, S = Math.round(Math.min(W0, H0) * 0.42), x0 = Math.max(0, Math.round(px - S)), y0 = Math.max(0, Math.round(py - S)),
      x1 = Math.min(W0, Math.round(px + S)), y1 = Math.min(H0, Math.round(py + S)), bw = x1 - x0, bh = y1 - y0; if (bw < 20 || bh < 20) return null;
  var sc = Math.min(1, 280 / Math.max(bw, bh)), w = Math.max(8, Math.round(bw * sc)), h = Math.max(8, Math.round(bh * sc)), cv = mk(w, h), g = cx2d(cv); g.drawImage(im, x0, y0, bw, bh, 0, 0, w, h);
  var d = g.getImageData(0, 0, w, h).data, n = w * h, G = new Float32Array(n), T = new Float32Array(n), i, x, y, k, pass;
  for (i = 0; i < n; i++) G[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
  for (pass = 0; pass < 2; pass++) {
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var s1 = 0, c1 = 0; for (k = -1; k <= 1; k++) if (x + k >= 0 && x + k < w) { s1 += G[y * w + x + k]; c1++; } T[y * w + x] = s1 / c1; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var s2 = 0, c2 = 0; for (k = -1; k <= 1; k++) if (y + k >= 0 && y + k < h) { s2 += T[(y + k) * w + x]; c2++; } G[y * w + x] = s2 / c2; }
  }
  var GX = new Float32Array(n), GY = new Float32Array(n), M = new Float32Array(n);
  for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; var gx = (G[i - w + 1] + 2 * G[i + 1] + G[i + w + 1]) - (G[i - w - 1] + 2 * G[i - 1] + G[i + w - 1]), gy = (G[i + w - 1] + 2 * G[i + w] + G[i + w + 1]) - (G[i - w - 1] + 2 * G[i - w] + G[i - w + 1]); GX[i] = gx; GY[i] = gy; M[i] = Math.hypot(gx, gy); }
  var ms = Array.prototype.slice.call(M).sort(function (a, b) { return a - b; }), thr = Math.max(24, ms[Math.floor(n * 0.85)]), E = []; for (i = 0; i < n; i++) if (M[i] > thr) E.push(i);
  var tx = (px - x0) * sc, ty = (py - y0) * sc, rmin = Math.max(6, Math.round(Math.min(w, h) * 0.07)), rmax = Math.round(Math.min(w, h) * 0.5), A = new Float32Array(n), best = [];
  for (var r = rmin; r <= rmax; r++) {
    A.fill(0);
    for (var e = 0; e < E.length; e++) { i = E[e]; x = i % w; y = (i - x) / w; var ux = GX[i] / M[i], uy = GY[i] / M[i]; for (var sg = -1; sg <= 1; sg += 2) { var cx = Math.round(x + sg * r * ux), cy = Math.round(y + sg * r * uy); if (cx >= 0 && cx < w && cy >= 0 && cy < h) A[cy * w + cx] += 1; } }
    var bv = 0, bi = -1;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { if (Math.hypot(x - tx, y - ty) > 0.7 * r) continue; i = y * w + x; var v = A[i] + A[i - 1] + A[i + 1] + A[i - w] + A[i + w] + (A[i - w - 1] + A[i - w + 1] + A[i + w - 1] + A[i + w + 1]) * 0.5; if (v > bv) { bv = v; bi = i; } }
    if (bi >= 0) best.push({ r: r, x: bi % w, y: Math.floor(bi / w), s: bv / (2 * Math.PI * r) });
  }
  if (!best.length) return null;
  var top = best.reduce(function (a, b) { return b.s > a.s ? b : a; }), pick = best.filter(function (b) { return b.s >= 0.75 * top.s && Math.hypot(b.x - top.x, b.y - top.y) < 0.2 * Math.max(b.r, top.r); }).reduce(function (a, b) { return b.r > a.r ? b : a; }, top);
  if (pick.s < 0.12) return null;
  function rays(rad0, lo, hi, sig) {
    var P = [];
    for (var an = 0; an < 144; an++) {
      var t = an * Math.PI / 72, ux = Math.cos(t), uy = Math.sin(t), R0 = rad0(t), bm = 0, br = 0;
      for (var q = lo * R0; q <= hi * R0; q += 0.5) { var X = Math.round(pick.x + q * ux), Y = Math.round(pick.y + q * uy); if (X < 1 || Y < 1 || X >= w - 1 || Y >= h - 1) break; var j = Y * w + X, sc2 = Math.abs(GX[j] * ux + GY[j] * uy) * Math.exp(-Math.pow((q - R0) / (sig * R0), 2)); if (sc2 > bm) { bm = sc2; br = q; } }
      if (bm > thr * 0.35) P.push([pick.x + br * ux, pick.y + br * uy]);
    }
    return P;
  }
  function robust(P) { var el = null, pts = P; if (P.length < 24) return null; for (var it = 0; it < 4; it++) { var f = ellFit(pts, pick.x, pick.y, pick.r); if (!f) break; el = f; var res = pts.map(function (p) { return ellRes(f, p); }), md = res.slice().sort(function (a, b) { return a - b; })[res.length >> 1]; pts = pts.filter(function (p, j) { return res[j] <= Math.max(1.2, 2 * md); }); if (pts.length < 20) break; } return el; }
  var el = robust(rays(function () { return pick.r; }, 0.6, 1.45, 0.22));
  if (el) { var e1 = el; el = robust(rays(function (t) { var c = Math.cos(t - e1.phi), s = Math.sin(t - e1.phi); return 1 / Math.sqrt(c * c / (e1.a * e1.a) + s * s / (e1.b * e1.b)); }, 0.9, 1.1, 0.06)) || e1; }
  if (!el || el.a > 1.5 * pick.r || el.a < 0.7 * pick.r || el.b / el.a < 0.45) el = { x: pick.x, y: pick.y, a: pick.r, b: pick.r, phi: 0 };
  if (el.b / el.a > 0.94) { var m2 = Math.sqrt(el.a * el.b); el = { x: el.x, y: el.y, a: m2, b: m2, phi: 0 }; }
  return { cx: x0 + el.x / sc, cy: y0 + el.y / sc, a: el.a / sc, b: el.b / sc, phi: el.phi };
}
function imgFromBlob(b) { return new Promise(function (res, rej) { var u = URL.createObjectURL(b), im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { URL.revokeObjectURL(u); rej(); }; im.src = u; }); }
function isHeic(f) { return /heic|heif/i.test(f.type || '') || /\.(heic|heif)$/i.test(f.name || ''); }
function heicToJpeg(f) {
  return new Promise(function (res, rej) {
    function go() { window.heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 }).then(function (o) { res(Array.isArray(o) ? o[0] : o); }).catch(rej); }
    if (window.heic2any) return go(); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'; s.onload = go; s.onerror = rej; document.head.appendChild(s);
  });
}
function shrink(im) { var W0 = im.naturalWidth || im.width, H0 = im.naturalHeight || im.height, s = Math.min(1, 1600 / Math.max(W0, H0)), c = mk(W0 * s, H0 * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; }
function idb() { return new Promise(function (res, rej) { try { var r = indexedDB.open('impala_pulso_foto', 1); r.onupgradeneeded = function () { r.result.createObjectStore('f'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(); }; } catch (e) { rej(); } }); }
function photoSave(F, withImg) {
  var meta = { pts: F.pts, refmm: F.refmm, rot: F.rot, dx: F.dx, dy: F.dy, q: F.q, phi: F.phi, ell: !!F.ell, cal: !!F.cal };
  var pb = withImg && F.img ? new Promise(function (res) { try { F.img.toBlob(function (b) { res(b); }, 'image/jpeg', 0.88); } catch (e) { res(null); } }) : Promise.resolve(undefined);
  pb.then(function (b) { return idb().then(function (db) { var st = db.transaction('f', 'readwrite').objectStore('f'); if (withImg) { if (F.img && b) st.put(b, 'img'); else st.delete('img'); } st.put(meta, 'meta'); }); }).catch(function () {});
}
function photoLoad() {
  return idb().then(function (db) {
    return new Promise(function (res) {
      var st = db.transaction('f').objectStore('f'), ri = st.get('img'), rm = st.get('meta'), out = {};
      ri.onsuccess = function () { out.b = ri.result; }; rm.onsuccess = function () { out.m = rm.result; };
      st.transaction.oncomplete = function () { if (!out.b) return res(null); imgFromBlob(out.b).then(function (im) { res({ img: shrink(im), m: out.m || {} }); }).catch(function () { res(null); }); };
      st.transaction.onerror = function () { res(null); };
    });
  }).catch(function () { return null; });
}

/* ================= caimento ================= */
/* caimento: o lug to lug (altura do relógio, de ponta a ponta das alças) comparado à largura do pulso visto de cima.
   Largura ≈ 34,3% da circunferência (seção do pulso ~ elipse; médias antropométricas). A parte plana do dorso,
   onde as alças apoiam sem "flutuar", fica em torno de 85% dessa largura. */
var FIT_Z = [68, 88, 100]; /* % da largura: discreto | ideal | grande | passa da borda */
function fitOf(P, C) {
  var w = 0.343 * C * 10, dm = P.diam || 0, l2l = P.l2l || (dm ? dm * 1.2 : 0);
  if (!l2l) return null; var pct = l2l / w * 100, cs = fmt(C, 1), est = P.l2l ? '' : ' (estimado)';
  var base = { w: w, l2l: l2l, pct: pct, tip: 'Pulso de ' + cs + ' cm ≈ ' + Math.round(w) + ' mm de largura vista de cima. Lug to lug ' + fmt(l2l, 1) + ' mm' + est + ' = ' + Math.round(pct) + '% dessa largura.' };
  function o(k, t, c, s) { return Object.assign({ k: k, t: t, c: c, s: s }, base); }
  if (pct < FIT_Z[0]) return o('pequeno', 'Veste discreto', '#a8915f', 'fica discreto: sobra bastante pulso dos lados.');
  if (pct <= 85) return o('bem', 'Veste bem', '#2f855a', 'veste bem: as alças ficam dentro do pulso, com folga.');
  if (pct <= FIT_Z[1]) return o('limite', 'No limite ideal', '#a8915f', 'fica no limite do ideal: as alças chegam perto da borda do pulso.');
  if (pct <= FIT_Z[2]) return o('grande', 'Grande para o pulso', '#b44a3c', 'fica grande: as alças chegam à borda do pulso.');
  return o('muito', 'Passa da borda do pulso', '#b44a3c', 'fica muito grande: as alças passam da borda do pulso.');
}

/* ================= estilos ================= */
var CSS = [
'.ipz{--ip-ink:#211e1f;--ip-txt:#515151;--ip-mut:#8d8a8b;--ip-line:#e4e3e3;--ip-soft:#efefef;--ip-acc:#211e1f;--ip-bg:#fff;font-family:inherit;color:var(--ip-txt);box-sizing:border-box;clear:both}',
'.ipz *,.ipz *:before,.ipz *:after{box-sizing:border-box}',
':where(.ipz) button{font:inherit;cursor:pointer;text-shadow:none;box-shadow:none}',
'.ipz input[type=range]{height:auto;padding:0;border:0;box-shadow:none;background:transparent;display:block}',
'.ipz .ipz-num{height:auto;margin:0;display:inline-block;border-radius:0;box-shadow:none;color:var(--ip-ink);background:#fff}',
'.ipz [hidden]{display:none!important}',
'.ipz-stage{position:relative;overflow:hidden;background:var(--ip-bg);touch-action:pan-y;-webkit-user-select:none;user-select:none}',
'.ipz-stage canvas{display:block;width:100%;height:auto}',
'.ipz-stage.ipz-sq{aspect-ratio:1/1}.ipz-stage.ipz-sq canvas[data-r=cv]{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}',
'.ipz [data-r=fitp]{min-height:66px}.ipz [data-r=h3]{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.ipz-stage.ipz-tap canvas{cursor:crosshair;touch-action:none}.ipz-stage.ipz-drag canvas{cursor:grab;touch-action:none}',
'.ipz-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:2px;color:var(--ip-mut);background:var(--ip-bg);text-transform:uppercase}',
'.ipz-load:after{content:"";width:24px;height:1px;background:currentColor;margin-left:12px;animation:ipzp 1.4s ease-in-out infinite}',
'@keyframes ipzp{0%,100%{opacity:.2;transform:scaleX(.3)}50%{opacity:1;transform:scaleX(1)}}',
'@media (prefers-reduced-motion:reduce){.ipz-load:after{animation:none}}',
'.ipz-cap{position:absolute;left:12px;bottom:12px;padding:5px 10px;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;line-height:1.35;color:#fff;background:rgba(33,30,31,.72);pointer-events:none}',
'.ipz-tones{display:flex;gap:12px;flex-wrap:wrap;align-items:center}',
'.ipz .ipz-tone{width:26px;height:26px;border-radius:50%;border:0;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);transition:box-shadow .15s,transform .15s}',
'.ipz .ipz-tone:hover{transform:scale(1.08)}',
'.ipz .ipz-tone[aria-checked="true"]{box-shadow:inset 0 0 0 1px rgba(0,0,0,.1),0 0 0 3px var(--ip-bg),0 0 0 4px var(--ip-ink)}',
'.ipz input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:2px 0 0;background:transparent;cursor:pointer;--p:50%}',
'.ipz input[type=range]::-webkit-slider-runnable-track{height:2px;background:linear-gradient(var(--ip-ink),var(--ip-ink)) 0/var(--p) 100% no-repeat,var(--ip-line);border:0}',
'.ipz input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--ip-bg);border:1.5px solid var(--ip-ink);margin-top:-8px;box-shadow:0 1px 4px rgba(0,0,0,.12);transition:transform .15s}',
'.ipz input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15)}',
'.ipz input[type=range]::-moz-range-track{height:2px;background:var(--ip-line);border:0}',
'.ipz input[type=range]::-moz-range-progress{height:2px;background:var(--ip-ink)}',
'.ipz input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--ip-bg);border:1.5px solid var(--ip-ink);box-shadow:0 1px 4px rgba(0,0,0,.12)}',
'.ipz-scale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ip-mut);letter-spacing:.5px;margin-top:2px}',
'.ipz-field{display:flex;flex-direction:column;gap:8px}',
'.ipz .ipz-lab{font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ip-mut);display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
'.ipz .ipz-lab b{color:var(--ip-ink);font-weight:600;letter-spacing:1px}',
'.ipz-opt{display:inline-flex;border:1px solid var(--ip-ink);align-self:flex-start}',
'.ipz .ipz-opt button{border:0;background:transparent;color:var(--ip-ink);padding:8px 16px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;transition:background .15s,color .15s}',
'.ipz .ipz-opt button+button{border-left:1px solid var(--ip-ink)}',
'.ipz .ipz-opt button[aria-pressed="true"]{background:var(--ip-ink);color:#fff}',
'.ipz-acts{display:flex;flex-wrap:wrap;gap:10px}',
'.ipz .ipz-act{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--ip-ink);background:transparent;color:var(--ip-ink);padding:11px 16px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;transition:background .15s,color .15s}',
'.ipz .ipz-act:hover,.ipz .ipz-act[aria-pressed="true"]{background:var(--ip-ink);color:#fff}',
'.ipz .ipz-act svg{width:15px;height:15px;flex:0 0 15px}',
'@media (max-width:767px){.ipz-acts .ipz-act{flex:1 1 100%;justify-content:center}.ipz-opt{align-self:stretch}.ipz .ipz-opt button{flex:1}}',
'.ipz .ipz-link{background:none;border:0;padding:0;color:var(--ip-ink);font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:600;border-bottom:1px solid currentColor;line-height:1.6}',
'.ipz .ipz-link[aria-pressed="true"]{color:var(--ip-acc)}',
'.ipz-link:focus-visible,.ipz-tone:focus-visible,.ipz-btn:focus-visible,.ipz-seg button:focus-visible,.ipz input:focus-visible{outline:2px solid var(--ip-acc);outline-offset:2px}',
'.ipz .ipz-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--ip-ink);background:#fff;color:var(--ip-ink);padding:9px 14px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;border-radius:0}',
'.ipz .ipz-btn.ipz-pri{background:var(--ip-ink);color:#fff}',
'.ipz-msg{font-size:12.5px;line-height:1.5;color:var(--ip-txt);margin:8px 0 0}.ipz-msg.ipz-err{color:#c53030}',
'.ipz-vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0;margin:-1px}',
/* minimal: mesma composição dos blocos editoriais (imagem | texto) */
'.ipz-min{margin:30px 0}',
'.ipz-min .ipz-row{display:flex;align-items:center;max-width:1140px;margin:0 auto}',
'.ipz-min .ipz-col{width:50%;margin:0}',
'.ipz-min .ipz-text{padding:30px 6%}',
'.ipz-min h2{font-size:35px;line-height:50px;font-weight:300;text-transform:uppercase;color:var(--ip-txt);margin:0 0 6px;letter-spacing:0}',
'.ipz-min h2 b{font-weight:600}',
'.ipz-min h3{font-size:20px;line-height:32px;font-weight:300;text-transform:uppercase;color:var(--ip-txt);margin:0 0 14px}',
'.ipz-min p{font-size:13px;line-height:22px;letter-spacing:.5px;font-weight:400;margin:0 0 18px;color:var(--ip-txt)}',
'.ipz-min .ipz-ctl{border-top:1px solid var(--ip-line);padding-top:22px;display:flex;flex-direction:column;gap:22px;max-width:430px}',
'.ipz-min .ipz-lab{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ip-mut);display:flex;justify-content:space-between;gap:8px}',
'.ipz-min .ipz-lab b{color:var(--ip-ink);font-weight:600}',
'.ipz-min .ipz-line{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}',
'.ipz-min .ipz-gen{display:inline-flex;gap:12px}',
'.ipz.ipz-min .ipz-gen .ipz-link{border-bottom-color:transparent;color:var(--ip-mut)}.ipz-min .ipz-gen .ipz-link[aria-pressed="true"]{color:var(--ip-ink);border-bottom-color:currentColor}',
'.ipz-min .ipz-foot{font-size:11px;color:var(--ip-mut);letter-spacing:.3px;line-height:1.5}',
'.ipz-eye{font-size:11px;letter-spacing:3.2px;text-transform:uppercase;color:#a8915f;margin:0 0 10px;font-weight:600}',
'.ipz.ipz-min h2{font-weight:300;letter-spacing:.5px}.ipz.ipz-min h2 b{font-weight:700}',
'.ipz.ipz-min h3{font-size:15px;line-height:24px;letter-spacing:2px;color:var(--ip-mut);margin:0 0 16px}',
'.ipz-ghost{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .28s ease}',
'.ipz-stage canvas[data-r=cv]{transition:opacity .45s ease}.ipz-stage.ipz-wait canvas[data-r=cv]{opacity:0}',
'.ipz-meter{margin:4px 0 26px;max-width:430px}',
'.ipz-mtrack{position:relative;display:flex;height:3px;gap:3px}',
'.ipz-mtrack i{display:block;height:3px;background:var(--ip-line)}.ipz-mz1{flex:18}.ipz-mz2{flex:20;background:#cfc6b4!important}.ipz-mz3{flex:22}',
'.ipz-medge{position:absolute;left:83.33%;top:-5px;width:1px;height:13px;background:var(--ip-mut)}',
'.ipz-medge:after{content:"borda do pulso";position:absolute;bottom:15px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ip-mut)}',
'.ipz-meter{padding-top:16px}',
'.ipz-mpct{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:30px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ip-mut)}.ipz-mpct b{font-size:22px;letter-spacing:.5px;color:var(--ip-ink);font-weight:600}',
'.ipz .ipz-dims{background:none;border:0;padding:0;margin-top:14px;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ip-ink);text-decoration:underline;text-underline-offset:4px;font-weight:600}',
'.ipz-mdot{position:absolute;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:var(--ip-ink);box-shadow:0 0 0 3px var(--ip-bg);transition:left .35s cubic-bezier(.2,.8,.2,1)}',
'.ipz-mlab{display:flex;margin-top:10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b9b6b4}',
'.ipz-mlab span{transition:color .25s}.ipz-mlab span:nth-child(1){flex:18}.ipz-mlab span:nth-child(2){flex:20;text-align:center}.ipz-mlab span:nth-child(3){flex:22;text-align:right}',
'.ipz-mlab span.on{color:var(--ip-ink);font-weight:700}',
'.ipz-hint{font-size:11px;color:var(--ip-mut);letter-spacing:.4px}',
'.ipz .ipz-guide{font-size:11.5px;color:var(--ip-ink);letter-spacing:.4px;text-decoration:underline;text-underline-offset:3px}',
'.ipz.ipz-min .ipz-opt{display:flex;align-self:stretch;border:0;gap:0}',
'.ipz.ipz-min .ipz-opt button{flex:1;height:46px;border:1px solid var(--ip-ink);background:transparent;color:var(--ip-ink);font-size:12px;font-weight:600;letter-spacing:2.4px;padding:0 12px}',
'.ipz.ipz-min .ipz-opt button+button{border-left:0}',
'.ipz.ipz-min .ipz-opt button[aria-pressed="true"]{background:var(--ip-ink);color:#fff}',
'.ipz.ipz-min .ipz-opt button:not([aria-pressed="true"]):hover{background:var(--ip-soft)}',
'.ipz input[type=range]::-webkit-slider-runnable-track{height:1px!important}',
'.ipz input[type=range]::-webkit-slider-thumb{width:15px!important;height:15px!important;margin-top:-7px!important;background:var(--ip-ink)!important;border:0!important;box-shadow:0 0 0 4px var(--ip-bg),0 1px 6px rgba(0,0,0,.25)!important}',
'.ipz input[type=range]::-moz-range-thumb{width:15px;height:15px;background:var(--ip-ink);border:0}',
'.ipz input[type=range]::-moz-range-track{height:1px}.ipz input[type=range]::-moz-range-progress{height:1px}',
'.ipz.ipz-min .ipz-lab{font-size:11px;letter-spacing:2px}.ipz.ipz-min .ipz-lab b{font-size:12px;letter-spacing:1.5px}',
'.ipz.ipz-min .ipz-foot{font-size:11px;color:#a9a6a5}',
'@media (prefers-reduced-motion:reduce){.ipz-ghost,.ipz-mdot,.ipz-stage canvas[data-r=cv]{transition:none}}',
'@media (max-width:767px){.ipz-min .ipz-row{display:block}.ipz-min .ipz-col{width:100%}.ipz-min .ipz-text{padding:20px 0 0;width:90%;margin:auto}.ipz-min h2{font-size:26px;line-height:36px}.ipz-min h3{font-size:16px;line-height:26px}}',
/* completo */
'.ipz-full{margin:30px auto;max-width:1140px;border:1px solid var(--ip-line);background:var(--ip-bg);display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}',
'.ipz-full .ipz-stage{background:var(--ip-bg);display:flex;align-items:center;justify-content:center;min-height:100%}.ipz-full .ipz-stage canvas{max-height:100%}',
'.ipz-full .ipz-side{padding:26px 28px;display:flex;flex-direction:column;gap:16px;min-width:0}',
'.ipz-full .ipz-kick{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ip-mut)}',
'.ipz-full h2{font-size:28px;line-height:1.2;font-weight:300;text-transform:uppercase;color:var(--ip-ink);margin:2px 0 0}.ipz-full h2 b{font-weight:600}',
'.ipz-full .ipz-sub{font-size:13px;line-height:1.55;margin:0}',
'.ipz-fit{display:flex;align-items:flex-start;gap:10px;background:var(--ip-soft);padding:10px 12px}',
'.ipz-fit i{flex:0 0 10px;height:10px;border-radius:50%;margin-top:5px}',
'.ipz-fit b{display:block;color:var(--ip-ink);font-size:14px}.ipz-fit small{display:block;font-size:12px;color:var(--ip-mut);line-height:1.45}',
'.ipz-specs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--ip-line);border:1px solid var(--ip-line);margin:0}',
'.ipz-specs div{background:#fff;padding:8px 10px;text-align:center}.ipz-specs dt{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ip-mut)}.ipz-specs dd{margin:2px 0 0;font-size:17px;color:var(--ip-ink);font-weight:600;font-variant-numeric:tabular-nums}',
'.ipz-seg{display:flex;border:1px solid var(--ip-ink)}.ipz-seg button{flex:1;border:0;background:#fff;color:var(--ip-ink);padding:9px 8px;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;font-weight:600}.ipz-seg button+button{border-left:1px solid var(--ip-ink)}.ipz-seg button[aria-pressed="true"]{background:var(--ip-ink);color:#fff}',
'.ipz-grp{display:flex;flex-direction:column;gap:10px}',
'.ipz-full .ipz-lab{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ip-mut);display:flex;justify-content:space-between;align-items:center;gap:8px}.ipz-full .ipz-lab b{color:var(--ip-ink)}',
'.ipz-row2{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
'.ipz-num{width:72px;padding:7px 8px;border:1px solid var(--ip-line);font:inherit;font-size:13px}',
'.ipz-note{font-size:11.5px;line-height:1.5;color:var(--ip-mut);margin:0}',
'@media (max-width:767px){.ipz-full{grid-template-columns:1fr}.ipz-full .ipz-side{padding:18px 16px}.ipz-full h2{font-size:22px}}',
/* debug */
'.ipz-dbg{grid-column:1/-1;display:flex;gap:10px;align-items:flex-start;padding:10px;border-top:1px dashed #c53030;font:12px/1.4 monospace;color:#c53030}.ipz-dbg canvas{width:220px;height:auto;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}'
].join('\n');
function injectCss() { if (document.getElementById('ipz-css')) return; var s = document.createElement('style'); s.id = 'ipz-css'; s.textContent = CSS; document.head.appendChild(s); }

/* ================= widget ================= */
function Widget(host, estilo, P) {
  var self = this, min = estilo === 'minimal', st = lsGet();
  var S = this.S = { g: st.g === 'f' ? 'f' : 'm', t: st.t != null ? clamp(+st.t, 0, 5) : 2, c: num(st.c) || 17.5, mode: 'fk', night: false, mins: 0, col: P.bgw9 ? 'bgw9' : 'c3' };
  var F = this.F = { img: null, pts: [], refmm: num(st.refmm) || 40, q: 1, phi: 0, ell: false, rot: 0, dx: 0, dy: 0, cal: false, manual: false, view: null };
  var C = null, OW = 1200, OH = 1200, BG = pageBg(host.parentElement || host);
  host.style.setProperty('--ip-bg', 'rgb(' + BG.join(',') + ')');
  host.classList.add('ipz', min ? 'ipz-min' : 'ipz-full');
  host.setAttribute('aria-label', 'Simulador do relógio no pulso');
  var nm = P.name || 'este relógio';
  var tonesHtml = TONES.map(function (t, i) { return '<button type="button" class="ipz-tone" role="radio" aria-label="Tom de pele: ' + t[1] + '" title="' + t[1] + '" data-t="' + i + '" style="background:' + toneBg(t[0]) + '"></button>'; }).join('');
  var fileInputs = '<input type="file" accept="image/*,.heic,.heif" class="ipz-vh" data-r="pick"><input type="file" accept="image/*" capture="environment" class="ipz-vh" data-r="cam">';
  if (min) {
    var tw = String(CFG.titulo).split(' '), tt = tw.length > 1 ? '<b>' + esc(tw.slice(0, -1).join(' ')) + '</b> ' + esc(tw[tw.length - 1]) : '<b>' + esc(CFG.titulo) + '</b>';
    host.innerHTML =
      '<div class="ipz-row"><div class="ipz-col"><div class="ipz-stage ipz-sq"><canvas data-r="cv" role="img" aria-label="' + esc(nm) + ' no pulso, em tamanho real"></canvas><canvas class="ipz-ghost" data-r="ghost" aria-hidden="true"></canvas><div class="ipz-load" data-r="load">Montando no pulso</div><div class="ipz-cap" data-r="cap" hidden></div></div></div>' +
      '<div class="ipz-col ipz-text"><div class="ipz-eye">Provador virtual</div><h2>' + tt + '</h2><h3 data-r="h3"></h3><p data-r="fitp"></p>' +
      '<div class="ipz-meter" data-r="meter"><div class="ipz-mpct"><span>Ocupa do seu pulso</span><b data-r="mpct"></b></div><div class="ipz-mtrack" aria-hidden="true"><i class="ipz-mz1"></i><i class="ipz-mz2"></i><i class="ipz-mz3"></i><span class="ipz-medge"></span><span class="ipz-mdot" data-r="mdot"></span></div><div class="ipz-mlab" aria-hidden="true"><span data-z="0">Discreto</span><span data-z="1">Ideal</span><span data-z="2">Grande</span></div><button type="button" class="ipz-dims" data-a="dims" aria-pressed="false">Ver as medidas no pulso</button></div>' +
      '<div class="ipz-ctl">' +
        '<div data-r="pfk" class="ipz-field" style="gap:26px">' +
          '<div class="ipz-field"><div class="ipz-lab"><span>Circunferência do pulso</span><b data-r="co"></b></div><input type="range" min="13" max="22" step="0.5" data-r="c" aria-label="Circunferência do pulso em centímetros">' +
            (CFG.guia ? '<a class="ipz-guide" href="' + esc(CFG.guia) + '" target="_blank" rel="noopener">Não sabe a sua medida? Descubra a medida do seu pulso</a>' : '<div class="ipz-hint">Meça com uma fita logo abaixo do osso do pulso</div>') + '</div>' +
          '<div class="ipz-field"><div class="ipz-lab"><span>Tom de pele</span><b data-r="tn"></b></div><span class="ipz-tones" role="radiogroup" aria-label="Tom de pele" data-r="tones">' + tonesHtml + '</span></div>' +
          '<div class="ipz-opt" role="group" aria-label="Pulso"><button type="button" data-g="m">Masculino</button><button type="button" data-g="f">Feminino</button></div></div>' +
        '<div data-r="pfoto" hidden><p class="ipz-msg" data-r="msg" style="margin:0"></p><div class="ipz-line" style="margin-top:10px"><button type="button" class="ipz-link" data-a="pick">Escolher foto</button><button type="button" class="ipz-link" data-a="cam">Tirar foto</button><button type="button" class="ipz-link" data-a="remark" hidden>Marcar de novo</button></div>' +
        '<div class="ipz-lab" style="margin-top:12px"><span>Diâmetro do relógio da foto</span><span><input type="number" class="ipz-num" min="20" max="60" step="0.5" data-r="refmm" aria-label="Diâmetro em milímetros do relógio que aparece na foto"> mm</span></div></div>' +
        ((CFG.escuro || CFG.foto) ? '<div class="ipz-acts">' + (CFG.escuro ? '<button type="button" class="ipz-act" data-a="night" aria-pressed="false" hidden><span>Ver no escuro</span></button>' : '') + (CFG.foto ? '<button type="button" class="ipz-act" data-a="mode" aria-pressed="false"><span>Ver na foto do meu pulso</span></button>' : '') + '</div>' : '') +
        '<div class="ipz-foot">Simulação em tamanho real, feita a partir da foto e das medidas do produto.</div>' +
      '</div>' + fileInputs + '</div></div>';
  } else {
    host.innerHTML =
      '<div class="ipz-stage ipz-sq"><canvas data-r="cv" role="img" aria-label="' + esc(nm) + ' no pulso, em tamanho real"></canvas><div class="ipz-load" data-r="load">Montando no pulso…</div><div class="ipz-cap" data-r="cap" hidden></div></div>' +
      '<div class="ipz-side"><div><div class="ipz-kick">Provador virtual</div><h2><b>' + esc(CFG.titulo) + '</b></h2></div>' +
      '<p class="ipz-sub">Veja o ' + esc(nm) + ' em tamanho real, num pulso do seu tamanho ou numa foto do seu próprio pulso.</p>' +
      '<div class="ipz-fit" data-r="fit"><i></i><div><b></b><small></small></div></div>' +
      '<dl class="ipz-specs" data-r="specs"></dl>' +
      (CFG.foto ? '' : '<!--') + '<div class="ipz-seg" role="group" aria-label="Tipo de pulso"><button type="button" data-a="fk" aria-pressed="true">Pulso ilustrado</button><button type="button" data-a="foto" aria-pressed="false">Foto do meu pulso</button></div>' + (CFG.foto ? '' : '-->') +
      '<div class="ipz-grp" data-r="pfk"><div class="ipz-lab"><span>Circunferência do pulso</span><b data-r="co"></b></div><input type="range" min="13" max="22" step="0.5" data-r="c" aria-label="Circunferência do pulso em centímetros">' +
        '<div class="ipz-lab"><span>Tom de pele</span><b data-r="tn"></b></div><span class="ipz-tones" role="radiogroup" aria-label="Tom de pele" data-r="tones">' + tonesHtml + '</span>' +
        '<div class="ipz-opt" role="group" aria-label="Pulso"><button type="button" data-g="m">Masculino</button><button type="button" data-g="f">Feminino</button></div>' +
        '<p class="ipz-note">Não sabe a medida? Passe uma fita métrica (ou um barbante) logo abaixo do osso do pulso.</p></div>' +
      '<div class="ipz-grp" data-r="pfoto" hidden><div class="ipz-row2"><button type="button" class="ipz-btn ipz-pri" data-a="pick">Escolher foto</button><button type="button" class="ipz-btn" data-a="cam">Tirar foto</button><button type="button" class="ipz-btn" data-a="remark" hidden>Marcar de novo</button></div>' +
        '<p class="ipz-msg" data-r="msg"></p>' +
        '<div class="ipz-lab"><span>Diâmetro do relógio da foto</span><span><input type="number" class="ipz-num" min="20" max="60" step="0.5" data-r="refmm" aria-label="Diâmetro em milímetros do relógio que aparece na foto"> mm</span></div>' +
        '<div class="ipz-row2"><button type="button" class="ipz-link" data-a="manual">Marcar com 2 toques</button></div>' +
        '<div data-r="rotw" hidden><div class="ipz-lab"><span>Girar</span><b data-r="roto">0°</b></div><input type="range" min="-60" max="60" step="1" value="0" data-r="rot" aria-label="Girar o relógio"></div>' +
        '<div class="ipz-lab"><span>Seu pulso tem (para o cálculo de caimento)</span><b data-r="co2"></b></div><input type="range" min="13" max="22" step="0.5" data-r="c2" aria-label="Circunferência do seu pulso em centímetros"></div>' +
      '<div class="ipz-grp" data-r="luzw"><div class="ipz-seg" role="group" aria-label="Iluminação"><button type="button" data-l="0" aria-pressed="true">☀ Dia</button><button type="button" data-l="1" aria-pressed="false">☾ No escuro</button></div>' +
        '<div data-r="minw" hidden><div class="ipz-lab"><span>Minutos no escuro</span><b data-r="mino">0</b></div><input type="range" min="0" max="60" step="1" value="0" data-r="mins" aria-label="Minutos no escuro"></div></div>' +
      '<div class="ipz-row2"><button type="button" class="ipz-btn" data-a="dl">Baixar imagem</button></div>' +
      '<p class="ipz-note">Simulação em tamanho real, feita a partir da primeira foto e das medidas do produto. A foto do seu pulso fica só no seu aparelho e não é enviada.</p>' +
      fileInputs + '</div>';
  }
  var $ = function (r) { return host.querySelector('[data-r="' + r + '"]'); };
  var cv = $('cv'), stage = cv.parentNode;

  function ui() {
    var fit = fitOf(P, S.c);
    $('co').textContent = fmt(S.c, 1) + ' cm'; $('c').value = S.c; if ($('tn')) $('tn').textContent = TONES[S.t][1];
    host.querySelectorAll('input[type=range]').forEach(function (r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); });
    host.querySelectorAll('.ipz-tone').forEach(function (b) { b.setAttribute('aria-checked', +b.dataset.t === S.t ? 'true' : 'false'); });
    host.querySelectorAll('[data-g]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.g === S.g ? 'true' : 'false'); });
    $('pfk').hidden = S.mode !== 'fk'; $('pfoto').hidden = S.mode !== 'foto';
    $('refmm').value = F.refmm;
    var rm = host.querySelector('[data-a="remark"]'); if (rm) rm.hidden = !F.img;
    if (min) {
      $('h3').textContent = fmt(P.diam, 1) + ' mm' + (S.mode === 'fk' ? ' · pulso de ' + fmt(S.c, 1) + ' cm' : ' · na sua foto');
      var md = $('mdot'); if (md && fit) { var pos = Math.max(0.02, Math.min(0.98, (fit.pct - 50) / 60)); md.style.left = (pos * 100) + '%'; var z = fit.pct < FIT_Z[0] ? 0 : fit.pct <= FIT_Z[1] ? 1 : 2; host.querySelectorAll('.ipz-mlab span').forEach(function (e) { e.classList.toggle('on', +e.dataset.z === z); }); $('mpct').textContent = Math.round(fit.pct) + '%'; }
      var db = host.querySelector('[data-a="dims"]'); if (db) { db.setAttribute('aria-pressed', S.dims ? 'true' : 'false'); db.textContent = S.dims ? 'Ocultar as medidas' : 'Ver as medidas no pulso'; db.hidden = S.mode !== 'fk'; }
      $('fitp').textContent = fitText(fit, S.c);
      var mb = host.querySelector('[data-a="mode"]'); if (mb) mb.querySelector('span').textContent = S.mode === 'fk' ? 'Ver na foto do meu pulso' : 'Voltar ao pulso ilustrado'; if (mb) mb.setAttribute('aria-pressed', S.mode === 'foto' ? 'true' : 'false');
      var nb = host.querySelector('[data-a="night"]'); if (nb) { nb.hidden = !P.lume; nb.setAttribute('aria-pressed', S.night ? 'true' : 'false'); nb.querySelector('span').textContent = S.night ? 'Ver de dia' : (P.led && !P.lume ? 'Acender a luz' : 'Ver no escuro'); }
    } else {
      var fb = $('fit'); if (fit) { fb.hidden = false; fb.querySelector('i').style.background = fit.c; fb.querySelector('b').textContent = fit.t + ' num pulso de ' + fmt(S.c, 1) + ' cm'; fb.querySelector('small').textContent = fit.tip; } else fb.hidden = true;
      $('specs').innerHTML = [['Diâmetro', P.diam], ['Lug to lug', P.l2l], ['Espessura', P.esp]].map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + (x[1] ? fmt(x[1], 1) + ' mm' : '—') + '</dd></div>'; }).join('');
      host.querySelectorAll('[data-a="fk"],[data-a="foto"]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.a === S.mode ? 'true' : 'false'); });
      $('co2').textContent = fmt(S.c, 1) + ' cm'; $('c2').value = S.c;
      $('luzw').hidden = !P.lume || !CFG.escuro;
      host.querySelectorAll('[data-l]').forEach(function (b) { b.setAttribute('aria-pressed', (+b.dataset.l === 1) === S.night ? 'true' : 'false'); });
      host.querySelector('[data-l="1"]').textContent = P.led && !(/lumin/i.test(P.text)) ? '💡 Luz acesa' : '☾ No escuro';
      $('minw').hidden = !(S.night && !P.led); $('mino').textContent = S.mins; $('mins').value = S.mins;
      $('rotw').hidden = !(F.img && F.cal); $('rot').value = F.rot; $('roto').textContent = F.rot + '°';
      var mn = host.querySelector('[data-a="manual"]'); if (mn) { mn.hidden = !F.img; mn.textContent = F.manual ? 'Achar o relógio com 1 toque' : 'Marcar com 2 toques'; }
    }
  }
  function fitText(fit, c) { return fit ? 'Visto de cima, um pulso de ' + fmt(c, 1) + ' cm tem cerca de ' + Math.round(fit.w) + ' mm de largura. De uma alça à outra, o ' + nm + ' mede ' + fmt(fit.l2l, 1) + ' mm' + (P.l2l ? '' : ' (estimado)') + ' e ' + fit.s : ''; }
  /* estabilidade: reserva para o texto de caimento a altura da versão mais longa possível, para nada pular ao mexer na régua */
  function lockText() {
    var p = $('fitp'); if (!p || !p.offsetWidth) return; var keep = p.textContent, mx = 0, cs = [13.5, 16.5, 19.5, 21.5];
    p.style.minHeight = '0px';
    cs.forEach(function (c) { var f = fitOf(P, c); if (!f) return; ['fica no limite do ideal: as alças chegam perto da borda do pulso.', 'fica muito grande: as alças passam da borda do pulso.', 'fica discreto: sobra bastante pulso dos lados.'].forEach(function (t) { f.s = t; p.textContent = fitText(f, c); mx = Math.max(mx, p.offsetHeight); }); });
    p.textContent = keep; if (mx) p.style.minHeight = mx + 'px';
  }
  var lockT; window.addEventListener('resize', function () { clearTimeout(lockT); lockT = setTimeout(lockText, 150); });
  function msg(t, err) { var m = $('msg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('ipz-err', !!err); }
  function cap(t) { var c = $('cap'); c.hidden = !t; c.textContent = t || ''; }
  function save() { lsSet({ g: S.g, t: S.t, c: S.c, refmm: F.refmm }); }

  /* ---------- desenho ---------- */
  var raf = 0, fade = true, drawn = false;
  function draw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { var gh = $('ghost'); if (fade && drawn && gh) { gh.width = cv.width; gh.height = cv.height; gh.getContext('2d').drawImage(cv, 0, 0); gh.style.transition = 'none'; gh.style.opacity = 1; } render(); drawn = true; if (fade && gh) { void gh.offsetWidth; gh.style.transition = ''; gh.style.opacity = 0; } fade = true; }); }
  function lumeLayer(g, place, scale) {
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(24,27,38)'; g.fillRect(0, 0, cv.width, cv.height); g.restore();
    var gl = glowOf(C, P, S.col); if (!gl) return false;
    var I = P.led ? 1 : 0.16 + 0.84 * Math.exp(-S.mins / 9), x = -C.cx * scale, y = -C.cy * scale, w = C.w * scale, h = C.h * scale;
    g.save(); place(g); g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true;
    g.globalAlpha = Math.min(1, I * 0.5); g.drawImage(gl.b2, x, y, w, h); g.globalAlpha = Math.min(1, I * 0.85); g.drawImage(gl.b1, x, y, w, h); g.globalAlpha = I; g.drawImage(gl.s, x, y, w, h); g.restore();
    return true;
  }
  /* cotas sobre a imagem: largura do pulso (vista de cima) × lug to lug */
  function dims(g, r) {
    var fit = fitOf(P, S.c); if (!fit) return;
    var cx = OW / 2, cy = OH / 2, pm = r.pxmm, hw = fit.w / 2 * pm, hl = fit.l2l / 2 * pm, caseR = P.diam / 2 * pm;
    var xW = cx - caseR - 30 * pm / 2.2, xL = cx + caseR + 8 * pm;
    function line(x, y0, y1, col) {
      g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
      [y0, y1].forEach(function (y) { g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.stroke(); });
      g.restore();
    }
    function tag(x, y, top, bottom, align) {
      g.save(); g.font = '600 26px ' + (getComputedStyle(host).fontFamily || 'sans-serif'); var w1 = g.measureText(top).width; g.font = '600 18px ' + (getComputedStyle(host).fontFamily || 'sans-serif'); var w2 = g.measureText(bottom).width;
      var bw = Math.max(w1, w2 * 1.15) + 32, bh = 70, bx = align === 'r' ? x + 18 : x - 18 - bw;
      g.fillStyle = 'rgba(255,255,255,.94)'; g.fillRect(bx, y - bh / 2, bw, bh);
      g.fillStyle = '#211e1f'; g.textBaseline = 'middle'; g.font = '600 26px ' + (getComputedStyle(host).fontFamily || 'sans-serif'); g.fillText(top, bx + 16, y - 11);
      g.fillStyle = '#8d8a8b'; g.font = '600 17px ' + (getComputedStyle(host).fontFamily || 'sans-serif'); if (g.letterSpacing !== undefined) g.letterSpacing = '2px'; g.fillText(bottom, bx + 16, y + 17);
      g.restore();
    }
    line(xW, cy - hw, cy + hw, 'rgba(33,30,31,.9)'); tag(xW, cy, fmt(fit.w, 0) + ' mm', 'PULSO', 'l');
    line(xL, cy - hl, cy + hl, 'rgba(33,30,31,.9)'); tag(xL, cy, fmt(fit.l2l, 1) + ' mm', 'ALÇA A ALÇA', 'r');
    /* guias pontilhadas das pontas das alças até a borda do pulso */
    g.save(); g.setLineDash([6, 8]); g.strokeStyle = 'rgba(33,30,31,.45)'; g.lineWidth = 1.5;
    [cy - hl, cy + hl].forEach(function (y) { g.beginPath(); g.moveTo(cx - caseR * 0.6, y); g.lineTo(xL + 14, y); g.stroke(); });
    g.restore();
  }
  function render() {
    if (!C) return;
    stage.classList.toggle('ipz-sq', S.mode === 'fk' || !!(F.img && F.cal));
    var g = cv.getContext('2d');
    if (S.mode === 'fk') {
      stage.classList.remove('ipz-tap', 'ipz-drag');
      var r = makeWrist({ g: S.g, t: S.t, c: S.c, bg: BG }); cv.width = OW; cv.height = OH;
      g.drawImage(r.cv, r.cx - OW / 2, r.cy - OH / 2, OW, OH, 0, 0, OW, OH);
      var scale = (P.diam / 2 * r.pxmm) / C.r;
      var place = function (q) { q.translate(OW / 2, OH / 2); };
      var WL = mk(OW, OH), wg = WL.getContext('2d'); wg.save(); place(wg); drawWrapped(wg, C, scale, r.ww); wg.restore();
      /* máscara: silhueta do braço (onde a pulseira dá a volta) + faixa plana da caixa e alças (que pode passar do pulso fino) */
      var M = mk(OW, OH), mg = M.getContext('2d'), ox = r.cx - OW / 2, oy = r.cy - OH / 2, Lp = C.L * scale;
      mg.beginPath(); mg.moveTo(-2, r.top[0] - oy); for (var mx = 0; mx < OW; mx += 3) mg.lineTo(mx, r.top[Math.min(r.top.length - 1, mx + ox)] - oy - 0.5);
      for (mx = OW - 1; mx >= 0; mx -= 3) mg.lineTo(mx, r.bot[Math.min(r.bot.length - 1, mx + ox)] - oy + 0.5); mg.closePath(); mg.fillStyle = '#000'; mg.fill();
      mg.fillRect(0, OH / 2 - Lp, OW, 2 * Lp);
      wg.globalCompositeOperation = 'destination-in'; wg.drawImage(M, 0, 0); wg.globalCompositeOperation = 'source-over';
      /* sombra do relógio sobre a pele: uma larga e suave, outra curta de contato */
      g.save(); g.shadowColor = 'rgba(40,20,10,.30)'; g.shadowBlur = 34; g.shadowOffsetX = 6; g.shadowOffsetY = 16; g.drawImage(WL, 0, 0); g.restore();
      g.save(); g.shadowColor = 'rgba(30,15,8,.42)'; g.shadowBlur = 7; g.shadowOffsetX = 1; g.shadowOffsetY = 4; g.drawImage(WL, 0, 0); g.restore();
      if (S.night) { if (!lumeLayer(g, place, scale)) cap('Este modelo não tem partes luminosas detectáveis na foto.'); else cap(P.led ? 'Luz acesa' : '☾ ' + S.mins + ' min no escuro'); }
      else cap('');
      if (S.dims && !S.night) dims(g, r);
      return;
    }
    /* foto do cliente */
    if (!F.img) {
      cv.width = OW; cv.height = Math.round(OW * 0.75); g.fillStyle = 'rgb(' + BG.map(function (v) { return Math.round(v * 0.95); }).join(',') + ')'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#777'; g.textAlign = 'center'; g.font = '600 26px "Open Sans",Arial,sans-serif'; g.fillText('Escolha uma foto do seu pulso', cv.width / 2, cv.height / 2 - 8);
      g.font = '20px "Open Sans",Arial,sans-serif'; g.fillText('de preferência usando um relógio de tamanho conhecido', cv.width / 2, cv.height / 2 + 26);
      stage.classList.remove('ipz-drag'); stage.classList.add('ipz-tap'); cap(''); return;
    }
    var im = F.img, W0 = im.width, H0 = im.height;
    if (!F.cal) {
      var sc = Math.min(1, 1200 / Math.max(W0, H0)); cv.width = Math.round(W0 * sc); cv.height = Math.round(H0 * sc); F.view = { s: sc, ox: 0, oy: 0 };
      g.drawImage(im, 0, 0, cv.width, cv.height); var rr = Math.max(6, cv.width / 90);
      F.pts.forEach(function (p) { g.fillStyle = '#ff3b30'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(p[0] * sc, p[1] * sc, rr, 0, 7); g.fill(); g.stroke(); });
      stage.classList.remove('ipz-drag'); stage.classList.add('ipz-tap');
      cap(F.manual ? (F.pts.length ? 'Agora toque na borda oposta da caixa.' : 'Toque numa borda da caixa do seu relógio (sem contar a coroa).') : 'Toque no centro do relógio que aparece na foto.');
      return;
    }
    /* calibrado: enquadra 100 mm ao redor do relógio da foto */
    cv.width = OW; cv.height = OH; var s2 = OW / (100 * F.pxmm); F.view = { s: s2, ox: F.cx - OW / 2 / s2, oy: F.cy - OH / 2 / s2 };
    g.fillStyle = '#16191d'; g.fillRect(0, 0, OW, OH); g.setTransform(s2, 0, 0, s2, -F.view.ox * s2, -F.view.oy * s2); g.drawImage(im, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
    var scale2 = (P.diam / 2 * F.pxmm) / C.r, ang = F.rot * Math.PI / 180;
    var place2 = function (q) { q.setTransform(s2, 0, 0, s2, -F.view.ox * s2, -F.view.oy * s2); q.translate(F.cx + F.dx, F.cy + F.dy); if (F.q < 0.999) { q.rotate(F.phi); q.scale(1, F.q); q.rotate(-F.phi); } q.rotate(ang); };
    g.save(); place2(g); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14 / s2; g.shadowOffsetX = -4 / s2; g.shadowOffsetY = 6 / s2; g.drawImage(C.cv, -C.cx * scale2, -C.cy * scale2, C.w * scale2, C.h * scale2); g.restore();
    stage.classList.remove('ipz-tap'); stage.classList.add('ipz-drag');
    if (S.night) { if (!lumeLayer(g, place2, scale2)) cap('Este modelo não tem partes luminosas detectáveis na foto.'); else cap(P.led ? 'Luz acesa' : '☾ ' + S.mins + ' min no escuro'); }
    else cap('Arraste para posicionar.');
  }

  /* ---------- foto ---------- */
  function setPhoto(im, meta) {
    F.img = im; F.pts = []; F.cal = false; F.ell = false; F.q = 1; F.phi = 0; F.dx = F.dy = 0; F.rot = 0;
    if (meta && meta.cal && meta.pts && meta.pts.length === 2) { F.pts = meta.pts; F.q = meta.q || 1; F.phi = meta.phi || 0; F.ell = !!meta.ell; F.refmm = meta.refmm || F.refmm; calib(true); F.rot = meta.rot || 0; F.dx = meta.dx || 0; F.dy = meta.dy || 0; }
  }
  function calib(keep) {
    var a = F.pts[0], b = F.pts[1]; F.pxmm = Math.hypot(a[0] - b[0], a[1] - b[1]) / (F.refmm || 40); F.cx = (a[0] + b[0]) / 2; F.cy = (a[1] + b[1]) / 2; F.cal = true;
    if (!keep) { F.dx = F.dy = 0; if (!F.ell) { var r = Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI); if (r > 90) r -= 180; if (r < -90) r += 180; F.rot = Math.abs(r) > 60 ? 0 : r; } }
  }
  function loadFile(f) {
    if (!f) return; if (f.type && !/^image\//.test(f.type) && !isHeic(f)) { msg('Esse arquivo não é uma imagem. Escolha uma foto (JPG, PNG ou HEIC).', true); return; }
    msg('Abrindo a foto…');
    (isHeic(f) ? heicToJpeg(f).then(imgFromBlob) : imgFromBlob(f).catch(function () { return heicToJpeg(f).then(imgFromBlob); }))
      .then(function (im) { setPhoto(shrink(im)); F.manual = false; msg('Agora toque no centro do relógio que aparece na foto. Se não estiver usando relógio, use "Marcar com 2 toques" num objeto de medida conhecida.'); photoSave(F, true); ui(); draw(); track('foto_carregada'); try { stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} })
      .catch(function () { msg('Não consegui abrir essa foto. Tente uma foto em JPG ou um print da foto.', true); });
  }
  function pt(e) { var b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * cv.width / b.width, y = (e.clientY - b.top) * cv.height / b.height, v = F.view || { s: 1, ox: 0, oy: 0 }; return [x / v.s + v.ox, y / v.s + v.oy]; }
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    if (S.mode !== 'foto') return;
    if (!F.img) { host.querySelector('[data-r="pick"]').click(); return; }
    var p = pt(e);
    if (!F.cal) {
      if (!F.manual) {
        var r = null; try { r = caseFind(F.img, p[0], p[1]); } catch (er) { r = null; }
        if (r) { F.q = Math.min(1, r.b / r.a); F.phi = r.phi; F.ell = true; var ca = Math.cos(r.phi), sa = Math.sin(r.phi); F.pts = [[r.cx - r.a * ca, r.cy - r.a * sa], [r.cx + r.a * ca, r.cy + r.a * sa]]; calib(); var deg = 0; if (F.q < 0.85) { deg = Math.round(r.phi * 180 / Math.PI - 90); while (deg > 90) deg -= 180; while (deg < -90) deg += 180; if (Math.abs(deg) > 60) deg = 0; } F.rot = deg; msg('Relógio da foto encontrado. Se o tamanho não parecer certo, confira o diâmetro dele acima ou use "Marcar de novo".'); track('foto_calibrada', { metodo: 'auto' }); }
        else { F.manual = true; F.pts = []; msg('Não consegui achar o relógio sozinho nessa foto. Toque numa borda da caixa e depois na borda oposta.', true); }
      } else { F.pts.push(p); F.q = 1; F.phi = 0; F.ell = false; if (F.pts.length === 2) { calib(); msg('Pronto. Arraste para posicionar o relógio.'); track('foto_calibrada', { metodo: 'manual' }); } }
      photoSave(F); ui(); draw(); return;
    }
    drag = { x: p[0], y: p[1], dx: F.dx, dy: F.dy }; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; var p = pt(e); F.dx = drag.dx + p[0] - drag.x; F.dy = drag.dy + p[1] - drag.y; draw(); });
  function endDrag() { if (drag) { drag = null; photoSave(F); } }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  /* ---------- eventos ---------- */
  function setMode(m) {
    S.mode = m; track('modo', { modo: m });
    if (m === 'foto' && !F.img) {
      photoLoad().then(function (o) { if (o && !F.img) { setPhoto(o.img, o.m); msg(F.cal ? 'Usando a última foto do seu pulso salva neste aparelho.' : 'Toque no centro do relógio que aparece na foto.'); } else if (!F.img) msg('Use uma foto de cima do pulso, de preferência com um relógio de diâmetro conhecido: ele serve de régua.'); ui(); draw(); });
    }
    ui(); draw();
  }
  host.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !host.contains(b)) return;
    if (b.dataset.t != null) { S.t = +b.dataset.t; save(); ui(); draw(); return; }
    if (b.dataset.g) { if (S.g !== b.dataset.g) { S.g = b.dataset.g; S.c = S.g === 'f' ? 15.5 : 17.5; save(); } ui(); draw(); return; }
    if (b.dataset.l != null) { S.night = b.dataset.l === '1'; track('luz', { escuro: S.night }); ui(); draw(); return; }
    var a = b.dataset.a;
    if (a === 'fk' || a === 'foto') return setMode(a);
    if (a === 'mode') return setMode(S.mode === 'fk' ? 'foto' : 'fk');
    if (a === 'dims') { S.dims = !S.dims; track('medidas', { on: S.dims }); ui(); draw(); return; }
    if (a === 'night') { S.night = !S.night; S.mins = S.night ? 2 : 0; track('luz', { escuro: S.night }); ui(); draw(); return; }
    if (a === 'pick') return $('pick').click();
    if (a === 'cam') return $('cam').click();
    if (a === 'remark') { F.cal = false; F.pts = []; F.manual = false; msg('Toque no centro do relógio que aparece na foto.'); photoSave(F); ui(); draw(); return; }
    if (a === 'manual') { F.manual = !F.manual; F.cal = false; F.pts = []; msg(F.manual ? 'Toque numa borda da caixa e depois na borda oposta.' : 'Toque no centro do relógio que aparece na foto.'); ui(); draw(); return; }
    if (a === 'dl') { track('baixar'); cv.toBlob(function (bl) { if (!bl) return; var u = URL.createObjectURL(bl), l = document.createElement('a'); l.href = u; l.download = (P.sku || 'relogio').replace(/[^\w-]+/g, '_') + '_no_pulso.jpg'; document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(u); l.remove(); }, 1000); }, 'image/jpeg', 0.9); }
  });
  var tmr;
  function onC(v) { S.c = +v; ui(); fade = false; draw(); clearTimeout(tmr); tmr = setTimeout(function () { save(); track('circunferencia', { cm: S.c }); }, 400); }
  $('c').addEventListener('input', function () { onC(this.value); });
  if ($('c2')) $('c2').addEventListener('input', function () { onC(this.value); });
  if ($('mins')) $('mins').addEventListener('input', function () { S.mins = +this.value; $('mino').textContent = S.mins; draw(); });
  if ($('rot')) $('rot').addEventListener('input', function () { F.rot = +this.value; $('roto').textContent = F.rot + '°'; draw(); });
  if ($('rot')) $('rot').addEventListener('change', function () { photoSave(F); });
  $('refmm').addEventListener('change', function () { var v = num(this.value); if (!v) return; F.refmm = v; save(); if (F.cal) { calib(true); photoSave(F); draw(); } });
  ['pick', 'cam'].forEach(function (r) { $(r).addEventListener('change', function () { var f = this.files && this.files[0]; loadFile(f); this.value = ''; }); });
  stage.addEventListener('dragover', function (e) { if (S.mode === 'foto') e.preventDefault(); });
  stage.addEventListener('drop', function (e) { if (S.mode !== 'foto') return; e.preventDefault(); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });

  ui();
  /* ---------- prepara o recorte ---------- */
  this.start = function () {
    if (self._started) return; self._started = true;
    /* a cópia em cache do CDN pode ter sido gravada sem o cabeçalho CORS: pede um endereço próprio (?ipz=) e, se falhar, outro tamanho */
    function bust(u) { return /^data:|^blob:/.test(u) ? u : u + (u.indexOf('?') < 0 ? '?' : '&') + 'ipz=' + VERSION; }
    var alt = sizeUrl(P.img, 1000);
    function proxy(u) { return /^https?:\/\//.test(u) ? 'https://images.weserv.nl/?output=png&url=' + encodeURIComponent(u.replace(/^https?:\/\//, '')) : null; }
    loadImg(bust(P.img)).then(function (img) { return img || (alt !== P.img ? loadImg(bust(alt)) : null); })
      .then(function (img) { return img || loadImg(proxy(P.img)); }).then(function (img) {
      if (!img) throw new Error('img');
      C = makeCut(img, P);
      if (!C.ok) throw new Error(C.why);
      $('load').remove(); lockText(); stage.classList.add('ipz-wait'); render(); drawn = true; requestAnimationFrame(function () { stage.classList.remove('ipz-wait'); }); track('exibido', { sku: P.sku });
      if (CFG.debug) debugPanel(host, C, P);
    }).catch(function (err) {
      log('falhou', err); host.hidden = true; /* sem simulação confiável: some sem deixar buraco na página */
    });
  };
}
function debugPanel(host, C, P) {
  var d = document.createElement('div'); d.className = 'ipz-dbg';
  var c = mk(C.w, C.h), g = c.getContext('2d'); g.drawImage(C.cv, 0, 0); g.strokeStyle = '#e53e3e'; g.lineWidth = 3;
  if (C.round) { g.beginPath(); g.arc(C.cx, C.cy, C.r, 0, 7); g.stroke(); } else g.strokeRect(C.cx - C.r, C.y0, 2 * C.r, C.y1 - C.y0);
  g.strokeStyle = '#3182ce'; g.beginPath(); g.moveTo(C.cx, C.cy - C.L); g.lineTo(C.cx, C.cy + C.L); g.stroke();
  d.appendChild(c); var t = document.createElement('div');
  t.textContent = 'diam=' + P.diam + ' l2l=' + P.l2l + ' esp=' + P.esp + ' lume=' + P.lume + (P.led ? ' led' : '') + (P.dig ? ' digital' : '') + ' | caixa ' + (C.round ? 'redonda' : 'pela largura') + (C.fb ? ' (fallback)' : '') + ' r=' + Math.round(C.r) + 'px → ' + fmt(P.diam / (2 * C.r) * 100, 2) + ' mm/100px | img=' + P.img;
  d.appendChild(t); host.appendChild(d);
}

/* ================= montagem na página ================= */
function isProductPage() { return !!(document.querySelector('.produto-thumbs, #imagemProduto') || /pagina-produto/.test(document.body.className)); }
function autoTarget() {
  var d = document.querySelector('#descricao');
  if (d) {
    var pp = d.querySelector('#prodPersonalizado, .bottom');
    var wrap = document.createElement('div');
    if (pp) pp.parentNode.insertBefore(wrap, pp);
    else { var dt = d.querySelectorAll('details'); var last = dt.length ? dt[dt.length - 1] : d.querySelector('.detalhe-tecnico'); if (last) last.parentNode.insertBefore(wrap, last.nextSibling); else d.appendChild(wrap); }
    return wrap;
  }
  var ref = document.querySelector('.produto .principal, .produto, #corpo');
  if (!ref) return null; var w2 = document.createElement('div'); ref.parentNode.insertBefore(w2, ref.nextSibling); return w2;
}
function boot() {
  /* modo teste: com data-teste no script, só aparece para quem abrir o produto com ?pulso=1 (fica valendo na sessão) */
  if (CFG.teste || (SCRIPT && SCRIPT.dataset && SCRIPT.dataset.teste != null)) {
    var on = /[?&]pulso=(1|debug)\b/.test(location.search);
    try { if (on) sessionStorage.setItem('impala_pulso_teste', '1'); else on = sessionStorage.getItem('impala_pulso_teste') === '1'; } catch (e) {}
    if (!on) return;
  }
  var hosts = [].slice.call(document.querySelectorAll('[data-impala-pulso]'));
  if (CFG.alvo) { var t = document.querySelector(CFG.alvo); if (t && hosts.indexOf(t) < 0) hosts.push(t); }
  if (!hosts.length) { if (!isProductPage()) return; var a = autoTarget(); if (!a) return; hosts.push(a); }
  var P = readProduct();
  if (P.off) return;
  if (!P.img || !P.diam) { log('sem foto ou diâmetro', P); return; }
  injectCss();
  hosts.forEach(function (h) {
    if (h.__ipz) return; h.__ipz = 1;
    var est = (h.dataset && h.dataset.estilo) || CFG.estilo;
    var W = new Widget(h, est === 'minimal' || est === 'minimalista' ? 'minimal' : 'completo', P);
    if ('IntersectionObserver' in window && !CFG.debug) {
      var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); W.start(); } }, { rootMargin: '600px 0px' });
      io.observe(h);
    } else W.start();
  });
}
/* montagem manual (outras páginas/plataformas): ImpalaPulso.mount(el, {estilo, img, diam, l2l, esp, name, lume, led, digital}) */
function mount(el, o) {
  o = o || {}; if (!el) return null; injectCss();
  var P = { name: o.name || o.nome || '', sku: o.sku || '', img: o.img, diam: num(o.diam), l2l: num(o.l2l), esp: num(o.esp), text: o.texto || '',
            lume: !!o.lume, led: !!o.led, ind: !!o.indiglo, dig: !!(o.digital), full: !!o.mostradorLuminoso, bgw9: o.corLume === 'azul' };
  if (!P.img || !P.diam) return null;
  el.innerHTML = ''; el.className = ''; el.hidden = false;
  var W = new Widget(el, o.estilo === 'minimal' || o.estilo === 'minimalista' ? 'minimal' : 'completo', P); W.start(); return W;
}
window.ImpalaPulso = { boot: boot, mount: mount, _wrist: makeWrist, readProduct: readProduct, makeCut: makeCut, version: VERSION };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
