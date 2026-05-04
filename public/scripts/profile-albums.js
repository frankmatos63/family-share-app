let selectionMode = false;
let selectedMediaIds = new Set();
let currentAlbumName = '';

window.selectedMediaIds = selectedMediaIds;

function closeAlbumModal(modal) {
  selectionMode = false;
  selectedMediaIds.clear();
  window.selectedMediaIds = selectedMediaIds;

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

function openAlbumModal(albumName) {
  selectionMode = false;
  selectedMediaIds.clear();
  window.selectedMediaIds = selectedMediaIds;

  renderAlbumModal(albumName);
}

function enableSelectionMode(albumName) {
  selectionMode = true;
  selectedMediaIds.clear();
  window.selectedMediaIds = selectedMediaIds;

  renderAlbumModal(albumName);
}

function cancelSelection() {
  selectionMode = false;
  selectedMediaIds.clear();
  window.selectedMediaIds = selectedMediaIds;

  const modal = document.getElementById('albumManagerModal');
  if (modal) {
    document.body.style.overflow = '';
    modal.remove();
  }
}

function toggleCheckbox(event, id, checkboxEl) {
  if (event) event.stopPropagation();

  const mediaId = String(id);

  if (selectedMediaIds.has(mediaId)) {
    selectedMediaIds.delete(mediaId);
    checkboxEl.classList.remove('bg-[#C76B4A]', 'text-white', 'border-[#C76B4A]', 'scale-105');
    checkboxEl.classList.add('bg-white', 'text-transparent', 'border-white', 'scale-100');
    checkboxEl.textContent = '';
  } else {
    selectedMediaIds.add(mediaId);
    checkboxEl.classList.remove('bg-white', 'text-transparent', 'border-white', 'scale-100');
    checkboxEl.classList.add('bg-[#C76B4A]', 'text-white', 'border-[#C76B4A]', 'scale-105');
    checkboxEl.textContent = '✓';
  }

  window.selectedMediaIds = selectedMediaIds;
  updateSelectionHeader();
}

function toggleCardSelection(event, id) {
  if (event) event.stopPropagation();

  const checkboxEl = document.querySelector(`[data-checkbox-for="${CSS.escape(String(id))}"]`);
  if (!checkboxEl) return;

  toggleCheckbox(event, id, checkboxEl);
}

function updateSelectionHeader() {
  const header = document.getElementById('selectionHeader');
  if (header) {
    header.textContent = `Select items to move • ${selectedMediaIds.size} selected`;
  }

  const moveBtn = document.getElementById('moveSelectedBtn');
  if (moveBtn) {
    moveBtn.textContent = `Move selected (${selectedMediaIds.size})`;

    if (selectedMediaIds.size === 0) {
      moveBtn.disabled = true;
      moveBtn.classList.add('opacity-70', 'cursor-not-allowed');
    } else {
      moveBtn.disabled = false;
      moveBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
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
}

function attachAlbumModalHandlers(modal, albumName) {
  const closeBtn = modal.querySelector('#closeAlbumManager');
  if (closeBtn) {
    closeBtn.onclick = () => closeAlbumModal(modal);
  }

  const moveBtn = modal.querySelector('#moveSelectedBtn');
  if (moveBtn) {
    moveBtn.onclick = (event) => {
      event.stopPropagation();

      if (moveBtn.disabled) return;

      if (typeof openBulkMoveModal === 'function') {
        openBulkMoveModal(albumName);
      } else {
        showToast('Move action is not available', 'error');
      }
    };
  }

  modal.addEventListener('click', (e) => {
    if (!selectionMode && e.target === modal) {
      closeAlbumModal(modal);
    }
  });
}

function renderAlbumModal(albumName) {
  currentAlbumName = albumName;
  window.selectedMediaIds = selectedMediaIds;

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

            ${
              selectionMode
                ? `<p id="selectionHeader" class="text-white/60 text-sm">Select items to move • 0 selected</p>`
                : `<p id="albumManagerCount" class="text-white/60 text-sm">${items.length} item${items.length === 1 ? '' : 's'}</p>`
            }
          </div>

          <div class="flex items-center gap-3">

            ${
              selectionMode
                ? `
                  <button
                    id="moveSelectedBtn"
                    type="button"
                    disabled
                    class="px-3 py-1 bg-[#C76B4A] text-white rounded-lg text-sm opacity-70 cursor-not-allowed"
                  >
                    Move selected (0)
                  </button>

                  <button
                    type="button"
                    onclick="cancelSelection()"
                    class="px-3 py-1 bg-white/20 text-white rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                `
                : ''
            }

            <button
              id="closeAlbumManager"
              type="button"
              class="text-white text-3xl leading-none px-3 py-1 rounded-lg hover:bg-white/10 transition"
            >
              ×
            </button>

          </div>
        </div>
      </div>

      ${
        items.length === 0
          ? '<p class="text-white/70">No media in this album.</p>'
          : `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              ${items.map(item => {
                const caption = String(item.title || '').trim();
                const mediaId = String(item.id);

                return `
                  <div
                    class="bg-white rounded-2xl overflow-hidden shadow-md relative"
                    data-media-card="${escapeHtml(mediaId)}"
                  >

                    ${
                      selectionMode
                        ? `
                          <button
                            type="button"
                            onclick='toggleCheckbox(event, ${JSON.stringify(mediaId)}, this)'
                            data-checkbox-for="${escapeHtml(mediaId)}"
                            class="absolute top-3 left-3 z-20 w-8 h-8 rounded-full border-2 border-white bg-white text-transparent shadow-md flex items-center justify-center text-sm font-bold cursor-pointer transition-transform scale-100"
                            aria-label="Select media item"
                          ></button>
                        `
                        : `
                          <div class="absolute top-2 right-2 z-10">
                            <button
                              type="button"
                              onclick='toggleMediaMenu(event, ${JSON.stringify(mediaId)})'
                              class="w-9 h-9 flex items-center justify-center rounded-full bg-black/45 text-white"
                            >
                              ⋯
                            </button>

                            <div
                              id="media-menu-${escapeHtml(mediaId)}"
                              class="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 text-sm opacity-0 scale-95 pointer-events-none"
                            >
                              <button
                                type="button"
                                onclick='event.stopPropagation(); openEditCaptionModal(${JSON.stringify(mediaId)}, ${JSON.stringify(caption)})'
                                class="block w-full text-left px-4 py-2.5 hover:bg-gray-50"
                              >
                                Edit caption
                              </button>

                              <button
                                type="button"
                                onclick='event.stopPropagation(); openDeleteMediaModal(${JSON.stringify(mediaId)}, ${JSON.stringify(albumName)})'
                                class="block w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50"
                              >
                                Delete media item
                              </button>
                            </div>
                          </div>
                        `
                    }

                    <button
                      type="button"
                      onclick='${
                        selectionMode
                          ? `toggleCardSelection(event, ${JSON.stringify(mediaId)})`
                          : `event.stopPropagation(); openMediaViewer(${JSON.stringify(item)})`
                      }'
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
                          ? `<p data-caption-for="${escapeHtml(mediaId)}" class="text-sm font-medium mb-1">${escapeHtml(caption)}</p>`
                          : `<p data-caption-for="${escapeHtml(mediaId)}" class="text-sm text-gray-400 italic mb-1">No caption</p>`
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
  attachAlbumModalHandlers(modal, albumName);
}

document.addEventListener('click', closeAllMediaMenus);

window.enableSelectionMode = enableSelectionMode;
window.openAlbumModal = openAlbumModal;
window.cancelSelection = cancelSelection;
window.toggleCheckbox = toggleCheckbox;
window.toggleCardSelection = toggleCardSelection;
window.toggleMediaMenu = toggleMediaMenu;
window.closeAllMediaMenus = closeAllMediaMenus;
window.updateAlbumCountInPlace = updateAlbumCountInPlace;
window.selectedMediaIds = selectedMediaIds;
