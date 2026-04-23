// --- 1. CONFIGURAÇÃO DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
// 🔄 CORREÇÃO: Usando signInWithPopup (O único que funciona bem no GitHub Pages)
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHs0DW6ppjwHcYSFSpXWfczIGt2IYaE18",
  authDomain: "uniara-medicina-ligas.firebaseapp.com",
  projectId: "uniara-medicina-ligas",
  storageBucket: "uniara-medicina-ligas.firebasestorage.app",
  messagingSenderId: "556596933742",
  appId: "1:556596933742:web:c7162dab0667064875a27f"
};

const app = initializeApp(firebaseConfig);
const dbFirestore = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const uniaraRef = doc(dbFirestore, "plataforma", "dados_medicina");

// ⚠️ LISTA DE COORDENADORES ATUALIZADA
const EMAILS_ADMIN = [
    "gbraz@uniara.edu.br",
    "rmprado@uniara.edu.br",
    "eclima@uniara.edu.br",
    "vferreira@uniara.edu.br"
]; 

// VARIÁVEIS GLOBAIS
let db = { ligas: [], pesquisas: [], eventos: [], extensao: [], atividades: [], relatoriosPesquisa: [], relatoriosEvento: [], relatoriosExtensao: [] };
let currentUser = null; 
let currentPage = 'dashboard';
let graficosAtivos = [];

// --- 2. GESTÃO DE AUTENTICAÇÃO ---
function mostrarErro(mensagem, isSuccess = false) {
    const msgBox = document.getElementById('loginError');
    msgBox.innerText = mensagem;
    msgBox.style.display = 'block';
    msgBox.style.backgroundColor = isSuccess ? '#e8f5e9' : '#ffebee';
    msgBox.style.color = isSuccess ? '#2e7d32' : '#c62828';
    msgBox.style.border = `1px solid ${isSuccess ? '#c8e6c9' : '#ffcdd2'}`;
}

async function loginComGoogle() {
    const btn = document.getElementById('btnGoogleLogin');
    document.getElementById('loginError').style.display = 'none';
    btn.innerHTML = "Abrindo pop-up do Google..."; 
    btn.disabled = true;

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const email = result.user.email.toLowerCase();

        if (!email.endsWith("@uniara.edu.br") && !EMAILS_ADMIN.includes(email)) {
            await signOut(auth);
            mostrarErro("⚠️ Utilize seu e-mail institucional (@uniara.edu.br).");
            btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Entrar com Google';
            btn.disabled = false;
            return;
        }
    } catch (error) {
        console.error("Erro no Popup:", error);
        mostrarErro("A janela de login foi fechada. Permita pop-ups no seu navegador.");
        btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Entrar com Google';
        btn.disabled = false;
    }
}

onAuthStateChanged(auth, async (user) => {
    const btn = document.getElementById('btnGoogleLogin');
    if (btn) { btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Entrar com Google'; btn.disabled = false; }

    if (user) {
        const email = user.email.toLowerCase();
        
        try {
            const userRef = doc(dbFirestore, "usuarios", user.uid);
            const userDoc = await getDoc(userRef);

            // REGRA 2: Coordenadores entram direto
            if (EMAILS_ADMIN.includes(email)) {
                await setDoc(userRef, { email: email, nome: user.displayName || 'Coordenador', status: 'aprovado', role: 'admin' }, { merge: true });
                currentUser = { email: email, nome: user.displayName, role: 'admin' };
                liberarAcesso(true);
                return;
            }

            // REGRA 3: Aluno Comum
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.status === 'aprovado') {
                    currentUser = { email: email, nome: user.displayName, role: 'user' };
                    liberarAcesso(false);
                } else if (data.status === 'pendente') {
                    await signOut(auth); mostrarErro("⏳ Sua conta está em análise pela coordenação.");
                } else {
                    await signOut(auth); mostrarErro("🚫 O acesso para este e-mail foi bloqueado.");
                }
            } else {
                // REGRA 4: Primeiro acesso
                await setDoc(userRef, { email: email, nome: user.displayName || 'Aluno', status: 'pendente', dataSolicitacao: new Date().toLocaleDateString('pt-BR') });
                await signOut(auth);
                mostrarErro("✅ Cadastro solicitado com sucesso! A coordenação irá liberar seu acesso.", true);
            }
        } catch (dbError) {
            console.error("Erro no BD:", dbError);
            await signOut(auth); mostrarErro("Erro interno: Falha ao ler permissões no banco de dados.");
        }
    } else {
        currentUser = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
});

async function liberarAcesso(isAdmin) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('menuAdmin').style.display = isAdmin ? 'flex' : 'none';
    await carregarDadosIniciais();
}

function fazerLogout() { signOut(auth); }

// --- 3. CARREGAMENTO E FILTRAGEM ---
async function carregarDadosIniciais() {
    try {
        const docSnap = await getDoc(uniaraRef);
        if (docSnap.exists()) {
            db = docSnap.data();
            db.relatoriosPesquisa = db.relatoriosPesquisa || [];
            db.relatoriosEvento = db.relatoriosEvento || [];
            db.relatoriosExtensao = db.relatoriosExtensao || [];
        } else { await saveDb(); }
        renderPage('dashboard'); 
    } catch (error) { console.error("Erro Firebase:", error); }
}

async function saveDb() { 
    try { await setDoc(uniaraRef, db); } catch (error) { console.error("Erro ao salvar:", error); }
}

function getDadosPermitidos(type) {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return db[type] || [];
    return (db[type] || []).filter(item => item.autorEmail === currentUser.email);
}

// --- 4. RENDERIZAÇÃO DA TELA ---
async function renderPage(page) {
    currentPage = page;
    const content = document.getElementById('pageContent');
    
    document.querySelectorAll('.nav-link').forEach(l => {
        const onclickAttr = l.getAttribute('onclick') || '';
        l.classList.toggle('active', onclickAttr.includes(`'${page}'`));
    });

    const isAdm = currentUser?.role === 'admin';
    const cabecalhoLiga = isAdm ? ['Nome', 'Sigla', 'Tutor', 'Autor'] : ['Nome', 'Sigla', 'Tutor'];
    const cabecalhoPesq = isAdm ? ['Título', 'Caracterização', 'Tutor', 'Autor'] : ['Título', 'Caracterização', 'Tutor'];
    const cabecalhoEvent = isAdm ? ['Título', 'Data', 'Tipo', 'Autor'] : ['Título', 'Data', 'Tipo'];
    const cabecalhoExt = isAdm ? ['Título', 'Linha', 'Tutor', 'Autor'] : ['Título', 'Linha', 'Tutor'];
    const cabecalhoAtiv = isAdm ? ['Título', 'Data', 'Local', 'Autor'] : ['Título', 'Data', 'Local'];

    switch(page) {
        case 'dashboard':
            const msgAcesso = isAdm ? 'Visão Global (Coordenador)' : `Sua Visão (${currentUser?.nome})`;
            content.innerHTML = `
                <div class="page-header" style="margin-bottom: 30px;">
                    <h2>Gestão de Ligas Acadêmicas</h2>
                    <p style="color:#666; margin-top:5px;"><span class="badge">${msgAcesso}</span> Bem-vindo ao painel de controle.</p>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                    <div class="card" style="border-top: 4px solid var(--color-primary); margin-bottom: 0;"><h3>Ligas</h3><p style="font-size:28px; color:var(--color-primary); font-weight:bold;">${getDadosPermitidos('ligas').length}</p></div>
                    <div class="card" style="border-top: 4px solid #00695c; margin-bottom: 0;"><h3>Pesquisas</h3><p style="font-size:28px; color:#00695c; font-weight:bold;">${getDadosPermitidos('pesquisas').length}</p></div>
                    <div class="card" style="border-top: 4px solid #e65100; margin-bottom: 0;"><h3>Eventos</h3><p style="font-size:28px; color:#e65100; font-weight:bold;">${getDadosPermitidos('eventos').length}</p></div>
                    <div class="card" style="border-top: 4px solid #4a148c; margin-bottom: 0;"><h3>Projetos</h3><p style="font-size:28px; color:#4a148c; font-weight:bold;">${getDadosPermitidos('extensao').length}</p></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                    <div class="card">
                        <h3 style="margin-bottom: 15px; color: #555; font-size: 15px;"><span class="material-icons-round" style="font-size: 18px; vertical-align: bottom;">bar_chart</span> Produtividade Acadêmica</h3>
                        <div style="height: 250px;"><canvas id="chartProdutividade"></canvas></div>
                    </div>
                    <div class="card">
                        <h3 style="margin-bottom: 15px; color: #555; font-size: 15px;"><span class="material-icons-round" style="font-size: 18px; vertical-align: bottom;">pie_chart</span> Divisão de Eventos</h3>
                        <div style="height: 250px;"><canvas id="chartEventos"></canvas></div>
                    </div>
                </div>`;
            setTimeout(renderizarGraficos, 100);
            break;
            
        case 'ligas': content.innerHTML = renderTable('Ligas Acadêmicas', 'ligas', getDadosPermitidos('ligas'), cabecalhoLiga, 'openLigaModal()'); break;
        case 'pesquisas': content.innerHTML = renderTable('Pesquisas Científicas', 'pesquisas', getDadosPermitidos('pesquisas'), cabecalhoPesq, 'openPesquisaModal()'); break;
        case 'eventos': content.innerHTML = renderTable('Eventos Científicos', 'eventos', getDadosPermitidos('eventos'), cabecalhoEvent, 'openEventoModal()'); break;
        case 'extensao': content.innerHTML = renderTable('Projetos de Extensão', 'extensao', getDadosPermitidos('extensao'), cabecalhoExt, 'openExtensaoModal()'); break;
        case 'atividades': content.innerHTML = renderTable('Relatório de Atividades', 'atividades', getDadosPermitidos('atividades'), cabecalhoAtiv, 'openAtividadeModal()'); break;
        
        case 'admin':
            if(!isAdm) { renderPage('dashboard'); return; }
            content.innerHTML = `<div class="page-header"><h2><span class="material-icons-round" style="vertical-align: middle;">admin_panel_settings</span> Gestão de Acessos</h2><p style="color:#666;">Aprove ou bloqueie usuários da plataforma.</p></div><div id="adminList" class="card">Carregando...</div>`;
            carregarPainelAdmin();
            break;

        case 'sobre': 
            content.innerHTML = `<div class="page-header"><h2>Informações Legais e Créditos</h2></div><div class="card" style="border-left: 5px solid var(--color-primary);"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;"><div class="legal-title" style="margin-bottom: 0;">Propriedade Intelectual</div><img src="gbx-logo.png" alt="GBX Learning Tools" style="height: 35px; object-fit: contain;"></div><p style="font-size: 14px; color: #333; margin-bottom: 10px;"><strong>Desenvolvido por:</strong> GBX - Learning Tools</p><p style="font-size: 14px; color: #333; background: #f9fbfb; padding: 10px; border-radius: 5px;"><strong>Termo de Cessão:</strong> Uso restrito para as Ligas Acadêmicas do curso de Medicina da UNIARA.</p></div>`;
            break;
    }
}

// 📊 GRÁFICOS
function renderizarGraficos() {
    graficosAtivos.forEach(chart => chart.destroy());
    graficosAtivos = [];

    const ctxProd = document.getElementById('chartProdutividade');
    const ctxEvt = document.getElementById('chartEventos');
    if (!ctxProd || !ctxEvt) return;

    const chart1 = new Chart(ctxProd, {
        type: 'bar',
        data: {
            labels: ['Pesquisas', 'Eventos', 'Projetos', 'Atividades'],
            datasets: [{
                label: 'Registros',
                data: [
                    getDadosPermitidos('pesquisas').length, 
                    getDadosPermitidos('eventos').length, 
                    getDadosPermitidos('extensao').length, 
                    getDadosPermitidos('atividades').length
                ],
                backgroundColor: ['#00695c', '#e65100', '#4a148c', '#0277bd'],
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const eventosData = getDadosPermitidos('eventos');
    const tipos = { 'Simpósio': 0, 'Minicurso': 0, 'Workshop': 0 };
    eventosData.forEach(e => { if(tipos[e.tipo] !== undefined) tipos[e.tipo]++; });

    const chart2 = new Chart(ctxEvt, {
        type: 'doughnut',
        data: {
            labels: Object.keys(tipos),
            datasets: [{ data: Object.values(tipos), backgroundColor: ['#1976d2', '#388e3c', '#fbc02d'], borderWidth: 2, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } }
    });

    graficosAtivos.push(chart1, chart2);
}

function renderTable(title, type, data, headers, modalNovoFn) {
    const hasReport = ['pesquisas', 'eventos', 'extensao'].includes(type);
    let html = `<div class="card"><div class="card-header"><h2>${title}</h2><button class="btn btn-primary" onclick="${modalNovoFn}"><span class="material-icons-round">add</span> Novo Registro</button></div><div style="overflow-x:auto"><table><thead><tr>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += `<th>Ações</th></tr></thead><tbody>`;
    
    if (data.length === 0) {
        html += `<tr><td colspan="100%" style="text-align:center; padding:30px; color:#999;">Nenhum registro encontrado nesta visão.</td></tr>`;
    } else {
        data.forEach(item => {
            html += `<tr>`;
            headers.forEach(h => { let key = h.toLowerCase(); if(key === 'autor') key = 'autorNome'; html += `<td>${item[key] || '---'}</td>`; });
            let editFn = type === 'ligas' ? 'openLigaModal' : type === 'pesquisas' ? 'openPesquisaModal' : type === 'eventos' ? 'openEventoModal' : type === 'extensao' ? 'openExtensaoModal' : 'openAtividadeModal';
            html += `<td style="white-space: nowrap;"><button class="btn btn-warning" style="margin-right:6px;" onclick="${editFn}(${item.id})" title="Editar"><span class="material-icons-round">edit</span></button>`;
            if(hasReport) { html += `<button class="btn btn-success" style="margin-right:6px;" onclick="openRelatorioModal('${type}', ${item.id})" title="Relatório"><span class="material-icons-round">description</span></button>`; }
            html += `<button class="btn btn-danger" onclick="deleteItem('${type}', ${item.id})" title="Excluir"><span class="material-icons-round">delete</span></button></td></tr>`;
        });
    }
    html += `</tbody></table></div></div>`; return html;
}

// --- 5. PAINEL ADMIN ---
async function carregarPainelAdmin() {
    try {
        const querySnapshot = await getDocs(collection(dbFirestore, "usuarios"));
        let html = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Data Solicitação</th><th>Status Atual</th><th>Ação</th></tr></thead><tbody>`;
        querySnapshot.forEach((doc) => {
            const u = doc.data(); const id = doc.id;
            if (u.role === 'admin') return; 
            const isPendente = u.status === 'pendente';
            html += `<tr><td>${u.nome || '---'}</td><td>${u.email}</td><td>${u.dataSolicitacao || '---'}</td><td><span class="badge" style="background:${isPendente ? '#ffebee' : '#e8f5e9'}; color:${isPendente ? '#c62828' : '#2e7d32'};">${u.status.toUpperCase()}</span></td><td>${isPendente ? `<button class="btn btn-success" onclick="mudarStatusUsuario('${id}', 'aprovado')"><span class="material-icons-round">check</span> Aprovar</button>` : `<button class="btn btn-danger" onclick="mudarStatusUsuario('${id}', 'pendente')"><span class="material-icons-round">block</span> Bloquear</button>`}</td></tr>`;
        });
        html += `</tbody></table>`; document.getElementById('adminList').innerHTML = html;
    } catch (e) { document.getElementById('adminList').innerHTML = "Erro ao carregar usuários."; }
}
async function mudarStatusUsuario(userId, novoStatus) { if(confirm(`Alterar status para ${novoStatus.toUpperCase()}?`)) { await updateDoc(doc(dbFirestore, "usuarios", userId), { status: novoStatus }); carregarPainelAdmin(); } }

// --- 6. MODAIS E SALVAMENTO ---
function showModal(html) { const container = document.getElementById('modalContainer'); container.innerHTML = `<div class="modal active" id="activeModal"><div class="modal-content">${html}<br><button class="btn btn-secondary" style="margin-top:20px;" onclick="closeActiveModal()"><span class="material-icons-round">close</span> Fechar</button></div></div>`; }
function closeActiveModal() { const m = document.getElementById('activeModal'); if(m) m.remove(); }

function pushOrUpdate(type, id, novoDado) {
    if (id) {
        const idx = db[type].findIndex(i => i.id === id);
        if (idx !== -1) { novoDado.id = db[type][idx].id; novoDado.autorEmail = db[type][idx].autorEmail; novoDado.autorNome = db[type][idx].autorNome; db[type][idx] = novoDado; }
    } else { novoDado.id = Date.now(); novoDado.autorEmail = currentUser.email; novoDado.autorNome = currentUser.nome; db[type].push(novoDado); }
}

function openLigaModal(id = null) { const item = id ? db.ligas.find(i => i.id === id) : {}; showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${id ? 'Editar Liga' : 'Nova Liga Acadêmica'}</h3><form onsubmit="event.preventDefault(); saveLiga(${id});"><div class="form-group"><label>Nome da Liga</label><input id="lNome" class="form-control" value="${item.nome || ''}" required></div><div class="form-row"><div class="form-group"><label>Sigla</label><input id="lSigla" class="form-control" value="${item.sigla || ''}" required></div><div class="form-group"><label>Tutor Responsável</label><input id="lTutor" class="form-control" value="${item.tutor || ''}" required></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Salvar Liga</button></div></form>`); }
function openPesquisaModal(id = null) { const item = id ? db.pesquisas.find(i => i.id === id) : {}; showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${id ? 'Editar Pesquisa' : 'Pesquisa Científica'}</h3><form onsubmit="event.preventDefault(); savePesquisa(${id});"><div class="form-row"><div class="form-group"><label>Ano</label><input id="pAno" class="form-control" type="number" value="${item.ano || new Date().getFullYear()}"></div><div class="form-group"><label>Caracterização</label><select id="pCarac" class="form-control"><option ${item.caracterizacao === 'Relato de Caso' ? 'selected':''}>Relato de Caso</option><option ${item.caracterizacao === 'Relato de Experiência' ? 'selected':''}>Relato de Experiência</option><option ${item.caracterizacao === 'Revisão Bibliográfica' ? 'selected':''}>Revisão Bibliográfica</option></select></div></div><div class="form-group"><label>Título da Pesquisa</label><input id="pTitulo" class="form-control" value="${item.titulo || ''}" required></div><h4 style="margin:15px 0 10px;">Tutor Responsável</h4><div class="form-group"><label>Nome do Tutor</label><input id="pTutorNome" class="form-control" value="${item.tutor || ''}" required></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Salvar Cadastro</button></div></form>`); }
function openEventoModal(id = null) { const item = id ? db.eventos.find(i => i.id === id) : {}; showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${id ? 'Editar Evento' : 'Evento Científico'}</h3><form onsubmit="event.preventDefault(); saveEvento(${id});"><div class="form-group"><label>Título do Evento</label><input id="eTitulo" class="form-control" value="${item.titulo || ''}" required></div><div class="form-row"><div class="form-group"><label>Data</label><input id="eData" type="date" class="form-control" value="${item.data || ''}"></div><div class="form-group"><label>Tipo</label><select id="eTipo" class="form-control"><option ${item.tipo === 'Simpósio' ? 'selected':''}>Simpósio</option><option ${item.tipo === 'Minicurso' ? 'selected':''}>Minicurso</option><option ${item.tipo === 'Workshop' ? 'selected':''}>Workshop</option></select></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Salvar Evento</button></div></form>`); }
function openExtensaoModal(id = null) { const item = id ? db.extensao.find(i => i.id === id) : {}; showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${id ? 'Editar Projeto' : 'Projeto de Extensão'}</h3><form onsubmit="event.preventDefault(); saveExtensao(${id});"><div class="form-group"><label>Título do Projeto</label><input id="exTitulo" class="form-control" value="${item.titulo || ''}" required></div><div class="form-row"><div class="form-group"><label>Linha Programática</label><input id="exLinha" class="form-control" value="${item.linha || ''}"></div><div class="form-group"><label>Tutor</label><input id="exTutor" class="form-control" value="${item.tutor || ''}" required></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Salvar Projeto</button></div></form>`); }
function openAtividadeModal(id = null) { const item = id ? db.atividades.find(i => i.id === id) : {}; showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${id ? 'Editar Atividade' : 'Registro de Atividade'}</h3><form onsubmit="event.preventDefault(); saveAtividade(${id});"><div class="form-group"><label>Título</label><input id="aTitulo" class="form-control" value="${item.titulo || ''}" required></div><div class="form-row"><div class="form-group"><label>Data</label><input id="aData" type="date" class="form-control" value="${item.data || ''}"></div><div class="form-group"><label>Local</label><input id="aLocal" class="form-control" value="${item.local || ''}"></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Salvar Atividade</button></div></form>`); }

async function finish(page) { await saveDb(); renderPage(page); closeActiveModal(); }
function saveLiga(id) { pushOrUpdate('ligas', id, { nome: document.getElementById('lNome').value, sigla: document.getElementById('lSigla').value, tutor: document.getElementById('lTutor').value }); finish('ligas'); }
function savePesquisa(id) { pushOrUpdate('pesquisas', id, { ano: document.getElementById('pAno').value, titulo: document.getElementById('pTitulo').value, caracterizacao: document.getElementById('pCarac').value, tutor: document.getElementById('pTutorNome').value }); finish('pesquisas'); }
function saveEvento(id) { pushOrUpdate('eventos', id, { titulo: document.getElementById('eTitulo').value, data: document.getElementById('eData').value, tipo: document.getElementById('eTipo').value }); finish('eventos'); }
function saveExtensao(id) { pushOrUpdate('extensao', id, { titulo: document.getElementById('exTitulo').value, linha: document.getElementById('exLinha').value, tutor: document.getElementById('exTutor').value }); finish('extensao'); }
function saveAtividade(id) { pushOrUpdate('atividades', id, { titulo: document.getElementById('aTitulo').value, data: document.getElementById('aData').value, local: document.getElementById('aLocal').value }); finish('atividades'); }

function openRelatorioModal(type, itemId) {
    const item = db[type].find(i => i.id === itemId); let formHtml = ''; let modalTitle = ''; const inst = "font-size:11px; color:#626c71; display:block;"; const lbl = "font-weight:bold; color:var(--color-primary);"; let col = type === 'pesquisas' ? 'relatoriosPesquisa' : type === 'eventos' ? 'relatoriosEvento' : 'relatoriosExtensao'; const rel = db[col].find(r => r.itemId === itemId) || {};
    if (type === 'pesquisas') { modalTitle = `Relatório de Pesquisa: ${item.titulo}`; formHtml = `<div class="form-group"><label style="${lbl}">Introdução <span style="${inst}">Apresentar o tema e contexto</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Objetivo(s)</label><textarea id="r2" class="form-control" rows="2">${rel.r2 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Metodologia</label><textarea id="r3" class="form-control" rows="3">${rel.r3 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Resultados</label><textarea id="r4" class="form-control" rows="3">${rel.r4 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Conclusão</label><textarea id="r5" class="form-control" rows="3">${rel.r5 || ''}</textarea></div>`; } 
    else if (type === 'eventos') { modalTitle = `Relatório de Evento: ${item.titulo}`; formHtml = `<div class="form-group"><label style="${lbl}">Descrição do evento</label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Público-alvo</label><input id="r2" class="form-control" value="${rel.r2 || ''}"></div><div class="form-group"><label style="${lbl}">Resultados alcançados</label><textarea id="r3" class="form-control" rows="3">${rel.r3 || ''}</textarea></div>`; } 
    else if (type === 'extensao') { modalTitle = `Relatório de Extensão: ${item.titulo}`; formHtml = `<div class="form-group"><label style="${lbl}">Objetivos do projeto</label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Metodologia e ações</label><textarea id="r2" class="form-control" rows="4">${rel.r2 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Resultados e impacto</label><textarea id="r3" class="form-control" rows="4">${rel.r3 || ''}</textarea></div>`; }
    let anexosHtml = ''; if (rel.anexos && rel.anexos.length > 0) { anexosHtml = `<div style="margin-bottom:15px; font-size:13px; background: #fff8e1; padding: 10px; border-radius: 6px;"><strong>📎 Anexos Salvos:</strong><br>` + rel.anexos.map(a => `<a href="${a.url}" target="_blank" style="color:var(--color-primary); text-decoration:none;">🔗 ${a.name}</a>`).join('<br>') + `</div>`; }
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${modalTitle}</h3><form id="relatorioForm" onsubmit="event.preventDefault(); saveRelatorio('${type}', ${itemId});">${formHtml}<div style="background:#f4f7f6; padding:15px; border-radius:8px; margin-top:20px; border: 1px dashed #b0bec5;">${anexosHtml}<label style="${lbl}">Adicionar Novas Evidências</label><input type="file" id="rFiles" class="form-control" multiple accept="image/*,application/pdf" onchange="updateFileList(this)"><div id="fileListDisplay" style="font-size:12px; margin-top:5px; color:#555;"></div></div><div style="display:flex; justify-content:space-between; margin-top:30px;"><button type="button" class="btn btn-success" onclick="gerarPDF('${type}', ${itemId})"><span class="material-icons-round">picture_as_pdf</span> Gerar PDF</button><button type="submit" id="btnSalvarRelatorio" class="btn btn-primary"><span class="material-icons-round">cloud_upload</span> Salvar na Nuvem</button></div></form>`);
}

function updateFileList(input) { const list = document.getElementById('fileListDisplay'); if (input.files.length > 0) list.innerHTML = `<strong>Prontos para Upload:</strong><br>${Array.from(input.files).map(f => `📄 ${f.name}`).join('<br>')}`; else list.innerHTML = ''; }

function gerarPDF(type, itemId) {
    const item = db[type].find(i => i.id === itemId); let relData; let docTitle = ''; let contentHtml = '';
    if (type === 'pesquisas') { relData = db.relatoriosPesquisa.find(r => r.itemId === itemId) || {}; docTitle = 'RELATÓRIO DE PESQUISA CIENTÍFICA'; contentHtml = `<p><strong>Título:</strong> ${item.titulo}</p><p><strong>Tutor:</strong> ${item.tutor}</p><hr><p><strong>Introdução:</strong><br>${relData.r1 || ''}</p><p><strong>Objetivos:</strong><br>${relData.r2 || ''}</p><p><strong>Metodologia:</strong><br>${relData.r3 || ''}</p><p><strong>Resultados:</strong><br>${relData.r4 || ''}</p><p><strong>Discussão/Conclusão:</strong><br>${relData.r5 || ''}</p>`; } 
    else if (type === 'eventos') { relData = db.relatoriosEvento.find(r => r.itemId === itemId) || {}; docTitle = 'RELATÓRIO DE EVENTO CIENTÍFICO'; contentHtml = `<p><strong>Evento:</strong> ${item.titulo}</p><p><strong>Data:</strong> ${item.data}</p><hr><p><strong>Descrição:</strong><br>${relData.r1 || ''}</p><p><strong>Público:</strong><br>${relData.r2 || ''}</p><p><strong>Resultados:</strong><br>${relData.r3 || ''}</p>`; } 
    else if (type === 'extensao') { relData = db.relatoriosExtensao.find(r => r.itemId === itemId) || {}; docTitle = 'RELATÓRIO DE PROJETO DE EXTENSÃO'; contentHtml = `<p><strong>Projeto:</strong> ${item.titulo}</p><p><strong>Linha:</strong> ${item.linha}</p><hr><p><strong>Objetivos:</strong><br>${relData.r1 || ''}</p><p><strong>Metodologia:</strong><br>${relData.r2 || ''}</p><p><strong>Impacto:</strong><br>${relData.r3 || ''}</p>`; }
    const printElement = document.createElement('div'); printElement.innerHTML = `<div style="padding: 30px; font-family: Arial;"><div style="text-align: center; border-bottom: 2px solid #21808d; margin-bottom:20px;"><h2>UNIARA - MEDICINA</h2><h3>${docTitle}</h3></div><div>${contentHtml}</div><div style="margin-top: 80px; display: flex; justify-content: space-between; text-align: center;"><div style="width: 45%;"><hr><p>Assinatura do Tutor</p></div><div style="width: 45%;"><hr><p>Presidente da Liga / Autor</p></div></div></div>`;
    // @ts-ignore
    html2pdf().set({ margin: 15, filename: `${docTitle}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(printElement).save();
}

async function saveRelatorio(type, itemId) {
    const btn = document.getElementById('btnSalvarRelatorio'); btn.innerHTML = '<span class="material-icons-round">sync</span> Fazendo Upload...'; btn.disabled = true;
    let col = type === 'pesquisas' ? 'relatoriosPesquisa' : type === 'eventos' ? 'relatoriosEvento' : 'relatoriosExtensao'; const idx = db[col].findIndex(r => r.itemId === itemId); let existingAnexos = []; if (idx >= 0 && db[col][idx].anexos) existingAnexos = db[col][idx].anexos;
    const data = { itemId: itemId }; for (let i = 1; i <= 5; i++) { const el = document.getElementById(`r${i}`); if (el) data[`r${i}`] = el.value; }
    const fileInput = document.getElementById('rFiles'); let novosAnexos = [];
    if (fileInput && fileInput.files.length > 0) { for (let i = 0; i < fileInput.files.length; i++) { const file = fileInput.files[i]; const safeName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_"); const storageRef = ref(storage, `evidencias/${type}/${itemId}/${safeName}`); try { await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); novosAnexos.push({ name: file.name, url: url }); } catch (err) { console.error("Erro no upload:", err); } } }
    data.anexos = [...existingAnexos, ...novosAnexos]; if (idx >= 0) db[col][idx] = data; else db[col].push(data);
    await finish(currentPage); alert('✅ Relatório salvo com sucesso!');
}

async function deleteItem(type, id) { if(!confirm('Deseja excluir definitivamente este registro?')) return; db[type] = db[type].filter(i => i.id !== id); if (type === 'pesquisas') db.relatoriosPesquisa = db.relatoriosPesquisa.filter(r => r.itemId !== id); if (type === 'eventos') db.relatoriosEvento = db.relatoriosEvento.filter(r => r.itemId !== id); if (type === 'extensao') db.relatoriosExtensao = db.relatoriosExtensao.filter(r => r.itemId !== id); await saveDb(); renderPage(currentPage); }


// --- 🧭 TUTORIAL INTERATIVO (INTRO.JS) ---
function iniciarTour() {
    renderPage('dashboard');
    setTimeout(() => {
        // @ts-ignore
        introJs().setOptions({
            nextLabel: 'Próximo',
            prevLabel: 'Voltar',
            doneLabel: 'Entendi!',
            showStepNumbers: true,
            showProgress: true,
            steps: [
                {
                    title: "👋 Bem-vindo(a)!",
                    intro: "Este é o seu novo sistema de Gestão de Ligas Acadêmicas. Vamos fazer um tour rápido para você aprender a usar."
                },
                {
                    element: document.querySelector('.sidebar'),
                    title: "Navegação",
                    intro: "Aqui no menu lateral você encontra todos os módulos. É por aqui que você vai transitar entre Ligas, Pesquisas e Eventos.",
                    position: 'right'
                },
                {
                    element: document.querySelector('.page-header'),
                    title: "Painel de Controle",
                    intro: "No Dashboard, você acompanha o volume de registros. Você só visualiza aquilo que você mesmo cadastrou (a menos que seja da Coordenação).",
                    position: 'bottom'
                }
            ]
        }).oncomplete(function() {
            renderPage('ligas');
            setTimeout(() => {
                // @ts-ignore
                introJs().setOptions({
                    nextLabel: 'Concluir',
                    showBullets: false,
                    steps: [
                        {
                            element: document.querySelector('.btn-primary'),
                            title: "Criar Registros",
                            intro: "Em qualquer aba que você entrar, sempre haverá este botão azul para adicionar um novo registro.",
                            position: 'left'
                        },
                        {
                            title: "Relatórios Oficiais",
                            intro: "Depois de criar um registro, você verá botões na tabela para <b>Editar</b>, enviar <b>Relatórios/Anexos</b> e <b>Gerar o PDF</b> assinado."
                        }
                    ]
                }).start();
            }, 300);
        }).start();
    }, 300);
}

// --- EXPOSIÇÃO GLOBAL ---
window.renderPage = renderPage;
window.openLigaModal = openLigaModal;
window.openPesquisaModal = openPesquisaModal;
window.openEventoModal = openEventoModal;
window.openExtensaoModal = openExtensaoModal;
window.openAtividadeModal = openAtividadeModal;
window.openRelatorioModal = openRelatorioModal;
window.closeActiveModal = closeActiveModal;
window.deleteItem = deleteItem;
window.gerarPDF = gerarPDF;
window.updateFileList = updateFileList;
window.saveLiga = saveLiga;
window.savePesquisa = savePesquisa;
window.saveEvento = saveEvento;
window.saveExtensao = saveExtensao;
window.saveAtividade = saveAtividade;
window.saveRelatorio = saveRelatorio;
window.loginComGoogle = loginComGoogle;
window.fazerLogout = fazerLogout;
window.mudarStatusUsuario = mudarStatusUsuario;
window.iniciarTour = iniciarTour;
