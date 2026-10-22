"use strict";
/* p118: kneeboard card for civil flights (#/card). One page for the phone or a printout: the route,
   times and aircraft; for the departure, destination and alternate the elevation, best runway with
   head and crosswind, and radio frequencies (ATIS, clearance, ground, tower, CTAF, approach); the
   current METAR and TAF lines; a pad for copying an IFR clearance (CRAFT) and ATIS; and the passenger
   briefing (p119). Opens from the Today card (p115) and a "Kneeboard" chip on the brief.
   Frequencies come from OurAirports public data through the freq function and must be checked
   against the current Chart Supplement. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .kc{max-width:860px;margin:0 auto;background:#fbf8ef;color:#111;border-radius:14px;padding:18px 20px;font:14px/1.45 var(--body,system-ui)}
    .kc h1{font:700 24px/1.2 var(--mono,monospace);margin:0;color:#111;letter-spacing:0}
    .kc .sub{color:#444;margin:4px 0 0}
    .kc h3{font:700 12px var(--disp,system-ui);letter-spacing:2px;text-transform:uppercase;color:#0b5a73;margin:16px 0 6px;border-bottom:1.5px solid #111;padding-bottom:3px}
    .kc .aps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
    .kc .ap{border:1.5px solid #111;border-radius:8px;padding:8px 10px}
    .kc .ap b.id{font:700 18px var(--mono,monospace)}
    .kc .ap .role{float:right;font:700 11px var(--disp,system-ui);letter-spacing:1px;text-transform:uppercase;color:#555}
    .kc .ap .nm{font-size:12px;color:#444;margin-bottom:4px}
    .kc table{border-collapse:collapse;width:100%;font:13px var(--mono,monospace)}
    .kc td{padding:2px 0;border-bottom:1px dotted #bbb}
    .kc td.f{text-align:right;font-weight:700}
    .kc .wx{font:12.5px/1.5 var(--mono,monospace);white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px 8px}
    .kc .pad{display:grid;grid-template-columns:auto 1fr;gap:0 10px;font:700 15px var(--mono,monospace)}
    .kc .pad span{border-bottom:1.5px solid #111;min-height:30px}
    .kc .pad i{font-style:normal;font-weight:400;font-size:11px;color:#555;display:block}
    .kc .pax-l li{border-top-color:#ccc}.kc .pax-l span{color:#333}.kc .pax-l .ltr{background:#0b5a73;color:#fff}
    .kc .disc{color:#c8102e;font-weight:700;font-size:12.5px;margin-top:12px}
    .kc-bar{display:flex;gap:8px;flex-wrap:wrap;max-width:860px;margin:0 auto 12px}
    @media print{body *{visibility:hidden!important}.kc,.kc *{visibility:visible!important}.kc{position:absolute;left:0;top:0;width:100%;max-width:none;border-radius:0;padding:0}}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const depAt = (f) => { const d = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : d; };
  const ORDER = ["ATIS", "AWOS", "ASOS", "CLD", "CD", "GND", "TWR", "CTAF", "UNIC", "A/D", "APP", "DEP", "CNTR"];
  const LABEL = { "A/D": "Approach and departure", CLD: "Clearance", CD: "Clearance", GND: "Ground", TWR: "Tower", UNIC: "Unicom", APP: "Approach", DEP: "Departure", CNTR: "Center" };
  const fcache = {};
  async function freqs(ids) {
    const need = ids.filter((i) => !(i in fcache));
    if (need.length) { try { const d = await fnGet(`freq?ids=${encodeURIComponent(need.join(","))}`); for (const i of need) fcache[i] = (d && d.rows && d.rows[i]) || []; } catch { for (const i of need) fcache[i] = null; } }
    const out = {}; for (const i of ids) out[i] = fcache[i]; return out;
  }
  function freqTable(rows) {
    if (rows == null) return `<p class="small" style="margin:4px 0 0;color:#555">Frequencies could not load. Check the Chart Supplement.</p>`;
    if (!rows.length) return `<p class="small" style="margin:4px 0 0;color:#555">No frequencies on file.</p>`;
    const r = [...rows].sort((a, b) => (ORDER.indexOf(a.type) + 99) % 99 - (ORDER.indexOf(b.type) + 99) % 99).filter((x, i, a) => a.findIndex((y) => y.type === x.type && y.mhz === x.mhz) === i).slice(0, 9);
    return `<table>${r.map((x) => `<tr><td>${h(LABEL[x.type] || (x.desc && x.desc.length < 26 ? x.desc : x.type))}</td><td class="f">${h(Number(x.mhz).toFixed(3).replace(/0$/, ""))}</td></tr>`).join("")}</table>`;
  }
  function wxLines(f, ids) {
    const txt = String(f.wxText || "");
    if (!txt.trim()) return "";
    const lines = txt.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const keep = lines.filter((l) => ids.some((i) => new RegExp(`(^|\\s)(TAF\\s+(AMD\\s+)?)?${i}\\b`).test(l)));
    return (keep.length ? keep : lines).slice(0, 8).join("\n");
  }
  async function page(el) {
    let f = null; try { f = currentFlight(); } catch {}
    if (!f || !(f.points || []).length) { el.innerHTML = `<div class="page"><h1>Kneeboard card</h1><p class="lede">Plan a flight first, then its kneeboard card shows here.</p><a class="btn" href="#/plan">Plan a flight</a></div>`; return; }
    let p = null; try { p = profile(f); } catch {}
    const d0 = depAt(f), ete = p && p.ete ? p.ete : null;
    const z = (d) => d ? `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}Z` : "";
    const loc = (d) => d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    const arr = d0 && ete ? new Date(+d0 + ete * 36e5) : null;
    let ac = {}; try { ac = allAircraft()[f.tail] || {}; } catch {}
    el.innerHTML = `<div class="page"><div class="kc-bar"><button type="button" class="btn sm" id="kcPrint">Print</button><a class="btn sec sm" href="#/brief">Back to the brief</a><button type="button" class="btn sec sm" id="kcPax">Passenger briefing</button></div>
      <div class="kc" id="kcCard"><h1>${h(f.route)}</h1>
      <p class="sub">${h(f.date)} · depart ${h(loc(d0))} local (${h(z(d0))})${arr ? ` · arrive about ${h(loc(arr))} (${h(z(arr))})` : ""}${ete ? ` · ${Math.floor(ete)} h ${pad(Math.round((ete % 1) * 60))} min` : ""}<br>${h(f.tail || "")}${ac.typeCode ? " " + h(ac.typeCode) : ""} · ${h(f.rules || "VFR")}${f.alternate ? ` · alternate ${h(f.alternate)}` : ""}${p && p.dist ? ` · ${Math.round(p.dist)} nm` : ""}</p>
      <h3>Airports</h3><div class="aps" id="kcAps"><p class="small" style="color:#555">Loading runways and frequencies…</p></div>
      <h3>Weather in the brief</h3><div id="kcWx"></div>
      <h3>Clearance and ATIS</h3>
      <div class="pad"><b>C</b><span><i>Clearance limit</i></span><b>R</b><span><i>Route</i></span><b>A</b><span><i>Altitude, and expect</i></span><b>F</b><span><i>Departure frequency</i></span><b>T</b><span><i>Transponder</i></span><b>ATIS</b><span><i>Letter, wind, altimeter, runway</i></span></div>
      <h3>Passenger briefing</h3>${window.AeroPax ? AeroPax.html(false) : ""}
      <p class="disc">Frequencies come from OurAirports public data and runway winds from the weather in the brief. Check them against the current Chart Supplement and ATIS. A planning aid, not for navigation.</p></div></div>`;
    el.querySelector("#kcPrint").onclick = () => window.print();
    el.querySelector("#kcPax").onclick = () => window.AeroPax && AeroPax.open();
    let rw = null; try { rw = window.AeroRunways ? await AeroRunways.load(f) : null; } catch {}
    const list = rw && rw.res && rw.res.length ? rw.res : [];
    const ids = list.map((a) => a.ident || a.code).filter(Boolean);
    const fr = await freqs(ids);
    if (!document.getElementById("kcCard")) return;
    const aps = el.querySelector("#kcAps");
    aps.innerHTML = list.length ? list.map((a) => {
      const b = a.best;
      const wind = b ? `Best runway <b>${h(b.id)}</b>${b.len ? `, ${Math.round(b.len).toLocaleString()} ft` : ""}<br>Head ${Math.round(b.head)} kt, cross ${Math.round(b.cross)} kt${b.gx > b.cross + 1 ? `, ${Math.round(b.gx)} in gusts` : ""}` : a.longest ? `Longest runway ${Math.round(a.longest).toLocaleString()} ft` : "";
      return `<div class="ap"><span class="role">${h(a.role)}</span><b class="id">${h(a.ident || a.code)}</b><div class="nm">${h(a.name || "")}${a.elev != null ? ` · elevation ${Math.round(a.elev)} ft` : ""}${a.da != null ? ` · density altitude ${Math.round(a.da / 100) * 100} ft` : ""}</div>${wind ? `<div style="margin-bottom:4px">${wind}</div>` : ""}${freqTable(fr[a.ident || a.code])}</div>`;
    }).join("") : `<p class="small" style="color:#555">No airport data for this route.</p>`;
    const wx = wxLines(f, ids);
    el.querySelector("#kcWx").innerHTML = wx ? `<div class="wx">${h(wx)}</div>` : `<p class="small" style="color:#555;margin:0">No weather loaded yet. Open the brief to load it, then come back.</p>`;
  }
  if (typeof ROUTES !== "undefined") ROUTES.card = (el) => { page(el); };
  // Kneeboard chip on the brief
  let t = 0;
  function chip() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    let f = null; try { f = currentFlight(); } catch {}
    const j = document.getElementById("bfJump");
    if (!j || !f || f.missionId || j.querySelector(".kc-chip")) return;
    const a = document.createElement("a"); a.href = "#/card"; a.className = "kc-chip"; a.textContent = "Kneeboard";
    j.appendChild(a);
  }
  const kick = () => { clearTimeout(t); t = setTimeout(chip, 300); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  if (/^#\/card/.test(location.hash || "")) setTimeout(() => { try { go(); } catch {} }, 0);
})();
