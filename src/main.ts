import { Game } from './game/Game';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root');
}

const game = new Game(app);
const splash = document.createElement('div');
splash.className = 'ego-loading';
splash.innerHTML = `
  <div class="ego-loading-line"></div>
  <div class="ego-loading-title">EGO GAMES</div>
  <div class="ego-loading-subtitle">quantum tunnel systems online</div>
`;
app.append(splash);
game.boot();
window.setTimeout(() => {
  splash.classList.add('done');
  window.setTimeout(() => splash.remove(), 520);
}, 1800);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.info('Service worker registration skipped:', error);
    });
  });
}
