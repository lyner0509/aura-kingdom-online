const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.class-card').forEach((card) => card.addEventListener('click', () => {
  document.querySelector('.class-card.active')?.classList.remove('active');
  card.classList.add('active');
}));
