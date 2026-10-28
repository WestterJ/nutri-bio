// 02-sugestoes.js — Utilitários de data/sessão, trilhas de estudo e sugestão do próximo estudo.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // Renderização da seção de Últimas Disciplinas Estudadas (Rotação)
        function parseBRDate(value) {
            if (!value) return new Date(0);
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + 'T12:00:00');
            const m = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`) : new Date(value);
        }
        function getSessionsNewestFirst() {
            return studySessions.map(x=>({x,t:parseBRDate(x.date).getTime()||0})).sort((a,b)=>b.t-a.t).map(o=>o.x);
        }
        function localTodayISO() {
            const d=new Date();
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        function dateToInputValue(value) {
            if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))) return String(value);
            const d=parseBRDate(value);
            if(Number.isNaN(d.getTime()) || d.getTime()===0) return localTodayISO();
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        function dateToBR(value) {
            const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date().toLocaleDateString('pt-BR');
        }
        function isRevisionSession(session) {
            // Compatível com os registros antigos que usavam o campo isReview.
            return !!session && (String(session.type2||'')==='Revisão' || Number(session.isReview)===1);
        }
        function sessionMatchesTopic(session,item) {
            if(!session || !item) return false;
            if(session.itemId && item.id && session.itemId===item.id) return true;
            return String(session.discipline||'')===String(item.discipline||'') && String(session.topic||'')===String(item.topic||'') && String(session.subtopic||'')===String(item.subtopic||'');
        }
        function getStudyTracks() {
            return [...new Set(studySessions.map(s=>String(s.studyTrack||'Trilha não informada').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
        }
        function getSuggestionMode() {
            const value=localStorage.getItem('tce_'+activeContest+'_suggestion_mode');
            return ['priority_first','priority_progress','priority_date'].includes(value) ? value : 'priority_progress';
        }
        function updateSuggestionModeHelp() {
            const select=document.getElementById('study-suggestion-mode');
            const help=document.getElementById('study-suggestion-help');
            if(!select) return;
            const mode=select.value;
            const text=mode==='priority_first'
              ? 'A recomendação fica na prioridade mais alta com tópicos pendentes; só avança quando ela não tiver mais pendências.'
              : mode==='priority_date'
                ? 'Dentro de cada prioridade, recomenda primeiro a disciplina há mais tempo sem estudo. Disciplinas nunca estudadas vêm antes das demais.'
                : 'Dentro de cada prioridade, recomenda primeiro as disciplinas com menor percentual concluído; em empate, evita repetir as estudadas recentemente.';
            if(help) help.textContent=text;
        }
        function saveSuggestionMode() {
            const select=document.getElementById('study-suggestion-mode');
            if(!select) return;
            const mode=['priority_first','priority_progress','priority_date'].includes(select.value)?select.value:'priority_progress';
            localStorage.setItem('tce_'+activeContest+'_suggestion_mode',mode);
            saveData();
            updateSuggestionModeHelp();
            renderRecentRotation();
            showCustomDialog('Estratégia salva',mode==='priority_first'
              ? 'A recomendação ficará concentrada na prioridade mais alta até não haver tópicos pendentes nela.'
              : mode==='priority_date'
                ? 'Dentro de cada prioridade, serão recomendadas primeiro as disciplinas há mais tempo sem estudo; as nunca estudadas vêm primeiro.'
                : 'Dentro de cada prioridade, serão recomendadas primeiro as disciplinas com menor percentual concluído.');
        }
        function getStudySuggestionCandidates() {
            const sorted = getSessionsNewestFirst().filter(session=>!isRevisionSession(session));
            const prioritySettings = getPrioritySettings();
            const priorityOrder = Object.keys(prioritySettings).sort((a,b) => (Number(prioritySettings[b].weight)||1) - (Number(prioritySettings[a].weight)||1));
            const priorityRank = Object.fromEntries(priorityOrder.map((priority,index) => [priority,index]));
            const grouped = new Map();
            masterEditalData.forEach(topic => {
                if (!grouped.has(topic.discipline)) grouped.set(topic.discipline, []);
                grouped.get(topic.discipline).push(topic);
            });
            let candidates = [...grouped.entries()].map(([discipline, topics]) => {
                const vals = topics.map(topic => userProgress.find(u => u.id === topic.id) || topic);
                const done = vals.filter(value => !!value.completed).length;
                const pendingTopics = topics.filter(topic => !(userProgress.find(u => u.id === topic.id) || topic).completed);
                const pendingPriorities = pendingTopics.map(topic => topic.priority || 'Amarela');
                const priority = pendingPriorities.sort((a,b) => (priorityRank[a] ?? 99) - (priorityRank[b] ?? 99))[0] || topics[0]?.priority || 'Amarela';
                const lastSession = sorted.find(session => session.discipline === discipline);
                const lastDate = lastSession?.date || '';
                const lastTrack = lastSession?.studyTrack || (lastSession ? 'Trilha não informada' : '');
                const lastTimestamp = lastSession ? parseBRDate(lastSession.date).getTime() : 0;
                const hours = vals.reduce((sum,value) => sum + (Number(value.hours)||0), 0);
                const questions = vals.reduce((sum,value) => sum + (Number(value.questions)||0), 0);
                return {
                    discipline, topics, done,
                    pct: topics.length ? Math.round(done/topics.length*100) : 0,
                    priority, rank: priorityRank[priority] ?? 99,
                    pending: pendingTopics.length, hours, questions, lastDate, lastTrack, lastTimestamp
                };
            }).filter(item => item.pending > 0);

            if (!candidates.length) return [];
            const mode = getSuggestionMode();
            if (mode === 'priority_first') {
                const highest = Math.min(...candidates.map(item => item.rank));
                candidates = candidates.filter(item => item.rank === highest);
            }
            if (mode === 'priority_date') {
                // Dentro de cada prioridade, disciplinas nunca estudadas (data 0) e as mais antigas vêm primeiro.
                candidates.sort((a,b) => a.rank-b.rank || a.lastTimestamp-b.lastTimestamp || a.discipline.localeCompare(b.discipline,'pt-BR'));
            } else {
                candidates.sort((a,b) => a.rank-b.rank || a.pct-b.pct || Number(!!a.lastDate)-Number(!!b.lastDate) || a.lastTimestamp-b.lastTimestamp || a.discipline.localeCompare(b.discipline,'pt-BR'));
            }
            return candidates;
        }
        function getNextStudyRecommendation() {
            return getStudySuggestionCandidates()[0] || null;
        }
        function applyStudyRecommendation() {
            const item=getNextStudyRecommendation();
            const select=document.getElementById('reg-discipline');
            if(!item||!select) return;
            select.value=item.discipline;
            updateRegTopics();
            showCustomDialog('Disciplina selecionada', 'A disciplina '+item.discipline+' foi selecionada conforme a estratégia configurada. Escolha o tópico e registre o estudo.');
        }
