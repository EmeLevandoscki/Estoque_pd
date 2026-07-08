// script.js — VERSÃO FINAL COMPLETA
// Funcionalidades: estoque, pedidos, clientes, histórico, categorias dinâmicas,
// descrição otimizada (modal), promoção, preço de custo/venda, resumo financeiro,
// forma de pagamento no abatimento de dívida

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

// ============================================================
// --- CATEGORIAS ---
// ============================================================

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
  if (!produtosNaNuvem.empty) {
    alert(`Não é possível excluir! Existem produtos cadastrados no seu estoque vinculados à categoria "${categoria}". Mude a categoria ou exclua os produtos primeiro.`);
    return;
  }
  const categoriasArray = carregarCategorias();
  const index = categoriasArray.indexOf(categoria);
  if (index > -1) {
    categoriasArray.splice(index, 1);
    localStorage.setItem('categorias', JSON.stringify(categoriasArray));
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
  atualizarFiltroCategoriaEstoque();
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

// ============================================================
// --- SEGURANÇA ---
// ============================================================

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

// ============================================================
// --- INICIALIZAÇÃO ---
// ============================================================

window.addEventListener("DOMContentLoaded", function() {
  toggleCampoCombo();
  if (sessionStorage.getItem('sistemaDesbloqueado') === 'true') {
    desbloquearApp();
  } else {
    inicializarSeguranca();
  }
});

// ============================================================
// --- SINCRONIZAÇÃO EM TEMPO REAL ---
// ============================================================

function ativarSincronizacaoEmTempoReal() {
  dbFS.collection("produtos").orderBy("nome", "asc").onSnapshot(snapshot => {
    produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderEstoque();
    atualizarInterfaceCategorias();
    atualizarFiltroCategoriaEstoque();
    atualizarResumoFinanceiro();
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
    atualizarResumoFinanceiro();
  });

  dbFS.collection("pagamentos").onSnapshot(snapshot => {
    pagamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderClientes();
    renderHistorico();
    atualizarResumoFinanceiro();
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

// ============================================================
// --- TOAST ---
// ============================================================

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// ============================================================
// --- ABAS ---
// ============================================================

function showTab(name, btn) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(name).classList.add("active");
  btn.classList.add("active");
}

// ============================================================
// --- ESTOQUE ---
// ============================================================

function getQuantidadeProduto(produto) {
  return produto && produto.quantidade !== undefined ? Number(produto.quantidade) : 0;
}

function isProdutoAtivo(produto) {
  if (produto && produto.ativo !== undefined) return Boolean(produto.ativo);
  return getQuantidadeProduto(produto) > 0;
}

function getStatusTag(produto) {
  return isProdutoAtivo(produto)
    ? '<span class="badge-promo" style="background:#dcfce7;color:#166534;margin-left:6px;">ativo</span>'
    : '<span class="badge-promo" style="background:#fee2e2;color:#b91c1c;margin-left:6px;">inativo</span>';
}

function toggleCampoCombo() {
  const tipo = document.getElementById('p-tipo')?.value || 'simples';
  const grupoCombo = document.getElementById('grupo-combo');
  if (grupoCombo) {
    grupoCombo.style.display = tipo === 'combo' ? 'block' : 'none';
  }
  if (tipo === 'combo') {
    atualizarListaProdutosCombo();
  }
}

function atualizarListaProdutosCombo() {
  const input = document.getElementById('p-combo-produto');
  const datalist = document.getElementById('lista-produtos-combo');
  if (!datalist) return;
  
  const idProdutoAtual = document.getElementById('edit-produto-id').value;
  const filtro = input.value.toLowerCase();
  
  const produtosFiltrados = produtos
    .filter(p => p.id !== idProdutoAtual && p.tipo !== 'combo')
    .filter(p => p.nome.toLowerCase().includes(filtro))
    .slice(0, 15);
  
  datalist.innerHTML = produtosFiltrados.map(p => {
    const qtd = getQuantidadeProduto(p);
    return `<option value="${p.nome}" data-id="${p.id}" data-preco="${p.precoVenda || 0}"> (${qtd} un.) — R$ ${(p.precoVenda || 0).toFixed(2)}</option>`;
  }).join('');
}

let itemsComboTemp = [];

function adicionarItemAoCombo() {
  const input = document.getElementById('p-combo-produto');
  const qtyInput = document.getElementById('p-combo-qty');
  const nomeProduto = input.value.trim();
  const quantidade = parseInt(qtyInput.value, 10) || 1;

  if (!nomeProduto) {
    toast('Digite o nome de um produto.');
    return;
  }

  const prod = produtos.find(p => p.nome.toLowerCase() === nomeProduto.toLowerCase() && p.tipo !== 'combo');
  if (!prod) {
    toast(`Produto "${nomeProduto}" não encontrado no estoque.`);
    return;
  }

  const existente = itemsComboTemp.find(i => i.produtoId === prod.id);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    itemsComboTemp.push({
      produtoId: prod.id,
      nome: prod.nome,
      quantidade: quantidade
    });
  }

  input.value = '';
  qtyInput.value = '1';
  renderizarItensComboTemp();
  atualizarListaProdutosCombo();
  toast(`${prod.nome} adicionado ao combo.`);
}

function renderizarItensComboTemp() {
  const tags = document.getElementById('itens-combo-tags');
  const listDiv = document.getElementById('lista-itens-combo');
  const hidden = document.getElementById('p-itens-combo');

  if (!itemsComboTemp.length) {
    listDiv.style.display = 'none';
    hidden.value = '';
    return;
  }

  listDiv.style.display = 'block';
  tags.innerHTML = itemsComboTemp.map(item => `
    <span style="display: inline-flex; align-items: center; gap: 6px; background: #e0f2fe; padding: 6px 10px; border-radius: 999px; border: 1px solid #bfdbfe; font-size: 13px; color: #0369a1;">
      ${item.nome} x${item.quantidade}
      <button type="button" onclick="removerItemDoComboTemp('${item.produtoId}')" style="border: none; background: none; cursor: pointer; color: #0369a1; font-weight: bold; padding: 0; margin: 0;">×</button>
    </span>
  `).join('');

  hidden.value = JSON.stringify(itemsComboTemp);
}

function removerItemDoComboTemp(produtoId) {
  itemsComboTemp = itemsComboTemp.filter(i => i.produtoId !== produtoId);
  renderizarItensComboTemp();
  toast('Item removido do combo.');
}

function parseItensCombo(texto) {
  if (!texto) return [];
  try {
    const parsed = JSON.parse(texto);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return texto
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [nome, qtd] = item.split('|').map(part => part.trim());
      return {
        nome: nome || 'Item',
        quantidade: parseInt(qtd || '1', 10) || 1
      };
    });
}

function formatarItensCombo(itens) {
  if (!Array.isArray(itens) || !itens.length) return '';
  return itens.map(item => `${item.nome} x${item.quantidade}`).join(', ');
}

function getHtmlProdutoEstoque(p) {
  const qtdFinal = getQuantidadeProduto(p);
  const custoFinal = p.precoCusto || 0;
  const precoFinal = p.precoVenda || 0;
  const emPromocao = p.emPromocao === 'sim';
  const descricao = p.descricao || '';
  const descricaoResumo = descricao.length > 30 ? descricao.substring(0, 30) + '...' : descricao;
  const precoCustoExibido = custoFinal > 0 ? `C: R$ ${custoFinal.toFixed(2)}` : '';
  const precoVendaExibido = precoFinal > 0 ? `V: R$ ${precoFinal.toFixed(2)}` : '';
  const promoTag = emPromocao ? '<span class="badge-promo">promo</span>' : '';
  const descricaoEsc = descricao.replace(/'/g, "\\'").replace(/"/g, '"');
  const statusTag = getStatusTag(p);
  const tipoBadge = p.tipo === 'combo'
    ? '<span class="badge-promo" style="background:#e0f2fe;color:#075985;margin-left:6px;">combo</span>'
    : '';
  const comboResumo = p.tipo === 'combo' && Array.isArray(p.itensCombo) && p.itensCombo.length
    ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">Combo: ${formatarItensCombo(p.itensCombo)}</div>`
    : '';
  return `
    <tr>
      <td style="font-weight: 600; color: #0f172a;">${p.nome || 'Sem nome'}${statusTag}${tipoBadge}${comboResumo}</td>
      <td><span class="cat-tag">${p.categoria || 'Geral'}</span></td>
      <td>
        <div class="qty-ctrl">
          <button onclick="ajustarQty('${p.id}', -1)">&minus;</button>
          <span class="qty-num">${qtdFinal}</span>
          <button onclick="ajustarQty('${p.id}', 1)">&plus;</button>
        </div>
      </td>
      <td style="font-weight: 500; font-size: 13px;">
        ${precoCustoExibido}<br>
        ${precoVendaExibido} ${promoTag}
      </td>
      <td class="desc-cell" onclick="mostrarDescricao('${descricaoEsc}')">
        ${descricaoResumo || '<span style="color:#cbd5e1">—</span>'}
      </td>
      <td class="actions">
        <button class="sm" onclick="editarProduto('${p.id}')">Editar</button>
        <button class="sm danger" onclick="deletarProduto('${p.id}')">Excluir</button>
      </td>
    </tr>
  `;
}

function renderEstoque() {
  const tbody = document.getElementById("tbody-estoque");
  if (!produtos.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum produto cadastrado.</td></tr>';
    atualizarFiltroCategoriaEstoque();
    return;
  }
  const produtosOrdenados = [...produtos].sort((a, b) => {
    const aZero = getQuantidadeProduto(a) === 0;
    const bZero = getQuantidadeProduto(b) === 0;
    if (aZero && !bZero) return 1;
    if (!aZero && bZero) return -1;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  tbody.innerHTML = produtosOrdenados.map(getHtmlProdutoEstoque).join("");
  atualizarFiltroCategoriaEstoque();
  atualizarResumoFinanceiro();
}

async function ajustarQty(id, delta) {
  const p = produtos.find(prod => prod.id === id);
  if (!p) return;
  const qtdAtual = getQuantidadeProduto(p);
  const novaQty = Math.max(0, qtdAtual + delta);
  await dbFS.collection("produtos").doc(id).update({ quantidade: novaQty, ativo: novaQty > 0 });
}

async function salvarProduto() {
  const id = document.getElementById("edit-produto-id").value;
  const nome = document.getElementById("p-nome").value.trim();
  const cat = document.getElementById("p-cat").value.trim();
  const qty = parseInt(document.getElementById("p-qty").value) || 0;
  const custo = parseFloat(document.getElementById("p-custo").value) || null;
  const preco = parseFloat(document.getElementById("p-preco").value) || null;
  const promocao = document.getElementById("p-promocao").value || null;
  const tipo = document.getElementById("p-tipo")?.value || "simples";
  const itensCombo = tipo === 'combo' ? itemsComboTemp : [];
  const descricao = document.getElementById("p-descricao").value.trim() || null;

  if (!nome || !cat) {
    toast("Preencha nome e categoria.");
    return;
  }
  if (tipo === 'combo' && !itensCombo.length) {
    toast("Adicione pelo menos um item ao combo.");
    return;
  }
  salvarCategoria(cat);
  const produtoAtivo = qty > 0;

  if (id) {
    await dbFS.collection("produtos").doc(id).update({
      nome, categoria: cat, quantidade: qty, ativo: produtoAtivo,
      precoCusto: custo, precoVenda: preco,
      emPromocao: promocao, descricao: descricao,
      tipo, itensCombo
    });
    toast("Produto atualizado.");
  } else {
    await dbFS.collection("produtos").add({
      nome, categoria: cat, quantidade: qty, ativo: produtoAtivo,
      precoCusto: custo, precoVenda: preco,
      emPromocao: promocao, descricao: descricao,
      tipo, itensCombo,
      data: new Date().toISOString()
    });
    toast("Produto adicionado.");
  }
  atualizarInterfaceCategorias();
  cancelarEdicaoProduto();
}

function editarProduto(id) {
  const p = produtos.find(prod => prod.id === id);
  document.getElementById("edit-produto-id").value = id;
  document.getElementById("p-nome").value = p.nome || '';
  document.getElementById("p-cat").value = p.categoria || '';
  document.getElementById("p-qty").value = p.quantidade !== undefined ? p.quantidade : 0;
  document.getElementById("p-custo").value = p.precoCusto || 0;
  document.getElementById("p-preco").value = p.precoVenda || 0;
  document.getElementById("p-promocao").value = p.emPromocao || "";
  document.getElementById("p-tipo").value = p.tipo || "simples";
  itemsComboTemp = Array.isArray(p.itensCombo) ? p.itensCombo.map(item => ({
    produtoId: item.produtoId || '',
    nome: item.nome,
    quantidade: item.quantidade
  })) : [];
  document.getElementById("p-descricao").value = p.descricao || "";
  toggleCampoCombo();
  renderizarItensComboTemp();
  document.getElementById("estoque-title").textContent = "Editar produto";
  document.getElementById("p-nome").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoProduto() {
  document.getElementById("edit-produto-id").value = "";
  document.getElementById("p-nome").value = "";
  document.getElementById("p-cat").value = "";
  document.getElementById("p-qty").value = "0";
  document.getElementById("p-custo").value = "0";
  document.getElementById("p-preco").value = "0";
  document.getElementById("p-promocao").value = "";
  document.getElementById("p-tipo").value = "simples";
  itemsComboTemp = [];
  document.getElementById("p-descricao").value = "";
  toggleCampoCombo();
  renderizarItensComboTemp();
  document.getElementById("estoque-title").textContent = "Novo produto";
  document.getElementById('categoria-sugestoes').style.display = 'none';
}

async function deletarProduto(id) {
  if (!confirm("Excluir este produto da nuvem?")) return;
  await dbFS.collection("produtos").doc(id).delete();
  toast("Produto excluído.");
}

// ============================================================
// --- CLIENTES ---
// ============================================================

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
    return NOMES_FIXOS.indexOf(a.nome) - NOMES_FIXOS.indexOf(b.nome);
  });
  const ordenadosPendencia = clientesComPendencia.sort((a, b) => a.nome.localeCompare(b.nome));
  const ordenadosSemPendencia = clientesSemPendencia.sort((a, b) => a.nome.localeCompare(b.nome));

  const clientesOrdenados = [...ordenadosFixos, ...ordenadosPendencia, ...ordenadosSemPendencia];

  if (!clientesOrdenados.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum cliente cadastrado.</td></tr>';
    atualizarResumoFinanceiro();
    return;
  }

  tbody.innerHTML = clientesOrdenados.map(c => {
    const totalPedidos = pedidos
      .filter(p => p.clienteId === c.id)
      .reduce((s, p) => s + p.valorTotal, 0);
    const totalPagoPedidos = pedidos
      .filter(p => p.clienteId === c.id)
      .reduce((s, p) => s + p.valorPago, 0);
    const totalAbatimentos = pagamentos
      .filter(pg => pg.clienteId === c.id)
      .reduce((s, pg) => s + pg.valor, 0);
    const totalPago = totalPagoPedidos + totalAbatimentos;
    const saldo = Math.max(0, totalPedidos - totalPago);
    const saldoClass = saldo === 0 ? "saldo-zero" : "saldo-pos";

    // Pedidos do cliente (do mais recente para o mais antigo)
    const pedidosDoCliente = pedidos
      .filter(p => p.clienteId === c.id)
      .sort((a, b) => new Date(b.data) - new Date(a.data));

    // ✅ DISTRIBUIÇÃO CORRETA DE ABATIMENTOS:
    // Ordena pedidos do mais antigo para o mais novo e distribui os abatimentos
    // sequencialmente — cada pedido recebe o que sobra do anterior
    const pedidosOrdenados = [...pedidosDoCliente].sort((a, b) => new Date(a.data) - new Date(b.data));
    let abatimentosRestantes = totalAbatimentos;
    const saldoPorPedido = {};
    pedidosOrdenados.forEach(p => {
      const jaPagoNoPedido = p.valorPago || 0;
      const restantePedido = Math.max(0, p.valorTotal - jaPagoNoPedido);
      const abatimentoParaEste = Math.min(restantePedido, abatimentosRestantes);
      abatimentosRestantes = Math.max(0, abatimentosRestantes - abatimentoParaEste);
      saldoPorPedido[p.id] = Math.max(0, p.valorTotal - jaPagoNoPedido - abatimentoParaEste);
    });

    // Filtra APENAS pedidos pendentes (saldo > 0)
    const pedidosPendentes = pedidosDoCliente.filter(p => (saldoPorPedido[p.id] || 0) > 0);

    return `
      <tr class="client-row" id="linha-cliente-${c.id}">
        <td style="font-weight: 600; color: #0f172a;">
          <div class="client-name" id="trigger-${c.id}" onclick="toggleHistorico('${c.id}')">
            ${c.nome} ${pedidosPendentes.length > 0 ? '<span class="badge badge-pend" style="font-size:11px; margin-left:6px;">' + pedidosPendentes.length + ' pendente' + (pedidosPendentes.length > 1 ? 's' : '') + '</span>' : ''} <span class="arrow">▼</span>
          </div>
          <div class="client-history" id="historico-${c.id}">

            ${pedidosPendentes.length > 0 ? `
              <div class="ch-section">
                <div class="ch-section-title ch-pedidos-title">Dívidas pendentes</div>
                ${pedidosPendentes.map(p => {
                  const saldoRestante = saldoPorPedido[p.id] || 0;
                  const data = p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—";
                  const itensHtml = (p.itens && p.itens.length) ? p.itens.map(i => `
                    <div class="ch-item">
                      <span class="ch-item-nome">${i.nome || 'Produto'} <span class="ch-item-cat">(${i.categoria || 'Geral'})</span></span>
                      <span class="ch-item-qty">x${i.quantidade || 0}</span>
                      <span class="ch-item-sub">R$ ${((i.preco || 0) * (i.quantidade || 0)).toFixed(2)}</span>
                    </div>
                  `).join('') : '';

                  // Busca todos os abatimentos feitos para este cliente (não por data do pedido)
                  const abatimentosDoPedido = pagamentos
                    .filter(pg => pg.clienteId === c.id)
                    .filter(pg => {
                      // Calcula quanto do abatimento foi atribuído a este pedido
                      const jaPagoNoPedido = p.valorPago || 0;
                      const restantePedido = Math.max(0, p.valorTotal - jaPagoNoPedido);
                      const abatimentoParaEste = Math.min(restantePedido, totalAbatimentos);
                      return abatimentoParaEste > 0;
                    });

                  // Formata os abatimentos como registros com mensagem explicativa
                  const abatimentosHtml = abatimentosDoPedido.length > 0 ? abatimentosDoPedido.map(pg => {
                    const pgData = new Date(pg.data).toLocaleDateString("pt-BR");
                    const forma = pg.formaPagamento === 'dinheiro' ? 'Dinheiro' : 'PIX';
                    return `
                      <div class="ch-pagamento">
                        <span class="ch-pg-data">${pgData}</span>
                        <span class="ch-pg-valor">- R$ ${pg.valor.toFixed(2)}</span>
                        <span class="ch-pg-forma">Foi pago com ${forma}</span>
                      </div>
                    `;
                  }).join('') : '';

                  return `
                    <div class="ch-pedido">
                      <div class="ch-pedido-header">
                        <span><strong>${data}</strong></span>
                        <span>Total: <strong>R$ ${p.valorTotal.toFixed(2)}</strong></span>
                        <span style="color: #ef4444; font-weight: 600; font-size: 12px;">Falta: R$ ${saldoRestante.toFixed(2)}</span>
                      </div>
                      ${itensHtml}
                      ${abatimentosHtml ? `<div class="ch-pagamentos-list">${abatimentosHtml}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="color: #059669; font-size: 13px; padding: 8px 0; font-weight: 500;">✓ Sem dívidas pendentes</div>
            `}
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
          <button class="sm" onclick="editarCliente('${c.id}')">Editar</button>
          <button class="sm danger" onclick="deletarCliente('${c.id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  const sel = document.getElementById("filtro-cliente");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos os clientes</option>' +
    clientesOrdenados.map(c => `<option value="${c.id}"${c.id === cur ? " selected" : ""}>${c.nome}</option>`).join("");

  atualizarResumoFinanceiro();
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

// ✅ FUNÇÃO ATUALIZADA: Abater pagamento com seleção de forma de pagamento
async function abaterPagamento(clienteId, saldo) {
  const inp = document.getElementById("pay-val-" + clienteId);
  const valor = parseFloat(inp.value) || 0;
  if (valor <= 0) { toast("Informe um valor válido."); return; }
  if (valor > saldo) { toast("Valor maior que o saldo devedor."); return; }

  // Abre modal de seleção
  const formaPagamento = await abrirModalFormaPagamento();
  if (!formaPagamento) return; // Cancelado

  await dbFS.collection("pagamentos").add({
    clienteId,
    valor,
    formaPagamento: formaPagamento,
    data: new Date().toISOString()
  });

  toast(`Pagamento de R$ ${valor.toFixed(2)} registrado (${formaPagamento.toUpperCase()}).`);
}

// ✅ FUNÇÃO ATUALIZADA: Quitar tudo com seleção de forma de pagamento
async function quitarTudo(clienteId, saldo) {
  if (!confirm("Quitar todo o saldo de R$ " + saldo.toFixed(2) + "?")) return;

  const formaPagamento = await abrirModalFormaPagamento();
  if (!formaPagamento) return; // Cancelado

  await dbFS.collection("pagamentos").add({
    clienteId,
    valor: saldo,
    formaPagamento: formaPagamento,
    data: new Date().toISOString()
  });

  toast(`Saldo de R$ ${saldo.toFixed(2)} quitado (${formaPagamento.toUpperCase()}).`);
}

// ✅ NOVA FUNÇÃO: Modal de seleção de forma de pagamento
function abrirModalFormaPagamento() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal-content" style="text-align: center;">
        <h3 style="margin-top: 0; color: #0f172a;">Forma de pagamento</h3>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 1.5rem;">Como o pagamento foi feito?</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn-forma-pgto" data-forma="dinheiro" style="background: #f0fdf4; color: #065f46; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">
            Dinheiro
          </button>
          <button class="btn-forma-pgto" data-forma="pix" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">
            PIX
          </button>
        </div>
        <button class="btn-cancelar-pgto" style="margin-top: 16px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer;">
          Cancelar
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Clique nos botões de forma
    overlay.querySelectorAll('.btn-forma-pgto').forEach(btn => {
      btn.addEventListener('click', () => {
        const forma = btn.getAttribute('data-forma');
        overlay.remove();
        resolve(forma);
      });
    });

    // Cancelar
    overlay.querySelector('.btn-cancelar-pgto').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
  });
}

async function salvarCliente() {
  const id = document.getElementById("edit-cliente-id").value;
  const nome = document.getElementById("c-nome").value.trim();
  if (!nome) { toast("Informe o nome do cliente."); return; }
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

// ============================================================
// --- PEDIDOS ---
// ============================================================

let itensPedido = [];

function adicionarItemPedido() {
  const sel = document.getElementById("ped-produto");
  const produtoId = sel.value;
  const qty = parseInt(document.getElementById("ped-qty").value, 10) || 1;
  if (!produtoId) { toast("Selecione um produto."); return; }

  const prod = produtos.find(p => p.id === produtoId);
  if (!prod) return;

  if (prod.tipo === 'combo') {
    montarCombo(produtoId, qty);
    return;
  }

  if (!isProdutoAtivo(prod)) {
    toast(prod.nome + " está indisponível por estar sem estoque.");
    return;
  }
  const qtdAtual = getQuantidadeProduto(prod);
  const existente = itensPedido.find(i => i.produtoId === produtoId && i.tipo !== 'combo');
  const jaAdicionado = existente ? existente.quantidade : 0;
  if (jaAdicionado + qty > qtdAtual) {
    toast("Estoque insuficiente para " + prod.nome + ".");
    return;
  }
  if (existente) {
    existente.quantidade += qty;
  } else {
    itensPedido.push({
      produtoId: produtoId, nome: prod.nome,
      preco: prod.precoVenda || 0, quantidade: qty,
      categoria: prod.categoria || 'Geral',
      tipo: prod.tipo || 'simples',
      itensCombo: []
    });
  }
  document.getElementById("ped-produto").value = "";
  document.getElementById("ped-qty").value = "1";
  renderItensPedido();
}

function montarCombo(comboSelecionado = null, qtdCombo = null) {
  const comboId = comboSelecionado || document.getElementById("ped-produto").value;
  const quantidadeCombo = qtdCombo !== null ? qtdCombo : (parseInt(document.getElementById("ped-qty").value, 10) || 1);

  if (!comboId) {
    toast("Selecione um combo para adicionar.");
    return;
  }

  const combo = produtos.find(p => p.id === comboId);
  if (!combo || combo.tipo !== 'combo') {
    toast("Selecione um produto do tipo combo.");
    return;
  }

  const itensDoCombo = Array.isArray(combo.itensCombo) ? combo.itensCombo : [];
  if (!itensDoCombo.length) {
    toast("Esse combo não possui itens definidos.");
    return;
  }

  let erroEstoque = null;

  itensDoCombo.forEach(item => {
    const produtoBase = produtos.find(p => p.id === item.produtoId || p.nome.toLowerCase() === (item.nome || '').toLowerCase());
    if (!produtoBase) {
      erroEstoque = `Não foi possível localizar "${item.nome}" no estoque.`;
      return;
    }
    if (!isProdutoAtivo(produtoBase)) {
      erroEstoque = `${produtoBase.nome} está indisponível no momento.`;
      return;
    }
    const qtdNecessaria = (item.quantidade || 1) * quantidadeCombo;
    const qtdAtual = getQuantidadeProduto(produtoBase);
    if (qtdAtual < qtdNecessaria) {
      erroEstoque = `Estoque insuficiente para ${produtoBase.nome}.`;
      return;
    }
  });

  if (erroEstoque) {
    toast(erroEstoque);
    return;
  }

  itensDoCombo.forEach(item => {
    const produtoBase = produtos.find(p => p.id === item.produtoId || p.nome.toLowerCase() === (item.nome || '').toLowerCase());
    if (!produtoBase) return;

    const qtdNecessaria = (item.quantidade || 1) * quantidadeCombo;
    const existente = itensPedido.find(i => i.produtoId === produtoBase.id && i.tipo !== 'combo');

    if (existente) {
      existente.quantidade += qtdNecessaria;
    } else {
      itensPedido.push({
        produtoId: produtoBase.id,
        nome: produtoBase.nome,
        preco: produtoBase.precoVenda || 0,
        quantidade: qtdNecessaria,
        categoria: produtoBase.categoria || 'Geral',
        tipo: 'simples',
        itensCombo: []
      });
    }
  });

  document.getElementById("ped-produto").value = "";
  document.getElementById("ped-qty").value = "1";
  renderItensPedido();
  toast(`Combo "${combo.nome}" montado no pedido com os produtos do estoque.`);
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

  lista.innerHTML = itensPedido.map(i => {
    const comboExtras = i.tipo === 'combo' && Array.isArray(i.itensCombo) && i.itensCombo.length
      ? `<div style="margin-top:6px; font-size:12px; color:#64748b; display:flex; flex-wrap:wrap; gap:6px;">
          ${(i.itensCombo || []).map(item => `
            <span style="display:inline-flex; align-items:center; gap:4px; background:#f8fafc; padding:4px 7px; border-radius:999px; border:1px solid #e2e8f0;">
              ${item.nome} x${item.quantidade}
            </span>
          `).join('')}
        </div>`
      : '';

    return `
      <span class="item-tag">
        ${i.nome} (x${i.quantidade}) &mdash; R$ ${(i.preco * i.quantidade).toFixed(2)}
        <button onclick="removerItemPedido('${i.produtoId}')">&#10005;</button>
        ${comboExtras}
      </span>
    `;
  }).join("");

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

  if (!clienteId) { toast("Selecione um cliente."); return; }
  if (!itensPedido.length) { toast("Adicione pelo menos um produto."); return; }

  const valorTotal = itensPedido.reduce((s, i) => s + i.preco * i.quantidade, 0);
  await dbFS.collection("pedidos").add({
    clienteId,
    itens: itensPedido.map(i => ({
      produtoId: i.produtoId, nome: i.nome, preco: i.preco,
      quantidade: i.quantidade, categoria: i.categoria,
      tipo: i.tipo || 'simples', itensCombo: i.itensCombo || []
    })),
    quantidade: itensPedido.reduce((s, i) => s + i.quantidade, 0),
    valorTotal, valorPago, parcelas,
    formaPagamento: forma,
    data: new Date().toISOString()
  });

  for (const item of itensPedido) {
    const prod = produtos.find(p => p.id === item.produtoId);
    if (prod) {
      const qtdAtual = getQuantidadeProduto(prod);
      const novaQty = Math.max(0, qtdAtual - item.quantidade);
      await dbFS.collection("produtos").doc(item.produtoId).update({
        quantidade: novaQty,
        ativo: novaQty > 0
      });
    }

    if (item.tipo === 'combo' && Array.isArray(item.itensCombo)) {
      for (const componente of item.itensCombo) {
        const produtoBase = produtos.find(p => p.id === componente.produtoId || p.nome.toLowerCase() === (componente.nome || '').toLowerCase());
        if (!produtoBase) continue;
        const qtdAtualBase = getQuantidadeProduto(produtoBase);
        const novaQtyBase = Math.max(0, qtdAtualBase - (componente.quantidade || 0));
        await dbFS.collection("produtos").doc(produtoBase.id).update({
          quantidade: novaQtyBase,
          ativo: novaQtyBase > 0
        });
      }
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

// ============================================================
// --- HISTÓRICO ---
// ============================================================

function renderHistorico() {
  const filtro = document.getElementById("filtro-cliente").value;
  const tbody = document.getElementById("tbody-historico");
  const lista = pedidos;
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum pedido registrado.</td></tr>';
    return;
  }

  // Ordena do mais recente para o mais antigo
  const filtrados = (filtro ? lista.filter(p => p.clienteId === filtro) : lista)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  let html = '';
  filtrados.forEach(ped => {
    const c = clientes.find(x => x.id === ped.clienteId);

    // ✅ DISTRIBUIÇÃO CORRETA DE ABATIMENTOS:
    // Soma apenas os abatimentos DO PRÓPRIO CLIENTE e distribui pelos pedidos
    // do mais antigo ao mais novo, sequencialmente
    const todosPedidosDoCliente = pedidos
      .filter(p => p.clienteId === ped.clienteId)
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    const totalAbatimentosCliente = pagamentos
      .filter(pg => pg.clienteId === ped.clienteId)
      .reduce((s, pg) => s + pg.valor, 0);
    let abatRestante = totalAbatimentosCliente;
    let abatimentoDestePedido = 0;
    let formaPagamentoDoAbatimento = '';

    for (const p of todosPedidosDoCliente) {
      const jaPago = p.valorPago || 0;
      const restantePedido = Math.max(0, p.valorTotal - jaPago);
      const abatParaEste = Math.min(restantePedido, abatRestante);
      if (p.id === ped.id) {
        abatimentoDestePedido = abatParaEste;
        // Encontra a forma de pagamento do abatimento que foi aplicado a este pedido
        const abatimentosAplicados = pagamentos
          .filter(pg => pg.clienteId === ped.clienteId)
          .sort((a, b) => new Date(a.data) - new Date(b.data));
        let acumulado = 0;
        for (const pg of abatimentosAplicados) {
          if (acumulado >= pg.valor) continue;
          const restante = pg.valor - acumulado;
          const parteUsada = Math.min(restante, abatimentoDestePedido);
          if (parteUsada > 0) {
            formaPagamentoDoAbatimento = pg.formaPagamento;
            break;
          }
          acumulado += pg.valor;
        }
        break;
      }
      abatRestante = Math.max(0, abatRestante - abatParaEste);
    }

    const totalRealmentePago = ped.valorPago + abatimentoDestePedido;
    const pago = totalRealmentePago >= ped.valorTotal;
    const data = ped.data ? new Date(ped.data).toLocaleDateString("pt-BR") : "—";

    // Cabeçalho do pedido
    html += `
      <tr class="pedido-header" onclick="togglePedidoHistorico('pedido-det-${ped.id}')">
        <td style="color: #64748b;">${data}</td>
        <td style="font-weight: 600; color: #0f172a;">${c ? c.nome : "—"}</td>
        <td style="font-weight: 600;">R$ ${ped.valorTotal.toFixed(2)}</td>
        <td>R$ ${totalRealmentePago.toFixed(2)}</td>
        <td style="text-transform: uppercase; font-size:12px; font-weight:500; color:#64748b;">${ped.formaPagamento}</td>
        <td><span class="badge ${pago ? "badge-ok" : "badge-pend"}">${pago ? "Pago" : "Pendente"}</span> <span class="arrow-hist">▼</span></td>
      </tr>
    `;

    // Linha detalhada dos itens do pedido
    const itensHtml = (ped.itens && ped.itens.length) ? ped.itens.map(i => {
      const subtotal = (i.preco * i.quantidade).toFixed(2);
      return `
        <div class="hist-item-detail">
          <span class="hist-item-nome">${i.nome || 'Produto'} <span class="hist-item-cat">(${i.categoria || 'Geral'})</span></span>
          <span class="hist-item-qty">x${i.quantidade || 0}</span>
          <span class="hist-item-preco">R$ ${(i.preco || 0).toFixed(2)} un.</span>
          <span class="hist-item-sub">R$ ${subtotal}</span>
        </div>
      `;
    }).join('') : '<div style="color:#94a3b8; padding:6px 0;">—</div>';

    html += `
      <tr class="pedido-detail" id="pedido-det-${ped.id}" style="display:none;">
        <td colspan="6" style="padding: 0; border: none;">
          <div class="pedido-detail-wrap">
            ${itensHtml}
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function togglePedidoHistorico(rowId) {
  const row = document.getElementById(rowId);
  const arrow = row?.previousElementSibling?.querySelector('.arrow-hist');
  if (row.style.display === 'none' || row.style.display === '') {
    row.style.display = 'table-row';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    row.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

// ============================================================
// --- SELECTS ---
// ============================================================

function atualizarSelects() {
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

  const pedProduto = document.getElementById("ped-produto");
  if (pedProduto) {
    const valorAtualProduto = pedProduto.value;
    pedProduto.innerHTML = '<option value="">Selecione...</option>';
    const filtroAtivo = Array.from(document.querySelectorAll('#filtro-categoria .category-button.active')).find(btn => btn.textContent !== 'Todas');
    const categoriaFiltrada = filtroAtivo ? filtroAtivo.textContent : null;
    const produtosFiltrados = (!categoriaFiltrada ? produtos : produtos.filter(p => p.categoria === categoriaFiltrada)).filter(p => isProdutoAtivo(p));
    produtosFiltrados.forEach(p => {
      const qtdAtual = getQuantidadeProduto(p);
      const precoFinal = p.precoVenda || 0;
      const categoria = p.categoria ? ` (${p.categoria})` : '';
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.nome || 'Sem nome'}${categoria} (${qtdAtual} un.) — R$ ${precoFinal.toFixed(2)}`;
      if (p.id === valorAtualProduto) option.selected = true;
      pedProduto.appendChild(option);
    });
  }
}

// ============================================================
// --- EVENTOS DE TECLADO ---
// ============================================================

function handleEnterKey(event, nextFieldId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (nextFieldId === 'salvar-produto') { salvarProduto(); return; }
    if (nextFieldId === 'salvar-cliente') { salvarCliente(); return; }
    if (nextFieldId === 'adicionar-item') { adicionarItemPedido(); return; }
    const nextField = document.getElementById(nextFieldId);
    if (nextField) nextField.focus();
  }
}

// ============================================================
// --- EVENTOS GLOBAIS ---
// ============================================================

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

// ============================================================
// --- BUSCA EM TEMPO REAL ---
// ============================================================

function filtrarEstoque() {
  const busca = document.getElementById('busca-produto').value.toLowerCase().trim();
  const tbody = document.getElementById('tbody-estoque');
  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca));
  if (produtosFiltrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum produto encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = produtosFiltrados.map(p => {
    const qtdFinal = getQuantidadeProduto(p);
    const custoFinal = p.precoCusto || 0;
    const precoFinal = p.precoVenda || 0;
    const emPromocao = p.emPromocao === "sim";
    const descricao = p.descricao || "";
    const descricaoResumo = descricao.length > 30 ? descricao.substring(0, 30) + "..." : descricao;
    const precoCustoExibido = custoFinal > 0 ? `C: R$ ${custoFinal.toFixed(2)}` : '';
    const precoVendaExibido = precoFinal > 0 ? `V: R$ ${precoFinal.toFixed(2)}` : '';
    const promoTag = emPromocao ? '<span class="badge-promo">promo</span>' : '';
    const descricaoEsc = descricao.replace(/'/g, "\\'").replace(/"/g, '"');
    const statusTag = getStatusTag(p);
    return `
      <tr>
        <td style="font-weight: 600; color: #0f172a;">${p.nome || 'Sem nome'}${statusTag}</td>
        <td><span class="cat-tag">${p.categoria || 'Geral'}</span></td>
        <td>
          <div class="qty-ctrl">
            <button onclick="ajustarQty('${p.id}', -1)">&minus;</button>
            <span class="qty-num">${qtdFinal}</span>
            <button onclick="ajustarQty('${p.id}', 1)">&plus;</button>
          </div>
        </td>
        <td style="font-weight: 500; font-size: 13px;">
          ${precoCustoExibido}<br>
          ${precoVendaExibido} ${promoTag}
        </td>
        <td class="desc-cell" onclick="mostrarDescricao('${descricaoEsc}')">
          ${descricaoResumo || '<span style="color:#cbd5e1">—</span>'}
        </td>
        <td class="actions">
          <button class="sm" onclick="editarProduto('${p.id}')">Editar</button>
          <button class="sm danger" onclick="deletarProduto('${p.id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================================
// --- FILTRO POR CATEGORIA (ESTOQUE) ---
// ============================================================

function filtrarCategoriaEstoque(categoria) {
  document.querySelectorAll('#filtro-categoria-estoque .category-button').forEach(btn => {
    btn.classList.remove('active');
  });
  const btnAtivo = Array.from(document.querySelectorAll('#filtro-categoria-estoque .category-button')).find(btn => btn.textContent === categoria);
  if (btnAtivo) btnAtivo.classList.add('active');

  const busca = document.getElementById('busca-produto').value.toLowerCase().trim();
  const tbody = document.getElementById('tbody-estoque');
  let produtosFiltrados = produtos;
  if (categoria !== 'todos') {
    produtosFiltrados = produtosFiltrados.filter(p => p.categoria === categoria);
  }
  if (busca) {
    produtosFiltrados = produtosFiltrados.filter(p => p.nome.toLowerCase().includes(busca));
  }
  if (produtosFiltrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum produto encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = produtosFiltrados.map(p => {
    const qtdFinal = getQuantidadeProduto(p);
    const custoFinal = p.precoCusto || 0;
    const precoFinal = p.precoVenda || 0;
    const emPromocao = p.emPromocao === "sim";
    const descricao = p.descricao || "";
    const descricaoResumo = descricao.length > 30 ? descricao.substring(0, 30) + "..." : descricao;
    const precoCustoExibido = custoFinal > 0 ? `C: R$ ${custoFinal.toFixed(2)}` : '';
    const precoVendaExibido = precoFinal > 0 ? `V: R$ ${precoFinal.toFixed(2)}` : '';
    const promoTag = emPromocao ? '<span class="badge-promo">promo</span>' : '';
    const descricaoEsc = descricao.replace(/'/g, "\\'").replace(/"/g, '"');
    const statusTag = getStatusTag(p);
    return `
      <tr>
        <td style="font-weight: 600; color: #0f172a;">${p.nome || 'Sem nome'}${statusTag}</td>
        <td><span class="cat-tag">${p.categoria || 'Geral'}</span></td>
        <td>
          <div class="qty-ctrl">
            <button onclick="ajustarQty('${p.id}', -1)">&minus;</button>
            <span class="qty-num">${qtdFinal}</span>
            <button onclick="ajustarQty('${p.id}', 1)">&plus;</button>
          </div>
        </td>
        <td style="font-weight: 500; font-size: 13px;">
          ${precoCustoExibido}<br>
          ${precoVendaExibido} ${promoTag}
        </td>
        <td class="desc-cell" onclick="mostrarDescricao('${descricaoEsc}')">
          ${descricaoResumo || '<span style="color:#cbd5e1">—</span>'}
        </td>
        <td class="actions">
          <button class="sm" onclick="editarProduto('${p.id}')">Editar</button>
          <button class="sm danger" onclick="deletarProduto('${p.id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================================
// --- ATUALIZAR FILTRO DE CATEGORIA (ESTOQUE) ---
// ============================================================

function atualizarFiltroCategoriaEstoque() {
  const container = document.getElementById('filtro-categoria-estoque');
  if (!container) return;
  const categoriasSalvas = carregarCategorias();
  const categoriasComProdutos = new Set();
  produtos.forEach(p => {
    if (p.categoria && p.categoria.trim()) {
      categoriasComProdutos.add(p.categoria.trim());
    }
  });
  const todasCategorias = [...new Set([...categoriasSalvas, ...categoriasComProdutos])];
  container.innerHTML = '<button class="category-button active" onclick="filtrarCategoriaEstoque(\'todos\')">Todas</button>';
  todasCategorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-button';
    btn.textContent = cat;
    btn.onclick = () => filtrarCategoriaEstoque(cat);
    container.appendChild(btn);
  });
}

// ============================================================
// --- MODAL DE DESCRIÇÃO ---
// ============================================================

function mostrarDescricao(descricaoCompleta) {
  const modal = document.createElement('div');
  modal.className = 'modal-desc-overlay';
  modal.innerHTML = `
    <div class="modal-desc-content">
      <h3>Descrição do Produto</h3>
      <p>${descricaoCompleta || 'Sem descrição.'}</p>
      <button class="primary" onclick="this.parentElement.parentElement.remove()">Fechar</button>
    </div>
  `;
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

// ============================================================
// --- RESUMO FINANCEIRO ---
// ============================================================

function atualizarResumoFinanceiro() {
  let totalReceber = 0;
  clientes.forEach(cliente => {
    const totalPedidos = pedidos
      .filter(p => p.clienteId === cliente.id)
      .reduce((s, p) => s + p.valorTotal, 0);
    const totalPago = pedidos
      .filter(p => p.clienteId === cliente.id)
      .reduce((s, p) => s + p.valorPago, 0) +
      pagamentos.filter(pg => pg.clienteId === cliente.id)
        .reduce((s, pg) => s + pg.valor, 0);
    totalReceber += Math.max(0, totalPedidos - totalPago);
  });

  let totalEstoque = 0;
  let totalCusto = 0;
  produtos.forEach(p => {
    const qtd = p.quantidade || 0;
    totalEstoque += (p.precoVenda || 0) * qtd;
    totalCusto += (p.precoCusto || 0) * qtd;
  });

  const lucroEstimado = totalEstoque - totalCusto;

  const elReceber = document.getElementById("resumo-receber");
  const elEstoque = document.getElementById("resumo-estoque");
  const elCusto = document.getElementById("resumo-custo");
  const elLucro = document.getElementById("resumo-lucro");

  if (elReceber) elReceber.textContent = `R$ ${totalReceber.toFixed(2)}`;
  if (elEstoque) elEstoque.textContent = `R$ ${totalEstoque.toFixed(2)}`;
  if (elCusto) elCusto.textContent = `R$ ${totalCusto.toFixed(2)}`;
  if (elLucro) elLucro.textContent = `R$ ${lucroEstimado.toFixed(2)}`;
}

// ============================================================
// --- LIMPEZA SECRETA (Ctrl + Alt + P) ---
// ============================================================

window.addEventListener('keydown', async (e) => {
  if (e.key === 'p' && e.ctrlKey && e.altKey) {
    e.preventDefault();
    const confirmed = confirm(
      "ATENÇÃO: Isso apagará TODOS os produtos, clientes, pedidos e pagamentos do sistema.\n\n" +
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
      toast(`${totalDeleted} registros apagados com sucesso!`);
      console.log(`[CLEANUP] LIMPEZA CONCLUÍDA: ${totalDeleted} registros removidos.`);
    } catch (error) {
      toast("Erro ao apagar dados. Verifique a conexão ou permissões.");
      console.error("Erro na limpeza:", error);
    }
  }
});