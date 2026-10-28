// 12-iniciar.js — Inicialização: chamadas finais que montam a tela (deve ser o último arquivo de lógica).
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        loadSupabaseSettings();
        applyPriorityColors();
        const initialSuggestionMode=document.getElementById('study-suggestion-mode');if(initialSuggestionMode)initialSuggestionMode.value=getSuggestionMode();
        updateSuggestionModeHelp();
        if(!contests[activeContest]) contests[activeContest]={name:activeContest===DEFAULT_CONTEST_ID?DEFAULT_CONTEST_NAME:activeContest,board:'',date:''};
        renderContestSelector();
        initCronogramaFilters();
        initRegistrationForm();
        initEditalFilters();
        updateContestHeader();
        renderPriorityDisciplineProgress();
        renderRecentRotation();
        updateCloudStatus('Dados carregados neste navegador');
