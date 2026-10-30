import { hoyEnZona, diaDelPlan, semanaDelPlan, sumarDias, lunesDe, fechaLinda, fechaCorta, DIAS_LARGO } from "./logic.js";

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const txt = (t) => esc(t).replace(/(a confirmar)/gi, '<span class="aconf">$1</span>');

let plan, hoy, fecha, vista = "hoy";

function leerUrl() {
  const q = new URLSearchParams(location.search);
  const f = q.get("fecha");
  if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) hoy = f; // simular "hoy" (pruebas)
  fecha = hoy;
  const h = location.hash.replace("#", "");
  const m = /^(hoy|semana)(?:\/(\d{4}-\d{2}-\d{2}))?$/.exec(h);
  if (m) { vista = m[1]; if (m[2]) fecha = m[2]; }
}
function irA(v, f) { vista = v; fecha = f; history.replaceState(null, "", location.pathname + location.search + "#" + v + (f !== hoy ? "/" + f : "")); render(); }

function bloque(b) {
  if (b.ref) {
    const r = plan.bloques[b.ref];
    if (!r) return "";
    return `<section class="card"><h2>⚡ ${esc(r.titulo)}</h2><ol>${r.lista.map((i) => `<li>${txt(i)}</li>`).join("")}</ol>${r.nota ? `<p class="nota">${txt(r.nota)}</p>` : ""}</section>`;
  }
  let h = `<section class="card"><h2>${esc(b.titulo || "")}</h2>`;
  if (b.filas) h += `<table>${b.filas.map(([e, d]) => `<tr><td>${txt(e)}</td><td class="dosis${String(d).length > 20 ? " largo" : ""}">${txt(d)}</td></tr>`).join("")}</table>`;
  if (b.lista) h += `<ol>${b.lista.map((i) => `<li>${txt(i)}</li>`).join("")}</ol>`;
  if (b.texto) h += `<p>${txt(b.texto)}</p>`;
  if (b.nota) h += `<p class="nota">${txt(b.nota)}</p>`;
  return h + "</section>";
}

const keyCampo = (f) => "campo:" + lunesDe(f);
const hechas = (f) => { try { return JSON.parse(localStorage.getItem(keyCampo(f)) || "[]"); } catch { return []; } };

function campoCard(d) {
  if (!d.campo) return "";
  if (d.campo.aConfirmar) return `<section class="card"><h2>🏃 Campo programado</h2><p>Para esta semana el campo programado está <span class="aconf">a confirmar</span> con el staff.</p></section>`;
  const c = d.campo, done = hechas(d.fecha);
  const sug = c.opciones.find((o) => !done.includes(o.n));
  const listo = done.length >= c.sesionesPorSemana;
  return `<section class="card"><h2>🏃 Campo programado</h2>
    <p class="nota">${esc(c.nombre)} · semana ${c.semanaPlan} de ${c.totalSemanas}. Hacé ${c.sesionesPorSemana} sesiones en la semana, <b>sin repetir opción</b>.</p>
    <p class="contador">${listo ? "✅ Ya completaste el campo de esta semana" : `Llevás ${done.length} de ${c.sesionesPorSemana} esta semana`}</p>
    ${c.opciones.map((o) => `<label class="opc${done.includes(o.n) ? " hecha" : ""}${!listo && sug && sug.n === o.n ? " sug" : ""}">
      <input type="checkbox" data-op="${o.n}" ${done.includes(o.n) ? "checked" : ""}>
      <span class="t"><span class="n">Opción ${o.n} · ${esc(o.nombre)}${!listo && sug && sug.n === o.n ? " — sugerida hoy" : ""}</span><br>${txt(o.texto)}</span></label>`).join("")}
    ${c.nota ? `<p class="nota">${txt(c.nota)}</p>` : ""}<p class="nota">Marcá la que hiciste; se guarda en este teléfono.</p></section>`;
}

function cabecera(d) {
  const chips = [];
  if (d.fase) chips.push(`<span class="chip acc">${esc(d.fase.nombre)}</span>`);
  if (d.tipo === "entrenamiento") chips.push(`<span class="chip">Semana ${d.semanaFase} de la fase</span>`);
  if (d.semanaPlan >= 1 && d.tipo !== "descanso") chips.push(`<span class="chip">Semana ${d.semanaPlan} del plan</span>`);
  if (d.especial && d.especial.nombre) chips.push(`<span class="chip">${esc(d.especial.nombre)}</span>`);
  const titulo = d.fecha === hoy ? "Hoy" : DIAS_LARGO[d.dia];
  return `<section class="card hero"><h1>${titulo}</h1><div class="sub">${fechaLinda(d.fecha)}</div><div class="chips">${chips.join("")}</div></section>`;
}

function avisoInicio() {
  const cal = plan.config.notaCalendario ? `<section class="card"><p class="nota">${txt(plan.config.notaCalendario)}</p></section>` : "";
  if (plan.config.inicioPlanConfirmado) return cal;
  return cal + `<section class="card aviso"><b>Fecha de inicio a confirmar:</b> el plan está calculado arrancando el ${fechaLinda(plan.config.inicioPlan)}. Si el staff confirma otra fecha, se actualiza y todo se recalcula solo.</section>`;
}

function vistaDia(d) {
  let h = cabecera(d);
  if (d.tipo === "descanso") {
    h += `<section class="card"><p class="big">😴 Descanso</p><p>${txt(plan.config.mensajeDescanso || "Día libre.")}</p>
      ${d.faltan > 0 ? `<p>El plan arranca el <b>${fechaLinda(d.inicioPlan)}</b> (en ${d.faltan} día${d.faltan === 1 ? "" : "s"}).</p>` : ""}</section>` + avisoInicio();
    return h;
  }
  if (d.tipo !== "entrenamiento") {
    return h + `<section class="card"><p class="big">📋 ${esc(d.fase.nombre)}</p><p>${txt(d.fase.descripcion || "Plan a definir.")}</p><p>Plan <span class="aconf">a confirmar</span>: cuando llegue el plan nuevo del club se carga acá.</p></section>`;
  }
  if (d.sesion) {
    h += `<section class="card"><p class="big">🏋️ ${esc(d.sesion.titulo)}</p>${d.fase.descansoSeries ? `<p class="nota">${txt(d.fase.descansoSeries)}</p>` : ""}</section>`;
    h += (d.sesion.bloques || []).map(bloque).join("");
  } else {
    h += `<section class="card"><p class="big">Sin gimnasio hoy</p><p>${d.campo ? "Si te toca, aprovechá para una sesión de campo." : "Descanso / recuperación."}</p></section>`;
  }
  h += campoCard(d);
  if (d.fase.aConfirmar && d.fase.aConfirmar.length) h += `<section class="card"><details><summary>Pendientes a confirmar de esta fase</summary><ul>${d.fase.aConfirmar.map((x) => `<li>${txt(x)}</li>`).join("")}</ul></details></section>`;
  return h + avisoInicio();
}

function vistaSemana() {
  const dias = semanaDelPlan(fecha, plan);
  const lun = dias[0].fecha, dom = dias[6].fecha;
  let h = `<section class="card hero"><h1>Semana</h1><div class="sub">${fechaCorta(lun)} al ${fechaCorta(dom)}</div><div class="chips">${dias[0].fase ? `<span class="chip acc">${esc(dias[0].fase.nombre)}</span>` : ""}${dias[0].tipo === "entrenamiento" ? `<span class="chip">Semana ${dias[0].semanaFase} de la fase</span>` : ""}</div></section>`;
  h += dias.map((d) => {
    let s;
    if (d.tipo === "descanso") s = "Descanso";
    else if (d.tipo !== "entrenamiento") s = esc(d.fase.nombre) + " · a definir";
    else s = (d.sesion ? "🏋️ " + esc(d.sesion.titulo) : "Sin gimnasio") + (d.campo && !d.campo.aConfirmar ? " · 🏃 campo opcional" : "");
    return `<button class="sem-dia${d.fecha === hoy ? " hoy" : ""}" data-ir="${d.fecha}"><div class="d">${DIAS_LARGO[d.dia]} ${fechaCorta(d.fecha)}${d.fecha === hoy ? " · hoy" : ""}</div><div class="s">${s}</div></button>`;
  }).join("");
  const c = dias.find((d) => d.campo && !d.campo.aConfirmar);
  if (c) h += `<section class="card"><h2>🏃 Campo de la semana</h2><p class="nota">${esc(c.campo.nombre)} · semana ${c.campo.semanaPlan}: elegí ${c.campo.sesionesPorSemana} opciones distintas.</p><ol>${c.campo.opciones.map((o) => `<li>${txt(o.texto)}</li>`).join("")}</ol></section>`;
  return h + avisoInicio();
}

function render() {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.vista === vista));
  $("#fecha").value = fecha;
  $("#fecha-label").textContent = vista === "hoy" ? (fecha === hoy ? "Hoy · " : "") + fechaLinda(fecha) : "Semana del " + fechaCorta(lunesDe(fecha));
  $("#volver").hidden = vista === "hoy" ? fecha === hoy : lunesDe(fecha) === lunesDe(hoy);
  $("#app").innerHTML = vista === "hoy" ? vistaDia(diaDelPlan(fecha, plan)) : vistaSemana();
  document.body.dataset.fase = diaDelPlan(fecha, plan).fase?.id || "ninguna";
  document.body.dataset.fecha = fecha;
}

async function cargarPlan() {
  const r = await fetch("plan.json", { cache: "no-store" });
  if (!r.ok) throw new Error("No pude cargar plan.json");
  return r.json();
}

async function init() {
  try { plan = await cargarPlan(); } catch (e) { $("#app").innerHTML = `<section class="card aviso">No pude cargar el plan. Revisá la conexión y recargá.</section>`; return; }
  hoy = hoyEnZona(plan.config.zonaHoraria);
  leerUrl();
  $("#pie").textContent = `Club San Carlos · Plantel Superior · plan actualizado al ${fechaCorta(plan.actualizado)} · hora de Buenos Aires`;
  document.querySelectorAll(".tab").forEach((b) => b.onclick = () => irA(b.dataset.vista, fecha));
  $("#prev").onclick = () => irA(vista, sumarDias(fecha, vista === "hoy" ? -1 : -7));
  $("#next").onclick = () => irA(vista, sumarDias(fecha, vista === "hoy" ? 1 : 7));
  $("#fecha").onchange = (e) => e.target.value && irA(vista, e.target.value);
  $("#volver").onclick = () => irA(vista, hoy);
  $("#app").addEventListener("click", (e) => { const b = e.target.closest("[data-ir]"); if (b) irA("hoy", b.dataset.ir); });
  $("#app").addEventListener("change", (e) => {
    const n = e.target.dataset && +e.target.dataset.op; if (!n) return;
    let d = hechas(fecha); d = e.target.checked ? [...new Set([...d, n])] : d.filter((x) => x !== n);
    localStorage.setItem(keyCampo(fecha), JSON.stringify(d)); render();
  });
  // Si cambia el día con la app abierta (pasa la medianoche), refrescar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || new URLSearchParams(location.search).get("fecha")) return;
    const h = hoyEnZona(plan.config.zonaHoraria); if (h !== hoy) { const enHoy = fecha === hoy; hoy = h; if (enHoy) fecha = h; render(); }
  });
  render();
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
init();
