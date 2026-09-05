const root=document.querySelector('#page-root');

function mount(){
  if(document.querySelector('#cognitus-promotional-contrast-v33'))return;
  const link=document.createElement('link');
  link.id='cognitus-promotional-contrast-v33';
  link.rel='stylesheet';
  link.href='./src/promotionalContrastV33.css?v=20260904-v33';
  document.head.appendChild(link);
}

function markSurface(){
  if(!root)return;
  const route=location.hash.replace(/^#/,'').split('?')[0]||'/';
  const promo=route==='/promotional-access'||route==='/admin/promotions'||root.matches('.promo30-workspace')||root.querySelector('[data-promo-v26-page]');
  document.documentElement.classList.toggle('promo33-active',Boolean(promo));
}

export function startPromotionalContrastV33(){
  mount();
  markSurface();
  window.addEventListener('hashchange',markSurface);
  document.addEventListener('cognitus:promo-rendered',markSurface);
}
