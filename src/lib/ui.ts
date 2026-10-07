// Small UI helpers shared by every page.

let toastTimer: number | undefined;

export function toast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2200);
}

export function openSheet(html: string) {
  const body = document.getElementById('sheetBody');
  const sheet = document.getElementById('sheet');
  const scrim = document.getElementById('sheetScrim');
  if (!body || !sheet || !scrim) return;
  body.innerHTML = html;
  sheet.classList.add('open');
  scrim.classList.add('open');
}

export function closeSheet() {
  document.getElementById('sheet')?.classList.remove('open');
  document.getElementById('sheetScrim')?.classList.remove('open');
}
