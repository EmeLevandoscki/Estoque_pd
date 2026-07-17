 const firebaseConfig = {
  apiKey: "AIzaSyCJNQeACZMM7C90J0LcLwPF7LWGvd2xdu0",
  authDomain: "meu-estoque-4f39d.firebaseapp.com",
  projectId: "meu-estoque-4f39d",
  storageBucket: "meu-estoque-4f39d.appspot.com",
  messagingSenderId: "763813971738",
  appId: "1:763813971738:web:ed5dc0cd2b1b449418cea3"
};

firebase.initializeApp(firebaseConfig);
const dbFS = firebase.firestore();
const authFB = firebase.auth();

let produtos = [], clientes = [], pedidos = [], pagamentos = [];
const NOMES_FIXOS = ["Emelly Levandoscki", "Taina Pinheiro Pomatti"];

// Função para arredondar valores monetários com precisão
function arredondarMoeda(valor) {
  return Math.round(valor * 100) / 100;
}

// Função para comparar valores monetários com margem de erro (0.01)
function saldoZero(saldo) {
  return arredondarMoeda(saldo) <= 0.01;
}

// --- DESCRIÇÃO DE PRODUTOS ---

function truncarTexto(texto, max) {
  const t = texto || '';
  return t.length > max ? t.substring(0, max) + '...' : t;
}

function escaparDescricao(texto) {
  return (texto || '').replace(/'/g, "\\'").replace(/"/g, '"');
}

function getHtmlDescricaoItem(descricao) {
  if (!descricao) return '';
  return `<div class="item-desc" onclick="mostrarDescricao('${escaparDescricao(descricao)}')" style="font-size:11px;color:#64748b;margin-top:2px;cursor:pointer;text-decoration:underline dotted;">${truncarTexto(descricao, 40)}</div>`;
}

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

// --- SEGURANÇA ---

function inicializarSeguranca() {
  const titulo = document.getElementById("lock-titulo");
  const subtitulo = document.getElementById("lock-subtitulo");
  const campoEmail = document.getElementById("campo-email");
  const erroEl = document.getElementById("lock-erro");
  titulo.textContent = "Bem-vinda de volta";
  subtitulo.textContent = "Entre com seus dados pra continuar";
  if (erroEl) erroEl.style.display = "none";
  validarCamposLogin();
  campoEmail.focus();
}

function validarCamposLogin() {
  const email = document.getElementById("campo-email").value.trim();
  const senha = document.getElementById("campo-senha").value.trim();
  const btn = document.getElementById("btn-lock");
  if (btn) btn.disabled = !(email && senha);
}

function alternarVisibilidadeSenha() {
  const campo = document.getElementById("campo-senha");
  const btn = document.getElementById("btn-toggle-senha");
  const mostrando = campo.type === "text";
  campo.type = mostrando ? "password" : "text";
  btn.innerHTML = mostrando
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.5 10.5 0 0112 19c-6.5 0-10-7-10-7a17.6 17.6 0 013.94-4.94M9.9 4.24A9.5 9.5 0 0112 4c6.5 0 10 7 10 7a17.6 17.6 0 01-2.16 3.19M6.71 6.71a3 3 0 004.24 4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  btn.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
  campo.focus();
}

async function verificarSenha() {
  const campoEmail = document.getElementById("campo-email");
  const campoSenha = document.getElementById("campo-senha");
  const btn = document.getElementById("btn-lock");
  const erroEl = document.getElementById("lock-erro");
  const card = document.getElementById("lock-card");
  const email = campoEmail.value.trim();
  const senha = campoSenha.value.trim();
  if (!email || !senha) return;

  if (erroEl) erroEl.style.display = "none";
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Entrando...";
  btn.style.opacity = "0.7";
  try {
    await authFB.signInWithEmailAndPassword(email, senha);
    // authFB.onAuthStateChanged cuida de chamar desbloquearApp()
  } catch (error) {
    console.error("Erro de login:", error.code, error.message);
    if (erroEl) erroEl.style.display = "block";
    if (card) {
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
    }
    campoSenha.value = "";
    campoSenha.focus();
  } finally {
    btn.textContent = textoOriginal;
    btn.style.opacity = "";
    validarCamposLogin();
  }
}

let sincronizacaoAtiva = false;

function desbloquearApp() {
  document.getElementById("tela-bloqueio").style.display = "none";
  document.getElementById("app-container").style.display = "block";
  document.getElementById("campo-email").value = "";
  document.getElementById("campo-senha").value = "";
  if (!sincronizacaoAtiva) {
    sincronizacaoAtiva = true;
    ativarSincronizacaoEmTempoReal();
  }
  aplicarTela(location.hash ? location.hash.slice(1) : "inicio");
}

function bloquearSistema() {
  document.getElementById("app-container").style.display = "none";
  document.getElementById("tela-bloqueio").style.display = "flex";
  authFB.signOut();
  inicializarSeguranca();
}

// --- NAVEGAÇÃO ENTRE TELAS (SPA) ---

const TELAS_VALIDAS = ["inicio", "estoque", "pedidos", "clientes", "historico"];
const TITULOS_TELA = {
  inicio: "Início",
  estoque: "Estoque",
  pedidos: "Pedidos",
  clientes: "Clientes",
  historico: "Histórico"
};

function aplicarTela(tela) {
  if (!TELAS_VALIDAS.includes(tela)) tela = "inicio";

  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(tela)?.classList.add("active");

  document.querySelectorAll("#tabs-nav .tab-btn").forEach(a => {
    a.classList.toggle("active", a.dataset.tela === tela);
  });
  document.querySelectorAll("#bottom-nav-list .bottom-nav-item").forEach(a => {
    a.classList.toggle("active", a.dataset.tela === tela);
  });

  const fab = document.getElementById("fab-acao");
  if (fab) {
    if (tela === "estoque") {
      fab.style.display = "flex";
      fab.onclick = () => novoProdutoMobile();
      fab.setAttribute("aria-label", "Novo produto");
    } else if (tela === "historico") {
      fab.style.display = "flex";
      fab.onclick = () => mostrarTela("pedidos");
      fab.setAttribute("aria-label", "Novo pedido");
    } else {
      fab.style.display = "none";
      fab.onclick = null;
    }
  }

  document.title = `${TITULOS_TELA[tela]} - Gerenciador de Estoque & Pedidos`;
  window.scrollTo({ top: 0 });
}

function mostrarTela(tela) {
  aplicarTela(tela);
  history.pushState({ tela }, "", "#" + tela);
}

window.addEventListener("popstate", (e) => {
  const tela = (e.state && e.state.tela) || (location.hash ? location.hash.slice(1) : "inicio");
  aplicarTela(tela);
});

// --- INICIALIZAÇÃO ---

window.addEventListener("DOMContentLoaded", function() {
  toggleCampoCombo();
  inicializarSeguranca();
  authFB.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
  authFB.onAuthStateChanged(user => {
    if (user) desbloquearApp();
    const carregando = document.getElementById("tela-carregando");
    if (carregando) carregando.classList.add("hide");
  });
});

// --- SINCRONIZAÇÃO EM TEMPO REAL ---

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

// --- TOAST ---

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// --- PAINÉIS EM TELA CHEIA (MOBILE) ---

function abrirSheetMobile(id) {
  document.getElementById(id)?.classList.add('sheet-open');
  document.body.classList.add('sheet-lock');
}

function fecharSheetMobile(id) {
  document.getElementById(id)?.classList.remove('sheet-open');
  document.body.classList.remove('sheet-lock');
}

function novoProdutoMobile() {
  cancelarEdicaoProduto();
  abrirSheetMobile('sheet-produto');
}

function novoClienteMobile() {
  cancelarEdicaoCliente();
  abrirSheetMobile('sheet-cliente');
}

// --- ESTOQUE ---

function getQuantidadeProduto(produto) {
  return produto && produto.quantidade !== undefined ? Number(produto.quantidade) : 0;
}

function isProdutoAtivo(produto) {
  if (produto && produto.ativo !== undefined) return Boolean(produto.ativo);
  return getQuantidadeProduto(produto) > 0;
}

function getIniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function getPillEstoque(qtd) {
  if (qtd <= 0) return { classe: 'esgotado', label: 'Esgotado' };
  if (qtd <= 5) return { classe: 'baixo', label: `${qtd} un.` };
  return { classe: 'ok', label: `${qtd} un.` };
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
    const descricaoLabel = p.descricao ? ` — ${truncarTexto(p.descricao, 40)}` : '';
    return `<option value="${p.nome}" data-id="${p.id}" data-preco="${p.precoVenda || 0}"> (${qtd} un.) — R$ ${(p.precoVenda || 0).toFixed(2)}${descricaoLabel}</option>`;
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
      quantidade: quantidade,
      descricao: prod.descricao || ''
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
    <span title="${escaparDescricao(item.descricao)}" style="display: inline-flex; align-items: center; gap: 6px; background: #e0f2fe; padding: 6px 10px; border-radius: 999px; border: 1px solid #bfdbfe; font-size: 13px; color: #0369a1;">
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

function formatarFormaPagamento(forma) {
  const nomes = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', debito: 'Débito', credito: 'Crédito' };
  return nomes[forma] || (forma || '—');
}

function getHtmlProdutoEstoque(p) {
  const qtdFinal = getQuantidadeProduto(p);
  const precoFinal = p.precoVenda || 0;
  const emPromocao = p.emPromocao === 'sim';
  const ativo = isProdutoAtivo(p);
  const pill = getPillEstoque(qtdFinal);

  const fotoHtml = p.foto
    ? `<img src="${p.foto}" alt="">`
    : `<div class="product-photo-placeholder">${getIniciais(p.nome)}</div>`;

  const badgesHtml = (emPromocao || p.tipo === 'combo')
    ? `<div class="product-photo-badges">
        ${emPromocao ? '<span class="product-photo-badge promo">Promo</span>' : ''}
        ${p.tipo === 'combo' ? '<span class="product-photo-badge combo">Combo</span>' : ''}
      </div>`
    : '';

  return `
    <div class="product-card" onclick="editarProduto('${p.id}')">
      <div class="product-photo${ativo ? '' : ' esgotado'}">
        ${fotoHtml}
        ${badgesHtml}
        <button type="button" class="product-photo-remove" onclick="event.stopPropagation(); deletarProduto('${p.id}')" aria-label="Excluir produto">&times;</button>
        <span class="product-photo-stock ${pill.classe}">${pill.label}</span>
        ${ativo ? '' : '<div class="product-photo-stamp">Esgotado</div>'}
      </div>
      <div class="product-card-body">
        <div class="product-nome-grid">${p.nome || 'Sem nome'}</div>
        <div class="product-cat-grid">${p.categoria || 'Geral'}</div>
        <div class="product-preco-grid money"><span class="cur">R$</span>${precoFinal.toFixed(2)}</div>
        <div class="qty-ctrl" onclick="event.stopPropagation()">
          <button onclick="ajustarQty('${p.id}', -1)">&minus;</button>
          <span class="qty-num">${qtdFinal}</span>
          <button onclick="ajustarQty('${p.id}', 1)">&plus;</button>
        </div>
      </div>
    </div>
  `;
}

function renderEstoque() {
  const tbody = document.getElementById("tbody-estoque");
  if (tbody) {
    if (!produtos.length) {
      tbody.innerHTML = '<div class="empty">Nenhum produto cadastrado.</div>';
    } else {
      const produtosOrdenados = [...produtos].sort((a, b) => {
        const aZero = getQuantidadeProduto(a) === 0;
        const bZero = getQuantidadeProduto(b) === 0;
        if (aZero && !bZero) return 1;
        if (!aZero && bZero) return -1;
        return (a.nome || '').localeCompare(b.nome || '');
      });

      tbody.innerHTML = produtosOrdenados.map(getHtmlProdutoEstoque).join("");
    }
  }
  const subtitulo = document.getElementById("estoque-subtitulo");
  if (subtitulo) {
    const baixoOuEsgotado = produtos.filter(p => getQuantidadeProduto(p) <= 5).length;
    subtitulo.textContent = `${produtos.length} produto${produtos.length === 1 ? '' : 's'}${baixoOuEsgotado > 0 ? ` · ${baixoOuEsgotado} com estoque baixo` : ''}`;
  }
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

// --- FOTO DO PRODUTO ---

let fotoProdutoTemp = null;

function comprimirImagem(file, maxDimensao, qualidade) {
  maxDimensao = maxDimensao || 640;
  qualidade = qualidade || 0.7;
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('not-an-image'));
      return;
    }
    const leitor = new FileReader();
    leitor.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let largura = img.width;
        let altura = img.height;
        if (largura > maxDimensao || altura > maxDimensao) {
          if (largura > altura) {
            altura = Math.round(altura * maxDimensao / largura);
            largura = maxDimensao;
          } else {
            largura = Math.round(largura * maxDimensao / altura);
            altura = maxDimensao;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        canvas.getContext('2d').drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = e.target.result;
    };
    leitor.readAsDataURL(file);
  });
}

function selecionarFotoProduto(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Selecione um arquivo de imagem.');
    return;
  }
  comprimirImagem(file).then(dataUrl => {
    fotoProdutoTemp = dataUrl;
    atualizarPreviewFotoProduto();
  });
}

function mostrarComprovante(dataUrl) {
  if (!dataUrl) return;
  const modal = document.createElement('div');
  modal.className = 'modal-desc-overlay';
  modal.innerHTML = `
    <div class="modal-desc-content" style="text-align:center;">
      <h3>Comprovante</h3>
      <img src="${dataUrl}" alt="Comprovante do PIX" style="max-width:100%; border-radius:12px; margin-bottom:1.5rem;">
      <button class="primary" onclick="this.parentElement.parentElement.remove()">Fechar</button>
    </div>
  `;
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function atualizarPreviewFotoProduto() {
  const preview = document.getElementById('p-foto-preview');
  const removerBtn = document.getElementById('p-foto-remover-btn');
  if (!preview) return;
  if (fotoProdutoTemp) {
    preview.innerHTML = `<img src="${fotoProdutoTemp}" alt="Foto do produto">`;
    if (removerBtn) removerBtn.style.display = '';
  } else {
    preview.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>`;
    if (removerBtn) removerBtn.style.display = 'none';
  }
}

function removerFotoProduto() {
  fotoProdutoTemp = null;
  atualizarPreviewFotoProduto();
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
  const foto = fotoProdutoTemp || null;

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
      tipo, itensCombo, foto
    });
    toast("Produto atualizado.");
  } else {
    await dbFS.collection("produtos").add({
      nome, categoria: cat, quantidade: qty, ativo: produtoAtivo,
      precoCusto: custo, precoVenda: preco,
      emPromocao: promocao, descricao: descricao,
      tipo, itensCombo, foto,
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
  fotoProdutoTemp = p.foto || null;
  atualizarPreviewFotoProduto();
  toggleCampoCombo();
  renderizarItensComboTemp();
  document.getElementById("estoque-title").textContent = "Editar produto";
  document.getElementById("p-nome").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
  abrirSheetMobile('sheet-produto');
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
  fotoProdutoTemp = null;
  atualizarPreviewFotoProduto();
  toggleCampoCombo();
  renderizarItensComboTemp();
  document.getElementById("estoque-title").textContent = "Novo produto";
  document.getElementById('categoria-sugestoes').style.display = 'none';
  fecharSheetMobile('sheet-produto');
}

async function deletarProduto(id) {
  if (!confirm("Excluir este produto da nuvem?")) return;
  await dbFS.collection("produtos").doc(id).delete();
  toast("Produto excluído.");
}

// --- CLIENTES ---

function calcularDetalheCliente(c) {
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
  const saldo = arredondarMoeda(Math.max(0, totalPedidos - totalPago));

  // Pedidos do cliente (do mais recente para o mais antigo)
  const pedidosDoCliente = pedidos
    .filter(p => p.clienteId === c.id)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  // DISTRIBUIÇÃO CORRETA DE ABATIMENTOS:
  // Ordena pedidos do mais antigo para o mais novo e distribui os abatimentos
  // sequencialmente — cada pedido recebe o que sobra do anterior
  const pedidosOrdenados = [...pedidosDoCliente].sort((a, b) => new Date(a.data) - new Date(b.data));
  let abatimentosRestantes = totalAbatimentos;
  const saldoPorPedido = {};
  const pagoPorPedido = {};
  pedidosOrdenados.forEach(p => {
    const jaPagoNoPedido = p.valorPago || 0;
    const restantePedido = Math.max(0, p.valorTotal - jaPagoNoPedido);
    const abatimentoParaEste = Math.min(restantePedido, abatimentosRestantes);
    abatimentosRestantes = Math.max(0, abatimentosRestantes - abatimentoParaEste);
    saldoPorPedido[p.id] = arredondarMoeda(Math.max(0, p.valorTotal - jaPagoNoPedido - abatimentoParaEste));
    pagoPorPedido[p.id] = arredondarMoeda(jaPagoNoPedido + abatimentoParaEste);
  });

  const qtdPedidos = pedidosDoCliente.length;
  const pedidosPendentes = pedidosDoCliente.filter(p => arredondarMoeda(saldoPorPedido[p.id] || 0) > 0.01);
  const idsPedidosPendentes = new Set(pedidosPendentes.map(p => p.id));

  // Replica a mesma distribuição (pedidos mais antigos primeiro), mas pagamento a pagamento
  // em ordem cronológica, só para descobrir quais pedidos cada pagamento ajudou a quitar.
  // Não altera saldoPorPedido/pagoPorPedido — é só para decidir o que aparece na lista.
  const restanteSimulado = {};
  pedidosOrdenados.forEach(p => {
    restanteSimulado[p.id] = Math.max(0, p.valorTotal - (p.valorPago || 0));
  });
  let ponteiroPedido = 0;
  const pedidosTocadosPorPagamento = {};
  const pagamentosCronologicos = pagamentos
    .filter(pg => pg.clienteId === c.id)
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  pagamentosCronologicos.forEach(pg => {
    let valorRestante = pg.valor;
    const tocados = new Set();
    while (valorRestante > 0.01 && ponteiroPedido < pedidosOrdenados.length) {
      const pedidoAtual = pedidosOrdenados[ponteiroPedido];
      if (restanteSimulado[pedidoAtual.id] <= 0.01) { ponteiroPedido++; continue; }
      const aplicar = Math.min(restanteSimulado[pedidoAtual.id], valorRestante);
      restanteSimulado[pedidoAtual.id] -= aplicar;
      valorRestante -= aplicar;
      tocados.add(pedidoAtual.id);
    }
    pedidosTocadosPorPagamento[pg.id] = tocados;
  });

  const pagamentosDoCliente = pagamentosCronologicos
    .filter(pg => {
      const tocados = pedidosTocadosPorPagamento[pg.id];
      return tocados && [...tocados].some(id => idsPedidosPendentes.has(id));
    })
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  return { saldo, totalPago, qtdPedidos, pedidosDoCliente, pedidosPendentes, saldoPorPedido, pagoPorPedido, pagamentosDoCliente };
}

function getClientesOrdenados() {
  const clientesFixos = [];
  const clientesComPendencia = [];
  const clientesSemPendencia = [];

  clientes.forEach(cliente => {
    const { saldo } = calcularDetalheCliente(cliente);
    if (NOMES_FIXOS.includes(cliente.nome)) {
      clientesFixos.push({ ...cliente, saldo });
    } else if (saldo > 0.01) {
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

  return [...ordenadosFixos, ...ordenadosPendencia, ...ordenadosSemPendencia];
}

function getHtmlClienteCard(c) {
  const det = calcularDetalheCliente(c);
  const subtitulo = saldoZero(det.saldo)
    ? `${det.qtdPedidos} pedido${det.qtdPedidos === 1 ? '' : 's'} · sem dívida`
    : `${det.qtdPedidos} pedido${det.qtdPedidos === 1 ? '' : 's'} · devendo <span class="money"><span class="cur">R$</span>${det.saldo.toFixed(2)}</span>`;
  return `
    <button type="button" class="client-card" onclick="abrirDetalheCliente('${c.id}')">
      <div class="client-avatar">${getIniciais(c.nome)}</div>
      <div class="client-info">
        <div class="client-nome">${c.nome}</div>
        <div class="client-sub">${subtitulo}</div>
      </div>
      <svg class="client-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
    </button>
  `;
}

function renderClientes() {
  const tbody = document.getElementById("tbody-clientes");
  const clientesOrdenados = getClientesOrdenados();

  if (tbody) {
    const busca = document.getElementById('busca-cliente')?.value.toLowerCase().trim() || '';
    const clientesFiltrados = busca
      ? clientesOrdenados.filter(c => c.nome.toLowerCase().includes(busca))
      : clientesOrdenados;

    if (!clientesFiltrados.length) {
      tbody.innerHTML = `<div class="empty">${busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</div>`;
    } else {
      tbody.innerHTML = clientesFiltrados.map(getHtmlClienteCard).join("");
    }
  }

  const sel = document.getElementById("filtro-cliente");
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos os clientes</option>' +
      clientesOrdenados.map(c => `<option value="${c.id}"${c.id === cur ? " selected" : ""}>${c.nome}</option>`).join("");
  }

  const subtituloPagina = document.getElementById("clientes-subtitulo");
  if (subtituloPagina) {
    subtituloPagina.textContent = `${clientesOrdenados.length} cliente${clientesOrdenados.length === 1 ? '' : 's'} ativo${clientesOrdenados.length === 1 ? '' : 's'}`;
  }

  atualizarResumoFinanceiro();
  renderDetalheCliente();
}

function filtrarClientes() {
  renderClientes();
}

function getHtmlOrderCard(c, p, det) {
  const saldoRestante = det.saldoPorPedido[p.id] || 0;
  const pagoNoPedido = det.pagoPorPedido[p.id] || 0;
  const statusKey = saldoZero(saldoRestante) ? 'pago' : (pagoNoPedido > 0.01 ? 'parcial' : 'aberto');
  const statusLabel = statusKey === 'pago' ? 'Pago' : (statusKey === 'parcial' ? 'Parcial' : 'Em aberto');
  const data = p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—";
  const qtdItensPedido = (p.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0);
  const pct = p.valorTotal > 0 ? Math.min(100, Math.round((pagoNoPedido / p.valorTotal) * 100)) : 0;
  const cardId = `order-card-${c.id}-${p.id}`;
  const itensHtml = (p.itens && p.itens.length) ? p.itens.map(i => `
    <div class="ch-item">
      <span class="ch-item-nome">${i.nome || 'Produto'} <span class="ch-item-cat">(${i.categoria || 'Geral'})</span></span>
      <span class="ch-item-qty">x${i.quantidade || 0}</span>
      <span class="ch-item-sub">R$ ${((i.preco || 0) * (i.quantidade || 0)).toFixed(2)}</span>
      ${getHtmlDescricaoItem(i.descricao)}
    </div>
  `).join('') : '<div class="ch-empty">Sem itens.</div>';

  return `
    <div class="order-card status-${statusKey}" id="${cardId}" onclick="togglePedidoCard('${cardId}')">
      <div class="order-card-top">
        <span class="order-card-data">${data}</span>
        <span class="status-badge status-${statusKey}">${statusLabel}</span>
      </div>
      <div class="order-card-sub">
        <span>${qtdItensPedido} ${qtdItensPedido === 1 ? 'item' : 'itens'} · ${formatarFormaPagamento(p.formaPagamento)}</span>
        <span class="order-card-arrow">▾</span>
      </div>
      ${statusKey === 'parcial' ? `
        <div class="order-progress">
          <div class="order-progress-bar"><div class="order-progress-fill" style="width:${pct}%"></div></div>
          <div class="order-progress-label">Pago R$ ${pagoNoPedido.toFixed(2)} de R$ ${p.valorTotal.toFixed(2)} (${pct}%)</div>
        </div>
      ` : ''}
      ${saldoRestante > 0.01 ? `
        <div class="order-card-footer">
          <span>Falta pagar</span>
          <strong class="money"><span class="cur">R$</span>${saldoRestante.toFixed(2)}</strong>
        </div>
      ` : ''}
      <div class="order-card-itens" onclick="event.stopPropagation()">
        ${p.comprovante ? `<div class="ch-empty" style="padding-bottom:6px;"><a href="#" onclick="event.preventDefault(); mostrarComprovante('${p.comprovante}')" style="color:var(--forest); font-weight:500;">Ver comprovante do PIX</a></div>` : ''}
        ${itensHtml}
      </div>
    </div>
  `;
}

let clienteDetalheAtual = null;

function abrirDetalheCliente(id) {
  clienteDetalheAtual = id;
  renderDetalheCliente();
  document.getElementById('cliente-detalhe')?.classList.add('open');
  document.body.classList.add('sheet-lock');
}

function fecharDetalheCliente() {
  clienteDetalheAtual = null;
  document.getElementById('cliente-detalhe')?.classList.remove('open');
  document.body.classList.remove('sheet-lock');
}

function renderDetalheCliente() {
  if (!clienteDetalheAtual) return;
  const c = clientes.find(cl => cl.id === clienteDetalheAtual);
  const body = document.getElementById('cliente-detalhe-body');
  if (!c) { fecharDetalheCliente(); return; }
  if (!body) return;

  const nomeEl = document.getElementById('cliente-detalhe-nome');
  const subEl = document.getElementById('cliente-detalhe-sub');
  const det = calcularDetalheCliente(c);
  const { saldo, totalPago, qtdPedidos, pedidosPendentes, pagamentosDoCliente } = det;

  if (nomeEl) nomeEl.textContent = c.nome;
  if (subEl) subEl.textContent = `${qtdPedidos} pedido${qtdPedidos === 1 ? '' : 's'}`;

  const pedidosHtml = pedidosPendentes.length > 0
    ? pedidosPendentes.map(p => getHtmlOrderCard(c, p, det)).join('')
    : '<div class="ch-empty">Nenhum pedido em aberto.</div>';

  const pagamentosHtml = pagamentosDoCliente.length > 0 ? `
    <div class="pagamentos-lista">
      ${pagamentosDoCliente.map(pg => {
        const pgData = pg.data ? new Date(pg.data).toLocaleDateString("pt-BR") : "—";
        const forma = pg.formaPagamento === 'dinheiro' ? 'Dinheiro' : 'PIX';
        const comprovanteLink = pg.comprovante
          ? ` · <a href="#" onclick="event.preventDefault(); mostrarComprovante('${pg.comprovante}')" style="color:var(--forest); font-weight:500;">Ver comprovante</a>`
          : '';
        return `
          <div class="pagamento-linha">
            <span class="pagamento-dot"></span>
            <div class="pagamento-info">
              <div class="pagamento-data">${pgData}</div>
              <div class="pagamento-forma">${forma}${comprovanteLink}</div>
            </div>
            <div class="pagamento-valor money"><span class="cur">R$</span>${pg.valor.toFixed(2)}</div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '<div class="ch-empty">Nenhum pagamento registrado.</div>';

  body.innerHTML = `
    <div class="balance-grid">
      <div class="balance-cell brick">
        <div class="balance-label">Devendo</div>
        <div class="balance-valor money"><span class="cur">R$</span>${saldo.toFixed(2)}</div>
      </div>
      <div class="balance-cell sage">
        <div class="balance-label">Já pago</div>
        <div class="balance-valor money"><span class="cur">R$</span>${totalPago.toFixed(2)}</div>
      </div>
    </div>

    ${!saldoZero(saldo) ? `
      <div class="section-block">
        <div class="pay-row">
          <input type="number" id="pay-val-${c.id}" value="0" step="0.01" min="0" max="${saldo.toFixed(2)}" placeholder="R$" inputmode="decimal">
          <button class="sm success" onclick="abaterPagamento('${c.id}', ${saldo})">Abater</button>
          <button class="sm primary" onclick="quitarTudo('${c.id}', ${saldo})">Quitar tudo</button>
        </div>
      </div>
    ` : ''}

    <div class="section-block">
      <div class="section-title">Pedidos</div>
      ${pedidosHtml}
    </div>

    <div class="section-block">
      <div class="section-title">Pagamentos recebidos</div>
      ${pagamentosHtml}
    </div>

    <div class="card-actions-buttons">
      <button class="sm" onclick="editarCliente('${c.id}')">Editar cliente</button>
      <button class="sm danger" onclick="deletarCliente('${c.id}')">Excluir cliente</button>
    </div>
  `;
}

function togglePedidoCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const itensDiv = card.querySelector('.order-card-itens');
  const abrir = !card.classList.contains('open');
  card.classList.toggle('open', abrir);
  if (itensDiv) itensDiv.style.display = abrir ? 'block' : 'none';
}

// FUNÇÃO ATUALIZADA: Abater pagamento com seleção de pedido
async function abaterPagamento(clienteId, saldo) {
  const inp = document.getElementById("pay-val-" + clienteId);
  const valor = parseFloat(inp.value) || 0;
  if (valor <= 0) { toast("Informe um valor válido."); return; }
  if (valor > saldo) { toast("Valor maior que o saldo devedor."); return; }

  // Abre modal para selecionar pedido
  const resultado = await abrirModalPagamentoPorPedido(clienteId, valor);
  if (!resultado) return; // Cancelado

  const { formaPagamento, pedidoId, comprovante } = resultado;

  await dbFS.collection("pagamentos").add({
    clienteId,
    pedidoId: pedidoId || null,
    valor,
    formaPagamento: formaPagamento,
    comprovante: formaPagamento === 'pix' ? (comprovante || null) : null,
    data: new Date().toISOString()
  });

  toast(`Pagamento de R$ ${valor.toFixed(2)} registrado (${formaPagamento.toUpperCase()}).`);
  inp.value = 0;
}

// FUNÇÃO ATUALIZADA: Quitar tudo com seleção de pedido
async function quitarTudo(clienteId, saldo) {
  if (!confirm("Quitar todo o saldo de R$ " + saldo.toFixed(2) + "?")) return;

  // Abre modal para selecionar pedido
  const resultado = await abrirModalPagamentoPorPedido(clienteId, saldo);
  if (!resultado) return; // Cancelado

  const { formaPagamento, pedidoId, comprovante } = resultado;

  await dbFS.collection("pagamentos").add({
    clienteId,
    pedidoId: pedidoId || null,
    valor: saldo,
    formaPagamento: formaPagamento,
    comprovante: formaPagamento === 'pix' ? (comprovante || null) : null,
    data: new Date().toISOString()
  });

  toast(`Saldo de R$ ${saldo.toFixed(2)} quitado (${formaPagamento.toUpperCase()}).`);
}

// NOVA FUNÇÃO: Modal de seleção de forma de pagamento
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

// NOVA FUNÇÃO: Modal para selecionar qual pedido pagar
function abrirModalPagamentoPorPedido(clienteId, valor) {
  return new Promise((resolve) => {
    // Busca pedidos pendentes do cliente
    const pedidosDoCliente = pedidos
      .filter(p => p.clienteId === clienteId)
      .sort((a, b) => new Date(b.data) - new Date(a.data));

    // Calcula saldo de cada pedido
    const pedidosComSaldo = pedidosDoCliente.map(p => {
      const totalAbatimentos = pagamentos
        .filter(pg => pg.clienteId === clienteId)
        .reduce((s, pg) => s + pg.valor, 0);
      
      const pedidosOrdenados = [...pedidosDoCliente].sort((a, b) => new Date(a.data) - new Date(b.data));
      let abatimentosRestantes = totalAbatimentos;
      let saldoPedido = 0;
      
      pedidosOrdenados.forEach(pd => {
        const jaPago = pd.valorPago || 0;
        const restante = Math.max(0, pd.valorTotal - jaPago);
        const abatParaEste = Math.min(restante, abatimentosRestantes);
        abatimentosRestantes = Math.max(0, abatimentosRestantes - abatParaEste);
        if (pd.id === p.id) saldoPedido = arredondarMoeda(restante - abatParaEste);
      });
      
      return { ...p, saldoPedido };
    }).filter(p => p.saldoPedido > 0.01);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '10001';

    let pedidoSelecionado = null;

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 500px; max-height: 600px; overflow-y: auto;">
        <h3 style="margin-top: 0; color: #0f172a; margin-bottom: 1rem;">Pagar por pedido</h3>
        
        <div style="margin-bottom: 1.5rem; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
          <span style="font-size: 13px; color: #065f46;">Valor a pagar: </span>
          <span style="font-weight: 700; color: #065f46; font-size: 16px;">R$ ${valor.toFixed(2)}</span>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 600; color: #475569; margin-bottom: 10px; font-size: 14px;">Qual pedido deseja pagar?</label>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
            ${pedidosComSaldo.length > 0 ? pedidosComSaldo.map((p, idx) => {
              const data = p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—";
              const itensTexto = p.itens ? p.itens.map(i => `${i.nome} x${i.quantidade}`).join(', ') : 'Sem itens';
              return `
                <label style="display: flex; align-items: center; padding: 10px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">
                  <input type="radio" name="pedido-select" value="${p.id}" style="margin-right: 10px; cursor: pointer;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #0f172a; font-size: 14px;">${data} • R$ ${p.valorTotal.toFixed(2)}</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${itensTexto}</div>
                    <div style="font-size: 13px; color: #ef4444; margin-top: 4px; font-weight: 500;">Falta: R$ ${p.saldoPedido.toFixed(2)}</div>
                  </div>
                </label>
              `;
            }).join('') : '<div style="color: #94a3b8; text-align: center; padding: 20px;">Nenhum pedido pendente</div>'}
            
            <label style="display: flex; align-items: center; padding: 10px; background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 6px; cursor: pointer; margin-top: 8px; transition: all 0.2s ease;">
              <input type="radio" name="pedido-select" value="todos" checked style="margin-right: 10px; cursor: pointer;">
              <div style="font-weight: 600; color: #1e40af;">Pagar de qualquer pedido (distribuir automaticamente)</div>
            </label>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 600; color: #475569; margin-bottom: 10px; font-size: 14px;">Forma de pagamento</label>
          <div style="display: flex; gap: 8px;">
            <button class="btn-forma" data-forma="dinheiro" style="flex: 1; background: #f0fdf4; color: #065f46; border: 2px solid #bbf7d0; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
              Dinheiro
            </button>
            <button class="btn-forma" data-forma="pix" style="flex: 1; background: #eff6ff; color: #1e40af; border: 2px solid #bfdbfe; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
              PIX
            </button>
          </div>
        </div>

        <div id="secao-comprovante-pagto" style="display:none; margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 600; color: #475569; margin-bottom: 10px; font-size: 14px;">Comprovante do PIX (opcional)</label>
          <div class="photo-picker">
            <div class="photo-preview" id="preview-comprovante-pagto">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <div class="photo-picker-actions">
              <button type="button" class="sm btn-escolher-comprovante-pagto">Escolher foto</button>
              <button type="button" class="sm danger btn-remover-comprovante-pagto" style="display:none;">Remover</button>
            </div>
          </div>
          <input type="file" accept="image/*" class="input-comprovante-pagto" style="display:none;">
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn-confirmar-pagto" style="flex: 1; background: #10b981; color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
            Confirmar pagamento
          </button>
          <button class="btn-cancelar-pagto2" style="flex: 1; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let formaEscolhida = null;
    let comprovanteEscolhido = null;

    const secaoComprovante = overlay.querySelector('#secao-comprovante-pagto');
    const previewComprovante = overlay.querySelector('#preview-comprovante-pagto');
    const inputComprovante = overlay.querySelector('.input-comprovante-pagto');
    const btnRemoverComprovante = overlay.querySelector('.btn-remover-comprovante-pagto');

    function atualizarPreviewComprovantePagto() {
      if (!previewComprovante) return;
      if (comprovanteEscolhido) {
        previewComprovante.innerHTML = `<img src="${comprovanteEscolhido}" alt="Comprovante">`;
        if (btnRemoverComprovante) btnRemoverComprovante.style.display = '';
      } else {
        previewComprovante.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>`;
        if (btnRemoverComprovante) btnRemoverComprovante.style.display = 'none';
      }
    }

    overlay.querySelector('.btn-escolher-comprovante-pagto')?.addEventListener('click', () => {
      inputComprovante?.click();
    });

    inputComprovante?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('Selecione um arquivo de imagem.');
        return;
      }
      comprimirImagem(file).then(dataUrl => {
        comprovanteEscolhido = dataUrl;
        atualizarPreviewComprovantePagto();
      });
    });

    btnRemoverComprovante?.addEventListener('click', () => {
      comprovanteEscolhido = null;
      atualizarPreviewComprovantePagto();
    });

    // Selecionar forma de pagamento
    overlay.querySelectorAll('.btn-forma').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-forma').forEach(b => {
          b.style.borderColor = '#e2e8f0';
          b.style.background = b.getAttribute('data-forma') === 'dinheiro' ? '#f0fdf4' : '#eff6ff';
        });
        btn.style.borderColor = '#10b981';
        btn.style.background = btn.getAttribute('data-forma') === 'dinheiro' ? '#dcfce7' : '#dbeafe';
        formaEscolhida = btn.getAttribute('data-forma');
        if (secaoComprovante) secaoComprovante.style.display = formaEscolhida === 'pix' ? 'block' : 'none';
        if (formaEscolhida !== 'pix') {
          comprovanteEscolhido = null;
          atualizarPreviewComprovantePagto();
        }
      });
    });

    // Selecionar pedido
    overlay.querySelectorAll('input[name="pedido-select"]').forEach(radio => {
      radio.addEventListener('change', () => {
        pedidoSelecionado = radio.value === 'todos' ? null : radio.value;
      });
    });

    // Confirmar
    overlay.querySelector('.btn-confirmar-pagto').addEventListener('click', () => {
      if (!formaEscolhida) {
        toast("Selecione a forma de pagamento.");
        return;
      }
      overlay.remove();
      resolve({ formaPagamento: formaEscolhida, pedidoId: pedidoSelecionado, comprovante: comprovanteEscolhido });
    });

    // Cancelar
    overlay.querySelector('.btn-cancelar-pagto2').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

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
  abrirSheetMobile('sheet-cliente');
}

function cancelarEdicaoCliente() {
  document.getElementById("edit-cliente-id").value = "";
  document.getElementById("c-nome").value = "";
  document.getElementById("cliente-title").textContent = "Novo cliente";
  fecharSheetMobile('sheet-cliente');
}

async function deletarCliente(id) {
  if (!confirm("Excluir este cliente?")) return;
  await dbFS.collection("clientes").doc(id).delete();
  if (clienteDetalheAtual === id) fecharDetalheCliente();
  toast("Cliente excluído.");
}

// --- PEDIDOS ---

let itensPedido = [];

function adicionarItemPedido() {
  const input = document.getElementById("ped-produto");
  const nomeDigitado = input.value.trim();
  const qty = parseInt(document.getElementById("ped-qty").value, 10) || 1;
  if (!nomeDigitado) { toast("Selecione um produto."); return; }

  const prod = produtos.find(p => (p.nome || '').toLowerCase() === nomeDigitado.toLowerCase());
  if (!prod) { toast(`Produto "${nomeDigitado}" não encontrado.`); return; }
  const produtoId = prod.id;

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
      descricao: prod.descricao || '',
      itensCombo: []
    });
  }
  document.getElementById("ped-produto").value = "";
  document.getElementById("ped-qty").value = "1";
  renderItensPedido();
}

function montarCombo(comboSelecionado = null, qtdCombo = null) {
  const nomeDigitado = document.getElementById("ped-produto").value.trim();
  const comboId = comboSelecionado || produtos.find(p => (p.nome || '').toLowerCase() === nomeDigitado.toLowerCase())?.id;
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
        descricao: produtoBase.descricao || '',
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
    lista.innerHTML = '<div class="empty" style="padding:1rem 0;">Nenhum produto adicionado ainda.</div>';
    resumo.style.display = "none";
    return;
  }

  lista.innerHTML = itensPedido.map(i => {
    const comboExtras = i.tipo === 'combo' && Array.isArray(i.itensCombo) && i.itensCombo.length
      ? `<div class="product-sub">Combo: ${(i.itensCombo || []).map(item => `${item.nome} x${item.quantidade}`).join(', ')}</div>`
      : '';

    return `
      <div class="item-card">
        <div class="item-card-info">
          <div class="item-card-nome">${i.nome} <span class="ch-item-cat">x${i.quantidade}</span></div>
          <div class="item-card-sub money"><span class="cur">R$</span>${(i.preco * i.quantidade).toFixed(2)}</div>
          ${comboExtras}
          ${getHtmlDescricaoItem(i.descricao)}
        </div>
        <button type="button" class="item-card-remove" onclick="removerItemPedido('${i.produtoId}')" aria-label="Remover item">&#10005;</button>
      </div>
    `;
  }).join("");

  const total = itensPedido.reduce((s, i) => s + i.preco * i.quantidade, 0);
  resumoItens.innerHTML = itensPedido.map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--ink-2); font-size:13px;">
      <span>${i.nome} x${i.quantidade}</span>
      <span class="money"><span class="cur">R$</span>${(i.preco * i.quantidade).toFixed(2)}</span>
    </div>
  `).join("");
  resumoTotal.innerHTML = `<span style="font-size:13px;color:var(--ink-2);">Total</span> <span class="money"><span class="cur">R$</span>${total.toFixed(2)}</span>`;
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
      tipo: i.tipo || 'simples', itensCombo: i.itensCombo || [],
      descricao: i.descricao || ''
    })),
    quantidade: itensPedido.reduce((s, i) => s + i.quantidade, 0),
    valorTotal, valorPago, parcelas,
    formaPagamento: forma,
    comprovante: forma === 'pix' ? (comprovantePedidoTemp || null) : null,
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

function selecionarFormaPagamento(valor) {
  document.getElementById('ped-forma').value = valor;
  document.querySelectorAll('#chips-forma-pagamento .payment-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-valor') === valor);
  });
  const grupo = document.getElementById('grupo-comprovante-pedido');
  if (grupo) {
    grupo.style.display = valor === 'pix' ? 'block' : 'none';
    if (valor !== 'pix') {
      comprovantePedidoTemp = null;
      atualizarPreviewComprovantePedido();
    }
  }
}

let comprovantePedidoTemp = null;

function selecionarComprovantePedido(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Selecione um arquivo de imagem.');
    return;
  }
  comprimirImagem(file).then(dataUrl => {
    comprovantePedidoTemp = dataUrl;
    atualizarPreviewComprovantePedido();
  });
}

function atualizarPreviewComprovantePedido() {
  const preview = document.getElementById('ped-comprovante-preview');
  const removerBtn = document.getElementById('ped-comprovante-remover-btn');
  if (!preview) return;
  if (comprovantePedidoTemp) {
    preview.innerHTML = `<img src="${comprovantePedidoTemp}" alt="Comprovante do PIX">`;
    if (removerBtn) removerBtn.style.display = '';
  } else {
    preview.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>`;
    if (removerBtn) removerBtn.style.display = 'none';
  }
}

function removerComprovantePedido() {
  comprovantePedidoTemp = null;
  atualizarPreviewComprovantePedido();
}

function limparPedido() {
  document.getElementById("ped-cliente").value = "";
  document.getElementById("ped-produto").value = "";
  document.getElementById("ped-qty").value = "1";
  selecionarFormaPagamento("dinheiro");
  document.getElementById("ped-parcelas").value = "1";
  document.getElementById("ped-pago").value = "0";
  itensPedido = [];
  renderItensPedido();
}

// --- HISTÓRICO ---

let modoHistorico = 'pedidos';

function alternarModoHistorico(modo) {
  modoHistorico = modo;
  document.querySelectorAll('#historico-modo .category-button').forEach(b => {
    b.classList.toggle('active', b.dataset.modo === modo);
  });
  renderHistorico();
}

function renderHistoricoPagamentos() {
  const tbody = document.getElementById("tbody-historico");
  if (!tbody) return;
  const filtro = document.getElementById("filtro-cliente")?.value || "";

  if (!pagamentos.length) {
    tbody.innerHTML = '<div class="empty">Nenhum pagamento registrado.</div>';
    return;
  }

  const filtrados = (filtro ? pagamentos.filter(pg => pg.clienteId === filtro) : pagamentos)
    .slice()
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (!filtrados.length) {
    tbody.innerHTML = '<div class="empty">Nenhum pagamento encontrado.</div>';
    return;
  }

  tbody.innerHTML = `
    <div class="pagamentos-lista">
      ${filtrados.map(pg => {
        const c = clientes.find(cl => cl.id === pg.clienteId);
        const data = pg.data ? new Date(pg.data).toLocaleDateString("pt-BR") : "—";
        const forma = pg.formaPagamento === 'dinheiro' ? 'Dinheiro' : 'PIX';
        const comprovanteLink = pg.comprovante
          ? ` · <a href="#" onclick="event.preventDefault(); mostrarComprovante('${pg.comprovante}')" style="color:var(--forest); font-weight:500;">Ver comprovante</a>`
          : '';
        return `
          <div class="pagamento-linha">
            <span class="pagamento-dot"></span>
            <div class="pagamento-info">
              <div class="pagamento-data">${c ? c.nome : 'Cliente removido'}</div>
              <div class="pagamento-forma">${data} · ${forma}${comprovanteLink}</div>
            </div>
            <div class="pagamento-valor money"><span class="cur">R$</span>${pg.valor.toFixed(2)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderHistorico() {
  if (modoHistorico === 'pagamentos') {
    renderHistoricoPagamentos();
    return;
  }

  const tbody = document.getElementById("tbody-historico");
  if (!tbody) return;
  const filtro = document.getElementById("filtro-cliente")?.value || "";
  const lista = pedidos;
  if (!lista.length) {
    tbody.innerHTML = '<div class="empty">Nenhum pedido registrado.</div>';
    return;
  }

  // Ordena do mais recente para o mais antigo
  const filtrados = (filtro ? lista.filter(p => p.clienteId === filtro) : lista)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (!filtrados.length) {
    tbody.innerHTML = '<div class="empty">Nenhum pedido encontrado.</div>';
    return;
  }

  let html = '';
  filtrados.forEach(ped => {
    const c = clientes.find(x => x.id === ped.clienteId);

    // DISTRIBUIÇÃO CORRETA DE ABATIMENTOS:
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
        abatimentoDestePedido = arredondarMoeda(abatParaEste);
        // Encontra a forma de pagamento do abatimento que foi aplicado a este pedido
        const abatimentosAplicados = pagamentos
          .filter(pg => pg.clienteId === ped.clienteId)
          .sort((a, b) => new Date(a.data) - new Date(b.data));
        let acumulado = 0;
        for (const pg of abatimentosAplicados) {
          if (acumulado >= pg.valor) continue;
          const restante = pg.valor - acumulado;
          const parteUsada = Math.min(restante, abatimentoDestePedido);
          if (parteUsada > 0.01) {
            formaPagamentoDoAbatimento = pg.formaPagamento;
            break;
          }
          acumulado += pg.valor;
        }
        break;
      }
      abatRestante = Math.max(0, abatRestante - abatParaEste);
    }

    const totalRealmentePago = arredondarMoeda(ped.valorPago + abatimentoDestePedido);
    const pago = totalRealmentePago >= (ped.valorTotal - 0.01);
    const data = ped.data ? new Date(ped.data).toLocaleDateString("pt-BR") : "—";
    const statusKey = pago ? 'pago' : (totalRealmentePago > 0.01 ? 'parcial' : 'aberto');
    const statusLabel = statusKey === 'pago' ? 'Pago' : (statusKey === 'parcial' ? 'Parcial' : 'Em aberto');
    const saldoRestante = arredondarMoeda(Math.max(0, ped.valorTotal - totalRealmentePago));
    const pct = ped.valorTotal > 0 ? Math.min(100, Math.round((totalRealmentePago / ped.valorTotal) * 100)) : 0;
    const qtdItensPedido = (ped.itens || []).reduce((s, i) => s + (i.quantidade || 0), 0);
    const cardId = `hist-order-${ped.id}`;

    const itensHtml = (ped.itens && ped.itens.length) ? ped.itens.map(i => `
      <div class="ch-item">
        <span class="ch-item-nome">${i.nome || 'Produto'} <span class="ch-item-cat">(${i.categoria || 'Geral'})</span></span>
        <span class="ch-item-qty">x${i.quantidade || 0}</span>
        <span class="ch-item-sub">R$ ${((i.preco || 0) * (i.quantidade || 0)).toFixed(2)}</span>
        ${getHtmlDescricaoItem(i.descricao)}
      </div>
    `).join('') : '<div class="ch-empty">Sem itens.</div>';

    html += `
      <div class="order-card status-${statusKey}" id="${cardId}" onclick="togglePedidoCard('${cardId}')">
        <div class="order-card-top">
          <span class="order-card-data">${data}</span>
          <span class="status-badge status-${statusKey}">${statusLabel}</span>
        </div>
        <div class="order-card-sub">
          <span>${c ? c.nome : '—'} · ${qtdItensPedido} ${qtdItensPedido === 1 ? 'item' : 'itens'} · ${formatarFormaPagamento(ped.formaPagamento)}</span>
          <span class="order-card-arrow">▾</span>
        </div>
        ${statusKey === 'parcial' ? `
          <div class="order-progress">
            <div class="order-progress-bar"><div class="order-progress-fill" style="width:${pct}%"></div></div>
            <div class="order-progress-label">Pago R$ ${totalRealmentePago.toFixed(2)} de R$ ${ped.valorTotal.toFixed(2)} (${pct}%)</div>
          </div>
        ` : ''}
        ${saldoRestante > 0.01 ? `
          <div class="order-card-footer">
            <span>Falta pagar</span>
            <strong class="money"><span class="cur">R$</span>${saldoRestante.toFixed(2)}</strong>
          </div>
        ` : ''}
        <div class="order-card-itens" onclick="event.stopPropagation()">
          ${ped.comprovante ? `<div class="ch-empty" style="padding-bottom:6px;"><a href="#" onclick="event.preventDefault(); mostrarComprovante('${ped.comprovante}')" style="color:var(--forest); font-weight:500;">Ver comprovante do PIX</a></div>` : ''}
          ${itensHtml}
        </div>
      </div>
    `;
  });

  tbody.innerHTML = html;
}

// --- SELECTS ---

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

  atualizarListaProdutosPedido();
}

function atualizarListaProdutosPedido() {
  const datalist = document.getElementById("lista-produtos-pedido");
  if (!datalist) return;
  const input = document.getElementById("ped-produto");
  const filtro = (input?.value || '').toLowerCase();
  const filtroAtivo = Array.from(document.querySelectorAll('#filtro-categoria .category-button.active')).find(btn => btn.textContent !== 'Todas');
  const categoriaFiltrada = filtroAtivo ? filtroAtivo.textContent : null;
  const produtosFiltrados = (!categoriaFiltrada ? produtos : produtos.filter(p => p.categoria === categoriaFiltrada))
    .filter(p => isProdutoAtivo(p))
    .filter(p => (p.nome || '').toLowerCase().includes(filtro));

  datalist.innerHTML = produtosFiltrados.map(p => {
    const qtdAtual = getQuantidadeProduto(p);
    const precoFinal = p.precoVenda || 0;
    const categoria = p.categoria ? ` (${p.categoria})` : '';
    const descricaoLabel = p.descricao ? ` — ${truncarTexto(p.descricao, 40)}` : '';
    return `<option value="${p.nome}">${categoria} (${qtdAtual} un.) — R$ ${precoFinal.toFixed(2)}${descricaoLabel}</option>`;
  }).join('');
}

// --- EVENTOS DE TECLADO ---

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

// --- BUSCA EM TEMPO REAL ---

function filtrarEstoque() {
  const busca = document.getElementById('busca-produto').value.toLowerCase().trim();
  const tbody = document.getElementById('tbody-estoque');
  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca));
  if (produtosFiltrados.length === 0) {
    tbody.innerHTML = '<div class="empty">Nenhum produto encontrado.</div>';
    return;
  }
  tbody.innerHTML = produtosFiltrados.map(getHtmlProdutoEstoque).join("");
}

// --- FILTRO POR CATEGORIA (ESTOQUE) ---

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
    tbody.innerHTML = '<div class="empty">Nenhum produto encontrado.</div>';
    return;
  }
  tbody.innerHTML = produtosFiltrados.map(getHtmlProdutoEstoque).join("");
}

// --- ATUALIZAR FILTRO DE CATEGORIA (ESTOQUE) ---

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

// --- MODAL DE DESCRIÇÃO ---

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

// --- RESUMO FINANCEIRO ---

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
    totalReceber += arredondarMoeda(Math.max(0, totalPedidos - totalPago));
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

  if (elReceber) elReceber.innerHTML = `<span class="cur">R$</span>${arredondarMoeda(totalReceber).toFixed(2)}`;
  if (elEstoque) elEstoque.innerHTML = `<span class="cur">R$</span>${totalEstoque.toFixed(2)}`;
  if (elCusto) elCusto.innerHTML = `<span class="cur">R$</span>${totalCusto.toFixed(2)}`;
  if (elLucro) elLucro.innerHTML = `<span class="cur">R$</span>${lucroEstimado.toFixed(2)}`;
}

// --- LIMPEZA SECRETA (Ctrl + Alt + P) ---

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