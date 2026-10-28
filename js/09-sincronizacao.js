// 09-sincronizacao.js — Supabase: login, mesclagem de dados, sincronização e salvamento na nuvem.
// Planejador de Estudos V10.7 (ver ARQUITETURA.md). Scripts clássicos compartilham o escopo global: a ORDEM de carga em index.html importa.
        // Supabase: mantém o funcionamento local e sincroniza os dados do usuário autenticado.
        let sbClient = null;
        let sbUser = null;
        let cloudSaveTimer = null;
        let cloudSaveInFlight = false;
        let cloudSaveQueued = false;
        let dataRevision = 0;
        let startupSyncUid = null;
        let cloudStatusPollTimer = null;
        const SB_TABLE = 'study_planner_data';

        function collectContestSnapshots() {
            const snapshots={};
            try {
                for(let i=0;i<localStorage.length;i++){
                    const key=localStorage.key(i);
                    if(!key || !key.startsWith('tce_contest_data_')) continue;
                    try {
                        const id=key.slice('tce_contest_data_'.length);
                        const snap=JSON.parse(localStorage.getItem(key));
                        if(!snap || typeof snap!=='object') continue;
                        snap.prioritySettings=JSON.parse(localStorage.getItem('tce_'+id+'_priority_settings')||JSON.stringify(snap.prioritySettings||{}));
                        snap.disciplineSettings=JSON.parse(localStorage.getItem('tce_'+id+'_discipline_settings')||JSON.stringify(snap.disciplineSettings||{}));
                        snap.suggestionMode=localStorage.getItem('tce_'+id+'_suggestion_mode')||snap.suggestionMode||'priority_progress';
                        snap.deleted=unionTombstones(getTombstones(id),snap.deleted);
                        snapshots[id]=snap;
                    } catch(e) { console.warn('Snapshot local ignorado:',key,e); }
                }
                const old=(()=>{try{return JSON.parse(localStorage.getItem('tce_contest_data_'+activeContest)||'{}')||{};}catch(e){return {};}})();
                snapshots[activeContest]={contestName:contests[activeContest]?.name||activeContest,masterEditalData,userProgress,studySessions,prioritySettings:getPrioritySettings(),disciplineSettings:getDisciplineSettings(),suggestionMode:getSuggestionMode(),deleted:getTombstones(activeContest),_snapshotUpdatedAt:old._snapshotUpdatedAt||new Date().toISOString()};
            } catch(e) { console.warn('Não foi possível reunir os snapshots dos concursos',e); }
            return snapshots;
        }

        function buildCurrentCloudPayload(timestamp=new Date().toISOString()) {
            const activeSnapshot={contestName:contests[activeContest]?.name||activeContest,masterEditalData,userProgress,studySessions,prioritySettings:getPrioritySettings(),disciplineSettings:getDisciplineSettings(),suggestionMode:getSuggestionMode(),deleted:getTombstones(activeContest),_snapshotUpdatedAt:timestamp};
            localStorage.setItem('tce_contest_data_'+activeContest,JSON.stringify(activeSnapshot));
            return {userProgress,studySessions,masterEditalData,activeContest,contests:{...contests},prioritySettings:getPrioritySettings(),disciplineSettings:getDisciplineSettings(),suggestionMode:getSuggestionMode(),contestSnapshots:collectContestSnapshots()};
        }

        // Mescla os registros por ID em vez de escolher cegamente um snapshot inteiro.
        // Em conflitos de progresso, conserva o maior valor numérico, não apaga conclusões,
        // e combina anotações diferentes para que nenhum texto seja perdido silenciosamente.
        function mergeNoteValues(remoteValue, localValue) {
            const values=[];
            [remoteValue,localValue].forEach(value=>{
                if(value===null || value===undefined) return;
                // Uma anotação já mesclada pode conter vários fragmentos; separe-os para
                // evitar repetir a mesma observação a cada sincronização entre dispositivos.
                String(value).split(/\s*\|\s*/g).forEach(part=>{
                    const text=part.trim();
                    if(text && !values.includes(text)) values.push(text);
                });
            });
            return values.join(' | ');
        }
        function mergeRecordValue(field, remoteValue, localValue, preferLocal) {
            if(remoteValue===undefined || remoteValue===null || remoteValue==='') return localValue===undefined?remoteValue:localValue;
            if(localValue===undefined || localValue===null || localValue==='') return remoteValue;
            if(JSON.stringify(remoteValue)===JSON.stringify(localValue)) return remoteValue;
            if(field==='notes') return mergeNoteValues(remoteValue,localValue);
            if(field==='completed') return Boolean(remoteValue || localValue);
            if(field==='isReview') return Math.max(Number(remoteValue)||0,Number(localValue)||0) ? 1 : 0;
            if(['hours','questions','reviews','minutes'].includes(field)) {
                const r=Number(remoteValue), l=Number(localValue);
                if(Number.isFinite(r) && Number.isFinite(l)) return Math.max(r,l);
            }
            if(Array.isArray(remoteValue) && Array.isArray(localValue)) {
                const values=[...remoteValue];
                localValue.forEach(v=>{if(!values.some(x=>JSON.stringify(x)===JSON.stringify(v)))values.push(v);});
                return values;
            }
            if(remoteValue && localValue && typeof remoteValue==='object' && typeof localValue==='object') return {...remoteValue,...localValue};
            return preferLocal ? localValue : remoteValue;
        }
        function mergeRecordLists(remoteList, localList, preferLocal) {
            const merged=[]; const indexByKey=new Map();
            const addOrMerge=(item,source)=>{
                if(!item || typeof item!=='object') return;
                const key=(item.id!==undefined && item.id!==null && String(item.id)!=='') ? 'id:'+String(item.id) : 'json:'+JSON.stringify(item);
                if(!indexByKey.has(key)) { indexByKey.set(key,merged.length); merged.push({...item}); return; }
                const idx=indexByKey.get(key), existing=merged[idx];
                if(source==='local') {
                    const result={...existing,...item};
                    const fields=new Set([...Object.keys(existing),...Object.keys(item)]);
                    fields.forEach(field=>{result[field]=mergeRecordValue(field,existing[field],item[field],preferLocal);});
                    merged[idx]=result;
                }
            };
            (Array.isArray(remoteList)?remoteList:[]).forEach(item=>addOrMerge(item,'remote'));
            (Array.isArray(localList)?localList:[]).forEach(item=>addOrMerge(item,'local'));
            return merged;
        }
        function mergeSettingsObjects(remoteValue, localValue, preferLocal) {
            const remote=(remoteValue && typeof remoteValue==='object' && !Array.isArray(remoteValue))?remoteValue:{};
            const local=(localValue && typeof localValue==='object' && !Array.isArray(localValue))?localValue:{};
            const merged={...remote};
            Object.entries(local).forEach(([key,value])=>{
                const current=remote[key];
                if(value && typeof value==='object' && !Array.isArray(value)) merged[key]=mergeSettingsObjects(current,value,preferLocal);
                else if(value!==undefined && value!==null && value!=='' && (!Object.prototype.hasOwnProperty.call(remote,key) || preferLocal)) merged[key]=value;
                else if(!Object.prototype.hasOwnProperty.call(remote,key)) merged[key]=value;
            });
            return merged;
        }
        function mergeContestSnapshot(remoteSnap, localSnap) {
            const remote=(remoteSnap && typeof remoteSnap==='object')?remoteSnap:{};
            const local=(localSnap && typeof localSnap==='object')?localSnap:{};
            const remoteTime=Date.parse(remote._snapshotUpdatedAt||'')||0;
            const localTime=Date.parse(local._snapshotUpdatedAt||'')||0;
            const preferLocal=localTime>=remoteTime;
            const dead=unionTombstones(remote.deleted,local.deleted);
            const deadItems=new Set(dead.items),deadSessions=new Set(dead.sessions);
            return {
                ...remote,
                ...local,
                contestName: local.contestName || remote.contestName,
                masterEditalData: mergeRecordLists(remote.masterEditalData,local.masterEditalData,preferLocal).filter(x=>!deadItems.has(String(x.id))),
                userProgress: mergeRecordLists(remote.userProgress,local.userProgress,preferLocal).filter(x=>!deadItems.has(String(x.id))),
                studySessions: mergeRecordLists(remote.studySessions,local.studySessions,preferLocal).filter(x=>!deadSessions.has(String(x.id))),
                deleted: dead,
                prioritySettings: mergeSettingsObjects(remote.prioritySettings,local.prioritySettings,preferLocal),
                disciplineSettings: mergeSettingsObjects(remote.disciplineSettings,local.disciplineSettings,preferLocal),
                suggestionMode: (preferLocal && local.suggestionMode) ? local.suggestionMode : (remote.suggestionMode || local.suggestionMode || 'priority_progress'),
                _snapshotUpdatedAt: new Date(Math.max(remoteTime,localTime,Date.now())).toISOString()
            };
        }
        function mergeContestSnapshots(remotePayload, localPayload) {
            const remoteSnapshots=(remotePayload && remotePayload.contestSnapshots && typeof remotePayload.contestSnapshots==='object')?remotePayload.contestSnapshots:{};
            const localSnapshots=(localPayload && localPayload.contestSnapshots && typeof localPayload.contestSnapshots==='object')?localPayload.contestSnapshots:{};
            const merged={...remoteSnapshots};
            // Compatibilidade com versões antigas que só guardavam o concurso ativo no nível principal.
            const remoteActive=remotePayload && remotePayload.activeContest;
            if(remoteActive && !merged[remoteActive] && (Array.isArray(remotePayload.masterEditalData)||Array.isArray(remotePayload.userProgress))) {
                merged[remoteActive]={contestName:remotePayload.contests?.[remoteActive]?.name||remoteActive,masterEditalData:remotePayload.masterEditalData||[],userProgress:remotePayload.userProgress||remotePayload.masterEditalData||[],studySessions:remotePayload.studySessions||[],prioritySettings:remotePayload.prioritySettings||{},disciplineSettings:remotePayload.disciplineSettings||{},suggestionMode:remotePayload.suggestionMode||'priority_progress'};
            }
            Object.entries(localSnapshots).forEach(([id,localSnap])=>{
                if(!localSnap || typeof localSnap!=='object') return;
                const remoteSnap=merged[id];
                merged[id]=remoteSnap ? mergeContestSnapshot(remoteSnap,localSnap) : localSnap;
            });
            return merged;
        }

        async function upsertCloudPayloadSafely(localPayload, uid) {
            if(!sbClient || !uid) throw new Error('Sessão Supabase não disponível.');
            const {data:remoteRow,error:readError}=await sbClient.from(SB_TABLE).select('data').eq('user_id',uid).maybeSingle();
            if(readError) throw readError; // Nunca tenta gravar por cima se não conseguiu ler a cópia atual.
            const remotePayload=remoteRow && remoteRow.data && typeof remoteRow.data==='object'?remoteRow.data:{};
            const remoteIds=Object.keys((remotePayload.contests&&typeof remotePayload.contests==='object')?remotePayload.contests:{}).concat(Object.keys((remotePayload.contestSnapshots&&typeof remotePayload.contestSnapshots==='object')?remotePayload.contestSnapshots:{}));
            if(isPristineLocalState()&&remoteIds.some(id=>id!==DEFAULT_CONTEST_ID)){
                localPayload={...localPayload,contests:{},contestSnapshots:{},activeContest:(remotePayload.activeContest&&remotePayload.activeContest!==DEFAULT_CONTEST_ID)?remotePayload.activeContest:remoteIds.find(id=>id!==DEFAULT_CONTEST_ID)};
            }
            const mergedSnapshots=mergeContestSnapshots(remotePayload,localPayload);
            const remoteContests=remotePayload.contests && typeof remotePayload.contests==='object'?remotePayload.contests:{};
            const localContests=localPayload.contests && typeof localPayload.contests==='object'?localPayload.contests:{};
            const mergedContests={...remoteContests};
            Object.entries(localContests).forEach(([id,localCfg])=>{
                const remoteCfg=remoteContests[id];
                if(!remoteCfg) { mergedContests[id]=localCfg; return; }
                if(id===localPayload.activeContest) { mergedContests[id]={...remoteCfg,...localCfg}; return; }
                const localTime=Date.parse(localCfg?._updatedAt||'')||0;
                const remoteTime=Date.parse(remoteCfg?._updatedAt||'')||0;
                // Não deixar um nome genérico reconstruído a partir do ID apagar o nome remoto conhecido.
                if(!localTime && localCfg?.name===id && remoteCfg?.name && remoteCfg.name!==id) return;
                if(localTime && localTime>remoteTime) mergedContests[id]={...remoteCfg,...localCfg};
            });
            Object.keys(mergedSnapshots).forEach(id=>{
                if(!mergedContests[id]) mergedContests[id]={name:mergedSnapshots[id]?.contestName||id,board:'',date:''};
            });
            const mergedPayload={...remotePayload,...localPayload,contests:mergedContests,contestSnapshots:mergedSnapshots};
            // Os campos legados do nível principal devem refletir o snapshot mesclado do concurso ativo,
            // e não uma cópia antiga de um dos dispositivos.
            const activeMerged=mergedSnapshots[localPayload.activeContest];
            if(activeMerged) Object.assign(mergedPayload,{userProgress:activeMerged.userProgress||[],studySessions:activeMerged.studySessions||[],masterEditalData:activeMerged.masterEditalData||[],prioritySettings:activeMerged.prioritySettings||{},disciplineSettings:activeMerged.disciplineSettings||{},suggestionMode:activeMerged.suggestionMode||'priority_progress'});
            const savedAt=new Date().toISOString();
            const {error:writeError}=await sbClient.from(SB_TABLE).upsert({user_id:uid,data:mergedPayload,updated_at:savedAt},{onConflict:'user_id'});
            if(writeError) throw writeError;
            return {savedAt,mergedPayload};
        }

        function persistSnapshotMapToLocal(snapshotMap) {
            Object.entries(snapshotMap||{}).forEach(([id,snapshot])=>{
                if(!snapshot || typeof snapshot!=='object') return;
                localStorage.setItem('tce_contest_data_'+id,JSON.stringify(snapshot));
                if(snapshot.prioritySettings) localStorage.setItem('tce_'+id+'_priority_settings',JSON.stringify(snapshot.prioritySettings));
                if(snapshot.disciplineSettings) localStorage.setItem('tce_'+id+'_discipline_settings',JSON.stringify(snapshot.disciplineSettings));
                if(snapshot.suggestionMode) localStorage.setItem('tce_'+id+'_suggestion_mode',snapshot.suggestionMode);
                if(snapshot.deleted) setTombstones(id,unionTombstones(getTombstones(id),snapshot.deleted));
            });
        }
        function adoptMergedCloudPayloadLocally(payload) {
            if(!payload || typeof payload!=='object') return;
            if(isPristineLocalState()&&payload.contests&&typeof payload.contests==='object'){
                const otherIds=Object.keys(payload.contests).filter(id=>id!==DEFAULT_CONTEST_ID);
                if(otherIds.length){
                    delete contests[DEFAULT_CONTEST_ID];
                    try{localStorage.removeItem('tce_contest_data_'+DEFAULT_CONTEST_ID);}catch(e){}
                    activeContest=(payload.activeContest&&payload.contests[payload.activeContest]&&payload.activeContest!==DEFAULT_CONTEST_ID)?payload.activeContest:otherIds[0];
                }
            }
            const chosenActive=activeContest;
            if(payload.contests && typeof payload.contests==='object') contests={...contests,...payload.contests};
            if(!contests[chosenActive] && payload.activeContest && contests[payload.activeContest]) activeContest=payload.activeContest;
            localStorage.setItem('tce_contests',JSON.stringify(contests));
            localStorage.setItem('tce_active_contest',activeContest);
            const snapshots=payload.contestSnapshots && typeof payload.contestSnapshots==='object'?payload.contestSnapshots:{};
            persistSnapshotMapToLocal(snapshots);
            const activeSnapshot=snapshots[activeContest];
            if(activeSnapshot) {
                restoreSnapshotToMemory(activeSnapshot);
                localStorage.setItem('tce_go_pro_data',JSON.stringify(userProgress));
                localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));
                localStorage.setItem('tce_master_edital',JSON.stringify(masterEditalData));
                if(activeSnapshot.prioritySettings) localStorage.setItem('tce_'+activeContest+'_priority_settings',JSON.stringify(activeSnapshot.prioritySettings));
                if(activeSnapshot.disciplineSettings) localStorage.setItem('tce_'+activeContest+'_discipline_settings',JSON.stringify(activeSnapshot.disciplineSettings));
                if(activeSnapshot.suggestionMode) localStorage.setItem('tce_'+activeContest+'_suggestion_mode',activeSnapshot.suggestionMode);
            }
            try { renderContestSelector(); initCronogramaFilters(); initRegistrationForm(); initEditalFilters(); renderSessionsList(); renderRecentRotation(); renderPriorityDisciplineProgress(); renderDashboard(); renderCustomization(); updateContestHeader(); applyPriorityColors(); }
            catch(error) { console.warn('Não foi possível atualizar algum painel após a mesclagem:',error); }
        }

        function saveSupabaseSettings() {
            const url = document.getElementById('sb-url').value.trim();
            const key = document.getElementById('sb-key').value.trim();
            if (!url || !key) {
                showCustomDialog('Configuração incompleta', 'Informe Project URL e a chave pública (publishable/anon).');
                return;
            }
            saveSupabaseSettingsQuietly(url,key);
            const emailField=document.getElementById('sb-email');
            if(emailField && emailField.value.trim()) localStorage.setItem('tce_sb_email',emailField.value.trim());
            updateCloudStatus('Configuração guardada; entre na conta');
            showCustomDialog('Configuração guardada', 'Agora informe o e-mail e a senha da conta do aplicativo e clique em “Entrar e sincronizar”. Depois escolha baixar os dados da nuvem ou enviar os dados locais.');
        }

        let sbClientConfigSignature = '';
        function initializeSupabase() {
            const url = (document.getElementById('sb-url').value || localStorage.getItem('tce_sb_url') || '').trim().replace(/\/$/,'');
            const key = (document.getElementById('sb-key').value || localStorage.getItem('tce_sb_key') || '').trim();
            if (!url || !key || !window.supabase || typeof window.supabase.createClient !== 'function') return false;
            try {
                const signature = url + '|' + key;
                if (!sbClient || sbClientConfigSignature !== signature) {
                    sbClient = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
                    sbClientConfigSignature = signature;
                    if (typeof window.attachPlannerAuthListener === 'function') window.attachPlannerAuthListener(sbClient);
                }
                return true;
            } catch (e) {
                updateCloudStatus('Erro na configuração');
                return false;
            }
        }

        function formatSavedAt(value) {
            if(!value) return 'ainda não salvo';
            const date=new Date(value);
            if(Number.isNaN(date.getTime())) return 'ainda não salvo';
            return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
        }
        function storageStatusKeys() {
            const uid=sbUser&&sbUser.id;
            return uid ? {
                mode:'tce_last_saved_mode_'+uid,
                local:'tce_last_local_saved_at_'+uid,
                cloud:'tce_last_cloud_saved_at_'+uid
            } : {mode:'tce_last_saved_mode_local',local:'tce_last_local_saved_at',cloud:null};
        }
        function recordLocalSave() {
            const now=new Date().toISOString();
            const keys=storageStatusKeys();
            localStorage.setItem(keys.local,now);
            localStorage.setItem(keys.mode,'Local');
            return now;
        }
        function recordCloudSave(timestamp=new Date().toISOString()) {
            if(!sbUser || !sbUser.id) return;
            const keys=storageStatusKeys();
            localStorage.setItem(keys.cloud,timestamp);
            localStorage.setItem(keys.mode,'Nuvem');
        }
        function updateCloudStatus(message) {
            const el=document.getElementById('cloud-status');if(el)el.textContent=message;
            const keys=storageStatusKeys();
            const detail=document.getElementById('cloud-save-detail');
            if(detail){
                const localAt=localStorage.getItem(keys.local);
                const cloudAt=keys.cloud?localStorage.getItem(keys.cloud):null;
                detail.textContent=`${message}. Último salvamento local: ${formatSavedAt(localAt)}. Última atualização confirmada na nuvem: ${sbUser?formatSavedAt(cloudAt):'não conectado'}. O horário da nuvem é consultado no servidor.`;
            }
            const button=document.getElementById('header-cloud-status');
            if(!button)return;
            const modeValue=localStorage.getItem(keys.mode)||'Local';
            const cloud=!!(sbUser && keys.cloud && modeValue==='Nuvem' && localStorage.getItem(keys.cloud));
            const mode=cloud?'Nuvem':'Local';
            const savedAt=cloud?localStorage.getItem(keys.cloud):localStorage.getItem(keys.local);
            const savedLabel=formatSavedAt(savedAt);
            button.classList.remove('local','cloud','error');
            button.classList.add(cloud?'cloud':'local');
            button.innerHTML=`<i class="fa-solid ${cloud?'fa-cloud-arrow-up':'fa-hard-drive'}"></i><span id="header-cloud-status-text">${mode} · ${savedLabel}</span>`;
            button.title=`${cloud?'Última atualização confirmada na nuvem':'Último salvamento local'}: ${savedLabel}. Clique para abrir as configurações.`;
        }

        async function testSupabaseConnection() {
            const url=(document.getElementById('sb-url').value||localStorage.getItem('tce_sb_url')||'').trim().replace(/\/$/,'');
            const key=(document.getElementById('sb-key').value||localStorage.getItem('tce_sb_key')||'').trim();
            if(!url||!key)return showCustomDialog('Dados de conexão necessários','Informe a URL do projeto e a chave pública, depois clique em Salvar conexão.');
            if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))return showCustomDialog('Confira a URL','Informe a URL base do projeto, no formato https://seu-projeto.supabase.co, sem caminhos extras.');
            updateCloudStatus('Testando conexão...');
            try {
                const resp=await fetch(url+'/auth/v1/health',{method:'GET',headers:{apikey:key}});
                if(!resp.ok) {
                    const detail=(await resp.text()).slice(0,300);
                    updateCloudStatus('Falha no teste de conexão');
                    return showCustomDialog('A API respondeu com erro',`HTTP ${resp.status}. Verifique se a URL e a chave pública pertencem ao mesmo projeto. ${detail}`);
                }
                const health=await resp.json().catch(()=>({}));
                saveSupabaseSettingsQuietly(url,key);
                let detail='A API de autenticação do projeto respondeu corretamente.';
                if(sbUser && sbClient){
                    const {error}=await sbClient.from(SB_TABLE).select('user_id').limit(1);
                    if(error) detail+=' A API respondeu, mas a tabela '+SB_TABLE+' não pôde ser lida nesta sessão: '+error.message;
                    else detail+=' A tabela '+SB_TABLE+' também respondeu para a conta conectada.';
                } else detail+=' Próximo passo: entre com e-mail ou Google para testar o acesso protegido aos dados.';
                updateCloudStatus('Conexão com Supabase validada');
                showCustomDialog('Conexão validada',detail,'fa-solid fa-circle-check');
            } catch(e) {
                updateCloudStatus('Falha no teste de conexão');
                showCustomDialog('Não foi possível testar',`O navegador não conseguiu alcançar a API. Confira sua internet, URL e chave. Detalhe: ${e.message}`);
            }
        }
        function saveSupabaseSettingsQuietly(url,key){
            localStorage.setItem('tce_sb_url',url);localStorage.setItem('tce_sb_key',key);
            document.getElementById('sb-url').value=url;document.getElementById('sb-key').value=key;
            initializeSupabase();
        }
        async function signInWithGoogleSupabase(){
            if(location.protocol==='file:') return showCustomDialog('O Google OAuth precisa de um endereço web','Abra o Planejador em um endereço HTTPS (site hospedado) ou em localhost e cadastre esse endereço em Supabase → Authentication → URL Configuration. Um arquivo HTML aberto diretamente do computador não é um endereço de retorno OAuth válido.');
            if(!initializeSupabase())return showCustomDialog('Configure a conexão','Informe a URL e chave pública do projeto Supabase e clique em Salvar conexão.');
            const redirectTo=window.location.origin+window.location.pathname;
            const {error}=await sbClient.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
            if(error)showCustomDialog('Não foi possível iniciar o Google OAuth',error.message+' Confira se o provedor Google está habilitado em Authentication → Sign In / Providers e se esta URL está na lista de Redirect URLs.');
        }

        async function signInSupabase() {
            const url=(document.getElementById('sb-url').value||'').trim().replace(/\/$/,'');
            const key=(document.getElementById('sb-key').value||'').trim();
            if (!url || !key) return showCustomDialog('Configuração necessária', 'Informe a URL do projeto e a chave pública.');
            if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) return showCustomDialog('URL inválida', 'Use a URL base do projeto, como https://seu-projeto.supabase.co.');
            saveSupabaseSettingsQuietly(url,key);
            if (!initializeSupabase()) return showCustomDialog('Configuração necessária', 'Não foi possível iniciar o cliente Supabase. Confira a URL e a chave pública.');
            const email = document.getElementById('sb-email').value.trim();
            const password = document.getElementById('sb-password').value;
            if (!email || !password) return showCustomDialog('Dados necessários', 'Informe e-mail e senha.');
            localStorage.setItem('tce_sb_email',email);
            updateCloudStatus('Conectando...');
            const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
            if (error) {
                updateCloudStatus('Falha no login');
                return showCustomDialog('Não foi possível entrar', error.message);
            }
            sbUser = data.user;
            updateCloudStatus('Conectado: ' + email);
            await resolveInitialCloudSync();
        }

        async function signUpSupabase() {
            const url=(document.getElementById('sb-url').value||'').trim().replace(/\/$/,'');
            const key=(document.getElementById('sb-key').value||'').trim();
            if (!url || !key) return showCustomDialog('Configuração necessária', 'Informe a URL do projeto e a chave pública.');
            if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) return showCustomDialog('URL inválida', 'Use a URL base do projeto, como https://seu-projeto.supabase.co.');
            saveSupabaseSettingsQuietly(url,key);
            if (!initializeSupabase()) return showCustomDialog('Configuração necessária', 'Não foi possível iniciar o cliente Supabase. Confira a URL e a chave pública.');
            const email = document.getElementById('sb-email').value.trim();
            const password = document.getElementById('sb-password').value;
            if (!email || password.length < 6) return showCustomDialog('Dados necessários', 'Informe o e-mail e uma senha com pelo menos 6 caracteres.');
            localStorage.setItem('tce_sb_email',email);
            const { data, error } = await sbClient.auth.signUp({ email, password });
            if (error) return showCustomDialog('Erro ao criar conta', error.message);
            if (data.session) {
                sbUser = data.user;
                updateCloudStatus('Conta criada e conectada');
                await resolveInitialCloudSync();
            } else {
                showCustomDialog('Verifique seu e-mail', 'A conta foi solicitada. Confirme o e-mail se a verificação estiver habilitada e depois entre.');
            }
        }

        async function signOutSupabase() {
            if (sbClient) await sbClient.auth.signOut();
            sbUser = null;
            updateCloudStatus('Sessão encerrada; dados locais preservados');
        }

        async function resolveInitialCloudSync() {
            const { data, error } = await sbClient.from(SB_TABLE).select('data, updated_at').eq('user_id', sbUser.id).maybeSingle();
            if (error) {
                updateCloudStatus('Erro ao ler nuvem');
                return showCustomDialog('Erro de sincronização', error.message + '\\nConfira se criou a tabela e as políticas RLS do SQL fornecido.');
            }
            if (!data) {
                showCustomDialog('Primeira sincronização', 'Ainda não há dados na nuvem para esta conta. Escolha “Enviar dados atuais à nuvem” para gravar o progresso deste navegador.');
                updateCloudStatus('Conectado; nuvem ainda vazia');
                return;
            }
            if(data.updated_at) {
                const keys=storageStatusKeys();
                if(keys.cloud) localStorage.setItem(keys.cloud,data.updated_at);
                if(!localStorage.getItem(keys.mode)) localStorage.setItem(keys.mode,'Nuvem');
            }
            showCustomDialog('Dados encontrados na nuvem', 'Para evitar sobrescrever seu progresso, abra “Sincronização manual e recuperação (avançado)” abaixo e escolha “Baixar dados da nuvem” para carregar os dados remotos ou “Enviar dados atuais à nuvem” para mesclar os concursos locais com os remotos. A sincronização preserva concursos remotos que não estão ativos neste navegador.');
            updateCloudStatus('Conectado; dados remotos encontrados');
        }

        async function refreshCloudTimestampFromServer() {
            if(!sbClient || !sbUser || document.visibilityState==='hidden') return;
            try {
                const {data,error}=await sbClient.from(SB_TABLE).select('updated_at').eq('user_id',sbUser.id).maybeSingle();
                if(error) throw error;
                if(data && data.updated_at) {
                    recordCloudSave(data.updated_at);
                    updateCloudStatus('Conectado à nuvem');
                }
            } catch(error) {
                console.warn('Não foi possível atualizar o horário confirmado da nuvem:',error);
            }
        }
        function startCloudTimestampPolling() {
            if(cloudStatusPollTimer) clearInterval(cloudStatusPollTimer);
            cloudStatusPollTimer=setInterval(()=>refreshCloudTimestampFromServer(),30000);
            document.addEventListener('visibilitychange',()=>{
                if(document.visibilityState==='visible') refreshCloudTimestampFromServer();
            });
            window.addEventListener('focus',()=>refreshCloudTimestampFromServer());
        }

        async function syncSupabase(mode) {
            if (!sbClient || !sbUser) {
                if (!initializeSupabase()) return showCustomDialog('Configuração necessária', 'Informe e guarde as configurações e entre na conta primeiro.');
                const { data } = await sbClient.auth.getUser();
                sbUser = data && data.user ? data.user : null;
            }
            if (!sbUser) return showCustomDialog('Entre primeiro', 'Faça login antes de sincronizar.');
            updateCloudStatus('Sincronizando...');
            if (mode === 'upload') {
                try {
                    const payload=buildCurrentCloudPayload();
                    const syncResult=await upsertCloudPayloadSafely(payload,sbUser.id);
                    adoptMergedCloudPayloadLocally(syncResult.mergedPayload);
                    recordCloudSave(syncResult.savedAt);updateCloudStatus('Sincronizado com a nuvem');
                    return showCustomDialog('Sincronização concluída','Os registros locais e remotos foram mesclados por item. Os lançamentos recebidos da nuvem também foram aplicados neste dispositivo.');
                } catch(error) {
                    updateCloudStatus('Erro ao enviar');
                    return showCustomDialog('Falha ao enviar',String(error.message||error)+'\nNada foi enviado porque a leitura/mesclagem segura falhou. Confira a tabela e as políticas RLS.');
                }
            }
            const { data, error } = await sbClient.from(SB_TABLE).select('data, updated_at').eq('user_id', sbUser.id).maybeSingle();
            if (error) {
                updateCloudStatus('Erro ao baixar');
                return showCustomDialog('Falha ao baixar', error.message);
            }
            if (!data || !data.data) return showCustomDialog('Nuvem vazia', 'Não há dados salvos para esta conta.');

            // O download combina os mapas de concursos: o remoto vence para IDs presentes nos dois lados;
            // os concursos existentes só localmente são preservados em vez de desaparecerem.
            let localContests={};try{localContests=JSON.parse(localStorage.getItem('tce_contests')||'{}')||{};}catch(e){}
            const remoteContests=data.data.contests&&typeof data.data.contests==='object'?data.data.contests:{};
            contests={...localContests,...remoteContests};
            const localSnapshots=collectContestSnapshots();
            let remoteSnapshots=data.data.contestSnapshots&&typeof data.data.contestSnapshots==='object'?data.data.contestSnapshots:{};
            if(data.data.activeContest && !remoteSnapshots[data.data.activeContest] && (Array.isArray(data.data.masterEditalData)||Array.isArray(data.data.userProgress))) {
                remoteSnapshots={...remoteSnapshots,[data.data.activeContest]:{contestName:data.data.contests?.[data.data.activeContest]?.name||data.data.activeContest,masterEditalData:data.data.masterEditalData||[],userProgress:data.data.userProgress||data.data.masterEditalData||[],studySessions:data.data.studySessions||[],prioritySettings:data.data.prioritySettings||{},disciplineSettings:data.data.disciplineSettings||{},suggestionMode:data.data.suggestionMode||'priority_progress'}};
            }
            // Download também mescla registros de cada concurso: não substitui o snapshot local inteiro.
            const allSnapshots=mergeContestSnapshots({...data.data,contestSnapshots:remoteSnapshots},{activeContest,contestSnapshots:localSnapshots});
            // Mantém o concurso selecionado neste aparelho; só troca se ele realmente não existir.
            if(!contests[activeContest] && data.data.activeContest) activeContest=data.data.activeContest;
            if(!contests[activeContest]) contests[activeContest]={name:activeContest===DEFAULT_CONTEST_ID?DEFAULT_CONTEST_NAME:activeContest,board:'',date:''};
            Object.keys(allSnapshots).forEach(id=>{if(!contests[id])contests[id]={name:allSnapshots[id]?.contestName||id,board:'',date:''};});
            localStorage.setItem('tce_active_contest',activeContest);
            localStorage.setItem('tce_contests',JSON.stringify(contests));
            persistSnapshotMapToLocal(allSnapshots);
            const activeSnapshot=allSnapshots[activeContest];
            if(activeSnapshot) restoreSnapshotToMemory(activeSnapshot);
            else {
                if(Array.isArray(data.data.masterEditalData))masterEditalData=data.data.masterEditalData;
                if(Array.isArray(data.data.userProgress))userProgress=data.data.userProgress;
                if(Array.isArray(data.data.studySessions))studySessions=data.data.studySessions;
            }
            localStorage.setItem('tce_contest_data_'+activeContest,JSON.stringify({...buildCurrentSnapshotForStorage(),_snapshotUpdatedAt:activeSnapshot?._snapshotUpdatedAt||new Date().toISOString()}));
            localStorage.setItem('tce_go_pro_data', JSON.stringify(userProgress));
            localStorage.setItem('tce_go_pro_sessions', JSON.stringify(studySessions));
            localStorage.setItem('tce_master_edital', JSON.stringify(masterEditalData));
            renderContestSelector();
            if(data.updated_at) recordCloudSave(data.updated_at); else recordCloudSave(new Date().toISOString());
            initCronogramaFilters();renderSessionsList();renderRecentRotation();renderPriorityDisciplineProgress();renderDashboard();renderCustomization();updateContestHeader();applyPriorityColors();
            updateCloudStatus('Dados baixados da nuvem');
            showCustomDialog('Download concluído','Os dados locais e remotos foram mesclados por item. Lançamentos exclusivos de cada dispositivo foram preservados.');
        }

        function buildCurrentSnapshotForStorage(timestamp=new Date().toISOString()) {
            return {contestName:contests[activeContest]?.name||activeContest,masterEditalData,userProgress,studySessions,prioritySettings:getPrioritySettings(),disciplineSettings:getDisciplineSettings(),suggestionMode:getSuggestionMode(),deleted:getTombstones(activeContest),_snapshotUpdatedAt:timestamp};
        }

        function scheduleCloudAutoSave() {
            if(!sbClient || !sbUser){updateCloudStatus('Salvo neste dispositivo; nuvem não conectada');return;}
            clearTimeout(cloudSaveTimer);
            updateCloudStatus('Salvo localmente; aguardando sincronização automática');
            cloudSaveTimer=setTimeout(()=>syncLatestChangesToCloud(),1200);
        }
        async function syncLatestChangesToCloud() {
            if(!sbClient||!sbUser)return;
            if(cloudSaveInFlight){cloudSaveQueued=true;return;}
            cloudSaveInFlight=true;
            const uid=sbUser.id;
            try{
                do{
                    cloudSaveQueued=false;
                    const revisionAtRequest=dataRevision;
                    const payload=buildCurrentCloudPayload(new Date().toISOString());
                    const syncResult=await upsertCloudPayloadSafely(payload,uid);
                    if(!sbUser||sbUser.id!==uid){cloudSaveQueued=false;return;}
                    recordCloudSave(syncResult.savedAt);
                    if(dataRevision!==revisionAtRequest) cloudSaveQueued=true;
                    else adoptMergedCloudPayloadLocally(syncResult.mergedPayload);
                }while(cloudSaveQueued&&sbUser&&sbUser.id===uid);
                if(sbUser&&sbUser.id===uid)updateCloudStatus('Sincronizado com a nuvem');
            }catch(error){
                console.warn('Falha na sincronização automática:',error);
                updateCloudStatus('Falha na sincronização automática; dados locais preservados');
            }finally{
                cloudSaveInFlight=false;
                if(cloudSaveQueued&&sbUser&&sbUser.id===uid){cloudSaveQueued=false;scheduleCloudAutoSave();}else if(!sbUser||sbUser.id!==uid){cloudSaveQueued=false;}
            }
        }
        function saveData() {
            const savedAtLocal=new Date().toISOString();
            localStorage.setItem('tce_go_pro_data',JSON.stringify(userProgress));
            localStorage.setItem('tce_go_pro_sessions',JSON.stringify(studySessions));
            localStorage.setItem('tce_master_edital',JSON.stringify(masterEditalData));
            localStorage.setItem('tce_contests',JSON.stringify(contests));
            localStorage.setItem('tce_active_contest',activeContest);
            localStorage.setItem('tce_contest_data_'+activeContest,JSON.stringify(buildCurrentSnapshotForStorage(savedAtLocal)));
            recordLocalSave();
            dataRevision++;
            updateCloudStatus('Salvamento local realizado');
            scheduleCloudAutoSave();
        }

