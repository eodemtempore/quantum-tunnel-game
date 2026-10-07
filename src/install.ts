interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export class InstallExperience {
  private promptEvent: InstallPromptEvent | null = null;
  private dialog: HTMLDivElement;
  private returnFocus: HTMLElement | null = null;

  constructor() {
    this.dialog = document.createElement('div');
    this.dialog.className = 'install-dialog hidden';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'install-dialog-title');
    document.body.append(this.dialog);

    this.updateInstalledState();
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.promptEvent = event as InstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => {
      this.promptEvent = null;
      this.updateInstalledState();
      this.closeDialog();
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const installButton = target.closest<HTMLButtonElement>('[data-install]');
      if (installButton) {
        this.install(installButton);
      } else if (target.closest('[data-install-close]') || target === this.dialog) {
        this.closeDialog();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeDialog();
    });
  }

  private updateInstalledState(): void {
    const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    document.body.classList.toggle('is-installed', standalone || (navigator as NavigatorWithStandalone).standalone === true);
  }

  private async install(button: HTMLButtonElement): Promise<void> {
    if (this.promptEvent) {
      const prompt = this.promptEvent;
      this.promptEvent = null;
      button.disabled = true;
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } finally {
        button.disabled = false;
      }
      return;
    }
    this.showInstructions(button);
  }

  private showInstructions(button: HTMLButtonElement): void {
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const instructions = isAppleMobile
      ? '<li>Open this page in your browser.</li><li>Tap the Share button.</li><li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>'
      : isAndroid
        ? '<li>Open this page in Chrome.</li><li>Open the browser menu (⋮).</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>'
        : '<li>Open this page in a browser that supports app installation, such as Chrome or Edge.</li><li>Use the install icon in the address bar or the browser menu.</li>';

    this.returnFocus = button;
    this.dialog.innerHTML = `
      <div class="install-dialog-panel" tabindex="-1">
        <button class="install-dialog-close" type="button" data-install-close aria-label="Close install instructions">×</button>
        <p class="eyebrow">Free home-screen game</p>
        <h2 id="install-dialog-title">Install Quantum Tunnel</h2>
        <p>Launch it from your home screen in full screen, like an app.</p>
        <ol>${instructions}</ol>
        <p class="muted small">No store account or payment is needed.</p>
      </div>
    `;
    this.dialog.classList.remove('hidden');
    document.body.classList.add('install-dialog-open');
    this.dialog.querySelector<HTMLButtonElement>('[data-install-close]')?.focus();
  }

  private closeDialog(): void {
    if (this.dialog.classList.contains('hidden')) return;
    this.dialog.classList.add('hidden');
    document.body.classList.remove('install-dialog-open');
    this.returnFocus?.focus();
    this.returnFocus = null;
  }
}
