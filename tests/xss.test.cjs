// Execute: node tests/xss.test.cjs (Chrome ou Edge instalado, sem dependências npm).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const browser = [process.env.XSS_TEST_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(file => file && fs.existsSync(file));
if (!browser) throw new Error('Defina XSS_TEST_BROWSER com o caminho do Chrome/Chromium/Edge.');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estoque-xss-'));
const mock = `
window.firebase = {
  initializeApp() {},
  firestore() { return { collection() { return { get: async () => ({docs:produtos.map(p => ({data:() => p})), empty:false}) }; } }; },
  auth: Object.assign(() => ({setPersistence: async () => {}, onAuthStateChanged() {}}),
    {Auth:{Persistence:{SESSION:'session'}}})
};
`;
async function browserTests() {
  let count = 0;
  const assert = (ok, label) => { if (!ok) throw new Error(label); count++; };
  const payload = `<img src=x onerror="console.log('XSS FUNCIONOU')">`;
  const hostile = `'");window.__xss = true;// " autofocus onfocus="window.__xss=true" & <svg onload="window.__xss=true">`;
  const originalLog = console.log;
  console.log = (...args) => { if (args.includes('XSS FUNCIONOU')) window.__xss = true; originalLog(...args); };
  const node = id => document.getElementById(id);
  const safe = (el, label) => assert(!el.querySelector('script, img[onerror], svg[onload], [onfocus], iframe, object'), label);
  const area = document.createElement('div');
  document.body.appendChild(area);
  const product = {id:hostile, nome:payload, categoria:payload, descricao:hostile, quantidade:10, precoVenda:12, precoCusto:5};
  const client = {id:hostile, nome:payload};
  const item = {produtoId:hostile, nome:payload, categoria:payload, descricao:hostile, quantidade:2, preco:12};
  const order = {id:hostile, clienteId:hostile, itens:[item], valorTotal:24, valorPago:0,
    data:'2026-09-13', formaPagamento:payload, comprovante:hostile};
  produtos = [product]; clientes = [client]; pedidos = [order]; pagamentos = [];

  assert(escaparHTML(`&<>"'`) === '&amp;&lt;&gt;&quot;&#39;', 'cinco caracteres escapados');
  assert(escaparHTML(null) === '' && escaparHTML(0) === '0', 'valores nulos e números');
  area.innerHTML = getHtmlProdutoEstoque(product);
  safe(area, 'produto seguro');
  assert(area.querySelector('.product-nome-grid').textContent === payload, 'nome literal');
  assert(area.querySelector('.product-cat-grid').textContent === payload, 'categoria literal');
  assert(area.querySelector('.product-cart-add svg'), 'SVG fixo preservado');
  let received;
  const editOriginal = editarProduto;
  editarProduto = id => { received = id; };
  area.querySelector('.product-card').click();
  assert(received === hostile, 'ID original no evento editar');
  editarProduto = editOriginal;
  const qtyOriginal = ajustarQty;
  ajustarQty = (id, delta) => { received = [id, delta]; };
  area.querySelector('.qty-ctrl button').click();
  assert(received[0] === hostile && received[1] === -1, 'ID e delta no botão de quantidade');
  ajustarQty = qtyOriginal;

  area.innerHTML = getHtmlDescricaoItem(hostile);
  safe(area, 'descrição curta segura');
  area.querySelector('.item-desc').click();
  let modal = document.querySelector('.modal-desc-overlay');
  assert(modal.querySelector('p').textContent === hostile, 'descrição completa literal');
  safe(modal, 'modal de descrição seguro'); modal.remove();

  atualizarListaProdutosCombo(); atualizarListaProdutosPedido();
  for (const id of ['lista-produtos-combo', 'lista-produtos-pedido']) {
    const option = node(id).querySelector('option');
    assert(option.value === payload, id + ': value original');
    assert(option.children.length === 0, id + ': conteúdo textual');
    assert(option.textContent.includes(hostile.slice(0, 40)), id + ': descrição literal');
  }
  assert(node('lista-produtos-combo').querySelector('option').dataset.id === hostile, 'ID datalist preservado');

  itemsComboTemp = [{...item}]; renderizarItensComboTemp();
  safe(node('itens-combo-tags'), 'tags combo seguras');
  assert(node('itens-combo-tags').querySelector('span').title === hostile, 'title literal');
  assert(JSON.parse(node('p-itens-combo').value)[0].nome === payload, 'combo sem escapar armazenamento');
  node('itens-combo-tags').querySelector('button').click();
  assert(itemsComboTemp.length === 0, 'remover item combo com ID especial');

  carrinhoEstoque = [{...item}]; renderCarrinhoEstoque();
  safe(node('carrinho-itens-lista'), 'carrinho seguro');
  node('carrinho-itens-lista').querySelector('button').click();
  assert(carrinhoEstoque.length === 0, 'remover carrinho com ID especial');
  itensPedido = [{...item, tipo:'combo', itensCombo:[{...item}]}]; renderItensPedido();
  safe(node('itens-lista'), 'pedido e subitens combo seguros'); safe(node('resumo-itens'), 'resumo seguro');
  assert(node('itens-lista').querySelector('.product-sub').textContent.includes(payload), 'nome do subitem literal');
  node('itens-lista').querySelector('.item-card-remove').click();
  assert(itensPedido.length === 0, 'remover pedido com ID especial');

  renderClientes();
  safe(node('tbody-clientes'), 'clientes seguros');
  assert(node('tbody-clientes').querySelector('.client-nome').textContent === payload, 'cliente literal');
  assert(node('filtro-cliente').options[1].value === hostile, 'select preserva UID');
  node('filtro-cliente').value = hostile; renderClientes();
  assert(node('filtro-cliente').value === hostile, 'seleção cliente preservada');
  node('tbody-clientes').querySelector('.client-card').click();
  safe(node('cliente-detalhe-body'), 'detalhes cliente seguros');
  assert(document.getElementById('pay-val-' + hostile), 'ID do pagamento preservado');
  const payOriginal = abaterPagamento;
  abaterPagamento = (id, saldo) => { received = [id, saldo]; };
  node('cliente-detalhe-body').querySelector('.pay-row button').click();
  assert(received[0] === hostile && received[1] === 24, 'argumentos do pagamento preservados');
  abaterPagamento = payOriginal;

  renderHistorico(); safe(node('tbody-historico'), 'histórico seguro');
  const card = document.getElementById('hist-order-' + hostile);
  assert(card && card.dataset.arg0 === card.id, 'ID histórico preservado');
  card.click(); assert(card.querySelector('.order-card-itens').style.display === 'block', 'expansão histórico');
  assert(card.querySelector('.ch-item-nome').textContent.includes(payload), 'item histórico literal');
  card.querySelector('a').click();
  modal = document.querySelector('.modal-desc-overlay'); safe(modal, 'comprovante seguro'); modal.remove();

  pagamentos = [{id:'pg', clienteId:hostile, valor:1, data:'2026-09-13', comprovante:hostile}];
  renderHistoricoPagamentos(); safe(node('tbody-historico'), 'histórico pagamentos seguro');
  renderDetalheCliente(); safe(node('cliente-detalhe-body'), 'pagamentos detalhe seguros');
  abrirModalPagamentoPorPedido(hostile, 1);
  const overlay = document.body.lastElementChild; safe(overlay, 'modal pagamento seguro');
  assert(overlay.querySelector('input[name="pedido-select"]').value === hostile, 'radio preserva ID');
  overlay.querySelector('.btn-cancelar-pagto2').click();

  const raster = 'data:image/png;base64,iVBORw0KGgo=';
  for (const value of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'data:image/svg+xml,<svg onload=alert(1)>']) {
    assert(urlImagemSegura(value) === '', 'protocolo/formato bloqueado');
  }
  assert(urlImagemSegura(raster) === raster, 'upload raster permitido');
  assert(urlImagemSegura('https://example.com/foto.png') === 'https://example.com/foto.png', 'HTTPS permitido');
  assert(urlImagemSegura('blob:https://example.com/id') === 'blob:https://example.com/id', 'blob permitido');
  for (const value of [hostile, 'x" onerror="window.__xss=true']) {
    fotoProdutoTemp = value; atualizarPreviewFotoProduto(); safe(node('p-foto-preview'), 'preview foto seguro');
    comprovantePedidoTemp = value; atualizarPreviewComprovantePedido(); safe(node('ped-comprovante-preview'), 'preview comprovante seguro');
    area.innerHTML = getHtmlProdutoEstoque({...product, foto:value}); safe(area, 'foto card segura');
  }
  await atualizarInterfaceCategorias();
  safe(node('botoes-rapidos-categoria'), 'categorias DOM seguras');
  // As categorias da fixture são lidas do Firestore simulado, sem escrita no banco.
  const categoryButton = node('botoes-rapidos-categoria').querySelector('.category-button');
  assert(categoryButton, 'botão de categoria criado');
  categoryButton.click(); assert(node('p-cat').value === payload, 'filtro categoria literal');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert(!window.__xss, 'nenhum payload executado');
  return count;
}
const script = text => '<script>' + text.replace(/<\/script/gi, '<\\/script') + '</script>';
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<link\b[^>]*>/gi, '');
html = html.replace('</body>', script(mock) + script(fs.readFileSync(path.join(root, 'script.js'), 'utf8')) + script(`
window.addEventListener('DOMContentLoaded', async () => {
  const result = document.createElement('pre'); result.id = 'xss-test-result';
  try { result.textContent = 'PASS ' + await (${browserTests.toString()})(); }
  catch (error) { result.textContent = 'FAIL ' + error.stack; }
  document.body.appendChild(result);
});`) + '</body>');
const file = path.join(dir, 'test.html');
fs.writeFileSync(file, html);
try {
  const run = spawnSync(browser, ['--headless', '--disable-gpu', '--in-process-gpu', '--no-first-run',
    '--disable-background-networking', '--no-default-browser-check',
    '--user-data-dir=' + path.join(dir, 'profile'), '--dump-dom', '--virtual-time-budget=3000',
    require('node:url').pathToFileURL(file).href], {encoding:'utf8', windowsHide:true, timeout:60000, maxBuffer:8 * 1024 * 1024});
  const result = (run.stdout || '').match(/<pre id="xss-test-result">([\s\S]*?)<\/pre>/);
  if (!result || !result[1].startsWith('PASS ')) {
    throw new Error(result ? result[1] : (run.error?.message || run.stderr || 'Navegador sem resultado'));
  }
  console.log(result[1] + ' verificações no navegador');
} finally {
  if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('estoque-xss-')) {
    throw new Error('Diretório temporário fora do local esperado.');
  }
  fs.rmSync(dir, {recursive:true, force:true, maxRetries:5, retryDelay:200});
}
