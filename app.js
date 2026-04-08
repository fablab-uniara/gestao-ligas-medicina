// --- CONFIGURAÇÃO DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// SUBSTITUA ESTE BLOCO PELAS CHAVES DO SEU FIREBASE (Passo 1.6)
const firebaseConfig = {
  apiKey: "AIzaSyDHs0DW6ppjwHcYSFSpXWfczIGt2IYaE18",
  authDomain: "uniara-medicina-ligas.firebaseapp.com",
  projectId: "uniara-medicina-ligas",
  storageBucket: "uniara-medicina-ligas.firebasestorage.app",
  messagingSenderId: "556596933742",
  appId: "1:556596933742:web:b8f4783ae9fb7bd375a27f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
};

// Inicializa o Firebase e o Banco de Dados
const app = initializeApp(firebaseConfig);
const dbFirestore = getFirestore(app);

// Cria uma referência para um documento único onde todos os dados da Uniara ficarão salvos
const uniaraRef = doc(dbFirestore, "plataforma", "dados_medicina");

// Estrutura base vazia
let db = {
    ligas: [], pesquisas: [], eventos: [], extensao: [], atividades: [],
    relatoriosPesquisa: [], relatoriosEvento: [], relatoriosExtensao: []
};

// --- NOVA FUNÇÃO DE SALVAMENTO (NUVEM) ---
async function saveDb() { 
    try {
        await setDoc(uniaraRef, db);
        console.log("Dados sincronizados com o Firebase!");
    } catch (error) {
        console.error("Erro ao salvar na nuvem:", error);
        alert("Erro de conexão. Verifique sua internet.");
    }
}

// --- RENDERER & INICIALIZAÇÃO ASSÍNCRONA ---
let currentPage = 'dashboard';

// Quando a página carregar, baixa os dados do Firebase antes de desenhar a tela
document.addEventListener('DOMContentLoaded', async () => { 
    try {
        const docSnap = await getDoc(uniaraRef);
        if (docSnap.exists()) {
            // Se já tem dados na nuvem, carrega eles
            db = docSnap.data();
            
            // Trava de segurança para arrays antigos
            db.relatoriosPesquisa = db.relatoriosPesquisa || [];
            db.relatoriosEvento = db.relatoriosEvento || [];
            db.relatoriosExtensao = db.relatoriosExtensao || [];
        } else {
            // Se for o primeiro acesso, cria o documento no Firebase
            await saveDb();
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
    
    // Libera a tela após baixar os dados
    renderPage('dashboard'); 
});
function renderPage(page) {
    currentPage = page;
    const content = document.getElementById('pageContent');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('onclick') && l.getAttribute('onclick').includes(`'${page}'`));
    });

    switch(page) {
        case 'dashboard':
            content.innerHTML = `
                <div class="page-header"><h2>Gestão Acadêmica - Medicina</h2></div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;">
                    <div class="card"><h3>Ligas</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.ligas.length}</p></div>
                    <div class="card"><h3>Pesquisas</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.pesquisas.length}</p></div>
                    <div class="card"><h3>Eventos</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.eventos.length}</p></div>
                    <div class="card"><h3>Projetos</h3><p style="font-size:24px; color:var(--color-primary); font-weight:bold;">${db.extensao.length}</p></div>
                </div>`;
            break;
        case 'ligas': content.innerHTML = renderTable('Ligas Acadêmicas', 'ligas', db.ligas, ['Nome', 'Sigla', 'Tutor'], 'openLigaModal()'); break;
        case 'pesquisas': content.innerHTML = renderTable('Pesquisas Científicas', 'pesquisas', db.pesquisas, ['Título', 'Caracterização', 'Tutor'], 'openPesquisaModal()'); break;
        case 'eventos': content.innerHTML = renderTable('Eventos Científicos', 'eventos', db.eventos, ['Título', 'Data', 'Tipo'], 'openEventoModal()'); break;
        case 'extensao': content.innerHTML = renderTable('Projetos de Extensão', 'extensao', db.extensao, ['Título', 'Linha', 'Tutor'], 'openExtensaoModal()'); break;
        case 'atividades': content.innerHTML = renderTable('Relatório de Atividades', 'atividades', db.atividades, ['Título', 'Data', 'Local'], 'openAtividadeModal()'); break;
    }
}

function renderTable(title, type, data, headers, modalFn) {
    const hasReport = ['pesquisas', 'eventos', 'extensao'].includes(type);

    return `
        <div class="card">
            <div class="card-header"><h2>${title}</h2><button class="btn btn-primary" onclick="${modalFn}">+ Novo Registro</button></div>
            <div style="overflow-x:auto">
                <table>
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>Ações</th></tr></thead>
                    <tbody>
                        ${data.length === 0 ? '<tr><td colspan="100%" style="text-align:center; padding:20px; color:#666;">Nenhum registro encontrado.</td></tr>' : 
                        data.map(item => `<tr>${headers.map(h => `<td>${item[h.toLowerCase()] || '---'}</td>`).join('')}
                        <td>
                            ${hasReport ? `<button class="btn btn-sm" style="background-color:#e0f2f1; color:#00695c; margin-right:8px; border:1px solid #00695c;" onclick="openRelatorioModal('${type}', ${item.id})">📝 Relatório / PDF</button>` : ''}
                            <button class="btn btn-sm btn-danger" onclick="deleteItem('${type}', ${item.id})">Excluir</button>
                        </td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// --- GESTÃO DE MODAIS ---
function showModal(html) {
    const container = document.getElementById('modalContainer');
    container.innerHTML = `<div class="modal active" id="activeModal"><div class="modal-content">${html}<br><button class="btn btn-secondary" onclick="closeActiveModal()">Fechar</button></div></div>`;
}
function closeActiveModal() { const m = document.getElementById('activeModal'); if(m) m.remove(); }

// --- MODAIS DE CADASTRO BASE ---

function openLigaModal() {
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Nova Liga Acadêmica</h3><form onsubmit="event.preventDefault(); saveLiga();"><div class="form-group"><label>Nome da Liga</label><input id="lNome" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Sigla</label><input id="lSigla" class="form-control" required></div><div class="form-group"><label>Tutor Responsável</label><input id="lTutor" class="form-control" required></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Salvar Liga</button></div></form>`);
}

function openPesquisaModal() {
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Pesquisa Científica (2025)</h3><form onsubmit="event.preventDefault(); savePesquisa();"><div class="form-row"><div class="form-group"><label>Ano</label><input id="pAno" class="form-control" type="number" value="2025"></div><div class="form-group"><label>Caracterização</label><select id="pCarac" class="form-control"><option>Relato de Caso</option><option>Relato de Experiência</option><option>Revisão Bibliográfica</option></select></div></div><div class="form-group"><label>Título da Pesquisa</label><input id="pTitulo" class="form-control" required></div><div class="form-group"><label>Área Temática</label><select id="pArea" class="form-control"><option>Comunicação</option><option>Cultura</option><option>Direitos Humanos</option><option>Educação</option><option>Meio ambiente</option><option>Saúde</option><option>Tecnologia</option><option>Trabalho</option></select></div><h4 style="margin:15px 0 10px; color:var(--color-text);">Identificação do Tutor</h4><div class="form-group"><label>Nome do Tutor</label><input id="pTutorNome" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Telefone</label><input id="pTutorTel" class="form-control"></div><div class="form-group"><label>Titulação</label><select id="pTutorTit" class="form-control"><option>Especialista</option><option>Mestre</option><option>Doutor</option></select></div></div><div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-top:15px"><h4 style="margin-bottom:5px; color:var(--color-text);">Orientador</h4><p style="font-size:11px; margin-bottom:10px; color:#666">(Preencher apenas se não for o Tutor)</p><div class="form-group"><label>Nome do Orientador</label><input id="pOrientNome" class="form-control"></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Criar Cadastro Base</button></div></form>`);
}

function openEventoModal() {
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Evento Científico</h3><form onsubmit="event.preventDefault(); saveEvento();"><div class="form-row"><div class="form-group"><label>Responsável</label><input id="eResp" class="form-control"></div><div class="form-group"><label>Vínculo</label><select id="eVinc" class="form-control"><option>Professor Titular</option><option>Preceptor</option><option>Outro</option></select></div></div><div class="form-row"><div class="form-group"><label>Tipo de Evento</label><select id="eTipo" class="form-control"><option>Simpósio</option><option>Minicurso</option><option>Workshop</option><option>Jornada</option></select></div><div class="form-group"><label>Eixo</label><select id="eEixo" class="form-control"><option>Saúde</option><option>Cultura</option><option>Educação</option><option>Tecnologia</option></select></div></div><div class="form-group"><label>Título</label><input id="eTitulo" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Data</label><input id="eData" type="date" class="form-control"></div><div class="form-group"><label>Modalidade</label><select id="eMod" class="form-control"><option>Presencial</option><option>Online</option></select></div></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Criar Cadastro Base</button></div></form>`);
}

function openExtensaoModal() {
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Projeto de Extensão</h3><form onsubmit="event.preventDefault(); saveExtensao();"><div class="form-group"><label>Título do Projeto</label><input id="exTitulo" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Linha Programática</label><select id="exLinha" class="form-control"><option>Saúde</option><option>Assistência Social</option><option>Educação</option><option>Cultura</option></select></div><div class="form-group"><label>Período</label><input id="exPer" class="form-control"></div></div><div class="form-group"><label>Tutor Responsável</label><input id="exTutor" class="form-control" required></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Criar Cadastro Base</button></div></form>`);
}

function openAtividadeModal() {
    showModal(`<h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">Relatório de Atividade LA (2025)</h3><form onsubmit="event.preventDefault(); saveAtividade();"><div class="form-group"><label>Título da Atividade</label><input id="aTitulo" class="form-control" required></div><div class="form-row"><div class="form-group"><label>Data</label><input id="aData" type="date" class="form-control"></div><div class="form-group"><label>Local</label><input id="aLocal" class="form-control"></div></div><div class="form-group"><label>Resumo Descritivo</label><textarea id="aRes" class="form-control" rows="4"></textarea></div><div style="text-align:right; margin-top:15px"><button type="submit" class="btn btn-primary">Salvar Atividade</button></div></form>`);
}

// --- MODAIS DE RELATÓRIO DINÂMICOS (COM ANEXOS E PDF) ---

function openRelatorioModal(type, itemId) {
    const item = db[type].find(i => i.id === itemId);
    let formHtml = '';
    let modalTitle = '';

    const instStyle = "font-size:11px; color:#626c71; font-weight:normal; display:block; margin-top:2px;";
    const labelStyle = "font-weight:bold; color:var(--color-primary);";

    if (type === 'pesquisas') {
        const rel = db.relatoriosPesquisa.find(r => r.itemId === itemId) || {};
        modalTitle = `Relatório de Pesquisa: ${item.titulo}`;
        formHtml = `
            <div class="form-group"><label style="${labelStyle}">Introdução <span style="${instStyle}">Apresentar o tema e contexto</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Objetivo(s) <span style="${instStyle}">Definir finalidade do estudo</span></label><textarea id="r2" class="form-control" rows="2">${rel.r2 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Metodologia <span style="${instStyle}">Descrever métodos utilizados</span></label><textarea id="r3" class="form-control" rows="3">${rel.r3 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Resultados <span style="${instStyle}">Apresentar principais achados</span></label><textarea id="r4" class="form-control" rows="3">${rel.r4 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Discussão <span style="${instStyle}">Interpretar os resultados</span></label><textarea id="r5" class="form-control" rows="3">${rel.r5 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Conclusão <span style="${instStyle}">Síntese do estudo</span></label><textarea id="r6" class="form-control" rows="2">${rel.r6 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Descritores <span style="${instStyle}">Palavras-chave do assunto (separadas por vírgula)</span></label><input id="r7" class="form-control" value="${rel.r7 || ''}"></div>
        `;
    } else if (type === 'eventos') {
        const rel = db.relatoriosEvento.find(r => r.itemId === itemId) || {};
        modalTitle = `Relatório de Evento: ${item.titulo}`;
        formHtml = `
            <div class="form-group"><label style="${labelStyle}">Descrição do evento <span style="${instStyle}">Detalhe as atividades e o formato do evento</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Público-alvo <span style="${instStyle}">Especifique quem participou e a quantidade</span></label><input id="r2" class="form-control" value="${rel.r2 || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Atividades desenvolvidas <span style="${instStyle}">Liste palestras, rodas de conversa, práticas</span></label><textarea id="r3" class="form-control" rows="3">${rel.r3 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Materiais utilizados <span style="${instStyle}">Equipamentos e insumos</span></label><textarea id="r4" class="form-control" rows="2">${rel.r4 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Resultados alcançados <span style="${instStyle}">Feedback e impacto do evento</span></label><textarea id="r5" class="form-control" rows="3">${rel.r5 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Observações adicionais <span style="${instStyle}">Ocorrências ou sugestões para o futuro</span></label><textarea id="r6" class="form-control" rows="2">${rel.r6 || ''}</textarea></div>
        `;
    } else if (type === 'extensao') {
        const rel = db.relatoriosExtensao.find(r => r.itemId === itemId) || {};
        modalTitle = `Relatório de Extensão: ${item.titulo}`;
        formHtml = `
            <div class="form-group"><label style="${labelStyle}">Objetivos do projeto <span style="${instStyle}">O que se pretendia alcançar com a extensão</span></label><textarea id="r1" class="form-control" rows="3">${rel.r1 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Linha programática <span style="${instStyle}">Área de atuação do projeto</span></label><input id="r2" class="form-control" value="${item.linha || rel.r2 || ''}"></div>
            <div class="form-group"><label style="${labelStyle}">Metodologia e ações desenvolvidas <span style="${instStyle}">Passo a passo da intervenção na comunidade</span></label><textarea id="r3" class="form-control" rows="4">${rel.r3 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Parcerias institucionais <span style="${instStyle}">Instituições envolvidas e como contribuíram</span></label><textarea id="r4" class="form-control" rows="2">${rel.r4 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Resultados e impacto <span style="${instStyle}">Benefício real gerado para o público alcançado</span></label><textarea id="r5" class="form-control" rows="4">${rel.r5 || ''}</textarea></div>
            <div class="form-group"><label style="${labelStyle}">Considerações finais <span style="${instStyle}">Conclusões da equipe sobre a experiência</span></label><textarea id="r6" class="form-control" rows="3">${rel.r6 || ''}</textarea></div>
        `;
    }

    // Adiciona o campo de Upload de Evidências
    const uploadHtml = `
        <div style="background:#f4f7f6; padding:15px; border-radius:8px; margin-top:20px; border: 1px dashed var(--color-primary);">
            <label style="${labelStyle}">Anexos (Evidências) <span style="${instStyle}">Adicione fotos, listas de presença e panfletos (Formatos: JPG, PNG, PDF).</span></label>
            <input type="file" id="rFiles" class="form-control" multiple accept="image/*,application/pdf" onchange="updateFileList(this)">
            <div id="fileListDisplay" class="anexos-list"></div>
        </div>
    `;

    showModal(`
        <h3 style="color:var(--color-primary); margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">${modalTitle}</h3>
        <form onsubmit="event.preventDefault(); saveRelatorio('${type}', ${itemId});">
            ${formHtml}
            ${uploadHtml}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px;">
                <button type="button" class="btn btn-success" onclick="gerarPDF('${type}', ${itemId})">📄 Gerar PDF Oficial</button>
                <button type="submit" class="btn btn-primary" style="font-size:16px; padding:10px 20px;">💾 Salvar Rascunho</button>
            </div>
        </form>
    `);
}

// Atualiza a visualização dos arquivos selecionados
function updateFileList(input) {
    const list = document.getElementById('fileListDisplay');
    if (input.files.length > 0) {
        let names = Array.from(input.files).map(f => `📄 ${f.name}`).join('<br>');
        list.innerHTML = `<br><strong>Arquivos vinculados:</strong><br>${names}<br><span style="color:#c0152f;">(Nota: No protótipo local os arquivos não são impressos no PDF. Para isso, ativaremos o módulo Supabase futuramente).</span>`;
    } else {
        list.innerHTML = '';
    }
}

// --- GERAÇÃO DE PDF (LAYOUT UNIARA) ---
function gerarPDF(type, itemId) {
    const item = db[type].find(i => i.id === itemId);
    let relData;
    let docTitle = '';
    let contentHtml = '';

    // Monta o conteúdo HTML formatado para o PDF com base no tipo
    if (type === 'pesquisas') {
        relData = db.relatoriosPesquisa.find(r => r.itemId === itemId) || {};
        docTitle = 'RELATÓRIO DE PESQUISA CIENTÍFICA';
        contentHtml = `
            <p><strong>Título da Pesquisa:</strong> ${item.titulo || 'N/A'}</p>
            <p><strong>Tutor Responsável:</strong> ${item.tutor || 'N/A'}</p>
            <hr style="margin: 20px 0; border: 0.5px solid #ccc;">
            <p><strong>1. Introdução:</strong><br>${relData.r1 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>2. Objetivo(s):</strong><br>${relData.r2 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>3. Metodologia:</strong><br>${relData.r3 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>4. Resultados:</strong><br>${relData.r4 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>5. Discussão:</strong><br>${relData.r5 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>6. Conclusão:</strong><br>${relData.r6 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>Descritores:</strong> ${relData.r7 || '<i>Não preenchido</i>'}</p>
        `;
    } else if (type === 'eventos') {
        relData = db.relatoriosEvento.find(r => r.itemId === itemId) || {};
        docTitle = 'RELATÓRIO DE EVENTO CIENTÍFICO';
        contentHtml = `
            <p><strong>Título do Evento:</strong> ${item.titulo || 'N/A'}</p>
            <p><strong>Data de Realização:</strong> ${item.data || 'N/A'}</p>
            <hr style="margin: 20px 0; border: 0.5px solid #ccc;">
            <p><strong>1. Descrição do Evento:</strong><br>${relData.r1 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>2. Público-Alvo:</strong><br>${relData.r2 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>3. Atividades Desenvolvidas:</strong><br>${relData.r3 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>4. Materiais Utilizados:</strong><br>${relData.r4 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>5. Resultados Alcançados:</strong><br>${relData.r5 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>6. Observações:</strong><br>${relData.r6 || '<i>Não preenchido</i>'}</p>
        `;
    } else if (type === 'extensao') {
        relData = db.relatoriosExtensao.find(r => r.itemId === itemId) || {};
        docTitle = 'RELATÓRIO DE PROJETO DE EXTENSÃO';
        contentHtml = `
            <p><strong>Título do Projeto:</strong> ${item.titulo || 'N/A'}</p>
            <p><strong>Tutor Responsável:</strong> ${item.tutor || 'N/A'}</p>
            <hr style="margin: 20px 0; border: 0.5px solid #ccc;">
            <p><strong>1. Objetivos do Projeto:</strong><br>${relData.r1 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>2. Linha Programática:</strong><br>${relData.r2 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>3. Metodologia e Ações:</strong><br>${relData.r3 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>4. Parcerias Institucionais:</strong><br>${relData.r4 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>5. Resultados e Impacto:</strong><br>${relData.r5 || '<i>Não preenchido</i>'}</p><br>
            <p><strong>6. Considerações Finais:</strong><br>${relData.r6 || '<i>Não preenchido</i>'}</p>
        `;
    }

    // Estrutura HTML invisível que será impressa
    const printElement = document.createElement('div');
    printElement.innerHTML = `
        <div style="font-family: Arial, sans-serif; color: #000; padding: 30px; line-height: 1.5;">
            <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #21808d; padding-bottom: 20px;">
                <h1 style="color: #21808d; margin: 0; font-size: 24px;">UNIARA - MEDICINA</h1>
                <h2 style="margin: 10px 0 0 0; font-size: 18px; color: #333;">LIGAS ACADÊMICAS</h2>
                <h3 style="margin: 20px 0 0 0; font-size: 16px;">${docTitle}</h3>
            </div>
            <div style="text-align: justify; font-size: 14px;">
                ${contentHtml}
            </div>
            <div style="margin-top: 100px; display: flex; justify-content: space-between; text-align: center; font-size: 14px;">
                <div style="width: 45%;">
                    <hr style="border: 1px solid #000; margin-bottom: 5px;">
                    <p>Assinatura do Tutor</p>
                </div>
                <div style="width: 45%;">
                    <hr style="border: 1px solid #000; margin-bottom: 5px;">
                    <p>Assinatura do Presidente da Liga</p>
                </div>
            </div>
        </div>
    `;

    // Configurações do html2pdf
    const opt = {
        margin:       15,
        filename:     `${docTitle.replace(/ /g, '_')}_Uniara.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Gera e salva o PDF
    html2pdf().set(opt).from(printElement).save();
}

// --- SAVE ACTIONS BASE ---
function saveLiga() { db.ligas.push({ id: Date.now(), nome: document.getElementById('lNome').value, sigla: document.getElementById('lSigla').value, tutor: document.getElementById('lTutor').value }); finish('ligas'); }
function savePesquisa() { const oNome = document.getElementById('pOrientNome').value; db.pesquisas.push({ id: Date.now(), titulo: document.getElementById('pTitulo').value, caracterizacao: document.getElementById('pCarac').value, tutor: document.getElementById('pTutorNome').value, orientador: oNome || document.getElementById('pTutorNome').value }); finish('pesquisas'); }
function saveEvento() { db.eventos.push({ id: Date.now(), titulo: document.getElementById('eTitulo').value, data: document.getElementById('eData').value, tipo: document.getElementById('eTipo').value }); finish('eventos'); }
function saveExtensao() { db.extensao.push({ id: Date.now(), titulo: document.getElementById('exTitulo').value, linha: document.getElementById('exLinha').value, tutor: document.getElementById('exTutor').value }); finish('extensao'); }
function saveAtividade() { db.atividades.push({ id: Date.now(), titulo: document.getElementById('aTitulo').value, data: document.getElementById('aData').value, local: document.getElementById('aLocal').value }); finish('atividades'); }

// --- SAVE ACTION RELATÓRIOS ---
function saveRelatorio(type, itemId) {
    const data = { itemId: itemId };
    for (let i = 1; i <= 7; i++) {
        const el = document.getElementById(`r${i}`);
        if (el) data[`r${i}`] = el.value;
    }
    let collectionName = type === 'pesquisas' ? 'relatoriosPesquisa' : type === 'eventos' ? 'relatoriosEvento' : 'relatoriosExtensao';
    const idx = db[collectionName].findIndex(r => r.itemId === itemId);
    if (idx >= 0) db[collectionName][idx] = data;
    else db[collectionName].push(data);
    saveDb(); closeActiveModal(); alert('✅ Relatório salvo com sucesso!');
}

function finish(page) { saveDb(); renderPage(page); closeActiveModal(); }

function deleteItem(type, id) {
    if(!confirm('Deseja excluir este registro e seus relatórios vinculados?')) return;
    db[type] = db[type].filter(i => i.id !== id);
    if (type === 'pesquisas') db.relatoriosPesquisa = db.relatoriosPesquisa.filter(r => r.itemId !== id);
    if (type === 'eventos') db.relatoriosEvento = db.relatoriosEvento.filter(r => r.itemId !== id);
    if (type === 'extensao') db.relatoriosExtensao = db.relatoriosExtensao.filter(r => r.itemId !== id);
    saveDb(); renderPage(currentPage);
}