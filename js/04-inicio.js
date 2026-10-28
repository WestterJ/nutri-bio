// 04-inicio.js — Trilhas cadastráveis, subtítulo do concurso, painéis recolhíveis da Home, progresso por prioridade, cronograma e KPIs.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // ===== V10.6: cursos/trilhas cadastráveis, subtítulo com dias para a prova e conta nova =====
        const DEFAULT_STUDY_TRACKS=['Curso regular','Curso intensivo','Estudo individual','Simulados'];
        function getStudyTrackOptions(){
            const cfg=contests[activeContest]||(contests[activeContest]={name:activeContest,board:'',date:''});
            if(!Array.isArray(cfg.studyTracks)){
                const used=getStudyTracks().filter(t=>t&&t!=='Trilha não informada');
                cfg.studyTracks=[...new Set([...DEFAULT_STUDY_TRACKS,...used])];
                try{localStorage.setItem('tce_contests',JSON.stringify(contests));}catch(e){}
            }
            return cfg.studyTracks;
        }
        function saveStudyTracks(list){
            contests[activeContest].studyTracks=list;
            contests[activeContest]._updatedAt=new Date().toISOString();
            try{localStorage.setItem('tce_contests',JSON.stringify(contests));}catch(e){}
            saveData();
        }
        function trackOptionsHtml(current){
            const list=getStudyTrackOptions();const arr=current&&!list.includes(current)?[current,...list]:list;
            return arr.map(t=>`<option value="${escapeHtml(t)}"${t===current?' selected':''}>${escapeHtml(t)}${list.includes(t)?'':' (fora da lista)'}</option>`).join('');
        }
        function populateRegTrackSelect(){
            const sel=document.getElementById('reg-track');if(!sel)return;
            const cur=sel.value;const list=getStudyTrackOptions();
            sel.innerHTML=list.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
            sel.value=list.includes(cur)?cur:(list[0]||'');
        }
        function refreshTrackViews(){try{initRegistrationForm();}catch(e){console.warn(e);}renderStudyTracksManager();}
        function renderStudyTracksManager(){
            const ul=document.getElementById('study-tracks-manager');if(!ul)return;
            const list=getStudyTrackOptions();const counts={};
            studySessions.forEach(s=>{const t=String(s.studyTrack||'').trim();counts[t]=(counts[t]||0)+1;});
            ul.innerHTML=list.map((t,i)=>`<li class="flex items-center gap-2"><input class="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" maxlength="60" value="${escapeHtml(t)}" data-track-old="${escapeHtml(t)}" aria-label="Nome da trilha"><span class="whitespace-nowrap text-[11px] text-slate-500">${counts[t]||0} registro${(counts[t]||0)===1?'':'s'}</span><button type="button" data-track-del="${i}" class="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100" aria-label="Excluir trilha" title="Excluir trilha"><i class="fa-solid fa-trash-can"></i></button></li>`).join('')||'<li class="text-xs text-slate-500">Nenhuma trilha cadastrada.</li>';
            if(!ul.dataset.bound){
                ul.dataset.bound='1';
                ul.addEventListener('change',ev=>{const inp=ev.target.closest('[data-track-old]');if(inp)renameStudyTrack(inp.dataset.trackOld,inp.value);});
                ul.addEventListener('click',ev=>{const b=ev.target.closest('[data-track-del]');if(b)deleteStudyTrack(Number(b.dataset.trackDel));});
            }
        }
        function addStudyTrack(){
            const inp=document.getElementById('new-track-name');const name=(inp.value||'').trim();if(!name)return;
            const list=getStudyTrackOptions().slice();
            if(list.some(t=>t.toLowerCase()===name.toLowerCase())){showCustomDialog('Nome já existe','Já existe uma trilha com esse nome.');return;}
            list.push(name);saveStudyTracks(list);inp.value='';refreshTrackViews();
        }
        function renameStudyTrack(oldName,newRaw){
            const name=(newRaw||'').trim();const list=getStudyTrackOptions().slice();const i=list.indexOf(oldName);if(i<0)return;
            if(!name||list.some((t,j)=>j!==i&&t.toLowerCase()===name.toLowerCase())){showCustomDialog(name?'Nome já existe':'Nome vazio',name?'Já existe uma trilha com esse nome.':'Informe um nome para a trilha.');renderStudyTracksManager();return;}
            if(name===oldName)return;
            list[i]=name;let changed=0;
            studySessions.forEach(s=>{if(String(s.studyTrack||'').trim()===oldName){s.studyTrack=name;changed++;}});
            if(changed)localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));
            saveStudyTracks(list);refreshTrackViews();
        }
        function deleteStudyTrack(i){
            const list=getStudyTrackOptions().slice();const t=list[i];if(t===undefined)return;
            if(list.length<=1){showCustomDialog('Mantenha ao menos uma trilha','O Registro de Estudos precisa de pelo menos uma opção.');return;}
            const n=studySessions.filter(s=>String(s.studyTrack||'').trim()===t).length;
            showCustomDialog('Excluir trilha?',n?`“${t}” sai da lista de opções. Os ${n} registro(s) que usam essa trilha continuam com o nome dela.`:`“${t}” será removida da lista.`,'fa-solid fa-triangle-exclamation',()=>{list.splice(i,1);saveStudyTracks(list);refreshTrackViews();});
        }

        // Subtítulo do cabeçalho: nome · banca · Prova em dd/mm/aaaa (faltam N dias)
        function contestSubtitleText(){
            const cfg=contests[activeContest]||{};const name=cfg.name||activeContest||'Concurso selecionado';
            let prova=null;
            if(cfg.date){
                const diff=dayDiffFromToday(cfg.date);
                const resto=diff===null?'':diff>1?` (faltam ${diff} dias)`:diff===1?' (falta 1 dia)':diff===0?' (é hoje)':' (já realizada)';
                prova='Prova em '+new Date(cfg.date+'T12:00:00').toLocaleDateString('pt-BR')+resto;
            }
            const meta=[cfg.board?'Banca '+cfg.board:null,prova].filter(Boolean).join(' · ');
            return meta?`${name} · ${meta}`:name;
        }
        function refreshContestSubtitle(){const sub=document.getElementById('contest-subtitle');if(!sub)return;const t=contestSubtitleText();if(sub.textContent!==t)sub.textContent=t;}

        // Estado "limpo": conta nova que ainda não cadastrou nada. Serve para não misturar o concurso vazio padrão
        // com os concursos de uma conta existente ao entrar em outro aparelho.
        function isPristineLocalState(){
            const ids=Object.keys(contests||{});
            if(ids.length>1||(ids.length===1&&ids[0]!==DEFAULT_CONTEST_ID)||activeContest!==DEFAULT_CONTEST_ID)return false;
            if(masterEditalData.length||studySessions.length)return false;
            if(userProgress.some(u=>(Number(u.hours)||0)>0||(Number(u.questions)||0)>0||u.completed||String(u.notes||'').trim()))return false;
            const cfg=contests[DEFAULT_CONTEST_ID]||{};
            if(cfg.board||cfg.date||(cfg.name&&cfg.name!==DEFAULT_CONTEST_NAME))return false;
            if(Array.isArray(cfg.importantDates)&&cfg.importantDates.length)return false;
            return true;
        }
        function onboardingHtml(){
            const link=(tab,label)=>`<button type="button" onclick="switchTab('${tab}',true)" class="font-semibold text-blue-700 underline dark:text-blue-300">${label}</button>`;
            return `<div class="rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-5 dark:border-slate-600 dark:bg-slate-900/40 sm:p-6"><h3 class="text-base font-bold text-blue-800 dark:text-blue-200"><i class="fa-solid fa-flag-checkered mr-2"></i>Vamos começar o seu planejamento</h3><p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Esta conta ainda não tem nenhum conteúdo. Siga os passos:</p><ol class="mt-3 space-y-2 text-sm"><li><strong>1.</strong> Em ${link('personalizacao','Personalização')}, informe o nome do concurso, a banca e a data da prova.</li><li><strong>2.</strong> Em ${link('edital','Edital Verticalizado')}, importe a planilha (há um modelo para baixar) ou cadastre as disciplinas e os tópicos.</li><li><strong>3.</strong> Registre cada sessão em ${link('registro','Registro de Estudos')} e acompanhe o progresso aqui.</li></ol></div>`;
        }

        // Cartões recolhíveis: Últimos estudos, Sugestões, Revisões sugeridas e Últimas revisões (iniciam fechados).
        // Resumo do cartão fechado: disciplina + o dado mais útil do primeiro item (posições entre os textos do cartão).
        const PANEL_SUMMARY_PARTS={'recent-rotation-container':[0,2,3],'next-study-container':[0,1],'review-due-container':[0,2],'recent-reviews-container':[0,2]};
        function getPanelSummaryText(container){
            const first=container.firstElementChild; if(!first) return '';
            const msg=first.querySelector('p'); if(msg) return msg.textContent.trim();
            const texts=[...first.querySelectorAll('div')].filter(d=>!d.firstElementChild&&!d.closest('button')).map(d=>d.textContent.trim()).filter(t=>t&&!/^\d+$/.test(t));
            const picks=(PANEL_SUMMARY_PARTS[container.id]||[0,1]).map(i=>texts[i]).filter(Boolean);
            return picks.join(' · ');
        }
        function initCollapsiblePanels(){
            ['recent-rotation-container','next-study-container','review-due-container','recent-reviews-container'].forEach(id=>{
                const container=document.getElementById(id); const panel=container&&container.closest('.activity-panel');
                const head=panel&&panel.querySelector('.activity-panel-head');
                if(!panel||!head||panel.dataset.collapsibleReady) return;
                panel.dataset.collapsibleReady='1';
                const summary=document.createElement('div');
                summary.className='panel-summary mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-300';
                head.insertAdjacentElement('afterend',summary);
                const chevron=document.createElement('i');
                chevron.className='fa-solid fa-chevron-down panel-chevron ml-1 shrink-0 text-xs text-slate-400';
                chevron.setAttribute('aria-hidden','true'); head.appendChild(chevron);
                head.setAttribute('role','button'); head.tabIndex=0; head.setAttribute('aria-expanded','false');
                panel.classList.add('collapsed');
                const toggle=()=>{const closed=panel.classList.toggle('collapsed'); head.setAttribute('aria-expanded',String(!closed));};
                head.addEventListener('click',toggle);
                head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
                const refresh=()=>{summary.textContent=getPanelSummaryText(container);};
                new MutationObserver(refresh).observe(container,{childList:true});
                refresh();
            });
        }
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCollapsiblePanels); else initCollapsiblePanels();

        function renderRecentRotation() {
            const container=document.getElementById('recent-rotation-container');
            if(!container) return;
            container.innerHTML='';
            const sorted=getSessionsNewestFirst().filter(session=>!isRevisionSession(session));
            const recentMap=new Map();
            sorted.forEach(session=>{
                const key=session.discipline||'Sem disciplina';
                if(!recentMap.has(key)) recentMap.set(key,session);
            });
            const recent=Array.from(recentMap.values()).slice(0,5);
            if(!recent.length) {
                container.innerHTML='<div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-5 text-center"><i class="fa-solid fa-book-open text-2xl text-slate-300"></i><p class="text-xs font-semibold text-slate-500 mt-2">Seu histórico começa aqui</p><p class="text-[11px] text-slate-400 mt-1">Use “Lançar estudo” para registrar a primeira sessão.</p></div>';
            } else recent.forEach(session=>{
                const card=document.createElement('div');
                card.className='recent-study-card flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3';
                const duration=((Number(session.minutes)||0)/60).toFixed(1);
                const noteItem=masterEditalData.find(i=>sessionMatchesTopic(session,i));
                const noteText=noteItem?String((userProgress.find(u=>u.id===noteItem.id)||{}).notes||'').trim():'';
                const noteId=noteItem?escapeHtml(noteItem.id):'';
                const noteHtml=!noteItem?'':(noteText
                    ?`<div role="button" tabindex="0" data-skip-summary onclick="openModal('${noteId}')" title="Abrir anotações" class="note-clamp mt-1.5 max-w-full cursor-pointer rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-left text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><i class="fa-regular fa-note-sticky mr-1"></i>${escapeHtml(noteText)}</div>`
                    :`<button type="button" onclick="openModal('${noteId}')" class="mt-1 text-[10px] font-semibold text-blue-700 hover:underline dark:text-blue-300"><i class="fa-regular fa-note-sticky mr-1"></i>Adicionar anotação</button>`);
                const questions=Number(session.questions)||0;
                card.innerHTML=`<div class="flex items-center gap-3 min-w-0"><div class="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 grid place-items-center shrink-0"><i class="fa-solid fa-book-open"></i></div><div class="min-w-0"><div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(session.discipline||'Sem disciplina')}</div><div class="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">${escapeHtml(session.topic||'Estudo registrado')}${session.subtopic?' · '+escapeHtml(session.subtopic):''}</div><div class="text-[10px] text-slate-400 mt-1"><i class="fa-regular fa-calendar mr-1"></i>${escapeHtml(session.date||'')} · ${escapeHtml(session.studyTrack||'Trilha não informada')}</div>${noteHtml}</div></div><div class="text-right shrink-0 min-w-[104px]"><div class="font-bold text-xs text-emerald-700 dark:text-emerald-300">${fmtHoras((Number(session.minutes)||0)/60)}</div><div class="text-[10px] text-amber-700 dark:text-amber-300 mt-1">${questions} ${questions===1?'questão':'questões'}</div></div>`;
                container.appendChild(card);
            });
            renderStudySuggestionPanel();
            renderReviewPanels();
            const recommendation=getNextStudyRecommendation();
            const text=document.getElementById('next-study-recommendation-text');
            const button=document.getElementById('use-study-recommendation');
            if(text) text.textContent=recommendation ? `${recommendation.discipline} · Prioridade ${getPriorityLabel(recommendation.priority)} · ${recommendation.pct}% concluído${recommendation.lastDate?' · último estudo '+recommendation.lastDate+(recommendation.lastTrack?' · '+recommendation.lastTrack:''):' · ainda não estudada'}` : 'Todas as disciplinas estão concluídas.';
            if(button) button.disabled=!recommendation;
            updateSuggestionModeHelp();
        }
        function renderStudySuggestionPanel() {
            const container = document.getElementById('next-study-container');
            const badge = document.getElementById('suggestion-mode-badge');
            if (!container) return;
            container.innerHTML = '';
            const mode = getSuggestionMode();
            const labels = {priority_first:'Prioridade primeiro', priority_progress:'Prioridade + progresso', priority_date:'Prioridade + data'};
            if (badge) badge.textContent = labels[mode] || labels.priority_progress;
            const suggestions = getStudySuggestionCandidates().slice(0,4);
            if (!suggestions.length) {
                container.innerHTML = '<div class="rounded-xl border border-dashed border-emerald-200 dark:border-slate-600 p-5 text-center"><i class="fa-solid fa-check-circle text-2xl text-emerald-500"></i><p class="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-2">Todas as disciplinas estão concluídas</p><p class="text-[11px] text-slate-500 mt-1">Faça revisões e simulados para consolidar o conteúdo.</p></div>';
                return;
            }
            suggestions.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'next-study-card flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 dark:bg-slate-900/50 dark:border-slate-700 p-3';
                const colorStyle = 'color:' + (getPrioritySettings()[item.priority]?.color || '#64748b');
                const lastStudyText = item.lastDate ? 'Último estudo: ' + escapeHtml(item.lastDate) + (item.lastTrack ? ' · ' + escapeHtml(item.lastTrack) : '') : 'Ainda não estudada';
                card.innerHTML = `<div class="flex items-start gap-2 min-w-0"><div class="grid place-items-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shrink-0">${index+1}</div><div class="min-w-0"><div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.discipline)}</div><div class="text-[10px] font-bold mt-1" style="${colorStyle}">Prioridade ${escapeHtml(getPriorityLabel(item.priority))} · ${item.pct}% concluído</div><div class="text-[10px] text-slate-500 mt-1">${item.pending} tópicos pendentes · ${item.hours.toFixed(1)} h · ${item.questions} questões</div><div class="text-[10px] text-slate-400 mt-1">${lastStudyText}</div></div></div><button type="button" class="shrink-0 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-3 py-2">Estudar</button>`;
                const button = card.querySelector('button');
                if (button) button.addEventListener('click', () => openDisciplineInCronograma(item.discipline));
                container.appendChild(card);
            });
        }
        function openDisciplineInCronograma(discipline) {
            switchTab('registro');
            const select = document.getElementById('reg-discipline');
            if (select) {
                select.value = discipline;
                updateRegTopics();
            }
            window.scrollTo({top:0,behavior:'smooth'});
        }
        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        }

        function getRevisionQueue() {
            const all=getSessionsNewestFirst();
            const now=new Date();now.setHours(12,0,0,0);
            const cadence=[1,7,15,30,45];
            const candidates=[];
            masterEditalData.forEach(item=>{
                const matches=all.filter(s=>sessionMatchesTopic(s,item));
                const lastStudy=matches.filter(s=>!isRevisionSession(s)).sort((a,b)=>parseBRDate(b.date)-parseBRDate(a.date))[0];
                if(!lastStudy)return;
                const lastStudyTs=parseBRDate(lastStudy.date).getTime();
                const reviews=matches.filter(s=>isRevisionSession(s)&&parseBRDate(s.date).getTime()>=lastStudyTs).sort((a,b)=>parseBRDate(b.date)-parseBRDate(a.date));
                const lastActivity=reviews[0]||lastStudy;
                const interval=cadence[Math.min(reviews.length,cadence.length-1)];
                const dueDate=parseBRDate(lastActivity.date);dueDate.setDate(dueDate.getDate()+interval);dueDate.setHours(12,0,0,0);
                if(dueDate<=now){
                    const daysLate=Math.max(0,Math.floor((now.getTime()-dueDate.getTime())/86400000));
                    candidates.push({item,dueDate,daysLate,interval,completedReviews:reviews.length,rank:Number(getPrioritySettings()[item.priority||'Amarela']?.weight)||1});
                }
            });
            return candidates.sort((a,b)=>b.rank-a.rank||a.dueDate-b.dueDate);
        }
        function startReviewForItem(itemId) {
            const item=masterEditalData.find(x=>x.id===itemId);if(!item)return;
            switchTab('registro');
            const disc=document.getElementById('reg-discipline');if(disc){disc.value=item.discipline;updateRegTopics();}
            const topic=document.getElementById('reg-topic');if(topic)topic.value=item.id;
            const type2=document.getElementById('reg-type2');if(type2)type2.value='Revisão';
            const date=document.getElementById('reg-date');if(date)date.value=localTodayISO();
            window.scrollTo({top:0,behavior:'smooth'});
            showCustomDialog('Revisão selecionada',`${item.discipline} · ${item.topic}${item.subtopic?' · '+item.subtopic:''}. Confira a data, a trilha e registre a duração/questões ao concluir.`);
        }
        function renderReviewPanels() {
            const dueContainer=document.getElementById('review-due-container');
            const recentContainer=document.getElementById('recent-reviews-container');
            if(!dueContainer||!recentContainer)return;
            const dueAll=getRevisionQueue();
            const due=dueAll.slice(0,8);
            const count=document.getElementById('review-due-count');if(count)count.textContent=`${dueAll.length} ${dueAll.length===1?'pendente':'pendentes'}`;
            if(!dueAll.length){dueContainer.innerHTML='<div class="rounded-xl border border-dashed border-violet-200 dark:border-slate-600 p-4 text-center"><i class="fa-solid fa-check-circle text-2xl text-violet-400"></i><p class="text-xs font-semibold text-violet-800 dark:text-violet-300 mt-2">Nenhuma revisão vencida pela regra atual</p><p class="text-[11px] text-slate-500 mt-1">Registre os estudos e o quadro sugerirá revisões futuras.</p></div>';}
            else {
                dueContainer.innerHTML='';
                due.forEach(({item,dueDate,daysLate,interval})=>{
                    const card=document.createElement('div');card.className='rounded-xl border border-violet-100 dark:border-slate-700 bg-violet-50/60 dark:bg-slate-900/50 p-3 flex items-start justify-between gap-3';
                    const dueLabel=dueDate.toLocaleDateString('pt-BR');
                    card.innerHTML=`<div class="min-w-0"><div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.discipline)}</div><div class="text-[11px] text-slate-600 dark:text-slate-300 mt-1">${escapeHtml(item.topic)}${item.subtopic?' · '+escapeHtml(item.subtopic):''}</div><div class="text-[10px] mt-1 ${daysLate>0?'text-red-600 dark:text-red-300':'text-violet-700 dark:text-violet-300'}">${daysLate>0?`${daysLate} dia(s) em atraso`:'Vence hoje'} · prevista para ${dueLabel}</div></div><button type="button" class="review-now-btn shrink-0 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-[11px] font-bold px-3 py-2">Revisar</button>`;
                    card.querySelector('.review-now-btn').addEventListener('click',()=>startReviewForItem(item.id));dueContainer.appendChild(card);
                });
                if(dueAll.length>due.length){const more=document.createElement('p');more.className='text-[10px] text-slate-500 px-1';more.textContent=`Mostrando 8 de ${dueAll.length} revisões pendentes; as demais seguem na fila.`;dueContainer.appendChild(more);}
            }
            const recent=getSessionsNewestFirst().filter(isRevisionSession).slice(0,5);
            const recentCount=document.getElementById('recent-review-count');if(recentCount)recentCount.textContent=`${recent.length} ${recent.length===1?'registro':'registros'}`;
            if(!recent.length)recentContainer.innerHTML='<div class="rounded-xl border border-dashed border-purple-200 dark:border-slate-600 p-4 text-center"><i class="fa-solid fa-rotate text-2xl text-purple-300"></i><p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">Nenhuma revisão registrada</p><p class="text-[11px] text-slate-500 mt-1">No Registro de Estudos, escolha “Revisão” em Tipo 2.</p></div>';
            else {
                recentContainer.innerHTML='';
                recent.forEach(session=>{
                    const card=document.createElement('div');card.className='rounded-xl border border-purple-100 dark:border-slate-700 bg-purple-50/50 dark:bg-slate-900/50 p-3 flex items-center justify-between gap-3';
                    card.innerHTML=`<div class="min-w-0"><div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(session.discipline||'Sem disciplina')}</div><div class="text-[11px] text-slate-600 dark:text-slate-300 mt-1">${escapeHtml(session.topic||'')}${session.subtopic?' · '+escapeHtml(session.subtopic):''}</div><div class="text-[10px] text-slate-400 mt-1">${escapeHtml(session.date||'')} · ${escapeHtml(session.studyTrack||'Trilha não informada')}</div></div><div class="text-right shrink-0"><div class="text-xs font-bold text-purple-700 dark:text-purple-300">${fmtHoras(Number(session.minutes||0)/60)}</div><div class="text-[10px] text-slate-500">${Number(session.questions)||0} questões</div></div>`;
                    recentContainer.appendChild(card);
                });
            }
        }

        window._openHomePriorities = window._openHomePriorities instanceof Set ? window._openHomePriorities : new Set();
        window._openHomeDisciplines = window._openHomeDisciplines instanceof Set ? window._openHomeDisciplines : new Set();
        function renderPriorityDisciplineProgress() {
            const container=document.getElementById('priority-progress-container');
            if(!container) return;
            container.innerHTML='';
            const total=masterEditalData.length;
            const completed=masterEditalData.filter(t=>{const u=userProgress.find(x=>x.id===t.id);return u&&u.completed}).length;
            const overall=total?Math.round(completed/total*100):0;
            const summary=document.getElementById('home-progress-summary');
            if(summary) summary.textContent=`${overall}% concluído · ${completed}/${total} tópicos`;
            if(!total){container.innerHTML=onboardingHtml();return;}
            const pSettings=getPrioritySettings();
            const priorityOrder=Object.keys(pSettings).sort((a,b)=>(Number(pSettings[b].weight)||1)-(Number(pSettings[a].weight)||1));
            const priorityMeta={};
            Object.entries(pSettings).forEach(([k,v])=>priorityMeta[k]={title:'Prioridade '+v.label,color:v.color,bg:hexToSoft(v.color)});
            priorityOrder.forEach(priority=>{
                const priorityTopics=masterEditalData.filter(t=>(t.priority||'Amarela')===priority);
                if(!priorityTopics.length) return;
                const group=document.createElement('div');group.className='priority-group-shell';
                const met=priorityMeta[priority];
                const discMap=new Map();priorityTopics.forEach(t=>{if(!discMap.has(t.discipline))discMap.set(t.discipline,[]);discMap.get(t.discipline).push(t)});
                const completedPri=priorityTopics.filter(t=>{const u=userProgress.find(x=>x.id===t.id);return u&&u.completed}).length;
                let inner='';
                [...discMap.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).forEach(([discipline,topics])=>{
                    const values=topics.map(t=>userProgress.find(u=>u.id===t.id)||t);
                    const done=topics.filter(t=>{const u=userProgress.find(x=>x.id===t.id);return u&&u.completed}).length;
                    const pct=topics.length?Math.round(done/topics.length*100):0;
                    const hours=values.reduce((sum,u)=>sum+(Number(u.hours)||0),0);
                    const questions=values.reduce((sum,u)=>sum+(Number(u.questions)||0),0);
                    const reviews=values.reduce((sum,u)=>sum+(Number(u.reviews)||0),0);
                    const topicRows=topics.map(t=>{
                        const u=userProgress.find(x=>x.id===t.id)||t;
                        const itemPct=u.completed?100:((Number(u.hours)||0)>0?Math.min(90,Math.round((Number(u.hours)||0)/Math.max(Number(t.hours)||1,1)*50)):0);
                        const priorityColor=getPrioritySettings()[priority]?.color||'#64748b';
                        return `<div class="home-topic-row"><div class="min-w-0"><div class="text-xs font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(t.topic||'Tópico')}</div><div class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(t.subtopic||'')}</div><div class="text-[10px] mt-1" style="color:${priorityColor}">${u.completed?'Concluído':'Em andamento'} · Prioridade ${escapeHtml(getPriorityLabel(priority))} · Peso: ${escapeHtml(t.weight||'—')}</div><button type="button" onclick="openModal('${t.id}')" class="mt-1 text-[10px] font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300"><i class="fa-regular fa-note-sticky mr-1"></i>Anotações</button></div><div class="text-right shrink-0 text-[10px] space-y-1"><div class="font-bold text-blue-700">${fmtHoras(Number(u.hours)||0)}</div><div class="text-amber-700">${Number(u.questions)||0} ${(Number(u.questions)||0)===1?'questão':'questões'}</div><div class="text-purple-700">${Number(u.reviews)||0} ${(Number(u.reviews)||0)===1?'revisão':'revisões'}</div><label class="flex items-center justify-end gap-1 mt-1"><input type="checkbox" ${u.completed?'checked':''} onchange="toggleItem('${t.id}');renderPriorityDisciplineProgress();renderEditalVerticalizado();" class="rounded border-slate-300"><span>Concluído</span></label></div></div>`;
                    }).join('');
                    inner+=`<details class="home-discipline-group" ${window._openHomeDisciplines.has(discipline)?'open':''} ontoggle="if(!window._openHomeDisciplines)window._openHomeDisciplines=new Set();this.open?window._openHomeDisciplines.add(this.dataset.discipline):window._openHomeDisciplines.delete(this.dataset.discipline)" data-discipline="${escapeHtml(discipline)}"><summary><span class="gauge" style="--gauge-pct:${pct}%;--gauge-color:${met.color}"><span>${pct}%</span></span><div class="min-w-0 flex-1"><div class="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">${escapeHtml(discipline)}</div><div class="text-[10px] text-slate-500 mt-1">${done}/${topics.length} tópicos concluídos</div><div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] mt-1"><span class="text-emerald-700 font-bold">${fmtHoras(hours)}</span><span class="text-amber-700 font-bold">${questions} questões</span><span class="text-purple-700 font-bold">${reviews} revisões</span></div></div><i class="fa-solid fa-chevron-right group-chevron"></i></summary><div>${topicRows}</div></details>`;
                });
                const priorityIsOpen=window._openHomePriorities.has(priority);
                group.innerHTML=`<details class="priority-group" data-priority="${priority}" ${priorityIsOpen?'open':''} ontoggle="if(!window._openHomePriorities)window._openHomePriorities=new Set();this.open?window._openHomePriorities.add(this.dataset.priority):window._openHomePriorities.delete(this.dataset.priority)"><summary class="priority-group-head" style="background:${met.bg};color:${met.color}"><span><i class="fa-solid fa-circle text-[9px] mr-2"></i>${met.title}</span><span>${completedPri}/${priorityTopics.length} tópicos · ${priorityTopics.length?Math.round(completedPri/priorityTopics.length*100):0}%</span><i class="fa-solid fa-chevron-right priority-chevron"></i></summary><div class="p-2.5 space-y-2.5">${inner}</div></details>`;
                container.appendChild(group);
            });
        }

        // Atualiza os KPIs e os painéis de acompanhamento. A tabela extensa foi removida da interface.
        function renderCronograma() {
            updateStats(masterEditalData, 'all');
            renderPriorityDisciplineProgress();
            renderRecentRotation();
        }

        function toggleItem(id) {
            let userItem = userProgress.find(i => i.id === id);
            if (!userItem) {
                const master = masterEditalData.find(m => m.id === id);
                userItem = { ...master };
                userProgress.push(userItem);
            }
            userItem.completed = !userItem.completed;
            saveData();
            renderCronograma();
        }

        // KPIs Reativos e Rodapé com Informações Agrupadas da Disciplina Filtrada
        function updateStats(filteredList, disciplineFilter) {
            const totalEditalTopics = masterEditalData.length;
            const completedEditalTopics = masterEditalData.filter(m => {
                const u = userProgress.find(x => x.id === m.id);
                return u && u.completed;
            }).length;

            const topicPercent = totalEditalTopics > 0 ? Math.round((completedEditalTopics / totalEditalTopics) * 100) : 0;

            document.getElementById('stat-topics-count').innerText = `${completedEditalTopics}/${totalEditalTopics}`;
            document.getElementById('stat-percent').innerText = `${topicPercent}%`;
            document.getElementById('stat-bar').style.width = `${topicPercent}%`;

            const allDisciplines = [...new Set(masterEditalData.map(i => i.discipline))];
            const studiedDisciplines = allDisciplines.filter(d => {
                const topicsInDisc = masterEditalData.filter(i => i.discipline === d);
                return topicsInDisc.some(t => {
                    const u = userProgress.find(x => x.id === t.id);
                    return u && (u.completed || u.hours > 0);
                });
            }).length;

            document.getElementById('stat-disciplines-count').innerText = `${studiedDisciplines}/${allDisciplines.length}`;
            const discPercent = allDisciplines.length > 0 ? Math.round((studiedDisciplines / allDisciplines.length) * 100) : 0;
            document.getElementById('stat-disc-percent').innerText = `${discPercent}%`;
            document.getElementById('stat-disc-bar').style.width = `${discPercent}%`;

            let totalHours = 0;
            let totalQuestions = 0;
            let totalReviews = 0;

            userProgress.forEach(i => {
                totalHours += (i.hours || 0);
                totalQuestions += (i.questions || 0);
                totalReviews += (i.reviews || 0);
            });

            document.getElementById('stat-total-hours').innerText = `${totalHours.toFixed(1)}h`;
            const _dhm=document.getElementById('stat-total-hours-dhm');if(_dhm)_dhm.textContent=fmtHM(totalHours)+' acumulado';
            document.getElementById('stat-hours-bar').style.width = `${Math.min(100, (totalHours / 60) * 100)}%`;

            document.getElementById('stat-total-questions').innerText = totalQuestions;
            document.getElementById('stat-questions-bar').style.width = `${Math.min(100, (totalQuestions / 300) * 100)}%`;

            document.getElementById('stat-total-reviews').innerText = totalReviews;
            document.getElementById('stat-reviews-bar').style.width = `${Math.min(100, (totalReviews / 25) * 100)}%`;

            // Rodapé com KPIs agrupados da disciplina filtrada
            const footerDiv = document.getElementById('footer-discipline-kpis');
            if (footerDiv && disciplineFilter !== 'all') {
                const discTopics = masterEditalData.filter(i => i.discipline === disciplineFilter);
                let discH = 0, discQ = 0, discR = 0, discDone = 0;
                discTopics.forEach(t => {
                    const u = userProgress.find(x => x.id === t.id);
                    if (u) {
                        discH += (u.hours || 0);
                        discQ += (u.questions || 0);
                        discR += (u.reviews || 0);
                        if (u.completed) discDone++;
                    }
                });
                footerDiv.innerHTML = `
                    <span>Resumo da Disciplina (<strong class="text-blue-600">${disciplineFilter}</strong>):</span>
                    <div class="flex items-center space-x-4 font-mono">
                        <span>Horas: <strong class="text-emerald-600">${fmtHoras(discH)}</strong></span>
                        <span>Questões: <strong class="text-amber-600">${discQ}</strong></span>
                        <span>Revisões: <strong class="text-purple-600">${discR}</strong></span>
                        <span>Tópicos: <strong class="text-blue-600">${discDone}/${discTopics.length}</strong></span>
                    </div>
                `;
                footerDiv.classList.remove('hidden');
                footerDiv.classList.add('flex');
            } else if (footerDiv) {
                footerDiv.classList.remove('flex');
                footerDiv.classList.add('hidden');
            }
        }

