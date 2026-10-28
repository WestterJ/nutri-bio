// 03-utilitarios.js — Horas (HH:mm), exclusões duráveis (tombstones), diagnóstico de tópicos e menu lateral retrátil.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // ===== V10.4: horas em dias/horas/minutos, exclusões duráveis e utilidades =====
        // 0.5 h -> 00:30 · 26.75 h -> 26:45 (as horas passam de 24 sem virar "dias")
        function fmtHM(hours){const t=Math.max(0,Math.round((Number(hours)||0)*60));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
        function fmtHoras(hours){const n=Number(hours)||0;return n.toFixed(1)+'h ('+fmtHM(n)+')';}

        // A mesclagem entre dispositivos faz união por id. Sem registrar o que foi excluído, tópicos e sessões removidos
        // voltariam a cada sincronização (foi assim que os tópicos do edital padrão continuaram aparecendo no Registro).
        function getTombstones(id){
            const t={items:[],sessions:[]};
            try{const raw=JSON.parse(localStorage.getItem('tce_'+id+'_deleted')||'null');if(raw&&typeof raw==='object'){t.items=Array.isArray(raw.items)?raw.items.map(String):[];t.sessions=Array.isArray(raw.sessions)?raw.sessions.map(String):[];}}catch(e){}
            return t;
        }
        function setTombstones(id,t){
            try{localStorage.setItem('tce_'+id+'_deleted',JSON.stringify({items:[...new Set((t&&t.items||[]).map(String))].slice(-5000),sessions:[...new Set((t&&t.sessions||[]).map(String))].slice(-5000)}));}catch(e){}
        }
        function addTombstones(kind,ids,id){
            id=id||activeContest;const t=getTombstones(id);
            t[kind]=[...t[kind],...(ids||[]).filter(x=>x!==undefined&&x!==null&&x!=='').map(String)];
            setTombstones(id,t);
        }
        function unionTombstones(a,b){
            const x=a||{},y=b||{};
            return {items:[...new Set([...(x.items||[]),...(y.items||[])].map(String))],sessions:[...new Set([...(x.sessions||[]),...(y.sessions||[])].map(String))]};
        }

        // Tópicos do edital padrão embutido no aplicativo (só são "legados" quando o concurso já tem edital próprio).
        function getLegacyIdSet(){
            const isDef=x=>/^tce_\d+$/.test(String(x.id))||/^pending_discipline_/.test(String(x.id));
            return masterEditalData.some(x=>!isDef(x))?new Set(masterEditalData.filter(isDef).map(x=>String(x.id))):new Set();
        }
        function diagnoseTopics(){
            const isDefId=x=>/^tce_\d+$/.test(String(x.id))||/^pending_discipline_/.test(String(x.id));
            const isSampleSession=x=>/^s_\d+$/.test(String(x.id));
            const sample=masterEditalData.filter(isDefId);
            const custom=masterEditalData.filter(x=>!isDefId(x));
            const customDisc=new Set(custom.map(x=>x.discipline));
            const sampleSessionIds=studySessions.filter(isSampleSession).map(x=>String(x.id));
            const realSessions=studySessions.filter(x=>!isSampleSession(x));
            const idSet=new Set(masterEditalData.map(x=>String(x.id)));
            const keyOf=x=>[x.discipline,x.topic,x.subtopic].map(v=>String(v||'')).join('\u0001');
            const byKey=new Map();masterEditalData.forEach(x=>{const k=keyOf(x);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(String(x.id));});
            const usedIds=new Set(),orphans=[];
            realSessions.forEach(x=>{
                if(x.itemId&&idSet.has(String(x.itemId))){usedIds.add(String(x.itemId));return;}
                const hit=byKey.get(keyOf(x));
                if(hit){hit.forEach(i=>usedIds.add(i));return;}
                orphans.push(x);
            });
            const noteIds=new Set(userProgress.filter(u=>String(u.notes||'').trim()).map(u=>String(u.id)));
            const groups=new Map();
            sample.forEach(x=>{
                if(!groups.has(x.discipline))groups.set(x.discipline,{discipline:x.discipline,total:0,kept:0,removable:[],duplicated:customDisc.has(x.discipline)});
                const g=groups.get(x.discipline);g.total++;
                if(usedIds.has(String(x.id))||noteIds.has(String(x.id)))g.kept++;else g.removable.push(x.id);
            });
            const list=[...groups.values()];
            return {total:masterEditalData.length,customCount:custom.length,legacyCount:sample.length,groups:list,removable:list.flatMap(g=>g.removable),orphans,sampleSessionIds};
        }
        function renderTopicDiagnostics(){
            const box=document.getElementById('topic-diagnostics-result');if(!box)return;
            const d=diagnoseTopics(),e=escapeHtml;
            let html=`<p class="text-xs text-slate-600 dark:text-slate-300">Tópicos no edital: <strong>${d.total}</strong> · do seu edital: <strong>${d.customCount}</strong> · conteúdo de exemplo de versões anteriores: <strong>${d.legacyCount}</strong> (+ <strong>${d.sampleSessionIds.length}</strong> sessão(ões) de exemplo) · sessões sem tópico correspondente: <strong>${d.orphans.length}</strong>.</p>`;
            if(d.groups.length){
                html+=`<div class="overflow-x-auto mt-3"><table class="w-full text-xs"><thead><tr class="text-left text-slate-500"><th class="py-1 pr-3">Disciplina do conteúdo de exemplo</th><th class="py-1 pr-3">Tópicos</th><th class="py-1 pr-3">Com estudo ou anotação seus</th><th class="py-1">Também existe no seu edital?</th></tr></thead><tbody>`+
                    d.groups.map(g=>`<tr class="border-t border-slate-200 dark:border-slate-700"><td class="py-1.5 pr-3 font-semibold">${e(g.discipline)}</td><td class="py-1.5 pr-3">${g.total}</td><td class="py-1.5 pr-3">${g.kept}</td><td class="py-1.5">${g.duplicated?'Sim (duplicada)':'Não'}</td></tr>`).join('')+`</tbody></table></div>`;
            }
            if(d.removable.length||d.sampleSessionIds.length)html+=`<div class="mt-3 flex flex-wrap items-center gap-2"><button type="button" onclick="cleanupLegacyTopics()" class="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"><i class="fa-solid fa-broom mr-1"></i>Remover conteúdo de exemplo (${d.removable.length} tópico(s) e ${d.sampleSessionIds.length} sessão(ões))</button><span class="text-[11px] text-slate-500">Os seus estudos e anotações não são removidos.</span></div>`;
            if(d.legacyCount&&!d.removable.length&&!d.sampleSessionIds.length)html+=`<p class="mt-3 text-xs text-amber-700 dark:text-amber-300">Os tópicos de exemplo que restaram têm estudos ou anotações seus. No Registro de Estudos, troque o tópico das linhas destacadas pelo tópico correto do seu edital e verifique de novo.</p>`;
            if(d.orphans.length)html+=`<p class="mt-3 text-xs text-amber-700 dark:text-amber-300">Há ${d.orphans.length} sessão(ões) apontando para tópicos que já não existem. No Registro de Estudos elas aparecem destacadas: escolha o tópico correto na coluna “Disciplina / Tópico”.</p>`;
            if(!d.legacyCount&&!d.orphans.length&&!d.sampleSessionIds.length)html+=`<p class="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><i class="fa-solid fa-circle-check mr-1"></i>Tudo certo: o Cronograma, o Edital e o Registro usam os mesmos tópicos e não há conteúdo de exemplo.</p>`;
            box.innerHTML=html;
        }
        function cleanupLegacyTopics(){
            const d=diagnoseTopics();if(!d.removable.length&&!d.sampleSessionIds.length)return;
            showCustomDialog('Remover conteúdo de exemplo?',`Serão removidos ${d.removable.length} tópico(s) e ${d.sampleSessionIds.length} sessão(ões) que vieram como exemplo nas versões anteriores do aplicativo e não são estudos seus. Tópicos com estudo registrado por você ou com anotação continuam. Recomenda-se gerar um backup antes.`,'fa-solid fa-triangle-exclamation',()=>{
                const ids=new Set(d.removable.map(String)),sids=new Set(d.sampleSessionIds);
                addTombstones('items',[...ids]);addTombstones('sessions',[...sids]);
                masterEditalData=masterEditalData.filter(x=>!ids.has(String(x.id)));
                userProgress=userProgress.filter(x=>!ids.has(String(x.id)));
                studySessions=studySessions.filter(x=>!sids.has(String(x.id)));
                try{localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));}catch(err){}
                saveData();
                try{initCronogramaFilters();initEditalFilters();initRegistrationForm();renderSessionsList();renderRecentRotation();renderPriorityDisciplineProgress();renderCustomization();renderDashboard();}catch(err){console.warn(err);}
                renderTopicDiagnostics();
                showCustomDialog('Conteúdo de exemplo removido',`${ids.size} tópico(s) e ${sids.size} sessão(ões) de exemplo foram removidos.`,'fa-solid fa-circle-check');
            });
        }

        // Progresso do tópico a partir de uma sessão (sign=+1 soma, -1 desconta).
        function adjustProgressForSession(session,sign){
            const item=masterEditalData.find(x=>sessionMatchesTopic(session,x));if(!item)return null;
            let p=userProgress.find(u=>u.id===item.id);
            if(!p){if(sign<0)return item;p={...item,hours:0,questions:0,reviews:0,completed:false};userProgress.push(p);}
            p.hours=Math.max(0,(Number(p.hours)||0)+sign*(Number(session.minutes)||0)/60);
            p.questions=Math.max(0,(Number(p.questions)||0)+sign*(Number(session.questions)||0));
            if(isRevisionSession(session))p.reviews=Math.max(0,(Number(p.reviews)||0)+sign);
            if(sign>0&&session.type2==='Estudo Teórico'&&p.hours>=0.5)p.completed=true;
            return item;
        }

        // ===== Menu lateral retrátil (V10.5) =====
        function setHeaderHeightVar(){const h=document.querySelector('body>header');if(h&&h.offsetHeight)document.documentElement.style.setProperty('--header-h',h.offsetHeight+'px');}
        function syncSidebarToggle(){
            const collapsed=document.body.classList.contains('sidebar-collapsed');
            const b=document.getElementById('sidebar-toggle');if(!b)return;
            b.setAttribute('aria-expanded',String(!collapsed));
            const label=collapsed?'Expandir menu':'Recolher menu';b.title=label;
            const l=b.querySelector('.nav-label');if(l)l.textContent=label;
        }
        function toggleSidebar(){
            const collapsed=document.body.classList.toggle('sidebar-collapsed');
            try{localStorage.setItem('tce_ui_sidebar',collapsed?'collapsed':'open');}catch(e){}
            syncSidebarToggle();
        }
        function openSidebarMobile(){document.body.classList.add('sidebar-open');}
        function closeSidebarMobile(){document.body.classList.remove('sidebar-open');}
        function launchStudyFromSidebar(){switchTab('registro');window.scrollTo({top:0,behavior:'smooth'});}
        function initSidebar(){
            document.body.dataset.tab=document.body.dataset.tab||'cronograma';
            setHeaderHeightVar();syncSidebarToggle();
            window.addEventListener('resize',setHeaderHeightVar);
            const header=document.querySelector('body>header');
            if(header&&window.ResizeObserver)new ResizeObserver(setHeaderHeightVar).observe(header);
            document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebarMobile();});
        }
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initSidebar); else initSidebar();

