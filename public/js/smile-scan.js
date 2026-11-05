/* Smile Lab — scan 3D da arcada (32 dentes), guiado pelo scroll. Canvas 2D puro, sem libs. */
(() => {
  const root = document.getElementById('smileLab');
  if (!root) return;
  const cv = root.querySelector('#labCanvas');
  const ctx = cv.getContext('2d');
  const steps = [...root.querySelectorAll('.lab__step')];
  const q = (s) => root.querySelector(s);
  const out = { teeth: q('#labTeeth'), prec: q('#labPrec'), shade: q('#labShade'), bar: q('#labBar'), now: q('#labNow') };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Geometria: 32 dentes com raízes + mandíbula de vidro ---------- */
  const CR = 7, RR = 5, R = CR + RR, U = 12, UNIT = 25, K = 0.0085, Z0 = 92, GAP = 3;
  const WID = [1, .78, .9, .72, .72, 1.12, 1.18, 1.05];
  const HEI = [1.18, 1.02, 1.12, .9, .9, .8, .76, .74];
  const DEP = [.62, .55, .75, .85, .85, 1.08, 1.12, 1.0];
  const RLEN = [1.3, 1.15, 1.45, 1.1, 1.05, .95, .9, .85];
  const xAt = (s) => { let x = 0, l = 0; while (l < s) { x += .5 / Math.hypot(1, 2 * K * x); l += .5; } return x; };
  const sgn = (c) => (Math.abs(c) < .01 ? 0 : Math.sign(c));

  const teeth = [];
  for (const upper of [true, false]) {
    const sc = upper ? 1 : .9;
    for (const side of [-1, 1]) {
      let acc = 0;
      for (let i = 0; i < 8; i++) {
        const w = WID[i] * sc * UNIT, h = HEI[i] * sc * UNIT, d = DEP[i] * sc * UNIT, rl = RLEN[i] * h;
        acc += w / 2 + .6; const x = xAt(acc) * side; acc += w / 2 + .6;
        const cz = Z0 - K * x * x - (upper ? 0 : 6), th = Math.atan2(-2 * K * x, 1);
        const ct = Math.cos(th), st = Math.sin(th), sg = upper ? 1 : -1;
        const V = new Float32Array(R * U * 3);
        for (let r = 0; r < R; r++) {
          const inRoot = r >= CR, k = r - CR + 1, dome = inRoot && k === RR, t = !inRoot ? 0 : dome ? 1.12 : k / (RR - 1), v = inRoot ? 1 : r / (CR - 1);
          let f = .68 + .32 * Math.sin(Math.PI * (.12 + .8 * Math.min(v, 1)));
          if (inRoot) f = dome ? .07 : .22 + .54 * Math.pow(1 - Math.pow(t, 1.8), .7); // afunila suave e termina arredondado
          let rz = d / 2 * f; if (i < 3 && !inRoot) rz *= lerp(.4, 1, sm(0, .55, v));
          const rx = w / 2 * f * .96;
          for (let u = 0; u < U; u++) {
            const a = u / U * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
            let lx = Math.sign(c) * Math.abs(c) ** .8 * rx, lz = Math.sign(s2) * Math.abs(s2) ** .8 * rz;
            if (inRoot && i >= 5) lx = lx * .55 + sgn(c) * w * .2 * sm(0, .55, Math.min(t, 1)); // molares: duas raízes
            if (inRoot) lx += w * .12 * t * t * (i % 2 ? 1 : -1);
            const y = GAP + (inRoot ? h + t * rl * .97 : v * h) + (i >= 3 && !inRoot ? .1 * h * (1 - v) * Math.cos(2 * a) : 0);
            const o = (r * U + u) * 3;
            V[o] = x + lx * ct - lz * st; V[o + 1] = sg * y; V[o + 2] = cz + lx * st + lz * ct;
          }
        }
        const quads = [];
        for (let r = 0; r < R - 1; r++) for (let u = 0; u < U; u++) {
          const ix = [r * U + u, r * U + (u + 1) % U, (r + 1) * U + (u + 1) % U, (r + 1) * U + u];
          const p0 = ix[0] * 3, p1 = ix[1] * 3, p3 = ix[3] * 3;
          const e1 = [V[p1] - V[p0], V[p1 + 1] - V[p0 + 1], V[p1 + 2] - V[p0 + 2]];
          const e2 = [V[p3] - V[p0], V[p3 + 1] - V[p0 + 1], V[p3 + 2] - V[p0 + 2]];
          let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const m = Math.hypot(...n) || 1; n = n.map((k) => k / m);
          if (n[0] * (V[p0] - x) + n[2] * (V[p0 + 2] - cz) < 0) n = n.map((k) => -k);
          quads.push({ ix, n });
        }
        const fdi = (upper ? (side < 0 ? 1 : 2) : (side < 0 ? 4 : 3)) * 10 + i + 1;
        teeth.push({ x, cz, upper, i, side, fdi, h, sg, focus: side === 1 && i >= 3 && i <= 5, V, quads, T: new Float32Array(R * U * 3), P: new Float32Array(R * U * 2) });
      }
    }
  }
  const top = teeth.filter((t) => t.upper).sort((a, b) => a.x - b.x);
  const CALL = [26, 36, 11, 13, 46];

  const jaws = [false, true].map((upper) => {
    const sg = upper ? 1 : -1, xm = upper ? 172 : 152, o = upper ? 24 : 21, ii = upper ? 19 : 17, S = [];
    for (let x = -xm; x <= xm; x += 8) {
      const th = Math.atan2(-2 * K * x, 1), nx = -Math.sin(th), nz = Math.cos(th), cz = Z0 - K * x * x - (upper ? 0 : 6);
      S.push({ x, ox: x + nx * o, oz: cz + nz * o, ix: x - nx * ii, iz: cz - nz * ii, yb: sg * (GAP + (upper ? 26 : 22)), yt: sg * ((upper ? 78 : 68) + 4 * Math.sin(x / 38)) });
    }
    return { upper, sg, S };
  });

  /* ---------- Canvas ---------- */
  let W = 0, H = 0, dpr = 1;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  function resize() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr;
  }
  addEventListener('resize', resize);
  root.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    ptr.tx = ((e.clientX - r.left) / r.width - .5) * 2; ptr.ty = ((e.clientY - r.top) / r.height - .5) * 2;
  });

  const LX = -.35, LY = .6, LZ = .72, LN = Math.hypot(LX, LY, LZ);

  function render(p, time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const yaw = lerp(lerp(-1.2, -.38, sm(0, .6, p)), 0, sm(.74, 1, p)) + ptr.x * .2;
    const pitch = lerp(.2, .12, sm(.6, 1, p)) + ptr.y * .07;
    const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const D = 520, fit = Math.min(W / 440, H / 290), f = D * fit, cx = W / 2 + 190 * fit * Math.sin(yaw), cy = H * .47;
    const scanX = lerp(-210, 210, sm(0, .42, p));
    const solid = sm(.22, .55, p), planeA = 1 - sm(.4, .5, p);
    const focusA = sm(.4, .5, p) * (1 - sm(.66, .82, p));
    const open = lerp(15, 1.5, sm(.64, .92, p));
    const pt = (x, y, z) => {
      const x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, d = D - z2;
      return [cx + x1 * f / d, cy - y2 * f / d, f / d];
    };
    const quad = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); };
    ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';

    // mandíbula / maxila de vidro
    const jawA = sm(.1, .4, p);
    for (const jw of jaws) {
      const oy = jw.sg * open, P = jw.S.map((s) => ({
        s, ob: pt(s.ox, s.yb + oy, s.oz), ot: pt(s.ox, s.yt + oy, s.oz), ib: pt(s.ix, s.yb + oy, s.iz), it: pt(s.ix, s.yt + oy, s.iz),
      }));
      for (let k = 0; k < P.length - 1; k++) {
        const a = P[k], b = P[k + 1], s = clamp((scanX - a.s.x) / 36) * jawA; if (s <= 0) continue;
        ctx.fillStyle = `rgba(95,150,235,${.05 * s})`;
        quad(a.ob, a.ot, b.ot, b.ob); ctx.fill(); quad(a.ib, a.it, b.it, b.ib); ctx.fill(); quad(a.ot, a.it, b.it, b.ot); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(175,215,255,${.34 * s})`;
        ctx.beginPath(); ctx.moveTo(a.ot[0], a.ot[1]); ctx.lineTo(b.ot[0], b.ot[1]); ctx.moveTo(a.ob[0], a.ob[1]); ctx.lineTo(b.ob[0], b.ob[1]);
        ctx.moveTo(a.it[0], a.it[1]); ctx.lineTo(b.it[0], b.it[1]); ctx.stroke();
      }
    }

    let scannedSum = 0;
    for (const t of teeth) {
      const V = t.V, T = t.T, P = t.P, oy = t.sg * open;
      for (let k = 0, j = 0; k < V.length; k += 3, j += 2) {
        const y = V[k + 1] + oy;
        const x1 = V[k] * cy_ + V[k + 2] * sy_, z1 = -V[k] * sy_ + V[k + 2] * cy_;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        T[k] = x1; T[k + 1] = y2; T[k + 2] = z2;
        const d = D - z2; P[j] = cx + x1 * f / d; P[j + 1] = cy - y2 * f / d;
      }
      scannedSum += clamp((scanX - t.x) / 50);
      const hot = t.focus ? focusA : 0;

      ctx.fillStyle = 'rgba(150,195,255,.34)';
      for (let k = 0, j = 0; k < V.length; k += 3, j += 2) if (V[k] > scanX + 4) ctx.fillRect(P[j] - .8, P[j + 1] - .8, 1.6, 1.6);

      for (const qd of t.quads) {
        const i0 = qd.ix[0] * 3, s = clamp((scanX - V[i0]) / 36);
        if (s <= 0) continue;
        const n = [qd.n[0] * cy_ + qd.n[2] * sy_, 0, 0]; const z1 = -qd.n[0] * sy_ + qd.n[2] * cy_;
        n[1] = qd.n[1] * cp - z1 * sp; n[2] = qd.n[1] * sp + z1 * cp;
        const vx = -T[i0], vy = -T[i0 + 1], vz = D - T[i0 + 2], nd = (n[0] * vx + n[1] * vy + n[2] * vz) / Math.hypot(vx, vy, vz);
        const rim = Math.pow(1 - Math.abs(nd), 1.7), lit = clamp((n[0] * LX + n[1] * LY + n[2] * LZ) / LN * .5 + .5);
        const r = Math.round(lerp(105 + 110 * rim, 255, hot)), g = Math.round(lerp(168 + 70 * rim, 135 + 85 * rim, hot)), b = Math.round(lerp(255, 40 + 90 * rim, hot));
        const fa = solid * s * (.03 + .2 * rim + .05 * lit) * (nd > 0 ? 1 : .7) * (1 + hot * 1.9);
        const sa = (nd > 0 ? .45 * (1 - solid) : 0) * s + solid * s * (.04 + .2 * rim) * (1 + hot);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { const j = qd.ix[k] * 2; ctx[k ? 'lineTo' : 'moveTo'](P[j], P[j + 1]); }
        ctx.closePath();
        if (fa > .004) { ctx.fillStyle = `rgba(${r},${g},${b},${fa})`; ctx.fill(); }
        if (sa > .03) { ctx.strokeStyle = `rgba(${r},${g},${b},${sa})`; ctx.lineWidth = .7; ctx.stroke(); }
      }
      if (hot > .02) { // brilho laranja na região em foco
        const c = pt(t.x, t.sg * (GAP + t.h * .7 + open), t.cz), rad = 46 * c[2] * (.9 + .1 * Math.sin(time / 260 + t.i));
        const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rad);
        g.addColorStop(0, `rgba(255,150,50,${.5 * hot})`); g.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = g; ctx.fillRect(c[0] - rad, c[1] - rad, rad * 2, rad * 2);
      }
    }

    // plano de scan
    if (planeA > .01) {
      const c = [pt(scanX, -105, -120), pt(scanX, -105, 130), pt(scanX, 105, 130), pt(scanX, 105, -120)];
      const g = ctx.createLinearGradient(c[0][0], c[0][1], c[3][0], c[3][1]);
      g.addColorStop(0, 'rgba(140,210,255,0)'); g.addColorStop(.5, `rgba(140,210,255,${.2 * planeA})`); g.addColorStop(1, 'rgba(140,210,255,0)');
      ctx.fillStyle = g; quad(c[0], c[1], c[2], c[3]); ctx.fill();
      ctx.strokeStyle = `rgba(200,236,255,${.9 * planeA})`; ctx.lineWidth = 1.5; ctx.shadowColor = '#8fd3ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(c[1][0], c[1][1]); ctx.lineTo(c[2][0], c[2][1]); ctx.moveTo(c[0][0], c[0][1]); ctx.lineTo(c[3][0], c[3][1]); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = `rgba(215,240,255,${.9 * planeA})`;
      for (const t of teeth) for (let k = 0, j = 0; k < t.V.length; k += 3, j += 2) {
        if (Math.abs(t.V[k] - scanX) < 14 && t.T[k + 2] > -30) ctx.fillRect(t.P[j] - 1.2, t.P[j + 1] - 1.2, 2.4, 2.4);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // marcações FDI
    const la = sm(.4, .5, p) * (1 - sm(.66, .74, p));
    if (la > .01) {
      ctx.font = '600 11px Manrope, sans-serif'; ctx.textAlign = 'center';
      for (const t of teeth) {
        if (!CALL.includes(t.fdi)) continue;
        const o = (3 * U + 3) * 2, px = t.P[o], py = t.P[o + 1], ly = py + (t.upper ? -56 : 56);
        const hotL = t.focus ? '255,170,90' : '190,225,255';
        ctx.strokeStyle = `rgba(${hotL},${.75 * la})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 14, ly); ctx.lineTo(px + 44, ly); ctx.stroke();
        ctx.fillStyle = `rgba(${hotL},${la})`; ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
        ctx.fillText(String(t.fdi), px + 58, ly + 4);
      }
    }

    // arco do sorriso + brilho
    const ar = sm(.84, .98, p);
    if (ar > .01) {
      const pts = top.map((t) => [t.P[6], t.P[7]]);
      ctx.strokeStyle = `rgba(255,216,154,${.85 * ar})`; ctx.lineWidth = 1.6; ctx.shadowColor = '#ffd89a'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(...pts[0]);
      for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(...pts[k], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      ctx.lineTo(...pts[pts.length - 1]); ctx.stroke(); ctx.shadowBlur = 0;
      const c = top.find((t) => t.fdi === 11), sx = c.P[6], sy = c.P[7] + 20, sz = 16 * ar * (.8 + .2 * Math.sin(time / 300));
      ctx.fillStyle = `rgba(255,255,255,${ar})`; ctx.beginPath();
      ctx.moveTo(sx, sy - sz); ctx.quadraticCurveTo(sx, sy, sx + sz, sy); ctx.quadraticCurveTo(sx, sy, sx, sy + sz);
      ctx.quadraticCurveTo(sx, sy, sx - sz, sy); ctx.quadraticCurveTo(sx, sy, sx, sy - sz); ctx.fill();
    }

    // UI
    const n = Math.round(clamp(scannedSum, 0, 32));
    out.teeth.textContent = String(n).padStart(2, '0') + '/32';
    out.prec.textContent = n ? '±0,02 mm' : '—';
    out.shade.textContent = p < .4 ? 'Escaneando' : p < .64 ? 'Atenção 26 · 36' : p < .84 ? 'Simulando' : 'Sorriso ideal';
    out.bar.style.transform = `scaleX(${p})`;
    const idx = p < .3 ? 0 : p < .6 ? 1 : p < .85 ? 2 : 3;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === idx));
    out.now.textContent = '0' + (idx + 1);
  }

  /* ---------- Loop ---------- */
  const target = () => {
    const r = root.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight));
  };
  resize();
  if (reduce) { steps.forEach((s) => s.classList.add('is-on')); render(.95, 0); addEventListener('resize', () => render(.95, 0)); return; }
  let cur = target(), vis = true;
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(root);
  (function loop(t) {
    requestAnimationFrame(loop);
    if (!vis) return;
    ptr.x = lerp(ptr.x, ptr.tx, .06); ptr.y = lerp(ptr.y, ptr.ty, .06);
    cur = lerp(cur, target(), .12);
    render(cur, t);
  })(0);
})();