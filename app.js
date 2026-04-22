// --- 1. CONFIGURAÇÃO DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
// 🔄 VOLTAMOS PARA O POPUP (Mais estável no GitHub Pages)
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

// ⚠️ LISTA DE COORDENADORES
const EMAILS_ADMIN = [
      "gbraz@uniara.edu.br",
  "vferreira@uniara.edu.br",
  "rmprado@uniara.edu.br",
  "eclima@uniara.edu.br"
]; 

// --- 2. BANCO DE DADOS BASE ---
let db = { ligas: [], pesquisas: [], eventos: [], extensao: [], atividades: [], relatoriosPesquisa: [], relatoriosEvento: [], relatoriosExtensao: [] };

// --- 3. GESTÃO DE AUTENTICAÇÃO COM GOOGLE ---
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

        // REGRA 1: Checagem de Domínio
        if (!email.endsWith("@uniara.edu.br") && !EMAILS_ADMIN.includes(email)) {
            await signOut(auth);
            mostrarErro("⚠️ Utilize seu e-mail institucional (@uniara.edu.br).");
            btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Entrar com Google';
            btn.disabled = false;
            return;
        }
    } catch (error) {
        console.error("Erro no Popup:", error);
        mostrarErro("A janela de login foi fechada ou bloqueada. Verifique a barra de endereços do seu navegador.");
        btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Entrar com Google';
        btn.disabled = false;
    }
}

onAuthStateChanged(auth, async (user) => {
    const btn = document.getElementById('btnGoogleLogin');
    if (btn) {
        btn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Entrar com Google';
        btn.disabled = false;
    }

    if (user) {
        const email = user.email.toLowerCase();
        
        try {
            const userRef = doc(dbFirestore, "usuarios", user.uid);
            const userDoc = await getDoc(userRef);

            // REGRA 2: Coordenador entra direto
            if (EMAILS_ADMIN.includes(email)) {
                await setDoc(userRef, { email: email, nome: user.displayName || 'Coordenador', status: 'aprovado', role: 'admin' }, { merge: true });
                liberarAcesso(true);
                return;
            }

            // REGRA 3: Aluno Comum
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.status === 'aprovado') {
                    liberarAcesso(false);
                } else if (data.status === 'pendente') {
                    await signOut(auth);
                    mostrarErro("⏳ Sua conta está em análise. Aguarde a aprovação da coordenação para acessar.");
                } else {
                    await signOut(auth);
                    mostrarErro("🚫 O acesso para este e-mail foi bloqueado.");
                }
            } else {
                // REGRA 4: Primeiro acesso
                await setDoc(userRef, {
                    email: email,
                    nome: user.displayName || 'Aluno',
                    status: 'pendente',
                    dataSolicitacao: new Date().toLocaleDateString('pt-BR')
                });
                await signOut(auth);
                mostrarErro("✅ Cadastro solicitado com sucesso! A coordenação irá avaliar e liberar o seu acesso.", true);
            }
        } catch (dbError) {
            console.error("Erro no BD:", dbError);
            await signOut(auth);
            mostrarErro("Erro interno: Falha ao ler permissões no banco de dados.");
        }
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
});

async function liberarAcesso(isAdmin) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('menuAdmin').style.display = isAdmin ? 'block' : 'none';
    await carregarDadosIniciais();
}

function fazerLogout() { signOut(auth); }

// --- 4. CARREGAMENTO E SALVAMENTO DE DADOS ---
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

let currentPage = 'dashboard';

// --- 5. RENDERIZAÇÃO DA TELA ---
async function renderPage(page) {
    currentPage = page;
    const content = document.getElementById('pageContent');
    
    document.querySelectorAll('.nav-link').forEach(l => {
        const onclickAttr = l.getAttribute('onclick') || '';
        l.classList.toggle('active', onclickAttr.includes(`'${page}'`));
    });

    switch(page) {
        case 'dashboard':
            content.innerHTML = `<div class="page-header"><h2>Gestão de Ligas Acadêmicas - Medicina UNIARA</h2></div><div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;"><div class="card"><h3>Ligas</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.ligas.length}</p></div><div class="card"><h3>Pesquisas</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.pesquisas.length}</p></div><div class="card"><h3>Eventos</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.eventos.length}</p></div><div class="card"><h3>Projetos</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.extensao.length}</p></div></div>`;
            break;
        case 'ligas': content.innerHTML = renderTable('Ligas Acadêmicas', 'ligas', db.ligas, ['Nome', 'Sigla', 'Tutor'], 'openLigaModal()'); break;
        case 'pesquisas': content.innerHTML = renderTable('Pesquisas Científicas', 'pesquisas', db.pesquisas, ['Título', 'Caracterização', 'Tutor'], 'openPesquisaModal()'); break;
        case 'eventos': content.innerHTML = renderTable('Eventos Científicos', 'eventos', db.eventos, ['Título', 'Data', 'Tipo'], 'openEventoModal()'); break;
        case 'extensao': content.innerHTML = renderTable('Projetos de Extensão', 'extensao', db.extensao, ['Título', 'Linha', 'Tutor'], 'openExtensaoModal()'); break;
        case 'atividades': content.innerHTML = renderTable('Relatório de Atividades', 'atividades', db.atividades, ['Título', 'Data', 'Local'], 'openAtividadeModal()'); break;
        
        case 'admin':
            content.innerHTML = `<div class="page-header"><h2>👑 Gestão de Acessos</h2><p style="color:#666;">Aprove ou bloqueie usuários que solicitaram cadastro com contas do Google.</p></div><div id="adminList">Carregando usuários...</div>`;
            carregarPainelAdmin();
            break;

        case 'sobre': 
            content.innerHTML = `<div class="page-header"><h2>Informações Legais e Créditos</h2></div><div class="card" style="border-left: 5px solid var(--color-primary);"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;"><div class="legal-title" style="margin-bottom: 0;">Propriedade Intelectual</div><img src="gbx-logo.png" alt="GBX Learning Tools" style="height: 35px; object-fit: contain;"></div><p style="font-size: 14px; color: #333; margin-bottom: 10px;"><strong>Desenvolvido por:</strong> GBX - Learning Tools</p><p style="font-size: 14px; color: #333; background: #eef2f5; padding: 10px; border-radius: 5px;"><strong>Termo de Cessão:</strong> Uso restrito para as Ligas Acadêmicas do curso de Medicina da UNIARA.</p></div>`;
            break;
    }
}

// LÓGICA DO PAINEL ADMIN
async function carregarPainelAdmin() {
    try {
        const querySnapshot = await getDocs(collection(dbFirestore, "usuarios"));
        let html = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Data Solicitação</th><th>Status Atual</th><th>Ação</th></tr></thead><tbody>`;
        
        querySnapshot.forEach((documento) => {
            const u = documento.data();
            const id = documento.id;
            if (u.role === 'admin') return; 
            
            const isPendente = u.status === 'pendente';
            html += `<tr>
                <td>${u.nome || '---'}</td>
                <td>${u.email}</td>
                <td>${u.dataSolicitacao || '---'}</td>
                <td><span style="padding:4px 8px; border-radius:4px; font-weight:bold; font-size:12px; background:${isPendente ? '#ffebee' : '#e8f5e9'}; color:${isPendente ? '#c62828' : '#2e7d32'};">${u.status.toUpperCase()}</span></td>
                <td>
                    ${isPendente 
                        ? `<button class="btn btn-success" onclick="mudarStatusUsuario('${id}', 'aprovado')">Aprovar</button>` 
                        : `<button class="btn btn-danger" onclick="mudarStatusUsuario('${id}', 'pendente')">Bloquear</button>`}
                </td>
            </tr>`;
        });
        
        html += `</tbody></table>`;
        document.getElementById('adminList').innerHTML = html;
    } catch (e) {
        document.getElementById('adminList').innerHTML = "Erro ao carregar usuários.";
    }
}

async function mudarStatusUsuario(userId, novoStatus) {
    if(!confirm(`Deseja realmente alterar o status deste usuário para ${novoStatus.toUpperCase()}?`)) return;
    await updateDoc(doc(dbFirestore, "usuarios", userId), { status: novoStatus });
    carregarPainelAdmin();
}

function renderTable(title, type, data, headers, modalFn) {
    const hasReport = ['pesquisas', 'eventos', 'extensao'].includes(type);
    return `<div class="card"><div class="card-header"><h2>${title}</h2><button class="btn btn-primary" onclick="${modalFn}">+ Novo Registro</button></div><div style="overflow-x:auto"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>Ações</th></tr></thead><tbody>${data.length === 0 ? '<tr><td colspan="100%" style="text-align:center; padding:20px;">Nenhum registro encontrado.</td></tr>' : data.map(item => `<tr>${headers.map(h => `<td>${item[h.toLowerCase()] || '---'}</td>`).join('')}<td>${hasReport ? `<button class="btn btn-sm" style="background-color:#e0f2f1; color:#00695c; margin-right:8px; border:1px solid #00695c;" onclick="openRelatorioModal('${type}', ${item.id})">📝 Relatório</button>` : ''}<button class="btn btn-sm btn-danger" onclick="deleteItem('${type}', ${item.id})">Excluir</button></td></tr>`).join('')}</tbody></table></div></div>`;
}

// --- 6. MODAIS, UPLOADS, E PDF ---
function showModal(html) { const container = document.getElementById('modalContainer'); container.innerHTML = `<div class="modal active" id="activeModal"><div class="modal-content">${html}<br><button class="btn btn-secondary" onclick="closeActiveModal()">Fechar</button></div></div>`; }
function closeActiveModal() { const m = document.getElementById('activeModal'); if(m) m.remove(); }
function openLigaModal() { showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Nova Liga Acadêmica</h3><form onsubmit="event.preventDefault(); saveLiga();"><div class="form-group"><label>Nome da Liga</label><input id="lNome" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Sigla</label><input id="lSigla" class="form-control" required></div><div class="form-group"><label>Tutor Responsável</label><input id="lTutor" class="form-control" required></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Salvar Liga</button></div></form>`); }
function openPesquisaModal() { showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Pesquisa Científica</h3><form onsubmit="event.preventDefault(); savePesquisa();"><div class="form-row"><div class="form-group"><label>Ano</label><input id="pAno" class="form-control" type="number" value="2025"></div><div class="form-group"><label>Caracterização</label><select id="pCarac" class="form-control"><option>Relato de Caso</option><option>Relato de Experiência</option><option>Revisão Bibliográfica</option></select></div></div><div class="form-group"><label>Título da Pesquisa</label><input id="pTitulo" class="form-control" required></div><div class="form-group"><label>Área Temática</label><select id="pArea" class="form-control"><option>Comunicação</option><option>Cultura</option><option>Saúde</option><option>Tecnologia</option></select></div><h4 style="margin:15px 0 10px;">Tutor da Liga</h4><div class="form-group"><label>Nome</label><input id="pTutorNome" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Telefone</label><input id="pTutorTel" class="form-control"></div><div class="form-group"><label>Titulação</label><select id="pTutorTit" class="form-control"><option>Especialista</option><option>Mestre</option><option>Doutor</option></select></div></div><div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-top:15px"><h4>Orientador</h4><div class="form-group"><label>Nome do Orientador (Se diferente)</label><input id="pOrientNome" class="form-control"></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Criar Cadastro</button></div></form>`); }
function openEventoModal() { showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Evento Científico</h3><form onsubmit="event.preventDefault(); saveEvento();"><div class="form-row"><div class="form-group"><label>Responsável</label><input id="eResp" class="form-control"></div><div class="form-group"><label>Vínculo</label><select id="eVinc" class="form-control"><option>Professor Titular</option><option>Outro</option></select></div></div><div class="form-row"><div class="form-group"><label>Tipo de Evento</label><select id="eTipo" class="form-control"><option>Simpósio</option><option>Minicurso</option><option>Workshop</option></select></div><div class="form-group"><label>Eixo</label><select id="eEixo" class="form-control"><option>Saúde</option><option>Educação</option></select></div></div><div class="form-group"><label>Título</label><input id="eTitulo" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Data</label><input id="eData" type="date" class="form-control"></div><div class="form-group"><label>Modalidade</label><select id="eMod" class="form-control"><option>Presencial</option><option>Online</option></select></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Criar Cadastro</button></div></form>`); }
function openExtensaoModal() { showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Projeto de Extensão</h3><form onsubmit="event.preventDefault(); saveExtensao();"><div class="form-group"><label>Título do Projeto</label><input id="exTitulo" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Linha Programática</label><select id="exLinha" class="form-control"><option>Saúde</option><option>Educação</option></select></div><div class="form-group"><label>Período</label><input id="exPer" class="form-control"></div></div><div class="form-group"><label>Tutor Responsável</label><input id="exTutor" class="form-control" required></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Criar Cadastro</button></div></form>`); }
function openAtividadeModal() { showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Atividade LA (2025)</h3><form onsubmit="event.preventDefault(); saveAtividade();"><div class="form-group"><label>Título da Atividade</label><input id="aTitulo" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Data</label><input id="aData" type="date" class="form-control"></div><div class="form-group"><label>Local</label><input id="aLocal" class="form-control"></div></div><div class="form-group"><label>Resumo Descritivo</label><textarea id="aRes" class="form-control" rows="4"></textarea></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Salvar Atividade</button></div></form>`); }

function openRelatorioModal(type, itemId) {
    const item = db[type].find(i => i.id === itemId); let formHtml = ''; let modalTitle = ''; const inst = "font-size:11px; color:#626c71; display:block;"; const lbl = "font-weight:bold; color:var(--color-primary);"; let col = type === 'pesquisas' ? 'relatoriosPesquisa' : type === 'eventos' ? 'relatoriosEvento' : 'relatoriosExtensao'; const rel = db[col].find(r => r.itemId === itemId) || {};
    if (type === 'pesquisas') { modalTitle = `Relatório de Pesquisa: ${item.titulo}`; formHtml = `<div class="form-group"><label style="${lbl}">Introdução <span style="${inst}">Apresentar o tema e contexto</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Objetivo(s) <span style="${inst}">Definir finalidade do estudo</span></label><textarea id="r2" class="form-control" rows="2">${rel.r2 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Metodologia <span style="${inst}">Descrever métodos utilizados</span></label><textarea id="r3" class="form-control" rows="3">${rel.r3 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Resultados <span style="${inst}">Apresentar principais achados</span></label><textarea id="r4" class="form-control" rows="3">${rel.r4 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Discussão e Conclusão <span style="${inst}">Síntese do estudo</span></label><textarea id="r5" class="form-control" rows="3">${rel.r5 || ''}</textarea></div>`; } 
    else if (type === 'eventos') { modalTitle = `Relatório de Evento: ${item.titulo}`; formHtml = `<div class="form-group"><label style="${lbl}">Descrição do evento <span style="${inst}">Atividades e formato</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Público-alvo <span style="${inst}">Perfil e quantidade</span></label><input id="r2" class="form-control" value="${rel.r2 || ''}"></div><div class="form-group"><label style="${lbl}">Resultados alcançados <span style="${inst}">Impacto do evento</span></label><textarea id="r3" class="form-control" rows="3">${rel.r3 || ''}</textarea></div>`; } 
    else if (type === 'extensao') { modalTitle = `Relatório de Extensão: ${item.titulo}`; formHtml = `<div class="form-group"><label style="${lbl}">Objetivos do projeto <span style="${inst}">O que se pretendia alcançar</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Metodologia e ações <span style="${inst}">Passo a passo na comunidade</span></label><textarea id="r2" class="form-control" rows="4">${rel.r2 || ''}</textarea></div><div class="form-group"><label style="${lbl}">Resultados e impacto <span style="${inst}">Benefício real gerado</span></label><textarea id="r3" class="form-control" rows="4">${rel.r3 || ''}</textarea></div>`; }
    let anexosHtml = ''; if (rel.anexos && rel.anexos.length > 0) { anexosHtml = `<div style="margin-bottom:15px; font-size:13px;"><strong>📎 Anexos Salvos:</strong><br>` + rel.anexos.map(a => `<a href="${a.url}" target="_blank" style="color:var(--color-primary); text-decoration:none;">🔗 ${a.name}</a>`).join('<br>') + `</div>`; }
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${modalTitle}</h3><form id="relatorioForm" onsubmit="event.preventDefault(); saveRelatorio('${type}', ${itemId});">${formHtml}<div style="background:#f4f7f6; padding:15px; border-radius:8px; margin-top:20px; border: 1px dashed var(--color-primary);">${anexosHtml}<label style="${lbl}">Adicionar Novas Evidências</label><input type="file" id="rFiles" class="form-control" multiple accept="image/*,application/pdf" onchange="updateFileList(this)"><div id="fileListDisplay" style="font-size:12px; margin-top:5px; color:#555;"></div></div><div style="display:flex; justify-content:space-between; margin-top:30px;"><button type="button" class="btn btn-success" onclick="gerarPDF('${type}', ${itemId})">📄 Gerar PDF Oficial</button><button type="submit" id="btnSalvarRelatorio" class="btn btn-primary" style="font-size:16px; padding:10px 20px;">💾 Salvar na Nuvem</button></div></form>`);
}

function updateFileList(input) { const list = document.getElementById('fileListDisplay'); if (input.files.length > 0) list.innerHTML = `<strong>Prontos para Upload:</strong><br>${Array.from(input.files).map(f => `📄 ${f.name}`).join('<br>')}`; else list.innerHTML = ''; }

function gerarPDF(type, itemId) {
    const item = db[type].find(i => i.id === itemId); let relData; let docTitle = ''; let contentHtml = '';
    if (type === 'pesquisas') { relData = db.relatoriosPesquisa.find(r => r.itemId === itemId) || {}; docTitle = 'RELATÓRIO DE PESQUISA CIENTÍFICA'; contentHtml = `<p><strong>Título:</strong> ${item.titulo}</p><p><strong>Tutor:</strong> ${item.tutor}</p><hr><p><strong>Introdução:</strong><br>${relData.r1 || ''}</p><p><strong>Objetivos:</strong><br>${relData.r2 || ''}</p><p><strong>Metodologia:</strong><br>${relData.r3 || ''}</p><p><strong>Resultados:</strong><br>${relData.r4 || ''}</p><p><strong>Discussão/Conclusão:</strong><br>${relData.r5 || ''}</p>`; } 
    else if (type === 'eventos') { relData = db.relatoriosEvento.find(r => r.itemId === itemId) || {}; docTitle = 'RELATÓRIO DE EVENTO CIENTÍFICO'; contentHtml = `<p><strong>Evento:</strong> ${item.titulo}</p><p><strong>Data:</strong> ${item.data}</p><hr><p><strong>Descrição:</strong><br>${relData.r1 || ''}</p><p><strong>Público:</strong><br>${relData.r2 || ''}</p><p><strong>Resultados:</strong><br>${relData.r3 || ''}</p>`; } 
    else if (type === 'extensao') { relData = db.relatoriosExtensao.find(r => r.itemId === itemId) || {}; docTitle = 'RELATÓRIO DE PROJETO DE EXTENSÃO'; contentHtml = `<p><strong>Projeto:</strong> ${item.titulo}</p><p><strong>Linha:</strong> ${item.linha}</p><hr><p><strong>Objetivos:</strong><br>${relData.r1 || ''}</p><p><strong>Metodologia:</strong><br>${relData.r2 || ''}</p><p><strong>Impacto:</strong><br>${relData.r3 || ''}</p>`; }
    const printElement = document.createElement('div'); printElement.innerHTML = `<div style="padding: 30px; font-family: Arial;"><div style="text-align: center; border-bottom: 2px solid #21808d; margin-bottom:20px;"><h2>UNIARA - MEDICINA</h2><h3>${docTitle}</h3></div><div>${contentHtml}</div><div style="margin-top: 80px; display: flex; justify-content: space-between; text-align: center;"><div style="width: 45%;"><hr><p>Assinatura do Tutor</p></div><div style="width: 45%;"><hr><p>Presidente da Liga</p></div></div></div>`;
    // @ts-ignore
    html2pdf().set({ margin: 15, filename: `${docTitle}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(printElement).save();
}

async function finish(page) { await saveDb(); renderPage(page); closeActiveModal(); }
function saveLiga() { db.ligas.push({ id: Date.now(), nome: document.getElementById('lNome').value, sigla: document.getElementById('lSigla').value, tutor: document.getElementById('lTutor').value }); finish('ligas'); }
function savePesquisa() { db.pesquisas.push({ id: Date.now(), titulo: document.getElementById('pTitulo').value, caracterizacao: document.getElementById('pCarac').value, tutor: document.getElementById('pTutorNome').value }); finish('pesquisas'); }
function saveEvento() { db.eventos.push({ id: Date.now(), titulo: document.getElementById('eTitulo').value, data: document.getElementById('eData').value, tipo: document.getElementById('eTipo').value }); finish('eventos'); }
function saveExtensao() { db.extensao.push({ id: Date.now(), titulo: document.getElementById('exTitulo').value, linha: document.getElementById('exLinha').value, tutor: document.getElementById('exTutor').value }); finish('extensao'); }
function saveAtividade() { db.atividades.push({ id: Date.now(), titulo: document.getElementById('aTitulo').value, data: document.getElementById('aData').value, local: document.getElementById('aLocal').value }); finish('atividades'); }

async function saveRelatorio(type, itemId) {
    const btn = document.getElementById('btnSalvarRelatorio'); btn.innerText = '⏳ Fazendo Upload...'; btn.disabled = true;
    let col = type === 'pesquisas' ? 'relatoriosPesquisa' : type === 'eventos' ? 'relatoriosEvento' : 'relatoriosExtensao'; const idx = db[col].findIndex(r => r.itemId === itemId); let existingAnexos = []; if (idx >= 0 && db[col][idx].anexos) existingAnexos = db[col][idx].anexos;
    const data = { itemId: itemId }; for (let i = 1; i <= 5; i++) { const el = document.getElementById(`r${i}`); if (el) data[`r${i}`] = el.value; }
    const fileInput = document.getElementById('rFiles'); let novosAnexos = [];
    if (fileInput && fileInput.files.length > 0) { for (let i = 0; i < fileInput.files.length; i++) { const file = fileInput.files[i]; const safeName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_"); const storageRef = ref(storage, `evidencias/${type}/${itemId}/${safeName}`); try { await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); novosAnexos.push({ name: file.name, url: url }); } catch (err) { console.error("Erro no upload:", err); } } }
    data.anexos = [...existingAnexos, ...novosAnexos]; if (idx >= 0) db[col][idx] = data; else db[col].push(data);
    await finish(currentPage); alert('✅ Relatório e Anexos salvos com sucesso!');
}

async function deleteItem(type, id) { if(!confirm('Deseja excluir na nuvem este registro e seus relatórios?')) return; db[type] = db[type].filter(i => i.id !== id); if (type === 'pesquisas') db.relatoriosPesquisa = db.relatoriosPesquisa.filter(r => r.itemId !== id); if (type === 'eventos') db.relatoriosEvento = db.relatoriosEvento.filter(r => r.itemId !== id); if (type === 'extensao') db.relatoriosExtensao = db.relatoriosExtensao.filter(r => r.itemId !== id); await saveDb(); renderPage(currentPage); }

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
