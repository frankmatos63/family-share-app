function closeAlbumModal(modal) {
  document.body.style.overflow = '';
  modal.remove();
}

function closeAllMediaMenus() {
  document.querySelectorAll('[id^="media-menu-"]').forEach(menu => {
    menu.classList.add('hidden', 'opacity-0', 'scale-95', 'pointer-events-none');
  });
}

function toggleMediaMenu(event, id) {
  event.stopPropagation();

  const menu = document.getElementById(`media-menu-${id}`);
  if (!menu) return;

  const isOpen = !menu.classList.contains('hidden');

  closeAllMediaMenus();

  if (!isOpen) {
    menu.classList.remove('hidden');

    requestAnimationFrame(() => {
      menu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
    });
  }
}

function updateAlbumCountInPlace(albumName) {
  const items = profileMedia.filter(item => {
    const album = normalizeAlbum(item.album) || 'Misc';
    return album === albumName;
  });

  const countEl = document.getElementById('albumManagerCount');
  if (countEl) {
    countEl.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  }

  const grid = document.getElementById('albumMediaGrid');
  if (grid && items.length === 0) {
    grid.outerHTML = '<p class="text-white/70">No media in this album.</p>';
  }

  const uploadStats = document.getElementById('uploadStats');
  if (uploadStats) {
    uploadStats.textContent = `${profileMedia.length} uploads`;
  }
}

function openAlbumModal(albumName) {
  const items = profileMedia.filter(item => {
    const album = normalizeAlbum(item.album) || 'Misc';
    return album === albumName;
  });

  const existingModal = document.getElementById('albumManagerModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'albumManagerModal';
  modal.className = 'fixed inset-0 bg-black/95 z-50 overflow-y-auto';

  document.body.style.overflow = 'hidden';

  modal.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 pb-8">
      <div class="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 mb-6">
        <div class="flex items-center justify-between py-4">
          <div>
            <h2 class="text-white text-xl font-semibold">${escapeHtml(albumName)}</h2>
            <p id="albumManagerCount" class="text-white/60 text-sm">
              ${items.length} item${items.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            id="closeAlbumManager"
            class="text-white text-3xl leading-none px-3 py-1 rounded-lg hover:bg-white/10 transition"
            aria-label="Close album"
          >
            ×
          </button>
        </div>
      </div>

      ${
        items.length === 0
          ? '<p class="text-white/70">No media in this album.</p>'
          : `<div id="albumMediaGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              ${items.map(item => {
                const caption = String(item.title || '').trim();

                return `
                  <div
                    class="bg-white rounded-2xl overflow-hidden shadow-md relative"
                    data-media-card="${escapeHtml(item.id)}"
                  >
                    <div class="absolute top-2 right-2 z-10">
                      <button
                        type="button"
                        onclick='toggleMediaMenu(event, ${JSON.stringify(item.id)})'
                        class="w-9 h-9 flex items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 transition"
                        aria-label="Media options"
                      >
                        ⋯
                      </button>

                      <div
                        id="media-menu-${escapeHtml(item.id)}"
                        class="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden text-sm transform origin-top-right transition duration-100 ease-out opacity-0 scale-95 pointer-events-none"
                      >
                        <button
                          type="button"
                          data-edit-caption-for="${escapeHtml(item.id)}"
                          onclick='event.stopPropagation(); openEditCaptionModal(${JSON.stringify(item.id)}, ${JSON.stringify(caption)})'
                          class="block w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50"
                        >
                          Edit caption
                        </button>

                        <button
                          type="button"
                          onclick='event.stopPropagation(); openMoveMediaModal(${JSON.stringify(item.id)}, ${JSON.stringify(albumName)})'
                          class="block w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50"
                        >
                          Move to album
                        </button>

                        <button
                          type="button"
                          onclick='event.stopPropagation(); openDeleteMediaModal(${JSON.stringify(item.id)}, ${JSON.stringify(albumName)})'
                          class="block w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50"
                        >
                          Delete media item
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onclick='event.stopPropagation(); openMediaViewer(${JSON.stringify(item)})'
                      class="block w-full text-left"
                    >
                      <div class="h-72 bg-gray-100">
                        ${
                          item.type === 'image'
                            ? `<img src="${escapeHtml(item.url)}" class="w-full h-full object-cover">`
                            : `<video src="${escapeHtml(item.url)}" poster="${escapeHtml(item.thumbnailUrl || '')}" muted playsinline preload="metadata" class="w-full h-full object-cover"></video>`
                        }
                      </div>
                    </button>

                    <div class="p-4">
                      ${
                        caption
                          ? `<p data-caption-for="${escapeHtml(item.id)}" class="text-sm font-medium mb-1">${escapeHtml(caption)}</p>`
                          : `<p data-caption-for="${escapeHtml(item.id)}" class="text-sm text-gray-400 italic mb-1">No caption</p>`
                      }
                      <p class="text-xs text-gray-500">${formatDate(item.uploadedAt)}</p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
      }
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeAlbumManager').onclick = () => closeAlbumModal(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAlbumModal(modal);
  });
}

document.addEventListener('click', closeAllMediaMenus);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllMediaMenus();
});

window.closeAlbumModal = closeAlbumModal;
window.closeAllMediaMenus = closeAllMediaMenus;
window.toggleMediaMenu = toggleMediaMenu;
window.updateAlbumCountInPlace = updateAlbumCountInPlace;
window.openAlbumModal = openAlbumModal;
