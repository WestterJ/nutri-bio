// 01-utils.js — Utilitários (datas, números, escape), aviso (toast), impressão de gráficos e modal de confirmação
"use strict";

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] || c));
  const fmtNum = n => (n === null || n === undefined || isNaN(n)) ? '-' : Number(n).toLocaleString('pt-BR', {maximumFractionDigits: 1});
  
  const pad = n => String(n).padStart(2, '0');
  const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const agoraLocalInput = () => { const d = new Date(); return `${hojeLocal()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDataBr = dataStr => {
    if (!dataStr) return '-';
    const partes = dataStr.split('T')[0].split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataStr;
  };
  const fmtDataHoraBr = dataHoraStr => {
    if (!dataHoraStr) return '-';
    const partes = dataHoraStr.split('T');
    const dataPartes = partes[0].split('-');
    if (dataPartes.length === 3) {
      const horaPartes = partes[1] ? ` ${partes[1]}` : '';
      return `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}${horaPartes}`;
    }
    return dataHoraStr;
  };

  // O aviso fica dentro do formulário de registro quando ele está aberto, evitando disputa de z-index com o dialog.
  const toastElement = document.getElementById('toast');
  const toastSlot = document.getElementById('toast-inline-slot');
  const modalRegistro = document.getElementById('modal-registro');
  const toastHome = document.createComment('local original do toast');
  if (toastElement && toastElement.parentNode) toastElement.parentNode.insertBefore(toastHome, toastElement);

  function posicionarToast() {
    const dentroRegistro = modalRegistro && modalRegistro.open && toastSlot;
    if (dentroRegistro) {
      toastSlot.classList.remove('hidden');
      toastSlot.appendChild(toastElement);
      toastElement.style.setProperty('position', 'relative', 'important');
      toastElement.style.setProperty('z-index', '1', 'important');
      toastElement.style.setProperty('top', 'auto', 'important');
      toastElement.style.setProperty('left', 'auto', 'important');
      toastElement.style.setProperty('transform', 'none', 'important');
      toastElement.className = 'w-full bg-slate-900 text-white px-4 py-3 rounded-xl shadow-md transition duration-300 text-sm pointer-events-auto';
    } else {
      toastSlot && toastSlot.classList.add('hidden');
      if (toastHome.parentNode) toastHome.parentNode.insertBefore(toastElement, toastHome.nextSibling);
      toastElement.style.setProperty('position', 'fixed', 'important');
      toastElement.style.setProperty('z-index', '2147483647', 'important');
      toastElement.style.setProperty('top', 'max(1rem, env(safe-area-inset-top))', 'important');
      toastElement.style.setProperty('left', '50%', 'important');
      toastElement.style.setProperty('transform', 'translateX(-50%)', 'important');
      toastElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl opacity-0 pointer-events-none transition duration-300 text-sm';
    }
  }

  function showToast(msg, isSync = false) {
    const t = $('#toast');
    const message = $('#toast-message');
    const close = $('#toast-close');
    message.textContent = isSync ? `🔄 Sincronizando: ${String(msg)}` : String(msg);
    posicionarToast();
    t.classList.remove('opacity-0', 'pointer-events-none');
    t.classList.add('opacity-100', 'pointer-events-auto');
    t.classList.toggle('bg-blue-700', !!isSync);
    t.classList.toggle('border', !!isSync);
    t.classList.toggle('border-blue-300', !!isSync);
    close.style.display = 'inline-block';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      t.classList.remove('opacity-100');
      t.classList.add('opacity-0', 'pointer-events-none');
      t.classList.remove('pointer-events-auto');
      setTimeout(() => {
        if (modalRegistro && !modalRegistro.open && toastElement.parentNode !== document.body && toastHome.parentNode) {
          toastHome.parentNode.insertBefore(toastElement, toastHome.nextSibling);
          toastSlot && toastSlot.classList.add('hidden');
        }
      }, 320);
    }, 6500);
  }

  if (modalRegistro) {
    modalRegistro.addEventListener('close', () => {
      if (toastElement.parentNode !== document.body && toastHome.parentNode) toastHome.parentNode.insertBefore(toastElement, toastHome.nextSibling);
      toastSlot && toastSlot.classList.add('hidden');
    });
  }

  $('#toast-close').addEventListener('click', () => {
    const t = $('#toast');
    clearTimeout(showToast._timer);
    t.classList.remove('opacity-100');
    t.classList.add('opacity-0');
    t.classList.remove('pointer-events-auto');
    t.classList.add('pointer-events-none');
  });

  window.addEventListener('beforeprint', () => {
    const charts = ['chart-peso', 'chart-calorias'];
    charts.forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) {
        const img = document.createElement('img'); img.src = canvas.toDataURL('image/png');
        img.className = 'print-chart w-full max-h-48 object-contain mt-2 mx-auto'; img.id = id + '-print-img';
        canvas.style.display = 'none'; canvas.parentNode.appendChild(img);
      }
    });
    [['rel-chart-peso-container','rel-chart-peso-container-canvas-print'],['rel-chart-calorias-container','rel-chart-calorias-container-canvas-print']].forEach(([targetId,sourceId])=>{
      const target=document.getElementById(targetId), source=document.querySelector('#relatorio-preview-box #'+targetId+' canvas');
      if(target && source && !target.querySelector('img.rel-img-fixa')){const img=document.createElement('img');img.src=source.toDataURL('image/png');img.className='print-chart w-full max-h-48 object-contain mt-2 mx-auto';img.id=sourceId+'-print-img';target.appendChild(img);}
    });
  });

  window.addEventListener('afterprint', () => {
    const charts = ['chart-peso', 'chart-calorias', 'rel-chart-peso-container-canvas-print', 'rel-chart-calorias-container-canvas-print'];
    charts.forEach(id => {
      const canvas = document.getElementById(id);
      const img = document.getElementById(id + '-print-img');
      if (canvas) canvas.style.display = '';
      if (img) img.remove();
    });
    document.querySelectorAll('.print-chart').forEach(img => img.remove());
    document.querySelectorAll('#rel-chart-peso-container-canvas-print, #rel-chart-calorias-container-canvas-print').forEach(c => c.style.display = '');
  });

  let pendingConfirmAction = null;
  window.customConfirm = function(title, msg, onConfirm, btnText = 'Confirmar', btnClass = 'bg-red-600 hover:bg-red-700 text-white') {
    $('#modal-confirm-title').textContent = title;
    $('#modal-confirm-msg').textContent = msg;
    const btn = $('#modal-confirm-ok');
    btn.textContent = btnText;
    btn.className = `px-4 py-2 rounded-lg text-sm font-bold shadow transition ${btnClass}`;
    pendingConfirmAction = onConfirm;
    $('#modal-confirm').showModal();
  };
  $('#modal-confirm-cancel').onclick = () => $('#modal-confirm').close();
  $('#modal-confirm-ok').onclick = () => {
    if (pendingConfirmAction) pendingConfirmAction();
    $('#modal-confirm').close();
  };
