// Lógica pura de fechas y plan (sin DOM). Se usa en el navegador y en los tests (node).
export const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
export const DIAS_LARGO = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAY = 86400000;

// "Hoy" en la zona del plan, independiente de la zona del teléfono.
export function hoyEnZona(zona = "America/Argentina/Buenos_Aires", ahora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ahora);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

// Fechas como número de día (UTC puro) para evitar líos de horario de verano.
export function aDia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) throw new Error("Fecha inválida: " + iso);
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
}
export function aIso(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
export function sumarDias(iso, k) { return aIso(aDia(iso) + k); }
export function diaSemana(iso) { return DIAS[new Date(aDia(iso) * DAY).getUTCDay()]; }
export function lunesDe(iso) { const n = aDia(iso); const wd = (new Date(n * DAY).getUTCDay() + 6) % 7; return aIso(n - wd); }
export function semanaRelativa(iso, inicioIso) { return Math.floor((aDia(lunesDe(iso)) - aDia(lunesDe(inicioIso))) / 7) + 1; }
export function fechaLinda(iso, conDia = true) {
  const d = new Date(aDia(iso) * DAY);
  const txt = `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
  return conDia ? `${DIAS_LARGO[diaSemana(iso)]} ${txt}` : txt;
}
export function fechaCorta(iso) { const d = new Date(aDia(iso) * DAY); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; }

// Resuelve "@inicioPlan" o "@inicioPlan+3w" / "+10d".
export function resolverFecha(valor, plan) {
  if (!valor) return null;
  const m = /^@inicioPlan(?:\+(\d+)([wd]))?$/.exec(valor);
  if (!m) { aDia(valor); return valor; }
  const base = plan.config.inicioPlan;
  if (!m[1]) return base;
  return sumarDias(base, (+m[1]) * (m[2] === "w" ? 7 : 1));
}

export function fasesOrdenadas(plan) {
  return plan.fases
    .map((f) => ({ ...f, inicioIso: resolverFecha(f.inicio, plan) }))
    .sort((a, b) => aDia(a.inicioIso) - aDia(b.inicioIso));
}

export function faseDe(iso, plan) {
  const fs = fasesOrdenadas(plan);
  let actual = null, siguiente = null;
  for (let i = 0; i < fs.length; i++) {
    if (aDia(fs[i].inicioIso) <= aDia(iso)) { actual = fs[i]; siguiente = fs[i + 1] || null; }
  }
  if (!actual) siguiente = fs[0] || null;
  return { fase: actual, siguiente };
}

function resolverSesion(valor, fase) {
  if (!valor) return null;
  if (typeof valor === "string") {
    const s = fase.sesiones && fase.sesiones[valor];
    return s ? { id: valor, ...s } : { id: valor, titulo: valor, bloques: [{ titulo: "Sesión", texto: "Detalle a confirmar." }] };
  }
  return valor; // sesión escrita en línea (ej. semanas de torneo)
}

function campoDe(fase, semanaFase, dia, plan, especial) {
  const dias = (especial && especial.diasCampo) || fase.diasCampo || [];
  if (!dias.includes(dia)) return null;
  const lista = (especial && especial.campoProgramado) || fase.campoProgramado || [];
  for (const c of lista) {
    const [d, h] = c.semanas;
    if (semanaFase >= d && semanaFase <= h) {
      const p = plan.campoProgramado[c.plan];
      const semanaPlan = semanaFase - d + (c.semanaPlanInicial || 1);
      return {
        planId: c.plan, nombre: p.nombre, sesionesPorSemana: p.sesionesPorSemana, semanaPlan,
        totalSemanas: p.opciones[0].semanas.length,
        nota: p.nota || null, opciones: p.opciones.map((o, i) => ({ n: i + 1, nombre: o.nombre, texto: o.semanas[semanaPlan - 1] || "a confirmar" })),
      };
    }
  }
  return { aConfirmar: true };
}

// Todo lo que corresponde a una fecha.
export function diaDelPlan(iso, plan) {
  const { fase, siguiente } = faseDe(iso, plan);
  const dia = diaSemana(iso);
  const base = { fecha: iso, dia, semanaPlan: semanaRelativa(iso, plan.config.inicioPlan), siguiente };
  if (!fase || fase.tipo === "descanso") {
    const inicio = plan.config.inicioPlan;
    return { ...base, tipo: "descanso", fase, faltan: Math.max(0, aDia(inicio) - aDia(iso)), inicioPlan: inicio };
  }
  const semanaFase = semanaRelativa(iso, fase.inicioIso);
  if (fase.tipo !== "entrenamiento") return { ...base, tipo: fase.tipo, fase, semanaFase };
  const especial = fase.semanasEspeciales && fase.semanasEspeciales[lunesDe(iso)];
  const semanaTipo = (especial && especial.dias) || fase.semanaTipo || {};
  const sesion = resolverSesion(semanaTipo[dia], fase);
  return {
    ...base, tipo: "entrenamiento", fase, semanaFase, especial: especial || null,
    sesion, campo: campoDe(fase, semanaFase, dia, plan, especial),
  };
}

export function semanaDelPlan(iso, plan) {
  const lun = lunesDe(iso);
  return Array.from({ length: 7 }, (_, i) => diaDelPlan(sumarDias(lun, i), plan));
}
