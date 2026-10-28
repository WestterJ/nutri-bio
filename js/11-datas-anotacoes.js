// 11-datas-anotacoes.js — Modal de anotações e Datas Importantes (checklist por concurso).
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // Modal de Anotações
        let activeModalId = null;
        function openModal(id) {
            activeModalId = id;
            const item = masterEditalData.find(i => i.id === id);
            const userItem = userProgress.find(u => u.id === id);
            document.getElementById('modal-title').innerText = `Anotações: ${item.topic}`;
            document.getElementById('modal-textarea').value = userItem && userItem.notes ? userItem.notes : '';
            document.getElementById('custom-modal').classList.remove('hidden');
            document.getElementById('custom-modal').classList.add('flex');
        }

        function closeModal() {
            document.getElementById('custom-modal').classList.remove('flex');
            document.getElementById('custom-modal').classList.add('hidden');
            activeModalId = null;
        }

        function saveModalNote() {
            if (activeModalId) {
                let userItem = userProgress.find(i => i.id === activeModalId);
                if (!userItem) {
                    const master = masterEditalData.find(m => m.id === activeModalId);
                    userItem = { ...master, hours: 0, questions: 0, reviews: 0, completed: false };
                    userProgress.push(userItem);
                }
                userItem.notes = document.getElementById('modal-textarea').value;
                saveData();
                try{renderRecentRotation();renderPriorityDisciplineProgress();}catch(err){console.warn(err);}
            }
            closeModal();
        }

        // ===== Datas importantes (checklist por concurso) =====
        function getImportantDates(){
            if(!contests[activeContest])contests[activeContest]={name:activeContest,board:'',date:''};
            const cfg=contests[activeContest];
            if(!Array.isArray(cfg.importantDates)){
                cfg.importantDates=[];
                try{localStorage.setItem('tce_contests',JSON.stringify(contests));}catch(err){}
            }
            return cfg.importantDates;
        }
        function saveImportantDates(){
            contests[activeContest]._updatedAt=new Date().toISOString();
            try{localStorage.setItem('tce_contests',JSON.stringify(contests));}catch(err){}
            saveData();
        }
        function dayDiffFromToday(iso){
            if(!iso)return null;const p=String(iso).split('-').map(Number);if(p.length<3||p.some(isNaN))return null;
            const t=new Date();return Math.round((Date.UTC(p[0],p[1]-1,p[2])-Date.UTC(t.getFullYear(),t.getMonth(),t.getDate()))/86400000);
        }
        function fmtBRDateISO(iso){const p=String(iso||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:'';}
        function daysChip(diff,done){
            if(done)return {text:'Concluída',cls:'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'};
            if(diff===null)return {text:'Sem data',cls:'bg-slate-100 text-slate-600'};
            if(diff<0)return {text:`há ${-diff} dia${diff===-1?'':'s'}`,cls:'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'};
            if(diff===0)return {text:'hoje',cls:'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'};
            if(diff===1)return {text:'amanhã',cls:'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'};
            if(diff<=7)return {text:`em ${diff} dias`,cls:'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'};
            return {text:`em ${diff} dias`,cls:'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'};
        }
        function dateRowHtml(i){
            const e=escapeHtml;const due=i.endDate||i.date;const chip=daysChip(dayDiffFromToday(due),i.done);
            return `<li class="date-row${i.done?' is-done':''}" data-id="${e(i.id)}">
                <input type="checkbox" class="date-check" ${i.done?'checked':''} aria-label="Marcar como concluída" data-df="done">
                <div class="min-w-0 flex-1">
                    <input class="tbl-field date-title text-sm font-semibold" data-df="title" maxlength="120" value="${e(i.title)}" aria-label="Título">
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <input type="date" class="tbl-field" style="width:auto" data-df="date" value="${e(i.date||'')}" aria-label="Data">
                        <span>até</span>
                        <input type="date" class="tbl-field" style="width:auto" data-df="endDate" value="${e(i.endDate||'')}" aria-label="Data final (opcional)">
                        <span class="rounded-full px-2 py-0.5 font-bold ${chip.cls}">${e(chip.text)}</span>
                    </div>
                </div>
                <button type="button" data-df-del="1" class="sess-act bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300" title="Excluir data" aria-label="Excluir data"><i class="fa-solid fa-trash-can"></i></button>
            </li>`;
        }
        function renderImportantDates(){
            const box=document.getElementById('dates-checklist');if(!box)return;
            const cfg=contests[activeContest]||{};const items=getImportantDates();
            const due=i=>i.endDate||i.date||'9999-12-31';
            const pending=items.filter(i=>!i.done).sort((a,b)=>String(due(a)).localeCompare(String(due(b))));
            const overdue=pending.filter(i=>(dayDiffFromToday(due(i))??0)<0);
            const upcoming=pending.filter(i=>(dayDiffFromToday(due(i))??0)>=0);
            const done=items.filter(i=>i.done).sort((a,b)=>String(due(b)).localeCompare(String(due(a))));
            const exam=document.getElementById('dates-exam');
            if(exam){
                const diff=dayDiffFromToday(cfg.date);
                exam.innerHTML=cfg.date?`<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300"><i class="fa-solid fa-flag-checkered mr-1"></i>Data da prova</p><p class="text-base font-bold">${escapeHtml(new Date(cfg.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}))}</p></div><div class="text-right"><p class="text-2xl font-extrabold text-blue-700 dark:text-blue-300">${diff===null?'—':(diff>=0?diff:0)}</p><p class="text-[11px] text-slate-500">${diff!==null&&diff>=0?(diff===1?'dia restante':'dias restantes'):'prova realizada'}</p></div></div>`:`<p class="text-xs text-slate-500"><i class="fa-solid fa-flag-checkered mr-1"></i>Defina a data da prova na aba Personalização para ver a contagem regressiva aqui.</p>`;
            }
            const sum=document.getElementById('dates-summary');
            if(sum){
                const next=upcoming[0];
                sum.textContent=items.length?`${done.length} de ${items.length} concluída${items.length===1?'':'s'}${overdue.length?` · ${overdue.length} atrasada${overdue.length===1?'':'s'}`:''}${next?` · próxima: ${next.title} (${daysChip(dayDiffFromToday(due(next)),false).text})`:''}`:'Nenhuma data cadastrada';
            }
            const section=(title,icon,color,list,extra='')=>list.length?`<div class="${extra}"><h3 class="mb-2 text-xs font-bold uppercase tracking-wide ${color}"><i class="fa-solid ${icon} mr-1"></i>${title} <span class="font-semibold opacity-70">(${list.length})</span></h3><ul class="space-y-2">${list.map(dateRowHtml).join('')}</ul></div>`:'';
            let html=section('Atrasadas','fa-triangle-exclamation','text-red-700 dark:text-red-300',overdue)+section('Próximas','fa-hourglass-half','text-blue-700 dark:text-blue-300',upcoming);
            if(!overdue.length&&!upcoming.length)html+=`<p class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-xs text-slate-500">${items.length?'Tudo concluído por aqui. 🎉':'Cadastre acima as datas importantes do concurso: inscrição, boleto, provas, resultado…'}</p>`;
            if(done.length)html+=`<details class="mt-2"><summary class="cursor-pointer text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><i class="fa-solid fa-circle-check mr-1"></i>Concluídas (${done.length})</summary><ul class="mt-2 space-y-2">${done.map(dateRowHtml).join('')}</ul></details>`;
            box.innerHTML=html;
            if(!box.dataset.bound){
                box.dataset.bound='1';
                box.addEventListener('change',ev=>{
                    const el=ev.target.closest('[data-df]');if(!el)return;
                    const li=el.closest('li');const item=getImportantDates().find(x=>x.id===li.dataset.id);if(!item)return;
                    const f=el.dataset.df;
                    if(f==='done')item.done=el.checked;
                    else if(f==='title'){item.title=(el.value||'').trim()||'Sem título';}
                    else if(f==='date'){if(!el.value){el.value=item.date||'';return;}item.date=el.value;if(item.endDate&&item.endDate<item.date)item.endDate='';}
                    else if(f==='endDate'){item.endDate=el.value&&el.value>=item.date?el.value:'';}
                    saveImportantDates();
                    if(f!=='title')renderImportantDates();
                });
                box.addEventListener('click',ev=>{
                    const btn=ev.target.closest('[data-df-del]');if(!btn)return;
                    const li=btn.closest('li');const item=getImportantDates().find(x=>x.id===li.dataset.id);if(!item)return;
                    showCustomDialog('Excluir data?',`“${item.title}” será removida da lista.`,'fa-solid fa-triangle-exclamation',()=>{
                        contests[activeContest].importantDates=getImportantDates().filter(x=>x.id!==item.id);
                        saveImportantDates();renderImportantDates();
                    });
                });
            }
        }
        function addImportantDate(ev){
            ev.preventDefault();
            const title=(document.getElementById('date-new-title').value||'').trim();
            const date=document.getElementById('date-new-date').value;
            let end=document.getElementById('date-new-end').value;
            if(!title||!date)return;
            if(end&&end<date)end='';
            getImportantDates().push({id:crypto.randomUUID(),title,date,endDate:end,done:false});
            saveImportantDates();
            ev.target.reset();
            renderImportantDates();
        }
        // Mantido com este nome porque outras telas chamam renderDashboard() ao salvar dados.
        function renderDashboard(){renderImportantDates();}

