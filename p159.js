"use strict";
/* p159: printable instructor sheets for the planning lab (October 28, 2026). Each lesson page gets
   "Print instructor sheet": one page with the ACS task, why it matters, the key points, the 172 and
   Warrior notes, the practice task, the three check questions with an answer key and room for notes.
   The lesson list prints all six. Black on white, whatever the screen theme. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #lsPrint{display:none}
    @media print{
      html.day body.ls-print,html body.ls-print{filter:none!important}
      html.day:has(body.ls-print){filter:none!important}
      body.ls-print > *:not(#lsPrint){display:none!important}
      body.ls-print{background:#fff!important}
      body.ls-print #lsPrint,body.ls-print #lsPrint *{visibility:visible!important}
      body.ls-print::before{display:none!important}
      body.ls-print #lsPrint{display:block!important;color:#000;background:#fff;font:11pt/1.4 Georgia,"Times New Roman",serif}
      #lsPrint .sh{page-break-after:always;padding:0 4mm}
      #lsPrint .sh:last-child{page-break-after:auto}
      #lsPrint h1{font:700 17pt Georgia,serif;margin:0 0 2pt;color:#000}
      #lsPrint .acs{font:9pt Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#444;margin:0 0 8pt}
      #lsPrint h2{font:700 11pt Arial,sans-serif;margin:10pt 0 3pt;border-bottom:1px solid #999;color:#000}
      #lsPrint ul,#lsPrint ol{margin:0;padding-left:16pt}
      #lsPrint li{margin:0 0 3pt}
      #lsPrint .opt{margin:1pt 0 0 10pt;font-size:10pt}
      #lsPrint .key{font-size:9.5pt;color:#222;margin:2pt 0 6pt 10pt}
      #lsPrint .nt{border:1px solid #999;height:70pt;margin-top:4pt}
      #lsPrint .ft{font:8.5pt Arial,sans-serif;color:#444;margin-top:8pt}
      @page{margin:14mm}
    }
    .lab-page .ls-btns{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}
  `;
  document.head.appendChild(css);
  const sheet = (l, i, n) => `<div class="sh"><h1>${i + 1}. ${h(l.title)}</h1><p class="acs">Planning lab · lesson ${i + 1} of ${n} · ${h(l.acs)} · about ${h(l.min)} minutes</p>
    <h2>Why it matters</h2><p>${h(l.why)}</p>
    <h2>Key points</h2><ul>${l.points.map((p) => `<li>${h(p)}</li>`).join("")}</ul>
    <h2>Cessna 172 and Piper Warrior</h2><p>${h(l.ac)}</p>
    <h2>Practice in AeroSignal</h2><p>${h(l.practice)} Plan a flight for tomorrow on the lesson page, then review the brief together.</p>
    <h2>Check questions</h2><ol>${l.quiz.map((q) => `<li>${h(q[0])}${q[1].map((o, oi) => `<div class="opt">${"ABC"[oi] || oi + 1}. ${h(o)}</div>`).join("")}<div class="key"><b>Answer ${"ABC"[q[2]] || q[2] + 1}.</b> ${h(q[3])}</div></li>`).join("")}</ol>
    <h2>Instructor notes</h2><div class="nt"></div>
    <p class="ft">Training material only. It does not replace instruction from a certificated flight instructor, the school's syllabus, the POH or an official weather briefing. The pilot in command is responsible for every flight.</p></div>`;
  function print(list) {
    const L = window.AeroLab ? AeroLab.LESSONS : [];
    let p = document.getElementById("lsPrint");
    if (!p) { p = document.createElement("div"); p.id = "lsPrint"; document.body.appendChild(p); }
    p.innerHTML = list.map((l) => sheet(l, L.indexOf(l), L.length)).join("");
    document.body.classList.add("ls-print");
    const done = () => { document.body.classList.remove("ls-print"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { try { window.print(); } catch {} setTimeout(done, 1500); }, 60);
  }
  function add() {
    const m = /^#\/lab(?:\/([a-z]+))?\/?$/.exec(location.hash || "");
    if (!m || !window.AeroLab) return;
    const page = document.querySelector("#view .lab-page");
    if (!page || page.querySelector(".ls-btns")) return;
    const L = AeroLab.LESSONS, l = m[1] && L.find((x) => x.id === m[1]);
    const box = document.createElement("div"); box.className = "ls-btns";
    box.innerHTML = l ? `<button type="button" class="btn sec sm" id="lsOne">Print instructor sheet</button>` : `<button type="button" class="btn sec sm" id="lsAll">Print all ${L.length} instructor sheets</button>`;
    const anchor = page.querySelector(".lede");
    if (anchor) anchor.after(box); else page.prepend(box);
    const b1 = box.querySelector("#lsOne"); if (b1) b1.onclick = () => print([l]);
    const b2 = box.querySelector("#lsAll"); if (b2) b2.onclick = () => print(L);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { add(); } catch (e) { console.error(e); } }, 200); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroLabPrint = { print };
})();
