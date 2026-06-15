// script.js — VERSÃO FINAL COM CORREÇÃO DO CLIENTE QUE SOME
const firebaseConfig = {
  apiKey: "AIzaSyCJNQEACZMM7C90J0LcLwPF7LWGvd2xdu0",
  authDomain: "meu-estoque-4f39d.firebaseapp.com",
  projectId: "meu-estoque-4f39d",
  storageBucket: "meu-estoque-4f39d.appspot.com",
  messagingSenderId: "763813971738",
  appId: "1:763813971738:web:ed5dc0cd2b1b449418cea3"
};
firebase.initializeApp(firebaseConfig);
const dbFS = firebase.firestore();
let produtos = [], clientes = [], pedidos = [], pagamentos = [];
const SENHA_CORRETA = "181022";
const NOMES_FIXOS = ["Emelly Levandoscki", "Taina Pinheiro Pomatti"];
let timersFechamento = {};

// --- CATEGORIAS ---
function carregarCategorias() {
  const categorias = localStorage.getItem('categorias');
  return categorias ? JSON.parse(categorias) : [];
}

function salvarCategoria(categoria) {
  if (!categoria.trim()) return;
  const categorias = carregarCategorias();
  if (!categorias.includes(categoria.trim())) {
    categorias.push(categoria.trim());
    localStorage.setItem('categorias', JSON.stringify(categorias));
  }
}

async function removerCategoria(event, categoria) {
  if (event) event.stopPropagation();
  const produtosNaNuvem = await dbFS.collection("produtos")
    .where("categoria", "==", categoria)
    .get();
  const possuiProdutoNoEstoque = !produtosNaNuvem.empty;
  if (possuiProdutoNoEstoque) {
    alert(`Não é possível excluir! Existem produtos cadastrados no seu estoque vinculados à categoria "${categoria}". Mude a categoria ou exclua os produtos primeiro.`);
    return;
  }
  const categorias = carregarCategorias();
  const index = categorias.indexOf(categoria);
  if (index > -1) {
    categorias.splice(index, 1);
    localStorage.setItem('categorias', JSON.stringify(categorias));
  }
  atualizarInterfaceCategorias();
  toast(`Categoria "${categoria}" removida.`);
}

function mostrarSugestoesCategoria() {
  const input = document.getElementById('p-cat');
  const sugestoes = document.getElementById('categoria-sugestoes');
  const valorDigitado = input.value.trim().toLowerCase();
  if (valorDigitado === '') {
    sugestoes.style.display = 'none';
    return;
  }
  const categorias = carregarCategorias();
  const filtradas = categorias.filter(cat => cat.toLowerCase().includes(valorDigitado));
  if (filtradas.length === 0) {
    sugestoes.style.display = 'none';
    return;
  }
  sugestoes.innerHTML = '';
  filtradas.forEach(cat => {
    const div = document.createElement('div');
    div.textContent = cat;
    div.onclick = () => {
      input.value = cat;
      sugestoes.style.display = 'none';
    };
    sugestoes.appendChild(div);
  });
  sugestoes.style.display = 'block';
}

function handleCategoryKey(event) {
  const input = document.getElementById('p-cat');
  const sugestoes = document.getElementById('categoria-sugestoes');
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const divs = sugestoes.querySelectorAll('div');
    if (divs.length > 0) {
      let current = document.querySelector('.selected');
      let next = current ? current.nextElementSibling : divs[0];
      if (current) current.classList.remove('selected');
      next?.classList.add('selected');
      input.value = next.textContent;
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const divs = sugestoes.querySelectorAll('div');
    if (divs.length > 0) {
      let current = document.querySelector('.selected');
      let prev = current ? current.previousElementSibling : divs[divs.length - 1];
      if (current) current.classList.remove('selected');
      prev?.classList.add('selected');
      input.value = prev.textContent;
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const selected = document.querySelector('.selected');
    if (selected) {
      input.value = selected.textContent;
      sugestoes.style.display = 'none';
    }
  } else if (event.key === 'Escape') {
    sugestoes.style.display = 'none';
  } else {
    mostrarSugestoesCategoria();
  }
}

function setCategoria(categoria) {
  document.getElementById('p-cat').value = categoria;
  document.getElementById('categoria-sugestoes').style.display = 'none';
}

function abrirModalCategoria() {
  document.getElementById('modal-categoria').style.display = 'flex';
  document.getElementById('nova-categoria-input').value = '';
  document.getElementById('nova-categoria-input').focus();
}

function fecharModalCategoria() {
  document.getElementById('modal-categoria').style.display = 'none';
}

async function adicionarCategoria() {
  const input = document.getElementById('nova-categoria-input');
  const novaCategoria = input.value.trim();
  if (!novaCategoria) {
    toast("Informe o nome da categoria.");
    return;
  }
  salvarCategoria(novaCategoria);
  atualizarInterfaceCategorias();
  fecharModalCategoria();
  toast(`Categoria "${novaCategoria}" adicionada!`);
}

async function atualizarInterfaceCategorias() {
  const categoriasLocalStorage = carregarCategorias();
  const produtosSnapshot = await dbFS.collection("produtos").get();
  const categoriasNoFirestore = new Set();
  produtosSnapshot.docs.forEach(doc => {
    const cat = doc.data().categoria;
    if (cat && cat.trim()) {
      categoriasNoFirestore.add(cat.trim());
    }
  });
  const todasCategorias = [...new Set([...categoriasLocalStorage, ...categoriasNoFirestore])];
  const containerBotoes = document.getElementById('botoes-rapidos-categoria');
  if (containerBotoes) {
    containerBotoes.innerHTML = '';
    todasCategorias.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-button';
      btn.type = 'button';
      btn.setAttribute('onclick', `setCategoria('${cat}')`);
      btn.innerHTML = `${cat} <span class="delete-icon" onclick="removerCategoria(event, '${cat}')">✕</span>`;
      containerBotoes.appendChild(btn);
    });
    const btnNovo = document.createElement('button');
    btnNovo.className = 'add-category-btn';
    btnNovo.type = 'button';
    btnNovo.setAttribute('onclick', 'abrirModalCategoria()');
    btnNovo.textContent = '+ Nova Categoria';
    containerBotoes.appendChild(btnNovo);
  }
  const filtroDiv = document.getElementById('filtro-categoria');
  if (filtroDiv) {
    filtroDiv.innerHTML = '<button class="category-button active" onclick="filtrarCategoria(\'todos\')">Todas</button>';
    todasCategorias.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-button';
      btn.textContent = cat;
      btn.onclick = () => filtrarCategoria(cat);
      filtroDiv.appendChild(btn);
    });
  }
  atualizarSelects();
}

function filtrarCategoria(categoria) {
  document.querySelectorAll('#filtro-categoria .category-button').forEach(btn => {
    btn.classList.remove('active');
  });
  const btnAtivo = Array.from(document.querySelectorAll('#filtro-categoria .category-button')).find(btn => btn.textContent === categoria);
  if (btnAtivo) btnAtivo.classList.add('active');
  atualizarSelects();
}

// --- SEGURANÇA ---
function inicializarSeguranca() {
  const titulo = document.getElementById("lock-titulo");
  const subtitulo = document.getElementById("lock-subtitulo");
  const campo = document.getElementById("campo-senha");
  titulo.textContent = "Sistema Protegido";
  subtitulo.textContent = "Insira a senha secreta compartilhada para acessar:";
  campo.focus();
}

function verificarSenha() {
  const campo = document.getElementById("campo-senha");
  const valorDigitado = campo.value.trim();
  if (valorDigitado === SENHA_CORRETA) {
    sessionStorage.setItem('sistemaDesbloqueado', 'true');
    desbloquearApp();
  } else {
    alert("Senha incorreta! Acesso negado.");
    campo.value = "";
    campo.focus();
  }
}

function desbloquearApp() {
  document.getElementById("tela-bloqueio").style.display = "none";
  document.getElementById("app-container").style.display = "block";
  document.getElementById("campo-senha").value = "";
  ativarSincronizacaoEmTempoReal();
}

function bloquearSistema() {
  document.getElementById("app-container").style.display = "none";
  document.getElementById("tela-bloqueio").style.display = "flex";
  sessionStorage.removeItem('sistemaDesbloqueado');
  inicializarSeguranca();
}

// --- INICIALIZAÇÃO ---
window.addEventListener("DOMContentLoaded", function() {
  if (sessionStorage.getItem('sistemaDesbloqueado') === 'true') {
    desbloquearApp();
  } else {
    inicializarSeguranca();
  }
});

// --- SINCRONIZAÇÃO EM TEMPO REAL ---
function ativarSincronizacaoEmTempoReal() {
  dbFS.collection("produtos").orderBy("nome", "asc").onSnapshot(snapshot => {
    produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderEstoque();
    atualizarInterfaceCategorias();
  });
  dbFS.collection("clientes").orderBy("nome", "asc").onSnapshot(snapshot => {
    clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderClientes();
    atualizarInterfaceCategorias();
  });
  dbFS.collection("pedidos").onSnapshot(snapshot => {
    pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderClientes();
    renderHistorico();
  });
  dbFS.collection("pagamentos").onSnapshot(snapshot => {
    pagamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderClientes();
    renderHistorico();
  });
  setTimeout(async () => {
    const produtosSnapshot = await dbFS.collection("produtos").get();
    const categoriasUsadas = new Set();
    produtosSnapshot.docs.forEach(doc => {
      const cat = doc.data().categoria;
      if (cat) categoriasUsadas.add(cat.trim());
    });
    const categoriasLocalStorage = carregarCategorias();
    const categoriasParaExcluir = categoriasLocalStorage.filter(cat => !categoriasUsadas.has(cat));
    if (categoriasParaExcluir.length > 0) {
      const novasCategorias = categoriasLocalStorage.filter(cat => !categoriasParaExcluir.includes(cat));
      localStorage.setItem('categorias', JSON.stringify(novasCategorias));
      atualizarInterfaceCategorias();
      toast(`Limpeza: ${categoriasParaExcluir.length} categorias órfãs removidas.`);
    }
  }, 2000);
}

// --- TOAST ---
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// --- ABAS ---
function showTab(name, btn) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(name).classList.add("active");
  btn.classList.add("active");
}

// --- ESTOQUE ---
function renderEstoque() {
  const tbody = document.getElementById("tbody-estoque");
  if (!produtos.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum produto cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = produtos.map(p => {
    const qtdFinal = p.quantidade !== undefined ? p.quantidade : 0;
    const precoFinal = p.preco || 0;
    return `
    <tr>
      <td style="font-weight: 600; color: #0f172a;">${p.nome || 'Sem nome'}</td>
      <td><span style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${p.categoria || 'Geral'}</span></td>
      <td>
        <div class="qty-ctrl">
          <button onclick="ajustarQty('${p.id}', -1)">&minus;</button>
          <span class="qty-num">${qtdFinal}</span>
          <button onclick="ajustarQty('${p.id}', 1)">&plus;</button>
        </div>
      </td>
      <td style="font-weight: 500;">R$ ${precoFinal.toFixed(2)}</td>
      <td class="actions">
        <button class="sm" onclick="editarProduto('${p.id}')">Editar</button>
        <button class="sm danger" onclick="deletarProduto('${p.id}')">Excluir</button>
      </td>
    </tr>
    `;
  }).join("");
}

async function ajustarQty(id, delta) {
  const p = produtos.find(prod => prod.id === id);
  if (!p) return;
  const qtdAtual = p.quantidade !== undefined ? p.quantidade : 0;
  const novaQty = Math.max(0, qtdAtual + delta);
  await dbFS.collection("produtos").doc(id).update({ quantidade: novaQty });
}

async function salvarProduto() {
  const id = document.getElementById("edit-produto-id").value;
  const nome = document.getElementById("p-nome").value.trim();
  const cat = document.getElementById("p-cat").value.trim();
  const qty = parseInt(document.getElementById("p-qty").value) || 0;
  const preco = parseFloat(document.getElementById("p-preco").value) || 0;
  if (!nome || !cat) {
    toast("Preencha nome e categoria.");
    return;
  }
  salvarCategoria(cat);
  if (id) {
    await dbFS.collection("produtos").doc(id).update({ nome, categoria: cat, quantidade: qty, preco });
    toast("Produto atualizado.");
  } else {
    await dbFS.collection("produtos").add({ nome, categoria: cat, quantidade: qty, preco, data: new Date().toISOString() });
    toast("Produto adicionado.");
  }
  atualizarInterfaceCategorias();
  cancelarEdicaoProduto();
}

function editarProduto(id) {
  const p = produtos.find(prod => prod.id === id);
  const qtdAtual = p.quantidade !== undefined ? p.quantidade : 0;
  document.getElementById("edit-produto-id").value = id;
  document.getElementById("p-nome").value = p.nome || '';
  document.getElementById("p-cat").value = p.categoria || '';
  document.getElementById("p-qty").value = qtdAtual;
  document.getElementById("p-preco").value = p.preco || 0;
  document.getElementById("estoque-title").textContent = "Editar produto";
  document.getElementById("p-nome").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoProduto() {
  document.getElementById("edit-produto-id").value = "";
  document.getElementById("p-nome").value = "";
  document.getElementById("p-cat").value = "";
  document.getElementById("p-qty").value = "0";
  document.getElementById("p-preco").value = "0";
  document.getElementById("estoque-title").textContent = "Novo produto";
  document.getElementById('categoria-sugestoes').style.display = 'none';
}

async function deletarProduto(id) {
  if (!confirm("Excluir este produto da nuvem?")) return;
  await dbFS.collection("produtos").doc(id).delete();
  toast("Produto excluído.");
}

// --- CLIENTES ---
function renderClientes() {
  const tbody = document.getElementById("tbody-clientes");
  const clientesFixos = [];
  const clientesComPendencia = [];
  const clientesSemPendencia = [];
  clientes.forEach(cliente => {
    const totalPedidos = pedidos
      .filter(p => p.clienteId === cliente.id)
      .reduce((s, p) => s + p.valorTotal, 0);
    const totalPago = pedidos
      .filter(p => p.clienteId === cliente.id)
      .reduce((s, p) => s + p.valorPago, 0) +
      pagamentos.filter(pg => pg.clienteId === cliente.id)
        .reduce((s, pg) => s + pg.valor, 0);
    const saldo = Math.max(0, totalPedidos - totalPago);
    if (NOMES_FIXOS.includes(cliente.nome)) {
      clientesFixos.push({ ...cliente, saldo });
    } else if (saldo > 0) {
      clientesComPendencia.push({ ...cliente, saldo });
    } else {
      clientesSemPendencia.push({ ...cliente, saldo });
    }
  });
  const ordenadosFixos = clientesFixos.sort((a, b) => {
    const indexA = NOMES_FIXOS.indexOf(a.nome);
    const indexB = NOMES_FIXOS.indexOf(b.nome);
    return indexA - indexB;
  });
  const ordenadosPendencia = clientesComPendencia.sort((a, b) => {
    return a.nome.localeCompare(b.nome);
  });
  const ordenadosSemPendencia = clientesSemPendencia.sort((a, b) => {
    return a.nome.localeCompare(b.nome);
  });
  const clientesOrdenados = [
    ...ordenadosFixos,
    ...ordenadosPendencia,
    ...ordenadosSemPendencia
  ];
  if (!clientesOrdenados.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum cliente cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = clientesOrdenados.map(c => {
    const totalPedidos = pedidos
      .filter(p => p.clienteId === c.id)
      .reduce((s, p) => s + p.valorTotal, 0);
    const totalPago = pedidos
      .filter(p => p.clienteId === c.id)
      .reduce((s, p) => s + p.valorPago, 0) +
      pagamentos.filter(pg => pg.clienteId === c.id)
        .reduce((s, pg) => s + pg.valor, 0);
    const saldo = Math.max(0, totalPedidos - totalPago);
    const saldoClass = saldo === 0 ? "saldo-zero" : "saldo-pos";
    const pedidosComDivida = (saldo <= 0) ? [] : pedidos.filter(p => {
      if (p.clienteId !== c.id) return false;
      return p.valorPago < p.valorTotal;
    });
    return `
    <tr class="client-row" id="linha-cliente-${c.id}">
      <td style="font-weight: 600; color: #0f172a;">
        <div class="client-name" id="trigger-${c.id}" onclick="toggleHistorico('${c.id}')">
          ${c.nome} <span class="arrow">▼</span>
        </div>
        <div class="client-history" id="historico-${c.id}">
          <h4>Dívida Atual Detalhada</h4>
          ${pedidosComDivida.length > 0 ? pedidosComDivida.map(p => {
            const restandoNoPedido = p.valorTotal - p.valorPago;
            const produtosDesc = p.itens.map(i => {
              return `
              <div class="history-item">
                <span class="prod-name">${i.nome || 'Produto'} (${i.categoria || 'Geral'})</span>
                <span class="prod-qty">x${i.quantidade || 0}</span>
                <span class="prod-total">R$ ${(i.preco * i.quantidade).toFixed(2)}</span>
              </div>
              `;
            }).join('');
            const data = p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—";
            return `
            <div style="border-bottom: 1px dashed #fef08a; padding: 8px 0; margin-bottom: 4px;">
              <div style="font-size: 12px; color: #713f12; margin-bottom: 4px;">
                <strong>Pedido em ${data}</strong> (Pendente: R$ ${restandoNoPedido.toFixed(2)})
              </div>
              ${produtosDesc}
            </div>
            `;
          }).join('') : '<div class="history-item" style="color: #10b981; font-weight: 600; padding: 4px 0;">Nenhum produto pendente de pagamento!</div>'}
        </div>
      </td>
      <td class="${saldoClass}">R$ ${saldo.toFixed(2)}</td>
      <td>
        ${saldo > 0 ? `
        <div class="pay-row">
          <input type="number" id="pay-val-${c.id}" value="0" step="0.01" min="0" max="${saldo.toFixed(2)}" placeholder="R$">
          <button class="sm success" onclick="abaterPagamento('${c.id}', ${saldo})">Abater</button>
          <button class="sm primary" onclick="quitarTudo('${c.id}', ${saldo})">Quitar tudo</button>
        </div>
        ` : '<span class="badge badge-ok">Sem dívida</span>'}
      </td>
      <td class="actions">
        <button class="sm" onclick="editarCliente(\'${c.id}\')">Editar</button>
        <button class="sm danger" onclick="deletarCliente(\'${c.id}\')">Excluir</button>
      </td>
    </tr>
    `;
  }).join("");
  const sel = document.getElementById("filtro-cliente");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos os clientes</option>' +
    clientesOrdenados.map(c => `<option value="${c.id}"${c.id === cur ? " selected" : ""}>${c.nome}</option>`).join("");
}

function toggleHistorico(clienteId) {
  const historyDiv = document.getElementById(`historico-${clienteId}`);
  const nameDiv = document.getElementById(`trigger-${clienteId}`);
  if (timersFechamento[clienteId]) {
    clearTimeout(timersFechamento[clienteId]);
    delete timersFechamento[clienteId];
  }
  if (historyDiv.style.display === 'block') {
    historyDiv.style.display = 'none';
    nameDiv.classList.remove('open');
  } else {
    historyDiv.style.display = 'block';
    nameDiv.classList.add('open');
    timersFechamento[clienteId] = setTimeout(() => {
      historyDiv.style.display = 'none';
      nameDiv.classList.remove('open');
      delete timersFechamento[clienteId];
    }, 10000);
  }
}

async function abaterPagamento(clienteId, saldo) {
  const inp = document.getElementById("pay-val-" + clienteId);
  const valor = parseFloat(inp.value) || 0;
  if (valor <= 0) {
    toast("Informe um valor válido.");
    return;
  }
  if (valor > saldo) {
    toast("Valor maior que o saldo devedor.");
    return;
  }
  await dbFS.collection("pagamentos").add({ clienteId, valor, data: new Date().toISOString() });
  toast("Pagamento registrado em rede.");
}

async function quitarTudo(clienteId, saldo) {
  if (!confirm("Quitar todo o saldo de R$ " + saldo.toFixed(2) + "?")) return;
  await dbFS.collection("pagamentos").add({ clienteId, valor: saldo, data: new Date().toISOString() });
  toast("Saldo quitado com sucesso.");
}

async function salvarCliente() {
  const id = document.getElementById("edit-cliente-id").value;
  const nome = document.getElementById("c-nome").value.trim();
  if (!nome) {
    toast("Informe o nome do cliente.");
    return;
  }
  if (id) {
    await dbFS.collection("clientes").doc(id).update({ nome });
    toast("Cliente atualizado.");
  } else {
    await dbFS.collection("clientes").add({ nome, data: new Date().toISOString() });
    toast("Cliente adicionado.");
  }
  cancelarEdicaoCliente();
}

function editarCliente(id) {
  const c = clientes.find(cl => cl.id === id);
  document.getElementById("edit-cliente-id").value = id;
  document.getElementById("c-nome").value = c.nome;
  document.getElementById("cliente-title").textContent = "Editar cliente";
  document.getElementById("c-nome").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoCliente() {
  document.getElementById("edit-cliente-id").value = "";
  document.getElementById("c-nome").value = "";
  document.getElementById("cliente-title").textContent = "Novo cliente";
}

async function deletarCliente(id) {
  if (!confirm("Excluir este cliente?")) return;
  await dbFS.collection("clientes").doc(id).delete();
  toast("Cliente excluído.");
}

// --- PEDIDOS ---
let itensPedido = [];

function adicionarItemPedido() {
  const sel = document.getElementById("ped-produto");
  const produtoId = sel.value;
  const qty = parseInt(document.getElementById("ped-qty").value, 10) || 1;
  if (!produtoId) {
    toast("Selecione um produto.");
    return;
  }
  const prod = produtos.find(p => p.id === produtoId);
  if (!prod) return;
  const qtdAtual = prod.quantidade !== undefined ? prod.quantidade : 0;
  const existente = itensPedido.find(i => i.produtoId === produtoId);
  const jaAdicionado = existente ? existente.quantidade : 0;
  if (jaAdicionado + qty > qtdAtual) {
    toast("Estoque insuficiente para " + prod.nome + ".");
    return;
  }
  if (existente) {
    existente.quantidade += qty;
  } else {
    itensPedido.push({
      produtoId: produtoId,
      nome: prod.nome,
      preco: prod.preco || 0,
      quantidade: qty,
      categoria: prod.categoria || 'Geral'
    });
  }
  document.getElementById("ped-produto").value = "";
  document.getElementById("ped-qty").value = "1";
  renderItensPedido();
}

function removerItemPedido(produtoId) {
  itensPedido = itensPedido.filter(i => i.produtoId !== produtoId);
  renderItensPedido();
}

function renderItensPedido() {
  const lista = document.getElementById("itens-lista");
  const resumo = document.getElementById("resumo-pedido");
  const resumoItens = document.getElementById("resumo-itens");
  const resumoTotal = document.getElementById("resumo-total");
  if (!itensPedido.length) {
    lista.innerHTML = '<span style="font-size:13px;color:#94a3b8">Nenhum produto adicionado ainda.</span>';
    resumo.style.display = "none";
    return;
  }
  lista.innerHTML = itensPedido.map(i => `
    <span class="item-tag">
      ${i.nome} (x${i.quantidade}) &mdash; R$ ${(i.preco * i.quantidade).toFixed(2)}
      <button onclick="removerItemPedido('${i.produtoId}')">&#10005;</button>
    </span>
  `).join("");
  const total = itensPedido.reduce((s, i) => s + i.preco * i.quantidade, 0);
  resumoItens.innerHTML = itensPedido.map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#475569;">
      <span>${i.nome} <b>x${i.quantidade}</b></span>
      <span>R$ ${(i.preco * i.quantidade).toFixed(2)}</span>
    </div>
  `).join("");
  resumoTotal.innerHTML = `<span>Valor Total:</span> <span style="float:right">R$ ${total.toFixed(2)}</span>`;
  resumo.style.display = "block";
}

async function fazerPedido() {
  const clienteId = document.getElementById("ped-cliente").value;
  const forma = document.getElementById("ped-forma").value;
  const parcelas = parseInt(document.getElementById("ped-parcelas").value) || 1;
  const valorPago = parseFloat(document.getElementById("ped-pago").value) || 0;
  if (!clienteId) {
    toast("Selecione um cliente.");
    return;
  }
  if (!itensPedido.length) {
    toast("Adicione pelo menos um produto.");
    return;
  }
  const valorTotal = itensPedido.reduce((s, i) => s + i.preco * i.quantidade, 0);
  await dbFS.collection("pedidos").add({
    clienteId,
    itens: itensPedido.map(i => ({
      produtoId: i.produtoId,
      nome: i.nome,
      preco: i.preco,
      quantidade: i.quantidade,
      categoria: i.categoria
    })),
    quantidade: itensPedido.reduce((s, i) => s + i.quantidade, 0),
    valorTotal,
    valorPago,
    parcelas,
    formaPagamento: forma,
    data: new Date().toISOString()
  });
  for (const item of itensPedido) {
    const prod = produtos.find(p => p.id === item.produtoId);
    if (prod) {
      const qtdAtual = prod.quantidade !== undefined ? prod.quantidade : 0;
      await dbFS.collection("produtos").doc(item.produtoId).update({
        quantidade: Math.max(0, qtdAtual - item.quantidade)
      });
    }
  }
  toast("Pedido registrado em rede com sucesso.");
  limparPedido();
}

function limparPedido() {
  document.getElementById("ped-cliente").value = "";
  document.getElementById("ped-produto").value = "";
  document.getElementById("ped-qty").value = "1";
  document.getElementById("ped-forma").value = "dinheiro";
  document.getElementById("ped-parcelas").value = "1";
  document.getElementById("ped-pago").value = "0";
  itensPedido = [];
  renderItensPedido();
}

// --- HISTÓRICO ---
function renderHistorico() {
  const filtro = document.getElementById("filtro-cliente").value;
  const tbody = document.getElementById("tbody-historico");
  const lista = pedidos;
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Nenhum pedido registrado.</td></tr>';
    return;
  }
  const filtrados = filtro ? lista.filter(p => p.clienteId === filtro) : lista;
  tbody.innerHTML = filtrados.map(ped => {
    const c = clientes.find(x => x.id === ped.clienteId);
    let produtosDesc = "";
    if (ped.itens && ped.itens.length) {
      produtosDesc = ped.itens.map(i => `${i.nome} (${i.categoria || 'Geral'}) (x${i.quantidade})`).join(", ");
    } else {
      produtosDesc = "—";
    }
    const pago = ped.valorPago >= ped.valorTotal;
    const data = ped.data ? new Date(ped.data).toLocaleDateString("pt-BR") : "—";
    return `
    <tr>
      <td style="color: #64748b;">${data}</td>
      <td style="font-weight: 500;">${c ? c.nome : "—"}</td>
      <td style="max-width:240px; font-size:13px; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${produtosDesc}">${produtosDesc}</td>
      <td style="font-weight: 600;">R$ ${ped.valorTotal.toFixed(2)}</td>
      <td>R$ ${ped.valorPago.toFixed(2)}</td>
      <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px">${ped.parcelas}x</span></td>
      <td style="text-transform: uppercase; font-size:12px; font-weight:500; color:#64748b;">${ped.formaPagamento}</td>
      <td><span class="badge ${pago ? "badge-ok" : "badge-pend"}">${pago ? "Pago" : "Pendente"}</span></td>
    </tr>
    `;
  }).join("");
}

// --- SELECTS ---
function atualizarSelects() {
  // Atualiza select de clientes (mantém a seleção atual)
  const pedCliente = document.getElementById("ped-cliente");
  if (pedCliente) {
    const valorAtual = pedCliente.value;
    pedCliente.innerHTML = '<option value="">Selecione...</option>';
    clientes.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.nome;
      if (c.id === valorAtual) option.selected = true;
      pedCliente.appendChild(option);
    });
  }

  // Atualiza select de produtos (mantém a seleção atual)
  const pedProduto = document.getElementById("ped-produto");
  if (pedProduto) {
    const valorAtualProduto = pedProduto.value;
    pedProduto.innerHTML = '<option value="">Selecione...</option>';

    const filtroAtivo = Array.from(document.querySelectorAll('#filtro-categoria .category-button.active')).find(btn => btn.textContent !== 'Todas');
    const categoriaFiltrada = filtroAtivo ? filtroAtivo.textContent : null;
    const produtosFiltrados = !categoriaFiltrada ? produtos : produtos.filter(p => p.categoria === categoriaFiltrada);

    produtosFiltrados.forEach(p => {
      const qtdAtual = p.quantidade !== undefined ? p.quantidade : 0;
      const precoFinal = p.preco || 0;
      const categoria = p.categoria ? ` (${p.categoria})` : '';
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.nome || 'Sem nome'}${categoria} (${qtdAtual} un.) — R$ ${precoFinal.toFixed(2)}`;
      if (p.id === valorAtualProduto) option.selected = true;
      pedProduto.appendChild(option);
    });
  }
}

// --- EVENTOS DE TECLADO ---
function handleEnterKey(event, nextFieldId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (nextFieldId === 'salvar-produto') {
      salvarProduto();
      return;
    }
    if (nextFieldId === 'salvar-cliente') {
      salvarCliente();
      return;
    }
    if (nextFieldId === 'adicionar-item') {
      adicionarItemPedido();
      return;
    }
    const nextField = document.getElementById(nextFieldId);
    if (nextField) nextField.focus();
  }
}

// --- EVENTOS GLOBAIS ---
document.addEventListener('click', function(e) {
  const sugestoes = document.getElementById('categoria-sugestoes');
  const input = document.getElementById('p-cat');
  if (sugestoes && !sugestoes.contains(e.target) && e.target !== input) {
    sugestoes.style.display = 'none';
  }
});

const modalCat = document.getElementById('modal-categoria');
if (modalCat) {
  modalCat.addEventListener('click', function(e) {
    if (e.target === this) fecharModalCategoria();
  });
}

// 🔐 BOTÃO SECRETO DE LIMPEZA — Ative com Ctrl + Alt + P
window.addEventListener('keydown', async (e) => {
  if (e.key === 'p' && e.ctrlKey && e.altKey) {
    e.preventDefault();
    const confirmed = confirm(
      "⚠️ ATENÇÃO: Isso apagará TODOS os produtos, clientes, pedidos e pagamentos do sistema.\n\n" +
      "Você tem certeza que deseja limpar tudo? Esta ação não pode ser desfeita."
    );
    if (!confirmed) return;
    try {
      const collections = ['produtos', 'clientes', 'pedidos', 'pagamentos'];
      let totalDeleted = 0;
      for (const col of collections) {
        const snapshot = await dbFS.collection(col).get();
        const batch = dbFS.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snapshot.size;
      }
      toast(`✅ ${totalDeleted} registros apagados com sucesso!`);
      console.log(`[CLEANUP] LIMPEZA CONCLUÍDA: ${totalDeleted} registros removidos.`);
    } catch (error) {
      toast("❌ Erro ao apagar dados. Verifique a conexão ou permissões.");
      console.error("Erro na limpeza:", error);
    }
  }
});