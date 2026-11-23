/* ===== Data & akun ===== */
const AKUN = {
  kader01: { pw: 'Kader#2026', role: 'kader',   nama: 'Siti Aminah',  label: 'Kader Posyandu' },
  bidan01: { pw: 'Bidan#2026', role: 'petugas', nama: 'Bidan Ratna',  label: 'Bidan/Petugas Kesehatan' }
};
const MENU = {
  kader:   ['dashboard', 'balita', 'ukur', 'hasil', 'riwayat', 'laporan'],
  petugas: ['dashboard', 'balita', 'hasil', 'riwayat', 'laporan'],
  ortu:    ['riwayat', 'laporan']
};
const LABEL = { dashboard: '📊 Dashboard', balita: '👶 Data Balita', ukur: '⚖️ Input Pengukuran',
  hasil: '🩺 Hasil & Status Gizi', riwayat: '📈 Riwayat & Grafik', laporan: '📄 Laporan' };

let db;
try { db = JSON.parse(localStorage.getItem('kmsdb') || '{"balita":[],"ukur":[]}'); } catch (e) { db = { balita: [], ukur: [] }; }
function toast(t) { const x = $('toast'); x.textContent = t; x.classList.remove('hide'); clearTimeout(toast.t); toast.t = setTimeout(() => x.classList.add('hide'), 6000); }
let me = null, cur = null;
const $ = id => document.getElementById(id);
const save = () => { try { localStorage.setItem('kmsdb', JSON.stringify(db)); } catch (e) {} };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tglID = d => d ? d.split('-').reverse().join('-') : '-';
const umurBln = (lahir, tgl) => { const a = new Date(lahir), b = new Date(tgl);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--; return Math.max(m, 0); };
const balitaBy = reg => db.balita.find(b => b.reg === reg);
const empty = (t, s) => `<div class="empty"><b>${t}</b>${s || ''}</div>`;
const table = (head, rows) => `<div class="scroll"><table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table></div>`;
const ukurVisible = () => me.role === 'ortu' ? db.ukur.filter(u => u.reg === me.reg) : db.ukur;


/* ===== Standar antropometri & z-score =====
   PENTING: nilai median di bawah ini DATA PERKIRAAN untuk mockup (bukan tabel resmi).
   Ganti dengan tabel Permenkes No. 2/2020. Rumus mengikuti laporan (metode tabel SD). */
const STD = {
  bbu:  { L: [[0,3.3],[1,4.5],[2,5.6],[3,6.4],[6,7.9],[9,8.9],[12,9.6],[18,10.9],[24,12.2],[36,14.3],[48,16.3],[60,18.3]],
          P: [[0,3.2],[1,4.2],[2,5.1],[3,5.8],[6,7.3],[9,8.2],[12,8.9],[18,10.2],[24,11.5],[36,13.9],[48,16.1],[60,18.2]] },
  tbu:  { L: [[0,49.9],[1,54.7],[2,58.4],[3,61.4],[6,67.6],[9,72],[12,75.7],[18,82.3],[24,87.8],[36,96.1],[48,103.3],[60,110]],
          P: [[0,49.1],[1,53.7],[2,57.1],[3,59.8],[6,65.7],[9,70.1],[12,74],[18,80.7],[24,86],[36,95.1],[48,102.7],[60,109.4]] },
  bbtb: { L: [[45,2.4],[50,3.3],[55,4.5],[60,5.9],[65,7.4],[70,8.6],[75,9.5],[80,10.4],[85,11.5],[90,12.6],[95,13.9],[100,15.3],[105,16.9],[110,18.8]],
          P: [[45,2.5],[50,3.3],[55,4.5],[60,5.8],[65,7.2],[70,8.3],[75,9.3],[80,10.2],[85,11.3],[90,12.4],[95,13.7],[100,15.2],[105,16.9],[110,18.7]] },
  imtu: { L: [[0,13.4],[3,16.9],[6,17.3],[9,17.2],[12,16.9],[18,16.5],[24,16],[36,15.7],[48,15.5],[60,15.3]],
          P: [[0,13.3],[3,16.1],[6,16.5],[9,16.4],[12,16.4],[18,16.2],[24,15.7],[36,15.4],[48,15.3],[60,15.2]] }
};
const CV = { bbu: [.105, .12], tbu: [.037, .037], bbtb: [.085, .10], imtu: [.085, .10] }; // selisih 1 SD (bawah, atas) relatif terhadap median
function medianOf(i, jk, x) {
  const t = STD[i][jk]; if (x <= t[0][0]) return t[0][1]; if (x >= t.at(-1)[0]) return t.at(-1)[1];
  const k = t.findIndex(r => r[0] >= x), a = t[k - 1], b = t[k]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
}
function zs(i, v, ref, jk) { const M = medianOf(i, jk, ref), [lo, hi] = CV[i]; return v >= M ? (v - M) / (M * hi) : (v - M) / (M * lo); }
function kurva(i, jk, z, ref) { const M = medianOf(i, jk, ref), [lo, hi] = CV[i]; return M + (z >= 0 ? z * M * hi : z * M * lo); }
function kat(i, z) {
  if (i === 'bbu') return z < -3 ? ['Berat badan sangat kurang', 'bd'] : z < -2 ? ['Berat badan kurang', 'wr'] : z <= 1 ? ['Berat badan normal', 'ok'] : ['Risiko berat badan lebih', 'wr'];
  if (i === 'tbu') return z < -3 ? ['Sangat pendek', 'bd'] : z < -2 ? ['Pendek', 'wr'] : z <= 3 ? ['Normal', 'ok'] : ['Tinggi', 'wr'];
  return z < -3 ? ['Gizi buruk', 'bd'] : z < -2 ? ['Gizi kurang', 'wr'] : z <= 1 ? ['Gizi baik (normal)', 'ok'] : z <= 2 ? ['Berisiko gizi lebih', 'wr'] : z <= 3 ? ['Gizi lebih', 'wr'] : ['Obesitas', 'bd'];
}
function analisis(u, b) {
  const m = umurBln(b.lahir, u.tgl), imt = u.bb / Math.pow(u.tb / 100, 2);
  const R = (i, label, hasil, x, ref) => { const z = zs(i, x, ref, b.jk), k = kat(i, z); return { i, label, hasil, z, kat: k[0], cls: k[1] }; };
  return [R('bbu', 'BB/U', u.bb + ' kg', u.bb, m), R('tbu', 'TB/U', u.tb + ' cm', u.tb, m),
          R('bbtb', 'BB/TB', u.bb + ' kg / ' + u.tb + ' cm', u.bb, u.tb), R('imtu', 'IMT/U', imt.toFixed(1), imt, m)];
}
const abnormal = a => a.filter(x => x.cls !== 'ok').map(x => x.label);
const ZCFG = { bbu: { name: 'BB/U (KMS)', lv: [-3, -2, 1], y: [0, 26] }, tbu: { name: 'TB/U', lv: [-3, -2, 3], y: [40, 125] } };
const ZCOL = ['#f1948a', '#f9e79f', '#abebc6', '#f9e79f'];
let cIdx = 'bbu';
const zona = (i, z) => { const l = ZCFG[i].lv; return z < l[0] ? ['Zona merah', 'bd'] : z < l[1] ? ['Zona kuning (di bawah standar)', 'wr'] : z <= l[2] ? ['Zona hijau (sesuai standar KMS)', 'ok'] : ['Zona kuning (di atas standar)', 'wr']; };
const naikT = (l, k) => k === 0 ? '-' : (l[k].bb > l[k - 1].bb ? 'Naik (N)' : 'Tidak naik (T)');

/* ===== Login ===== */
function login() {
  const u = $('u').value.trim(), p = $('p').value;
  let acc = AKUN[u.toLowerCase()];
  if (acc && acc.pw === p) me = { ...acc, user: u.toLowerCase() };
  else {
    const b = db.balita.find(x => x.reg.toLowerCase() === u.toLowerCase());
    if (b && b.lahir.split('-').reverse().join('') === p)
      me = { role: 'ortu', reg: b.reg, nama: 'Orang tua ' + b.nama, label: 'Orang tua/Wali' };
  }
  $('loginErr').classList.toggle('hide', !!me);
  if (!me) return;
  $('login').classList.add('hide'); $('app').classList.remove('hide');
  $('uName').textContent = me.nama; $('uRole').textContent = me.label;
  $('nav').innerHTML = MENU[me.role].map(s => `<a href="#" data-s="${s}">${LABEL[s]}</a>`).join('');
  $('nav').onclick = e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); go(a.dataset.s); } };
  go(MENU[me.role][0]);
}
function logout() { me = null; $('u').value = $('p').value = ''; $('app').classList.add('hide'); $('login').classList.remove('hide'); }

/* ===== Navigasi ===== */
function go(s) {
  if (!MENU[me.role].includes(s)) return;   // hak akses
  document.querySelectorAll('.screen').forEach(e => e.classList.toggle('on', e.id === s));
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.s === s));
  ({ dashboard: rDash, balita: rBalita, ukur: rUkur, hasil: rHasil, riwayat: rRiwayat, laporan: rLaporan })[s]();
}

/* ===== Dashboard ===== */
function rDash() {
  const bln = new Date().toISOString().slice(0, 7);
  const pend = db.ukur.filter(u => !u.tindak);
  $('stats').innerHTML = [[db.balita.length, 'Balita terdaftar'], [db.ukur.filter(u => u.tgl.startsWith(bln)).length, 'Diukur bulan ini'], [pend.length, 'Belum ditinjau']]
    .map(([n, t], i) => `<div class="stat ${i == 2 && n ? 'warn' : ''}"><b>${n}</b><span>${t}</span></div>`).join('');
  $('pending').innerHTML = pend.length ? table(['Nama', 'Tanggal', 'BB / TB', ''], pend.map(u => `<tr><td>${esc(balitaBy(u.reg).nama)}</td><td>${tglID(u.tgl)}</td><td>${u.bb} kg / ${u.tb} cm</td>
    <td>${me.role === 'petugas' ? `<button class="btn o" onclick="cur=${u.id};go('hasil')">Tinjau</button>` : ''}</td></tr>`))
    : empty('Belum ada data', 'Data akan muncul setelah kader menginput pengukuran.');
}

/* ===== Data balita ===== */
function rBalita() {
  $('formBalita').classList.toggle('hide', me.role !== 'kader');
  drawBalita();
}
function drawBalita() {
  const q = $('q').value.toLowerCase();
  const l = db.balita.filter(b => (b.nama + b.reg).toLowerCase().includes(q));
  $('balitaList').innerHTML = l.length ? table(['NIK', 'Nama', 'JK', 'Tgl Lahir', 'Orang Tua/Wali', 'Kontak'],
    l.map(b => `<tr><td>${b.reg}</td><td>${esc(b.nama)}</td><td>${b.jk}</td><td>${tglID(b.lahir)}</td><td>${esc(b.ortu)}</td><td>${esc(b.kontak)}</td></tr>`))
    : empty('Belum ada balita terdaftar', me.role === 'kader' ? 'Daftarkan balita pertama lewat form di bawah.' : 'Menunggu kader mendaftarkan balita.');
}
function simpanBalita() {
  const v = id => $(id).value.trim(), er = $('errBalita');
  if (!/^\d{16}$/.test(v('bReg'))) { er.textContent = 'NIK harus tepat 16 digit angka (sekarang ' + v('bReg').length + ' digit).'; er.classList.remove('hide'); return; }
  if (balitaBy(v('bReg'))) { er.textContent = 'NIK ini sudah terdaftar.'; er.classList.remove('hide'); return; }
  if (!v('bNama') || !v('bLahir')) { er.textContent = 'Nama, jenis kelamin, dan tanggal lahir wajib diisi.'; er.classList.remove('hide'); return; }
  if (new Date(v('bLahir')) > new Date()) { er.textContent = 'Tanggal lahir tidak boleh di masa depan.'; er.classList.remove('hide'); return; }
  er.classList.add('hide');
  db.balita.push({ reg: v('bReg'), nama: v('bNama'), jk: $('bJk').value, lahir: v('bLahir'), ortu: v('bOrtu'), kontak: v('bKontak'), alamat: v('bAlamat'), bbl: v('bBbl'), pbl: v('bPbl') });
  save(); ['bReg', 'bNama', 'bLahir', 'bOrtu', 'bKontak', 'bAlamat', 'bBbl', 'bPbl'].forEach(i => $(i).value = '');
  rBalita();
  toast('Balita tersimpan.\nAkun orang tua:\nUsername: ' + db.balita.at(-1).reg + ' (NIK)\nPassword: tanggal lahir balita (ddmmyyyy)');
}

/* ===== Input pengukuran ===== */
function rUkur() {
  $('uBalita').innerHTML = db.balita.length ? db.balita.map(b => `<option value="${b.reg}">${b.reg} - ${esc(b.nama)}</option>`).join('') : '<option value="">(belum ada balita)</option>';
  $('uTgl').value = new Date().toISOString().slice(0, 10); $('uPetugas').value = me.nama;
  $('errUkur').classList.add('hide'); $('okUkur').classList.add('hide');
}
function simpanUkur() {
  const er = $('errUkur'), ok = $('okUkur'); ok.classList.add('hide');
  const b = balitaBy($('uBalita').value), tgl = $('uTgl').value;
  const bb = parseFloat($('uBb').value.replace(',', '.')), tb = parseFloat($('uTb').value.replace(',', '.')), lkRaw = $('uLk').value.replace(',', '.'), lk = lkRaw ? parseFloat(lkRaw) : null;
  const err = [];
  if (!b) err.push('Pilih balita terlebih dahulu (daftarkan dulu jika belum ada).');
  if (!tgl) err.push('Tanggal pengukuran wajib diisi.');
  if (b && tgl && tgl < b.lahir) err.push('Tanggal pengukuran lebih awal dari tanggal lahir.');
  if (b && tgl && umurBln(b.lahir, tgl) > 60) err.push('Umur melebihi 60 bulan (di luar sasaran balita).');
  if (isNaN(bb) || bb < 1 || bb > 25) err.push('Berat badan tidak wajar (harus 1-25 kg). Periksa salah ketik.');
  if (isNaN(tb) || tb < 40 || tb > 125) err.push('Panjang/tinggi badan tidak wajar (harus 40-125 cm). Periksa salah ketik.');
  if (lk !== null && (isNaN(lk) || lk < 30 || lk > 60)) err.push('Lingkar kepala tidak wajar (harus 30-60 cm).');
  if (err.length) { er.innerHTML = err.join('<br>'); er.classList.remove('hide'); return; }
  er.classList.add('hide');
  db.ukur.push({ id: Date.now(), reg: b.reg, tgl, bb, tb, lk, petugas: me.nama, tindak: '' }); save();
  ['uBb', 'uTb', 'uLk'].forEach(i => $(i).value = '');
  ok.textContent = 'Pengukuran ' + b.nama + ' tersimpan. Menunggu peninjauan bidan/petugas.'; ok.classList.remove('hide');
}

/* ===== Hasil & tindak lanjut ===== */
function rHasil() {
  const l = [...db.ukur].reverse();
  $('hSel').innerHTML = l.length ? l.map(u => `<option value="${u.id}">${esc(balitaBy(u.reg).nama)} - ${tglID(u.tgl)}</option>`).join('') : '<option value="">(belum ada data)</option>';
  if (cur && l.some(u => u.id === cur)) $('hSel').value = cur;
  drawHasil();
}
function drawHasil() {
  const u = db.ukur.find(x => x.id == $('hSel').value), box = $('hasilBody');
  if (!u) { box.innerHTML = `<div class="card">${empty('Belum ada hasil pengukuran')}</div>`; return; }
  cur = u.id; const b = balitaBy(u.reg), umur = umurBln(b.lahir, u.tgl), canEdit = me.role === 'petugas';
  const a = analisis(u, b), abn = abnormal(a);
  box.innerHTML = `<div class="card"><h2>${esc(b.nama)} · ${b.jk === 'L' ? 'Laki-laki' : 'Perempuan'} · ${umur} bulan</h2>
    <p class="sub">Kunjungan ${tglID(u.tgl)} · dicatat ${esc(u.petugas)}${u.lk ? ' · LK ' + u.lk + ' cm' : ''}</p>
    ${table(['Indeks', 'Hasil ukur', 'Z-score', 'Kategori'], a.map(x => `<tr><td>${x.label}</td><td>${x.hasil}</td><td>${x.z.toFixed(2)}</td><td><span class="badge ${x.cls}">${x.kat}</span></td></tr>`))}
    <div class="alert ${abn.length ? 'w' : 'i'}" style="margin-top:14px">${abn.length ? '<b>Ada indeks di luar rentang normal (' + abn.join(', ') + ').</b> Disarankan rujukan ke tenaga kesehatan untuk penilaian lebih lanjut.' : 'Semua indeks berada dalam rentang normal.'}</div>
    <p class="note">Nilai standar yang dipakai sementara adalah data perkiraan untuk mockup. Ganti dengan tabel resmi Permenkes No. 2/2020 sebelum dipakai nyata.</p></div>
    <div class="card"><h2>Tindak lanjut</h2>
    <div class="f"><label>Catatan tindak lanjut ${canEdit ? '' : '(hanya bidan/petugas yang dapat mengisi)'}</label>
    <textarea id="tTindak" rows="3" ${canEdit ? '' : 'disabled'} placeholder="Contoh: dirujuk ke Puskesmas, konseling gizi, kontrol 1 bulan">${esc(u.tindak)}</textarea></div>
    ${canEdit ? '<button class="btn" id="btnTindak">Simpan Tindak Lanjut</button>' : ''}
    <p class="note">Sistem ini bukan alat diagnosis dan tidak menggantikan penilaian tenaga kesehatan.</p></div>`;
  if (canEdit) $('btnTindak').onclick = () => { u.tindak = $('tTindak').value.trim(); save(); toast('Tindak lanjut tersimpan.'); };
}

/* ===== Riwayat & grafik ===== */
function rRiwayat() {
  const ortu = me.role === 'ortu';
  $('rPilih').classList.toggle('hide', ortu);
  $('rSel').innerHTML = db.balita.length ? db.balita.map(b => `<option value="${b.reg}">${b.reg} - ${esc(b.nama)}</option>`).join('') : '<option value="">(belum ada balita)</option>';
  if (ortu) $('rSel').value = me.reg;
  drawRiwayat();
}
function drawRiwayat() {
  const b = balitaBy($('rSel').value);
  $('rSub').textContent = b ? `${b.nama} · NIK ${b.reg}` + (me.role === 'ortu' ? ' (hanya lihat)' : '') : 'Belum ada balita terdaftar';
  const l = b ? db.ukur.filter(u => u.reg === b.reg).sort((x, y) => x.tgl.localeCompare(y.tgl)) : [];
  const zb = u => zona('bbu', zs('bbu', u.bb, umurBln(b.lahir, u.tgl), b.jk));
  $('rTabel').innerHTML = l.length ? table(['Tanggal', 'Umur', 'BB (kg)', 'TB (cm)', 'Zona KMS (BB/U)', 'Naik/Tidak', 'Tindak lanjut'],
    l.map((u, k) => `<tr><td>${tglID(u.tgl)}</td><td>${umurBln(b.lahir, u.tgl)} bln</td><td>${u.bb}</td><td>${u.tb}</td><td><span class="badge ${zb(u)[1]}">${zb(u)[0].split(' (')[0]}</span></td><td>${naikT(l, k)}</td><td>${esc(u.tindak) || '-'}</td></tr>`).reverse())
    : empty('Belum ada riwayat pengukuran');
  if (!b || !l.length) { $('chart').innerHTML = empty('Grafik muncul setelah ada data pengukuran'); return; }
  const C = ZCFG[cIdx], [y0, y1] = C.y, X = a => 50 + a / 60 * 520, Y = v => 220 - (Math.min(Math.max(v, y0), y1) - y0) / (y1 - y0) * 200;
  const ages = [...Array(21).keys()].map(k => k * 3), cv = z => ages.map(a => [a, kurva(cIdx, b.jk, z, a)]);
  const bounds = [null, ...C.lv, null];
  const polys = ZCOL.map((col, k) => {
    const lo = bounds[k] === null ? ages.map(a => [a, y0]) : cv(bounds[k]), hi = bounds[k + 1] === null ? ages.map(a => [a, y1]) : cv(bounds[k + 1]);
    return `<polygon points="${[...lo, ...hi.reverse()].map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="${col}"/>`; }).join('');
  const pts = l.map(u => [umurBln(b.lahir, u.tgl), cIdx === 'bbu' ? u.bb : u.tb]);
  const yt = [0, 1, 2, 3, 4].map(k => y0 + (y1 - y0) * k / 4);
  const lastZ = zs(cIdx, pts.at(-1)[1], pts.at(-1)[0], b.jk), zn = zona(cIdx, lastZ);
  $('chart').innerHTML = `<div class="tabs">${Object.keys(ZCFG).map(k => `<span class="${k === cIdx ? 'on' : ''}" onclick="cIdx='${k}';drawRiwayat()">${ZCFG[k].name}</span>`).join('')}</div>
    <svg class="chart" viewBox="0 0 620 270"><rect x="50" y="20" width="520" height="200"/>${polys}
    ${yt.map(v => `<text x="44" y="${Y(v) + 4}" font-size="10" text-anchor="end">${Math.round(v)}</text>`).join('')}
    ${[0, 12, 24, 36, 48, 60].map(a => `<text x="${X(a)}" y="236" font-size="10" text-anchor="middle">${a}</text>`).join('')}
    ${C.lv.map(z => `<text x="574" y="${Y(kurva(cIdx, b.jk, z, 60)) + 4}" font-size="10">${z > 0 ? '+' : ''}${z} SD</text>`).join('')}
    <text x="310" y="256" font-size="11" text-anchor="middle">Umur (bulan)</text>
    <polyline points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke-width="2.5"/>
    ${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5"/>`).join('')}</svg>
    <div class="legend"><span>🟥 Merah: &lt; -3 SD</span><span>🟨 Kuning: -3 s/d -2 SD dan di atas batas atas</span><span>🟩 Hijau: sesuai standar</span></div>
    <div class="alert ${zn[1] === 'ok' ? 'i' : 'w'}" style="margin-top:12px"><b>Posisi terakhir (${C.name}): ${zn[0]}</b> · z-score ${lastZ.toFixed(2)}${cIdx === 'bbu' ? ' · ' + naikT(l, l.length - 1) : ''}</div>
    <p class="note">Garis batas memakai data standar perkiraan (lihat catatan di halaman Hasil).</p>`;
}

/* ===== Laporan ===== */
function rLaporan() {
  const l = ukurVisible(), ortu = me.role === 'ortu', bb = ortu ? balitaBy(me.reg) : null;
  $('lInfo').textContent = ortu ? `Balita: ${bb.nama} · NIK ${bb.reg}` : `Semua balita terdaftar (${db.balita.length} balita)`;
  $('lTgl').textContent = new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }); $('lOleh').textContent = me.nama;
  $('lTtd').classList.toggle('hide', ortu);
  $('lTabel').innerHTML = l.length ? table(['Nama', 'Tanggal', 'Umur', 'BB', 'TB', 'Zona KMS', 'Status gizi', 'Tindak lanjut'],
    [...l].reverse().map(u => { const b = balitaBy(u.reg), a = analisis(u, b), ab = abnormal(a), z = zona('bbu', a[0].z);
      return `<tr><td>${esc(b.nama)}</td><td>${tglID(u.tgl)}</td><td>${umurBln(b.lahir, u.tgl)} bln</td><td>${u.bb}</td><td>${u.tb}</td><td><span class="badge ${z[1]}">${z[0].split(' (')[0]}</span></td>
      <td><span class="badge ${ab.length ? 'wr' : 'ok'}">${ab.length ? 'Perlu ditinjau: ' + ab.join(', ') : 'Normal'}</span></td><td>${esc(u.tindak) || '-'}</td></tr>`; }))
    : empty('Belum ada data laporan', 'Laporan terisi otomatis dari data pengukuran.');
}

/* ===== Event ===== */
$('btnLogin').onclick = login; $('p').onkeydown = e => { if (e.key === 'Enter') login(); };
$('btnOut').onclick = logout; $('btnSimpanBalita').onclick = simpanBalita; $('btnSimpanUkur').onclick = simpanUkur;
$('q').oninput = drawBalita; $('bReg').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16); }; $('hSel').onchange = drawHasil; $('rSel').onchange = drawRiwayat;
$('btnReset').onclick = () => { try { localStorage.removeItem('kmsdb'); } catch (e) {} db = { balita: [], ukur: [] }; toast('Semua data demo dihapus.'); };
