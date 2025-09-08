/* mixed-cart-guard.js
   Bloqueia checkout se carrinho tiver ENCOMENDA + PRONTA ENTREGA juntos.
   Ajuste os rótulos em CONFIG abaixo conforme sua loja.
*/

(function () {
  // ====== CONFIG ======
  // Detectar por TYPE:
  const TYPE_ENCOMENDA = 'encomenda';
  const TYPE_PRONTA = 'pronta entrega';

  // OU (opcional) detectar por TAGS (além do type):
  const TAG_ENCOMENDA = 'encomenda';            // ex: "Encomenda (Pré venda)"
  const TAG_PRONTA = 'pronta-entrega';           // opcional, se usar tag pra pronta entrega

  // Mensagem ao cliente:
  const WARNING_TEXT = 'Seu carrinho contém itens de Encomenda e de Pronta Entrega. \
Por favor, finalize pedidos separados (um só de Encomenda e outro só de Pronta Entrega).';

  // ====== CORE ======
  async function fetchCart() {
    const res = await fetch('/cart.js');
    if (!res.ok) throw new Error('Falha ao carregar carrinho');
    return res.json();
  }

  function hasType(str, needle) {
    return (str || '').toString().trim().toLowerCase() === needle;
  }
  function hasTag(tagsArr, needle) {
    if (!Array.isArray(tagsArr)) return false;
    return tagsArr.map(t => (t || '').toString().trim().toLowerCase()).includes(needle);
  }

  function decideGroups(items) {
    let hasEncomenda = false;
    let hasPronta = false;

    for (const it of items) {
      const pType = (it.product_type || '').trim().toLowerCase();
      // Ajax cart retorna tags como string separada por vírgulas. Normalizamos para array:
      const tags = (it.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const isEncomendaByType = hasType(pType, TYPE_ENCOMENDA);
      const isProntaByType    = hasType(pType, TYPE_PRONTA);

      const isEncomendaByTag  = hasTag(tags, TAG_ENCOMENDA);
      const isProntaByTag     = TAG_PRONTA ? hasTag(tags, TAG_PRONTA) : false;

      const isEncomenda = isEncomendaByType || isEncomendaByTag;
      const isPronta    = isProntaByType    || isProntaByTag;

      hasEncomenda = hasEncomenda || isEncomenda;
      hasPronta    = hasPronta    || isPronta;
    }

    return { hasEncomenda, hasPronta, mixed: hasEncomenda && hasPronta };
  }

  // Encontra botões de checkout em temas OS 2.0 (cart page e drawer)
  function findCheckoutButtons() {
    const selectors = [
      'button[name="checkout"]',
      'form[action*="/cart"] button[type="submit"]',
      'a[href="/checkout"]',
      '#checkout',
      '.cart__checkout-button',
      'button[data-checkout-trigger="true"]'
    ];
    const set = new Set();
    selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => set.add(el)));
    return Array.from(set);
  }

  function ensureWarningEl() {
    let el = document.querySelector('#mixed-cart-warning');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mixed-cart-warning';
      el.setAttribute('role', 'alert');
      el.style.cssText =
        'margin:12px 0;padding:12px;border:1px solid #f3c2c2;background:#fff3f3;color:#a40000;border-radius:8px;font-size:14px;line-height:1.4;';
      // tenta colocar próximo do total/checkout:
      const containers = [
        document.querySelector('form[action*="/cart"]'),
        document.querySelector('#CartDrawer') || document.querySelector('[id*="Cart-Drawer"]'),
        document.querySelector('.cart__footer') || document.querySelector('cart-footer')
      ];
      const target = containers.find(Boolean) || document.body;
      target.prepend(el);
    }
    return el;
  }

  function setBlocked(block) {
    const buttons = findCheckoutButtons();
    buttons.forEach(btn => {
      if (block) {
        btn.dataset._prevDisabled = btn.disabled ? '1' : '0';
        btn.disabled = true;
        btn.classList.add('is-disabled');
        btn.style.pointerEvents = 'none';
        btn.style.filter = 'grayscale(1)';
        btn.title = 'Finalize pedidos separados';
      } else {
        // só reabilita se foi este script que desabilitou
        if (btn.dataset._prevDisabled === '0') {
          btn.disabled = false;
          btn.classList.remove('is-disabled');
          btn.style.pointerEvents = '';
          btn.style.filter = '';
          btn.title = '';
        }
      }
    });

    const warn = ensureWarningEl();
    warn.textContent = block ? WARNING_TEXT : '';
    warn.style.display = block ? '' : 'none';
  }

  async function evaluate() {
    try {
      const cart = await fetchCart();
      const { mixed } = decideGroups(cart.items || []);
      setBlocked(mixed);
    } catch (e) {
      // se não conseguir ler o carrinho, não bloqueia para não quebrar checkout
      console.warn('[mixed-cart-guard] erro:', e);
      setBlocked(false);
    }
  }

  // Reavaliar em mudanças de DOM comuns (cart drawer/qty)
  const mo = new MutationObserver(() => evaluate());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Eventos típicos que temas disparam
  ['cart:updated', 'cart:update', 'change'].forEach(evt =>
    document.addEventListener(evt, () => evaluate(), { capture: true })
  );

  // Primeira avaliação
  document.addEventListener('DOMContentLoaded', evaluate);
})();
