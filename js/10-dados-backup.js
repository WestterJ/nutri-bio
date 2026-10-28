// 10-dados-backup.js — saveData, cabeçalho do concurso, configurações do Supabase, reset e backup (exportar/importar).
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        function updateContestHeader() {
            const cfg=contests[activeContest]||{};
            const name=cfg.name||activeContest||'Concurso selecionado';
            refreshContestSubtitle();
            renderContestSelector();
            const date=cfg.date||'';document.getElementById('countdown-badge').dataset.examDate=date;updateCountdown();
            const caption=document.getElementById('edital-contest-caption');if(caption)caption.textContent=`Conteúdo programático de ${name}, dividido por tópico e subtópico.`;
        }

        function loadSupabaseSettings() {
            const url = localStorage.getItem('tce_sb_url') || ((window.PLANEJADOR_SUPABASE||{}).url||'');
            const key = localStorage.getItem('tce_sb_key') || '';
            document.getElementById('sb-url').value = url;
            document.getElementById('sb-key').value = key;
            document.getElementById('sb-email').value = localStorage.getItem('tce_sb_email') || '';
            if (url && key) initializeSupabase();
            if (sbClient) {
                sbClient.auth.getSession().then(async ({ data }) => {
                    if (data.session) {
                        sbUser = data.session.user;
                        document.getElementById('sb-email').value = sbUser.email || '';
                        updateCloudStatus('Sessão ativa: ' + (sbUser.email || 'usuário'));
                    }
                });
            }
        }

        function confirmReset() {
            showCustomDialog(
                'Resetar Dados',
                'Deseja realmente resetar todo o progresso?',
                'fa-solid fa-triangle-exclamation',
                () => {
                    addTombstones('sessions', studySessions.map(x => x.id));
                    userProgress = JSON.parse(JSON.stringify(masterEditalData));
                    studySessions = [];
                    localStorage.setItem('tce_go_pro_sessions', JSON.stringify(studySessions));
                    saveData();
                    initCronogramaFilters(); initRegistrationForm(); renderSessionsList(); renderRecentRotation(); renderPriorityDisciplineProgress(); renderDashboard();
                    showCustomDialog('Sucesso', 'Dados reiniciados com sucesso!', 'fa-solid fa-circle-check');
                }
            );
        }

        function exportData() {
            try {
                // O backup inclui todos os concursos e snapshots locais, sem credenciais Supabase.
                saveCurrentContestSnapshot(activeContest);
                const backup={
                    app:'Planejador de Estudos',
                    backupVersion:2,
                    exportedAt:new Date().toISOString(),
                    activeContest,
                    contests:{...contests},
                    contestSnapshots:collectContestSnapshots(),
                    // Mantidos para compatibilidade com leitores antigos, referem-se ao concurso ativo.
                    userProgress,
                    studySessions,
                    masterEditalData
                };
                const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
                const url=URL.createObjectURL(blob);
                const dlAnchor=document.createElement('a');
                dlAnchor.href=url;dlAnchor.download='planejador_estudos_backup_completo.json';
                document.body.appendChild(dlAnchor);dlAnchor.click();dlAnchor.remove();
                setTimeout(()=>URL.revokeObjectURL(url),1000);
                showCustomDialog('Backup completo gerado',`O arquivo inclui ${Object.keys(backup.contests).length} concurso(s) cadastrado(s), seus editais, progresso, históricos e personalizações. Guarde uma cópia fora do dispositivo.`);
            } catch(error) {
                showCustomDialog('Falha ao exportar backup',String(error.message||error));
            }
        }

        function applyImportedBackup(parsed) {
            const now=new Date().toISOString();
            const importedSnapshots=parsed.contestSnapshots && typeof parsed.contestSnapshots==='object' && !Array.isArray(parsed.contestSnapshots) ? parsed.contestSnapshots : null;
            const hasContestBackup=!!importedSnapshots || (parsed.contests && typeof parsed.contests==='object');
            if(hasContestBackup) {
                const incomingContests=parsed.contests && typeof parsed.contests==='object' && !Array.isArray(parsed.contests)?parsed.contests:{};
                contests={...contests,...incomingContests};
                if(importedSnapshots) {
                    const normalized={};
                    Object.entries(importedSnapshots).forEach(([id,snap])=>{
                        if(!id || !snap || typeof snap!=='object') return;
                        normalized[id]={...snap,_snapshotUpdatedAt:now};
                    });
                    persistSnapshotMapToLocal(normalized);
                    Object.keys(normalized).forEach(id=>{if(!contests[id])contests[id]={name:normalized[id]?.contestName||id,board:'',date:''};});
                }
                if(parsed.activeContest) activeContest=parsed.activeContest;
                if(!contests[activeContest]) contests[activeContest]={name:activeContest===DEFAULT_CONTEST_ID?DEFAULT_CONTEST_NAME:activeContest,board:'',date:''};
                localStorage.setItem('tce_active_contest',activeContest);
                localStorage.setItem('tce_contests',JSON.stringify(contests));
                const importedActive=importedSnapshots && importedSnapshots[activeContest];
                if(importedActive) restoreSnapshotToMemory({...importedActive,_snapshotUpdatedAt:now});
                else {
                    if(Array.isArray(parsed.masterEditalData)) masterEditalData=parsed.masterEditalData;
                    if(Array.isArray(parsed.userProgress)) userProgress=parsed.userProgress;
                    if(Array.isArray(parsed.studySessions)) studySessions=parsed.studySessions;
                }
                // Stamp the selected contest as current and persist all of the merged backup.
                localStorage.setItem('tce_contest_data_'+activeContest,JSON.stringify(buildCurrentSnapshotForStorage(now)));
                localStorage.setItem('tce_go_pro_data',JSON.stringify(userProgress));
                localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));
                localStorage.setItem('tce_master_edital',JSON.stringify(masterEditalData));
                renderContestSelector();
                initCronogramaFilters();initRegistrationForm();initEditalFilters();renderSessionsList();renderRecentRotation();renderPriorityDisciplineProgress();renderDashboard();renderCustomization();updateContestHeader();applyPriorityColors();
                saveData();
                showCustomDialog('Backup restaurado com mesclagem',`Foram importados ${importedSnapshots?Object.keys(importedSnapshots).length:0} snapshot(s). Os concursos que já existiam e não estão no arquivo foram preservados. A sincronização com a nuvem será mesclada com os outros concursos remotos.`);
                return;
            }
            // Formato antigo V1–V5: só contém progresso e sessões do concurso ativo.
            if(Array.isArray(parsed.userProgress)) userProgress=parsed.userProgress;
            else throw new Error('O JSON não contém um backup reconhecido do Planejador.');
            if(Array.isArray(parsed.studySessions)) studySessions=parsed.studySessions;
            if(Array.isArray(parsed.masterEditalData)) masterEditalData=parsed.masterEditalData;
            localStorage.setItem('tce_go_pro_data',JSON.stringify(userProgress));
            localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));
            saveData();
            initCronogramaFilters();renderSessionsList();renderRecentRotation();renderPriorityDisciplineProgress();renderDashboard();renderEditalVerticalizado();
            showCustomDialog('Backup antigo importado','Este JSON antigo contém somente o progresso e as sessões do concurso que estava ativo. Os outros concursos foram preservados no dispositivo e na mesclagem da nuvem, mas não podem ser recuperados de um arquivo que nunca os incluiu.');
        }

        function importData(event) {
            const file=event.target.files && event.target.files[0];
            if(!file)return;
            const reader=new FileReader();
            reader.onload=function(e){
                try {
                    const parsed=JSON.parse(e.target.result);
                    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw new Error('Formato JSON inválido.');
                    const isFull=!!(parsed.contestSnapshots || parsed.contests);
                    const count=isFull?Object.keys(parsed.contestSnapshots||{}).length:1;
                    showCustomDialog('Confirmar importação',isFull
                        ? `O backup contém ${Object.keys(parsed.contests||{}).length} concurso(s) e ${count} snapshot(s). Os dados dos IDs presentes no arquivo serão restaurados, e concursos que só existam atualmente serão preservados. Deseja continuar?`
                        : 'Este é um backup antigo, limitado ao concurso ativo. Ele substituirá o progresso e as sessões desse concurso, sem excluir os outros concursos. Deseja continuar?',
                        'fa-solid fa-triangle-exclamation',()=>{try{applyImportedBackup(parsed);}catch(error){showCustomDialog('Não foi possível importar',String(error.message||error));}});
                } catch(error) {
                    showCustomDialog('Erro', 'Arquivo JSON inválido ou incompatível. '+String(error.message||error), 'fa-solid fa-circle-xmark');
                } finally {
                    event.target.value='';
                }
            };
            reader.onerror=()=>showCustomDialog('Falha ao ler arquivo','Não foi possível ler o arquivo JSON selecionado.');
            reader.readAsText(file);
        }

