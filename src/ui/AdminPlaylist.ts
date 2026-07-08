import { PlaylistEntry, PlaylistManager, TrackMood } from '../audio/PlaylistManager';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char] ?? char;
  });
}

export class AdminPlaylist {
  private editingId = '';
  private errorMessage = '';

  constructor(
    private root: HTMLElement,
    private playlist: PlaylistManager,
    private onChange: () => void,
    private onClose: () => void
  ) {}

  show(): void {
    this.render();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
    this.editingId = '';
  }

  private render(): void {
    const entries = this.playlist.getAdminPlaylist();
    const current = entries.find((entry) => entry.id === this.editingId);
    this.root.innerHTML = `
      <section class="screen admin-screen">
        <div class="panel admin-panel">
          <div class="screen-head">
            <div>
              <p class="eyebrow">Prototype Admin</p>
              <h2>Admin Playlist</h2>
            </div>
            <button class="icon-button" data-admin-close aria-label="Return to game">×</button>
          </div>
          <p class="muted small">These entries live in localStorage on this browser. Use direct browser-reachable audio files only, such as /tracks/file.mp3 or a CORS-enabled https URL ending in mp3, wav, m4a, or ogg. SoundCloud page URLs are not direct audio files and will not play here.</p>
          ${this.errorMessage ? `<p class="warning">${escapeHtml(this.errorMessage)}</p>` : ''}
          <form class="admin-form" data-admin-form>
            <input type="hidden" name="id" value="${escapeHtml(current?.id ?? '')}" />
            <label>Track title<input name="title" required value="${escapeHtml(current?.title ?? '')}" /></label>
            <label>Artist/name<input name="artist" required value="${escapeHtml(current?.artist ?? '')}" /></label>
            <label>Direct audio file URL<input name="url" required placeholder="/tracks/my-loop.mp3 or https://cdn.example.com/track.mp3" value="${escapeHtml(current?.url ?? '')}" /></label>
            <label>BPM optional<input name="bpm" inputmode="numeric" value="${escapeHtml(String(current?.bpm ?? ''))}" /></label>
            <label>Mood
              <select name="mood">
                ${(['dark', 'fast', 'chill', 'boss', 'quantum'] as TrackMood[])
                  .map((mood) => `<option value="${mood}" ${current?.mood === mood ? 'selected' : ''}>${mood}</option>`)
                  .join('')}
              </select>
            </label>
            <div class="button-row">
              <button class="primary" type="submit">${current ? 'Update Track' : 'Add Track'}</button>
              <button class="secondary" type="button" data-admin-reset>New Entry</button>
            </div>
          </form>
          <div class="admin-list">
            ${entries.length === 0 ? '<p class="empty">No local admin tracks yet.</p>' : entries.map((entry) => this.renderEntry(entry)).join('')}
          </div>
        </div>
      </section>
    `;

    this.root.querySelector('[data-admin-close]')?.addEventListener('click', () => {
      this.hide();
      this.onClose();
    });

    this.root.querySelector('[data-admin-reset]')?.addEventListener('click', () => {
      this.editingId = '';
      this.errorMessage = '';
      this.render();
    });

    this.root.querySelector<HTMLFormElement>('[data-admin-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const bpmRaw = String(data.get('bpm') ?? '').trim();
      try {
        this.playlist.saveAdminEntry(
          {
            title: String(data.get('title') ?? '').trim(),
            artist: String(data.get('artist') ?? '').trim(),
            url: String(data.get('url') ?? '').trim(),
            bpm: bpmRaw ? Number(bpmRaw) : undefined,
            mood: String(data.get('mood') ?? 'quantum') as TrackMood
          },
          String(data.get('id') ?? '') || undefined
        );
        this.editingId = '';
        this.errorMessage = '';
        this.onChange();
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Could not save this playlist entry.';
      }
      this.render();
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        this.editingId = button.dataset.edit ?? '';
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        this.playlist.removeAdminEntry(button.dataset.remove ?? '');
        this.onChange();
        this.render();
      });
    });
  }

  private renderEntry(entry: PlaylistEntry): string {
    return `
      <article class="admin-entry">
        <div>
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${escapeHtml(entry.artist)} · ${escapeHtml(entry.mood)}${entry.bpm ? ` · ${escapeHtml(String(entry.bpm))} BPM` : ''}</span>
          <small>${escapeHtml(entry.url)}</small>
        </div>
        <div class="button-row compact">
          <button class="secondary" data-edit="${escapeHtml(entry.id)}">Edit</button>
          <button class="danger" data-remove="${escapeHtml(entry.id)}">Remove</button>
        </div>
      </article>
    `;
  }
}
