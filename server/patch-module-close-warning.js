// 21 Nov 2026: Edit modules - warn on screen before a module is closed (hidden) for everyone.
const fs=require('fs');const f='index.html';let s=fs.readFileSync(f,'utf8');
const NL=s.includes('\r\n')?'\r\n':'\n';
function rep(a,b){a=a.split('\n').join(NL);b=b.split('\n').join(NL);const n=s.split(a).length-1;if(n!==1)throw new Error('anchor found '+n+'x: '+a.slice(0,60));s=s.replace(a,()=>b)}
// 1) live warning on the row while the box is unticked
rep(`list.querySelectorAll(".me-on").forEach(function (cb) { cb.onchange = function () { var r = cb.closest(".me-row"); r.classList.toggle("off", !cb.checked); cb.nextElementSibling.textContent = cb.checked ? "Shown" : "Hidden"; }; });`,
`list.querySelectorAll(".me-on").forEach(function (cb) { var was = cb.checked; cb.onchange = function () { var r = cb.closest(".me-row"); r.classList.toggle("off", !cb.checked); cb.nextElementSibling.textContent = cb.checked ? "Shown" : "Hidden";
      var w = r.querySelector(".me-warn"); if (was && !cb.checked) { if (!w) { w = document.createElement("div"); w.className = "me-warn"; w.setAttribute("role", "alert"); w.style.cssText = "flex-basis:100%;margin-top:6px;padding:6px 10px;border-radius:6px;background:#fdecea;color:#b3261e;border:1px solid #f5c2bd;font-size:12.5px;font-weight:600"; w.textContent = "⚠ This module will be CLOSED for everyone when you press Save. Staff will no longer see it."; r.style.flexWrap = "wrap"; r.appendChild(w); } } else if (w) w.remove(); }; });`);
// 2) confirm before saving when something is being closed
rep(`document.getElementById("meSave").onclick = function () {
      var next = {};`,
`document.getElementById("meSave").onclick = async function () {
      var closing = [];
      list.querySelectorAll(".me-row").forEach(function (r) { var cb = r.querySelector(".me-on"), k = r.dataset.mkey; if (cb && !cb.checked && !(cur[k] && cur[k].off)) { var ni = r.querySelector(".me-name"), nm = r.querySelector(".me-nm"); closing.push((ni && (ni.value.trim() || ni.placeholder)) || (nm && nm.firstChild && nm.firstChild.textContent) || k); } });
      if (closing.length && !await rcConfirm("⚠ Warning: you are about to CLOSE " + (closing.length === 1 ? "this module" : "these " + closing.length + " modules") + " for everyone:\n\n• " + closing.join("\n• ") + "\n\nStaff will no longer see " + (closing.length === 1 ? "it" : "them") + " in the Workspace, and anyone using " + (closing.length === 1 ? "it" : "them") + " right now will be stopped. The data is kept and you can switch " + (closing.length === 1 ? "it" : "them") + " back on any time.", { ok: "Yes, close " + (closing.length === 1 ? "it" : "them"), danger: true })) return;
      var next = {};`);
fs.writeFileSync(f,s);console.log('ok');
