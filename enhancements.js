// Cognitus Enhanced Interactions (Enterprise-Level Polish)

// Smooth fade-in on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.info-card, .feature-card, .architecture-card, .staff-card, .hero-panel, .metric-card').forEach(el => {
  el.classList.add('reveal');
  observer.observe(el);
});

// Subtle parallax effect for hero
window.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth) - 0.5;
  const y = (e.clientY / window.innerHeight) - 0.5;

  const panel = document.querySelector('.hero-panel');
  if (panel) {
    panel.style.transform = `rotateY(${x * 4}deg) rotateX(${y * -4}deg)`;
  }
});

// Button hover glow enhancement
const buttons = document.querySelectorAll('.button-primary');
buttons.forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    btn.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.25), transparent 40%), linear-gradient(135deg, #6d8fff, #3f5fbf)`;
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.background = '';
  });
});

// Typing effect for command preview
const command = document.querySelector('.command-line');
if (command) {
  const text = command.textContent;
  command.textContent = '';
  let i = 0;

  const type = () => {
    if (i < text.length) {
      command.textContent += text.charAt(i);
      i++;
      setTimeout(type, 25);
    }
  };

  setTimeout(type, 500);
}

// Add CSS dynamically for reveal
const style = document.createElement('style');
style.innerHTML = `
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease;
}
.reveal-visible {
  opacity: 1;
  transform: translateY(0);
}
`;
document.head.appendChild(style);
