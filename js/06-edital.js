// 06-edital.js — Aba Edital Verticalizado: filtros e renderização.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // Edital Verticalizado com filtros por Disciplina e Tópico
        function initEditalFilters() {
            const discSelect = document.getElementById('edital-filter-disc');
            const currentDisc = discSelect.value;
            discSelect.innerHTML = '<option value="all">Todas as Disciplinas</option>';
            
            const disciplines = [...new Set(masterEditalData.map(i => i.discipline))];
            disciplines.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                if (d === currentDisc) opt.selected = true;
                discSelect.appendChild(opt);
            });

            updateEditalTopicsFilter();
            renderEditalVerticalizado();
            renderSyllabusManager();
        }

        function updateEditalTopicsFilter() {
            const disc = document.getElementById('edital-filter-disc').value;
            const topSelect = document.getElementById('edital-filter-topic');
            topSelect.innerHTML = '<option value="all">Todos os Tópicos</option>';

            let items = masterEditalData;
            if (disc !== 'all') {
                items = items.filter(i => i.discipline === disc);
            }
            const topics = [...new Set(items.map(i => i.topic))];
            topics.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.innerText = t;
                topSelect.appendChild(opt);
            });
        }

        function renderEditalVerticalizado() {
            const container = document.getElementById('edital-verticalizado-container');
            container.innerHTML = '';

            const discFilter = document.getElementById('edital-filter-disc').value;
            const topicFilter = document.getElementById('edital-filter-topic').value;

            updateEditalTopicsFilter();
            const _ps=getPrioritySettings();const _prog=new Map(userProgress.map(u=>[u.id,u]));

            let list = [...masterEditalData];
            if (discFilter !== 'all') {
                list = list.filter(i => i.discipline === discFilter);
            }
            if (topicFilter !== 'all') {
                list = list.filter(i => i.topic === topicFilter);
            }

            const grouped = {};
            list.forEach(i => {
                if (!grouped[i.discipline]) grouped[i.discipline] = [];
                grouped[i.discipline].push(i);
            });

            if (Object.keys(grouped).length === 0) {
                container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Nenhum tópico encontrado com os filtros selecionados.</p>`;
                return;
            }

            Object.keys(grouped).forEach(disc => {
                const topics = grouped[disc];
                const div = document.createElement('div');
                div.className = 'edital-discipline-wrap';
                
                let topicsHtml = '';
                topics.forEach(t => {
                    const u = _prog.get(t.id);
                    const isCompleted = u ? u.completed : false;
                    const hours = u ? u.hours : 0;
                    const questions = u ? u.questions : 0;
                    const reviews = u ? u.reviews : 0;

                    topicsHtml += `
                        <label class="flex items-start space-x-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 transition">
                            <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window._openEditalDiscipline='${escapeHtml(disc)}';toggleItem('${t.id}');renderPriorityDisciplineProgress();renderEditalVerticalizado();" class="w-4 h-4 text-blue-600 rounded border-slate-300 mt-0.5">
                            <div class="flex-1">
                                <div class="text-xs font-bold text-slate-800 dark:text-slate-100">${t.topic}</div>
                                <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">${t.subtopic}</div>
                                <div class="text-[10px] text-slate-500 flex flex-wrap items-center gap-2 mt-1.5">
                                    <span>Prioridade: <strong style="color:${_ps[t.priority]?.color||'#64748b'}">${escapeHtml(_ps[t.priority]?.label||t.priority||'Média')}</strong></span>
                                    <span>•</span>
                                    <span>Peso: <strong>${t.weight}</strong></span>
                                    <span>•</span>
                                    <span>Horas: <strong>${fmtHoras(hours)}</strong></span>
                                    <span>•</span>
                                    <span>Questões: <strong>${questions}</strong></span>
                                    <span>•</span>
                                    <span>Revisões: <strong>${reviews}</strong></span>
                                </div>
                            </div>
                        </label>
                    `;
                });

                const completedInDisc = topics.filter(t => {
                    const u = _prog.get(t.id);
                    return u && u.completed;
                }).length;

                const pct=topics.length?Math.round(completedInDisc/topics.length*100):0;
                const opened=(window._openEditalDiscipline===disc);
                div.innerHTML = `
                    <details class="edital-group" ${opened?'open':''} ontoggle="window._openEditalDiscipline=this.open?this.dataset.discipline:null" data-discipline="${escapeHtml(disc)}">
                      <summary>
                        <span class="gauge" style="--gauge-pct:${pct}%;--gauge-color:#0a5cad"><span>${pct}%</span></span>
                        <span class="min-w-0 flex-1"><span class="block font-bold text-sm text-slate-800 dark:text-slate-100">${escapeHtml(disc)}</span><span class="block text-[11px] text-slate-500 mt-1">${completedInDisc}/${topics.length} tópicos concluídos</span></span>
                        <i class="fa-solid fa-chevron-right edital-chevron"></i>
                      </summary>
                      <div class="edital-topic-list space-y-2">${topicsHtml}</div>
                    </details>
                `;
                container.appendChild(div);
            });
        }

