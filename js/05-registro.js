// 05-registro.js — Aba Registro: formulário de estudo, tabela editável de sessões, edição e exclusão.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // Formulário de Registro de Estudos & Histórico com Filtros
        function initRegistrationForm() {
            const discSelect = document.getElementById('reg-discipline');
            const previousDiscipline=discSelect.value;
            discSelect.innerHTML = '';
            
            const disciplines = [...new Set(masterEditalData.map(i => i.discipline))];
            disciplines.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                discSelect.appendChild(opt);
            });
            if(disciplines.includes(previousDiscipline))discSelect.value=previousDiscipline;

            const histDisc = document.getElementById('hist-filter-disc');
            const oldDiscFilter=histDisc.value||'all';
            histDisc.innerHTML = '<option value="all">Todas Disciplinas</option>';
            disciplines.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                histDisc.appendChild(opt);
            });
            histDisc.value=disciplines.includes(oldDiscFilter)?oldDiscFilter:'all';
            const trackFilter=document.getElementById('hist-filter-track');
            if(trackFilter){const oldTrack=trackFilter.value||'all';trackFilter.innerHTML='<option value="all">Todas as trilhas</option>';getStudyTracks().forEach(track=>{const opt=document.createElement('option');opt.value=track;opt.textContent=track;trackFilter.appendChild(opt)});trackFilter.value=getStudyTracks().includes(oldTrack)?oldTrack:'all';}
            const dateField=document.getElementById('reg-date');if(dateField&&!dateField.value)dateField.value=localTodayISO();
            populateRegTrackSelect();
            updateRegTopics();
            renderSessionsList();
        }

        function updateRegTopics() {
            const disc = document.getElementById('reg-discipline').value;
            const topSelect = document.getElementById('reg-topic');
            const previousItem=topSelect.value;
            topSelect.innerHTML = '';

            const items = masterEditalData.filter(i => i.discipline === disc);
            items.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.id;
                opt.innerText = `${i.topic} ➔ ${i.subtopic}`;
                topSelect.appendChild(opt);
            });
            if(items.some(i=>i.id===previousItem))topSelect.value=previousItem;
        }

        function handleStudySessionSubmit(e) {
            e.preventDefault();
            const type1=document.getElementById('reg-type1').value;
            const type2=document.getElementById('reg-type2').value;
            const discipline=document.getElementById('reg-discipline').value;
            const itemId=document.getElementById('reg-topic').value;
            const dateValue=document.getElementById('reg-date').value||localTodayISO();
            const studyTrack=(document.getElementById('reg-track').value||'Curso regular').trim()||'Curso regular';
            const minutes=Math.max(1,parseFloat(document.getElementById('reg-minutes').value)||1);
            const questions=Math.max(0,parseInt(document.getElementById('reg-questions').value)||0);
            const item=masterEditalData.find(i=>i.id===itemId);
            if(!item)return showCustomDialog('Selecione um tópico','A disciplina selecionada não tem tópico disponível. Cadastre ou importe o conteúdo do edital primeiro.');
            const session={id:crypto.randomUUID(),itemId:item.id,date:dateToBR(dateValue),type1,type2,studyTrack,discipline:item.discipline,topic:item.topic,subtopic:item.subtopic,minutes,questions,isReview:type2==='Revisão'?1:0};
            studySessions.unshift(session);
            localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));
            let userItem=userProgress.find(u=>u.id===itemId);
            if(!userItem){userItem={...item,hours:0,questions:0,reviews:0,completed:false};userProgress.push(userItem);}
            userItem.hours=(Number(userItem.hours)||0)+(minutes/60);
            userItem.questions=(Number(userItem.questions)||0)+questions;
            if(isRevisionSession(session))userItem.reviews=(Number(userItem.reviews)||0)+1;
            if(type2==='Estudo Teórico' && userItem.hours>=0.5)userItem.completed=true;
            saveData();
            const _q=document.getElementById('reg-questions');if(_q)_q.value=0;
            initRegistrationForm();initCronogramaFilters();renderSessionsList();
            renderRecentRotation();renderDashboard();renderPriorityDisciplineProgress();
            showCustomDialog('Registro salvo',`${type2==='Revisão'?'Revisão':'Sessão de estudo'} registrada em ${session.date} na trilha “${studyTrack}”.`,'fa-solid fa-circle-check');
        }

        function getInlineSessionEditorMarkup(session) {
            const currentItem=masterEditalData.find(item=>sessionMatchesTopic(session,item))||masterEditalData.find(item=>item.discipline===session.discipline);
            const dateValue=dateToInputValue(session.date);
            const type1=session.type1||'Conhecimentos Específicos';
            const type2=session.type2||'Estudo Teórico';
            const type1Options=['Conhecimentos Específicos','Conhecimentos Gerais'].map(v=>`<option value="${escapeHtml(v)}" ${v===type1?'selected':''}>${escapeHtml(v)}</option>`).join('');
            const type2Options=['Estudo Teórico','Resolução de Questões','Revisão','Simulado'].map(v=>`<option value="${escapeHtml(v)}" ${v===type2?'selected':''}>${escapeHtml(v)}</option>`).join('');
            const disciplines=[...new Set(masterEditalData.map(x=>x.discipline))];
            const discOptions=disciplines.map(d=>`<option value="${escapeHtml(d)}" ${d===session.discipline?'selected':''}>${escapeHtml(d)}</option>`).join('');
            const topicOptions=masterEditalData.filter(x=>x.discipline===(currentItem?.discipline||session.discipline)).map(x=>`<option value="${escapeHtml(x.id)}" ${x.id===currentItem?.id?'selected':''}>${escapeHtml(x.topic)}${x.subtopic?' → '+escapeHtml(x.subtopic):''}</option>`).join('');
            return `<details class="session-inline-editor mt-2 w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-blue-50/50 dark:bg-slate-900/40 p-3"><summary class="cursor-pointer select-none text-xs font-bold text-blue-700 dark:text-blue-300"><i class="fa-solid fa-pen-to-square mr-1"></i>Editar campos nesta tela</summary>
              <form class="inline-session-edit grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3 items-end" data-session-id="${escapeHtml(session.id)}">
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Data<input name="date" type="date" required value="${escapeHtml(dateValue)}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs"></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Tipo 1<select name="type1" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs">${type1Options}</select></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Tipo 2<select name="type2" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs">${type2Options}</select></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Curso / trilha<input name="studyTrack" list="study-tracks-list" maxlength="100" value="${escapeHtml(session.studyTrack||'Trilha não informada')}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs"></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Disciplina<select name="discipline" class="inline-edit-discipline mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs">${discOptions}</select></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300 xl:col-span-2">Tópico / subtópico<select name="itemId" class="inline-edit-item mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs">${topicOptions}</select></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Minutos<input name="minutes" type="number" min="1" required value="${Math.max(1,Number(session.minutes)||1)}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs"></label>
                <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Questões<input name="questions" type="number" min="0" value="${Math.max(0,Number(session.questions)||0)}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-xs"></label>
                <div class="sm:col-span-2 xl:col-span-4 flex flex-wrap gap-2 justify-end"><button type="button" class="inline-edit-cancel rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-semibold">Cancelar</button><button type="submit" class="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800">Salvar alterações</button></div>
              </form></details>`;
        }
        function populateInlineTopicSelect(form,selectedId='') {
            const discipline=form.querySelector('[name="discipline"]')?.value||'';
            const topicSelect=form.querySelector('[name="itemId"]');if(!topicSelect)return;
            const prior=selectedId||topicSelect.value;
            topicSelect.innerHTML=masterEditalData.filter(x=>x.discipline===discipline).map(x=>`<option value="${escapeHtml(x.id)}" ${x.id===prior?'selected':''}>${escapeHtml(x.topic)}${x.subtopic?' → '+escapeHtml(x.subtopic):''}</option>`).join('');
            if(!topicSelect.value && topicSelect.options.length)topicSelect.selectedIndex=0;
        }
        function saveInlineSession(event) {
            event.preventDefault();
            const form=event.currentTarget;
            const id=form.dataset.sessionId;
            const session=studySessions.find(x=>x.id===id);if(!session)return;
            const oldSession={...session};
            const item=masterEditalData.find(x=>x.id===form.querySelector('[name="itemId"]').value);if(!item)return showCustomDialog('Tópico indisponível','Escolha um tópico válido para salvar a alteração.');
            const minutes=Math.max(1,Number(form.querySelector('[name="minutes"]').value)||1);
            const questions=Math.max(0,Number(form.querySelector('[name="questions"]').value)||0);
            const type2=form.querySelector('[name="type2"]').value;
            const studyTrack=(form.querySelector('[name="studyTrack"]').value||'').trim()||'Trilha não informada';
            const oldItem=masterEditalData.find(x=>sessionMatchesTopic(oldSession,x));
            const oldProgress=oldItem?userProgress.find(u=>u.id===oldItem.id):null;
            if(oldProgress){
                oldProgress.hours=Math.max(0,(Number(oldProgress.hours)||0)-(Number(oldSession.minutes)||0)/60);
                oldProgress.questions=Math.max(0,(Number(oldProgress.questions)||0)-(Number(oldSession.questions)||0));
                if(isRevisionSession(oldSession))oldProgress.reviews=Math.max(0,(Number(oldProgress.reviews)||0)-1);
            }
            Object.assign(session,{itemId:item.id,date:dateToBR(form.querySelector('[name="date"]').value),type1:form.querySelector('[name="type1"]').value,type2,studyTrack,discipline:item.discipline,topic:item.topic,subtopic:item.subtopic,minutes,questions,isReview:type2==='Revisão'?1:0});
            let newProgress=userProgress.find(u=>u.id===item.id);
            if(!newProgress){newProgress={...item,hours:0,questions:0,reviews:0,completed:false};userProgress.push(newProgress);}
            newProgress.hours=(Number(newProgress.hours)||0)+(minutes/60);
            newProgress.questions=(Number(newProgress.questions)||0)+questions;
            if(isRevisionSession(session))newProgress.reviews=(Number(newProgress.reviews)||0)+1;
            if(type2==='Estudo Teórico'&&newProgress.hours>=0.5)newProgress.completed=true;
            studySessions.sort((a,b)=>parseBRDate(b.date)-parseBRDate(a.date));
            saveData();initRegistrationForm();renderSessionsList();renderRecentRotation();renderDashboard();renderPriorityDisciplineProgress();
            showCustomDialog('Sessão atualizada','Data, trilha, tipo e métricas foram atualizados. Os quadros de estudos e revisões foram recalculados.');
        }

        // ===== Histórico de sessões em tabela editável (V10.4) =====
        const SESSION_TYPE1_OPTIONS=['Conhecimentos Específicos','Conhecimentos Gerais'];
        const SESSION_TYPE2_OPTIONS=['Estudo Teórico','Resolução de Questões','Revisão','Simulado'];
        function sessionTopicLabel(item){return item.topic+(item.subtopic?' → '+item.subtopic:'');}
        function renderSessionsList() {
            const container=document.getElementById('sessions-list');if(!container)return;
            const typeFilter=document.getElementById('hist-filter-type')?.value||'all';
            const discFilter=document.getElementById('hist-filter-disc')?.value||'all';
            const trackFilter=document.getElementById('hist-filter-track')?.value||'all';
            const _fk=[typeFilter,discFilter,trackFilter].join('|');
            if(window._sessionsFilterKey!==_fk){window._sessionsFilterKey=_fk;window._sessionsLimit=20;}
            const _limit=window._sessionsLimit||20;
            const filtered=getSessionsNewestFirst().filter(s=>(typeFilter==='all'||s.type2===typeFilter)&&(discFilter==='all'||s.discipline===discFilter)&&(trackFilter==='all'||String(s.studyTrack||'Trilha não informada')===trackFilter));
            const badge=document.getElementById('session-count-badge');
            const totalMin=filtered.reduce((a,s)=>a+(Number(s.minutes)||0),0);
            if(badge)badge.innerText=`${filtered.length} ${filtered.length===1?'registro':'registros'} · ${fmtHoras(totalMin/60)}`;
            if(!filtered.length){container.innerHTML='<p class="text-xs text-slate-400 text-center py-8">Nenhum registro encontrado. Os estudos lançados aparecem aqui.</p>';return;}
            const e=escapeHtml;
            const legacyIds=getLegacyIdSet();
            const disciplines=[...new Set(masterEditalData.map(i=>i.discipline))];
            const opts=(arr,cur)=>[...new Set([cur,...arr].filter(Boolean))].map(v=>`<option value="${e(v)}"${v===cur?' selected':''}>${e(v)}</option>`).join('');
            const discBase=disciplines.map(d=>`<option value="${e(d)}">${e(d)}</option>`).join('');
            const discOpts=cur=>{if(!cur)return discBase;const tag=`<option value="${e(cur)}">`;return discBase.includes(tag)?discBase.replace(tag,tag.replace('>',' selected>')):`<option value="${e(cur)}" selected>${e(cur)}</option>`+discBase;};
            const rows=filtered.slice(0,_limit).map(s=>{
                const item=masterEditalData.find(x=>sessionMatchesTopic(s,x))||null;
                const flagged=!item||legacyIds.has(String(item.id));
                const topicText=item?sessionTopicLabel(item)+(legacyIds.has(String(item.id))?' (edital padrão)':''):'⚠ '+(s.topic||'Tópico')+(s.subtopic?' → '+s.subtopic:'')+' (não está mais no edital)';
                const minutes=Math.max(0,Number(s.minutes)||0);
                return `<tr data-id="${e(s.id)}"${flagged?' class="sess-orphan" title="Este registro aponta para um tópico que não faz parte do seu edital atual. Escolha o tópico correto na coluna Disciplina / Tópico."':''}>
                    <td style="min-width:122px"><input type="date" class="tbl-field" data-f="date" value="${e(dateToInputValue(s.date))}" aria-label="Data"></td>
                    <td style="min-width:164px"><select class="tbl-field font-semibold" data-f="type2" aria-label="Atividade">${opts(SESSION_TYPE2_OPTIONS,s.type2||SESSION_TYPE2_OPTIONS[0])}</select><select class="tbl-field tbl-sub" data-f="type1" aria-label="Conteúdo">${opts(SESSION_TYPE1_OPTIONS,s.type1||SESSION_TYPE1_OPTIONS[0])}</select></td>
                    <td style="min-width:300px"><select class="tbl-field font-semibold" data-f="discipline" title="${e(s.discipline||'')}" aria-label="Disciplina">${discOpts(s.discipline||'')}</select><select class="tbl-field tbl-sub" data-f="itemId" title="${e(topicText)}" aria-label="Tópico e subtópico"><option value="${e(item?item.id:'')}" selected>${e(topicText)}</option></select></td>
                    <td style="min-width:132px"><select class="tbl-field" data-f="studyTrack" aria-label="Curso ou trilha">${trackOptionsHtml(String(s.studyTrack||'Trilha não informada'))}</select></td>
                    <td style="min-width:78px"><input type="number" min="1" class="tbl-field" data-f="minutes" value="${minutes}" aria-label="Minutos"><div class="px-1.5 text-[10px] text-slate-400" data-dhm>${fmtHoras(minutes/60)}</div></td>
                    <td style="min-width:64px"><input type="number" min="0" class="tbl-field" data-f="questions" value="${Number(s.questions)||0}" aria-label="Questões"></td>
                    <td style="min-width:96px;white-space:nowrap"><button type="button" data-act="copy" class="sess-ico bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300" title="Copiar para o formulário" aria-label="Copiar para o formulário"><i class="fa-regular fa-copy"></i></button> <button type="button" data-act="note" class="sess-ico bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300" title="Anotações do tópico" aria-label="Anotações do tópico"><i class="fa-regular fa-note-sticky"></i></button> <button type="button" data-act="del" class="sess-ico bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300" title="Excluir registro" aria-label="Excluir registro"><i class="fa-regular fa-trash-can"></i></button></td>
                </tr>`;
            }).join('');
            container.innerHTML=`<table class="sess-table"><thead><tr><th>Data</th><th>Atividade / Conteúdo</th><th>Disciplina / Tópico</th><th>Trilha</th><th>Min</th><th>Quest.</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>`;
            if(filtered.length>_limit){
                const more=document.createElement('button');more.type='button';
                more.className='m-3 w-[calc(100%-1.5rem)] py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800';
                more.textContent=`Mostrar mais 20 (restam ${filtered.length-_limit})`;
                more.addEventListener('click',()=>{window._sessionsLimit=_limit+20;renderSessionsList();});
                container.appendChild(more);
            }
            if(!container.dataset.bound){
                container.dataset.bound='1';
                container.addEventListener('change',onSessionTableChange);
                container.addEventListener('focusin',ev=>{const t=ev.target;if(t&&t.matches&&t.matches('select[data-f="itemId"]'))fillSessionTopicSelect(t);});
                container.addEventListener('click',onSessionTableClick);
            }
        }
        // As opções de tópico só são montadas quando o campo recebe foco (mantém a tabela leve com centenas de tópicos).
        function fillSessionTopicSelect(sel,forceId){
            const tr=sel.closest('tr');const disc=tr.querySelector('[data-f="discipline"]').value;
            const cur=forceId||sel.value;
            if(!forceId&&sel.dataset.filled===disc)return;
            sel.dataset.filled=disc;
            sel.innerHTML=masterEditalData.filter(x=>x.discipline===disc).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(sessionTopicLabel(x))}</option>`).join('');
            if([...sel.options].some(o=>o.value===cur))sel.value=cur;else sel.selectedIndex=-1;
        }
        function onSessionTableChange(ev){
            const el=ev.target.closest('[data-f]');if(!el)return;
            const tr=el.closest('tr');const s=studySessions.find(x=>x.id===tr.dataset.id);if(!s)return;
            const f=el.dataset.f,patch={};
            if(f==='date'){if(!el.value){el.value=dateToInputValue(s.date);return;}patch.date=dateToBR(el.value);}
            else if(f==='type1')patch.type1=el.value;
            else if(f==='type2'){patch.type2=el.value;patch.isReview=el.value==='Revisão'?1:0;}
            else if(f==='studyTrack')patch.studyTrack=(el.value||'').trim()||'Trilha não informada';
            else if(f==='minutes')patch.minutes=Math.max(1,Number(el.value)||1);
            else if(f==='questions')patch.questions=Math.max(0,Number(el.value)||0);
            else if(f==='discipline'){
                const first=masterEditalData.find(x=>x.discipline===el.value);
                if(!first){showCustomDialog('Disciplina sem tópicos','Essa disciplina não tem tópicos cadastrados no edital.');el.value=s.discipline||'';return;}
                patch.itemId=first.id;
            }else if(f==='itemId'){
                if(!masterEditalData.some(x=>x.id===el.value))return;
                patch.itemId=el.value;
            }
            applySessionPatch(s,patch,tr);
        }
        function applySessionPatch(s,patch,tr){
            adjustProgressForSession(s,-1);
            Object.assign(s,patch);
            if(patch.itemId){const it=masterEditalData.find(x=>x.id===patch.itemId);if(it)Object.assign(s,{discipline:it.discipline,topic:it.topic,subtopic:it.subtopic});}
            adjustProgressForSession(s,+1);
            saveData();
            if(tr){
                const dhm=tr.querySelector('[data-dhm]');if(dhm)dhm.textContent=fmtHoras((Number(s.minutes)||0)/60);
                if(patch.itemId){
                    const ds=tr.querySelector('[data-f="discipline"]');if(ds)ds.value=s.discipline;
                    const ts=tr.querySelector('[data-f="itemId"]');if(ts){ts.dataset.filled='';fillSessionTopicSelect(ts,patch.itemId);}
                    tr.classList.remove('sess-orphan');tr.removeAttribute('title');
                }
                tr.classList.remove('row-saved');void tr.offsetWidth;tr.classList.add('row-saved');
            }
            try{renderRecentRotation();renderPriorityDisciplineProgress();}catch(err){console.warn(err);}
        }
        function onSessionTableClick(ev){
            const btn=ev.target.closest('[data-act]');if(!btn)return;
            const tr=btn.closest('tr');const id=tr.dataset.id;const s=studySessions.find(x=>x.id===id);if(!s)return;
            if(btn.dataset.act==='del'){
                showCustomDialog('Excluir registro?','Este registro de estudo será removido e as horas, questões e revisões dele serão descontadas do tópico.','fa-solid fa-triangle-exclamation',()=>deleteSession(id));
            }else if(btn.dataset.act==='note'){
                const item=masterEditalData.find(x=>sessionMatchesTopic(s,x));
                if(!item)return showCustomDialog('Tópico indisponível','Escolha primeiro um tópico válido do edital nesta linha para abrir as anotações.');
                openModal(item.id);
            }else if(btn.dataset.act==='copy'){
                const item=masterEditalData.find(x=>sessionMatchesTopic(s,x));
                const set=(id2,v)=>{const el=document.getElementById(id2);if(el)el.value=v;};
                set('reg-type1',s.type1||SESSION_TYPE1_OPTIONS[0]);set('reg-type2',s.type2||SESSION_TYPE2_OPTIONS[0]);
                {const ts=document.getElementById('reg-track'),tv=s.studyTrack||'';if(ts&&tv&&![...ts.options].some(o=>o.value===tv))ts.add(new Option(tv+' (fora da lista)',tv));set('reg-track',tv||(ts&&ts.options[0]?ts.options[0].value:''));}set('reg-minutes',Math.max(1,Number(s.minutes)||1));set('reg-questions',Number(s.questions)||0);set('reg-date',localTodayISO());
                if(item){set('reg-discipline',item.discipline);updateRegTopics();set('reg-topic',item.id);}
                document.getElementById('study-session-form')?.scrollIntoView({behavior:'smooth',block:'center'});
                showCustomDialog('Registro copiado','Os dados foram levados para o formulário, com a data de hoje. Ajuste o que precisar e clique em “Salvar registro de estudo”.','fa-solid fa-circle-check');
            }
        }

        function updateEditSessionTopics(selectedId) {
            const discipline=document.getElementById('edit-session-discipline').value;
            const select=document.getElementById('edit-session-item');
            select.innerHTML='';
            masterEditalData.filter(i=>i.discipline===discipline).forEach(item=>{
                const opt=document.createElement('option');opt.value=item.id;opt.textContent=`${item.topic} → ${item.subtopic}`;
                if(item.id===selectedId) opt.selected=true;
                select.appendChild(opt);
            });
        }
        function editSession(id) {
            const session=studySessions.find(s=>s.id===id);if(!session)return;
            document.getElementById('edit-session-id').value=id;
            const d=parseBRDate(session.date);
            document.getElementById('edit-session-date').value=isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            document.getElementById('edit-session-type1').value=session.type1||'Conhecimentos Específicos';
            const type2=document.getElementById('edit-session-type2');
            if(![...type2.options].some(o=>o.value===session.type2)){const opt=document.createElement('option');opt.value=session.type2;opt.textContent=session.type2;type2.appendChild(opt)}
            type2.value=session.type2||'Estudo Teórico';
            const dsel=document.getElementById('edit-session-discipline');dsel.innerHTML='';
            [...new Set(masterEditalData.map(i=>i.discipline))].forEach(disc=>{const opt=document.createElement('option');opt.value=disc;opt.textContent=disc;dsel.appendChild(opt)});
            dsel.value=masterEditalData.some(i=>i.discipline===session.discipline)?session.discipline:(dsel.options[0]?.value||'');
            const match=masterEditalData.find(i=>i.discipline===session.discipline&&i.topic===session.topic&&i.subtopic===session.subtopic)||masterEditalData.find(i=>i.discipline===session.discipline);
            updateEditSessionTopics(match?match.id:null);
            document.getElementById('edit-session-minutes').value=Number(session.minutes)||50;
            document.getElementById('edit-session-questions').value=Number(session.questions)||0;
            document.getElementById('edit-session-review').value=(session.isReview || session.type2==='Revisão')?'1':'0';
            document.getElementById('session-edit-modal').classList.remove('hidden');document.getElementById('session-edit-modal').classList.add('flex');
        }
        function closeSessionEdit(){document.getElementById('session-edit-modal').classList.add('hidden');document.getElementById('session-edit-modal').classList.remove('flex')}
        function saveEditedSession(event) {
            event.preventDefault();
            const id=document.getElementById('edit-session-id').value;
            const session=studySessions.find(s=>s.id===id);if(!session)return closeSessionEdit();
            const oldSession={...session};
            const item=masterEditalData.find(t=>t.id===document.getElementById('edit-session-item').value);if(!item)return;
            const minutes=Math.max(1,Number(document.getElementById('edit-session-minutes').value)||1);
            const questions=Math.max(0,Number(document.getElementById('edit-session-questions').value)||0);
            const isReview=Number(document.getElementById('edit-session-review').value)||0;
            const oldItem=masterEditalData.find(t=>t.discipline===oldSession.discipline&&t.topic===oldSession.topic&&t.subtopic===oldSession.subtopic);
            const oldProgress=oldItem?userProgress.find(u=>u.id===oldItem.id):null;
            if(oldProgress){
                oldProgress.hours=Math.max(0,(Number(oldProgress.hours)||0)-(Number(oldSession.minutes)||0)/60);
                oldProgress.questions=Math.max(0,(Number(oldProgress.questions)||0)-(Number(oldSession.questions)||0));
                if(oldSession.isReview || oldSession.type2==='Revisão') oldProgress.reviews=Math.max(0,(Number(oldProgress.reviews)||0)-1);
            }
            const dateValue=document.getElementById('edit-session-date').value;
            const [year,month,day]=dateValue.split('-');
            Object.assign(session,{date:`${day}/${month}/${year}`,type1:document.getElementById('edit-session-type1').value,type2:document.getElementById('edit-session-type2').value,discipline:item.discipline,topic:item.topic,subtopic:item.subtopic,minutes,questions,isReview});
            let newProgress=userProgress.find(u=>u.id===item.id);
            if(!newProgress){newProgress={...item,hours:0,questions:0,reviews:0,completed:false};userProgress.push(newProgress)}
            newProgress.hours=(Number(newProgress.hours)||0)+minutes/60;
            newProgress.questions=(Number(newProgress.questions)||0)+questions;
            if(isReview || session.type2==='Revisão')newProgress.reviews=(Number(newProgress.reviews)||0)+1;
            if(session.type2==='Estudo Teórico' && newProgress.hours>=0.5)newProgress.completed=true;
            studySessions.sort((a,b)=>parseBRDate(b.date)-parseBRDate(a.date));
            saveData();renderSessionsList();initCronogramaFilters();renderDashboard();renderEditalVerticalizado();
            closeSessionEdit();showCustomDialog('Sessão atualizada','As informações do histórico e os totais do tópico foram atualizados.');
        }

        function deleteSession(id) {
            const old=studySessions.find(s=>s.id===id);
            if(old)adjustProgressForSession(old,-1);
            studySessions = studySessions.filter(s => s.id !== id);
            addTombstones('sessions',[id]);
            localStorage.setItem('tce_go_pro_sessions', JSON.stringify(studySessions));
            saveData();
            initRegistrationForm();renderSessionsList();
            renderRecentRotation();renderDashboard();renderPriorityDisciplineProgress();
        }

