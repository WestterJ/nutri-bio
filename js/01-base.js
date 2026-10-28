// 01-base.js — Base: dados iniciais, toasts e caixas de diálogo, contagem regressiva, modo escuro, abas, configurações de prioridade.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // Banco de Dados Oficial Completo extraído do Edital e da Planilha ODS (Todas as disciplinas, tópicos e subtópicos)
        // Nenhum conteúdo de concurso vem embutido: cada usuário começa vazio e cadastra ou importa o seu edital.
        const DEFAULT_CONTEST_ID = 'meu-concurso';
        const DEFAULT_CONTEST_NAME = 'Meu concurso';
        let masterEditalData = [];
        let defaultInitialSessions = [];

        // Guarde o modelo inicial antes de carregar os dados locais do concurso ativo.
        window._defaultMasterEdital = JSON.parse(JSON.stringify(masterEditalData));
        let userProgress = null;
        try { userProgress = JSON.parse(localStorage.getItem('tce_go_pro_data')); } catch(e) {}
        if (!Array.isArray(userProgress)) userProgress = JSON.parse(JSON.stringify(masterEditalData));
        try { masterEditalData = JSON.parse(localStorage.getItem('tce_master_edital')) || masterEditalData; } catch(e) {}
        let studySessions = JSON.parse(localStorage.getItem('tce_go_pro_sessions')) || defaultInitialSessions;

        function preencherVersao() { document.querySelectorAll('[data-app-version]').forEach(function (e) { e.textContent = window.APP_VERSION || ''; }); if (window.APP_VERSION) document.title = 'Planejador de Estudos | Concursos — ' + window.APP_VERSION; }
        preencherVersao(); document.addEventListener('DOMContentLoaded', preencherVersao);

        // V10.1: avisos informativos viram toasts (não bloqueiam a tela); só confirmações e textos longos usam caixa.
        function nivelToast(title, icon) {
            const t = String(title || '');
            if (/circle-check/.test(icon || '')) return 'ok';
            if (/erro|falha|n[ãa]o foi poss|a api respondeu/i.test(t)) return 'erro';
            if (/inv[áa]lid|indispon|incomplet|necess|obrigat|selecione\b|informe|confira|ausente|n[ãa]o encontrad|j[áa] (existe|cadastrad)|vazia|entre primeiro|sem t[óo]picos|oauth/i.test(t)) return 'aviso';
            if (/salv|conclu|adicionad|atualizad|removid|aplicad|importad|restaurad|gerado|recalculad|selecionad|guardad|validad|sucesso/i.test(t)) return 'ok';
            return 'info';
        }
        const TOAST_ESTILO = {
            ok: ['bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100', 'fa-solid fa-circle-check text-emerald-600', 3500],
            info: ['bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100', 'fa-solid fa-circle-info text-blue-600', 6000],
            aviso: ['bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100', 'fa-solid fa-triangle-exclamation text-amber-600', 7500],
            erro: ['bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100', 'fa-solid fa-circle-xmark text-red-600', 10000]
        };
        function showToast(title, message, nivel) {
            let pilha = document.getElementById('toast-stack');
            if (!pilha) {
                pilha = document.createElement('div'); pilha.id = 'toast-stack'; pilha.setAttribute('aria-live', 'polite');
                pilha.className = 'fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 pointer-events-none';
                pilha.style.bottom = 'max(1rem, env(safe-area-inset-bottom))';
                document.body.appendChild(pilha);
            }
            const chave = title + '|' + message;
            const igual = [...pilha.children].find(e => e.dataset.k === chave);
            if (igual) igual.remove();
            while (pilha.children.length >= 3) pilha.firstChild.remove();
            const [cls, icone, ms] = TOAST_ESTILO[nivel] || TOAST_ESTILO.info;
            const el = document.createElement('div');
            el.dataset.k = chave; el.setAttribute('role', nivel === 'erro' || nivel === 'aviso' ? 'alert' : 'status');
            el.className = 'pointer-events-auto w-full max-w-md rounded-xl border shadow-lg px-3 py-2.5 text-xs flex gap-2.5 items-start cursor-pointer transition duration-200 opacity-0 translate-y-2 ' + cls;
            const i = document.createElement('i'); i.className = icone + ' mt-0.5 text-sm';
            const corpo = document.createElement('div'); corpo.className = 'flex-1 min-w-0';
            const t = document.createElement('div'); t.className = 'font-bold'; t.textContent = title;
            const m = document.createElement('div'); m.className = 'mt-0.5 opacity-90 break-words'; m.textContent = message || '';
            corpo.append(t); if (message) corpo.append(m);
            const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar aviso'); x.className = 'opacity-60 hover:opacity-100 px-1'; x.textContent = '×';
            el.append(i, corpo, x); pilha.appendChild(el);
            requestAnimationFrame(() => el.classList.remove('opacity-0', 'translate-y-2'));
            const fechar = () => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 200); };
            el.addEventListener('click', fechar);
            setTimeout(fechar, ms + Math.min(String(message || '').length * 20, 4000));
        }
        // Caixa própria (substitui confirm/prompt nativos): resolve true/texto ao confirmar e null ao cancelar.
        function abrirCaixa(title, message, opt) {
            opt = opt || {};
            return new Promise(resolve => {
                const ov = document.createElement('div');
                ov.className = 'fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4';
                ov.innerHTML = '<form role="dialog" aria-modal="true" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3 border border-slate-200 dark:border-slate-700"><h3 class="font-bold text-sm"></h3><p class="msg text-xs text-slate-600 dark:text-slate-300"></p><input type="text" maxlength="120" class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"><div class="flex justify-end gap-2 pt-1"><button type="button" class="cancelar px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-semibold">Cancelar</button><button type="submit" class="ok px-4 py-2 text-white rounded-xl text-xs font-semibold"></button></div></form>';
                ov.querySelector('h3').textContent = title; ov.querySelector('.msg').textContent = message || '';
                const inp = ov.querySelector('input'); if (opt.input) inp.placeholder = opt.placeholder || ''; else inp.remove();
                const ok = ov.querySelector('.ok'); ok.textContent = opt.ok || 'Confirmar'; ok.className += opt.perigo ? ' bg-red-600 hover:bg-red-700' : ' bg-blue-600 hover:bg-blue-700';
                const fim = v => { ov.remove(); resolve(v); };
                ov.querySelector('form').onsubmit = e => { e.preventDefault(); fim(opt.input ? (inp.value.trim() || null) : true); };
                ov.querySelector('.cancelar').onclick = () => fim(null);
                ov.addEventListener('keydown', e => { if (e.key === 'Escape') fim(null); });
                ov.addEventListener('mousedown', e => { if (e.target === ov) fim(null); });
                document.body.appendChild(ov); (opt.input ? inp : ok).focus();
            });
        }
        const confirmAsync = (msg, title, okLabel) => abrirCaixa(title || 'Confirmar', msg, { ok: okLabel || 'Confirmar', perigo: true }).then(v => v !== null);
        const promptAsync = (title, label) => abrirCaixa(title, label, { input: true, ok: 'Criar' });

        function showCustomDialog(title, message, iconClass = 'fa-solid fa-circle-info', callback = null) {
            if (callback || String(message || '').length > 320) return showModalDialog(title, message, iconClass, callback);
            showToast(title, message, nivelToast(title, iconClass));
        }
        function showModalDialog(title, message, iconClass = 'fa-solid fa-circle-info', callback = null) {
            document.getElementById('dialog-title').innerText = title;
            document.getElementById('dialog-message').innerText = message;
            document.getElementById('dialog-icon').innerHTML = `<i class="${iconClass}"></i>`;
            
            const buttonsDiv = document.getElementById('dialog-buttons');
            if (callback) {
                buttonsDiv.innerHTML = `
                    <button onclick="closeDialog()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition">Cancelar</button>
                    <button id="dialog-confirm-btn" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition">Confirmar</button>
                `;
                document.getElementById('dialog-confirm-btn').onclick = () => {
                    closeDialog();
                    callback();
                };
            } else {
                buttonsDiv.innerHTML = `
                    <button onclick="closeDialog()" class="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition">OK</button>
                `;
            }
            document.getElementById('custom-dialog').classList.remove('hidden');
            document.getElementById('custom-dialog').classList.add('flex');
        }

        function closeDialog() {
            document.getElementById('custom-dialog').classList.remove('flex');
            document.getElementById('custom-dialog').classList.add('hidden');
        }

        // Countdown para 17 de Janeiro de 2027
        function updateCountdown() {
            try{refreshContestSubtitle();}catch(e){}
            const badge=document.getElementById('countdown-badge');
            const dateStr=badge?(badge.dataset.examDate||''):'';
            const examDate=new Date(`${dateStr}T08:00:00`);
            const now=new Date();const diff=examDate-now;
            if(!dateStr || Number.isNaN(examDate.getTime())){document.getElementById('countdown-text').innerText='Data da prova não definida';return}
            if(diff>0){const days=Math.floor(diff/(1000*60*60*24));document.getElementById('countdown-text').innerText=`${days} dias para a prova (${examDate.toLocaleDateString('pt-BR')})`;}
            else document.getElementById('countdown-text').innerText='Data da prova já passou';
        }
        setInterval(updateCountdown, 1000);
        updateCountdown();

        // Dark Mode
        function toggleDarkMode() {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('tce_go_dark', isDark);
            document.getElementById('theme-icon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        if (localStorage.getItem('tce_go_dark') === 'true') {
            document.documentElement.classList.add('dark');
            document.getElementById('theme-icon').className = 'fa-solid fa-sun';
        }

        // Alternância de Abas
        function switchTab(tabId, defer) {
            document.body.classList.remove('sidebar-open');
            document.body.dataset.tab = tabId;
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('bg-blue-600', 'text-white', 'shadow-sm', 'active-tab');
                el.removeAttribute('aria-current');
                el.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
            });

            const activeContent = document.getElementById(`content-${tabId}`);
            if (activeContent) activeContent.classList.remove('hidden');
            const activeBtn = document.getElementById(`tab-${tabId}`);
            if (activeBtn) {
                activeBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
                activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow-sm', 'active-tab');
                activeBtn.setAttribute('aria-current', 'page');
            }

            const token = window._tabToken = (window._tabToken || 0) + 1;
            const renderTab = () => {
                if (window._tabToken !== token) return;
                if (tabId === 'dashboard') renderDashboard();
                if (tabId === 'registro') initRegistrationForm();
                if (tabId === 'edital') initEditalFilters();
                if (tabId === 'cronograma') initCronogramaFilters();
                if (tabId === 'personalizacao') renderCustomization();
            };
            if (defer) requestAnimationFrame(() => setTimeout(renderTab, 0)); else renderTab();
            
        }

        const DEFAULT_PRIORITY_SETTINGS = {
            Vermelha: { label: 'Alta', color: '#dc2626', weight: 3 },
            Amarela: { label: 'Média', color: '#d97706', weight: 2 },
            Verde: { label: 'Baixa / revisão', color: '#059669', weight: 1 }
        };
        const DEFAULT_DISCIPLINE_GROUPS = ['Língua Portuguesa','Matemática e Raciocínio Lógico','Noções de Direito Constitucional','Noções de Administração Pública','Administração Estratégica'];
        function getPrioritySettings() {
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('tce_'+activeContest+'_priority_settings') || '{}') || {}; } catch(e) {}
            const merged = {};
            Object.keys(DEFAULT_PRIORITY_SETTINGS).forEach(k => merged[k] = {...DEFAULT_PRIORITY_SETTINGS[k], ...(saved[k] || {})});
            return merged;
        }
        function getDisciplineSettings() {
            try { return JSON.parse(localStorage.getItem('tce_'+activeContest+'_discipline_settings') || '{}') || {}; } catch(e) { return {}; }
        }
        function getPriorityLabel(p) { return getPrioritySettings()[p]?.label || p || 'Média'; }
        function applyPriorityColors() {
            const cfg=getPrioritySettings();
            document.documentElement.style.setProperty('--prio-red', cfg.Vermelha.color || '#dc2626');
            document.documentElement.style.setProperty('--prio-yellow', cfg.Amarela.color || '#d97706');
            document.documentElement.style.setProperty('--prio-green', cfg.Verde.color || '#059669');
        }
        function hexToSoft(hex) {
            const h=String(hex||'#64748b').replace('#',''); if(!/^[0-9a-f]{6}$/i.test(h)) return '#f1f5f9';
            const vals=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
            return '#'+vals.map(v=>Math.round(v+(255-v)*0.9).toString(16).padStart(2,'0')).join('');
        }
        function getPriorityWeight(p) {
            const cfg=getPrioritySettings();
            return -(Number(cfg[p]?.weight) || 1); // Peso maior aparece antes no cronograma.
        }

        function initCronogramaFilters() {
            // A tabela detalhada foi removida da tela; mantém apenas a atualização dos painéis e KPIs.
            renderCronograma();
            renderRecentRotation();
        }

