async function loadUserUploads() {
  const container = document.getElementById('userUploads');
  const uploadStats = document.getElementById('uploadStats');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      if (uploadStats) uploadStats.textContent = 'Not logged in';
      container.innerHTML = '<p class="text-gray-500">Please log in.</p>';
      return;
    }

    const res = await fetch('/api/media');
    const data = await res.json();

    const userItems = data
      .filter(item => item.uploadedBy === currentUser.username)
      .slice()
      .reverse();

    profileMedia = userItems;

    if (uploadStats) uploadStats.textContent = `${userItems.length} uploads`;

    if (userItems.length === 0) {
      container.innerHTML = '<p class="text-gray-500">No uploads yet.</p>';
      return;
    }

    const grouped = {};

    userItems.forEach(item => {
      const album = normalizeAlbum(item.album) || 'Misc';
      if (!grouped[album]) grouped[album] = [];
      grouped[album].push(item);
    });

    const sortedAlbums = Object.keys(grouped).sort((a, b) => {
      if (a === 'Misc') return 1;
      if (b === 'Misc') return -1;
      return a.localeCompare(b);
    });

    container.innerHTML = sortedAlbums.map(album => {
      const items = grouped[album];
      const latest = items[0];

      const preview = items.slice(0, 3).map(item => `
        <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
          ${
            item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-full object-cover">`
              : `<video src="${escapeHtml(item.url)}" poster="${escapeHtml(item.thumbnailUrl || '')}" muted playsinline preload="metadata" class="w-full h-full object-cover"></video>`
          }
        </div>
      `).join('');

      return `
        <div class="bg-white border border-[#E8DED2] rounded-2xl p-6 mb-6 shadow-sm hover:shadow-md transition">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-lg font-semibold">${escapeHtml(album)}</h2>
              <p class="text-xs text-gray-500 mt-1">
                ${items.length} item${items.length > 1 ? 's' : ''} • ${formatDate(latest.uploadedAt)}
              </p>
            </div>

            <button
              onclick='openAlbumModal(${JSON.stringify(album)})'
              class="px-4 py-2 bg-[#C76B4A] text-white rounded-lg text-sm hover:opacity-90"
            >
              Open
            </button>
          </div>

          <div class="flex gap-3">
            ${preview}
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    if (uploadStats) uploadStats.textContent = 'Error loading uploads';
  }
}

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

function updateCaptionInPlace(mediaId, newTitle) {
  const captionEl = document.querySelector(`[data-caption-for="${CSS.escape(String(mediaId))}"]`);
  const editBtn = document.querySelector(`[data-edit-caption-for="${CSS.escape(String(mediaId))}"]`);

  if (captionEl) {
    if (newTitle) {
      captionEl.textContent = newTitle;
      captionEl.className = 'text-sm font-medium mb-1';
    } else {
      captionEl.textContent = 'No caption';
      captionEl.className = 'text-sm text-gray-400 italic mb-1';
    }
  }

  if (editBtn) {
    editBtn.setAttribute(
      'onclick',
      `event.stopPropagation(); openEditCaptionModal(${JSON.stringify(mediaId)}, ${JSON.stringify(newTitle)})`
    );
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

function openDeleteMediaModal(mediaId, albumName) {
  closeAllMediaMenus();

  const existing = document.getElementById('deleteMediaModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deleteMediaModal';
  modal.className = 'fixed inset-0 bg-black/50 z-[90] flex items-center justify-center px-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Delete media item?</h2>

      <p class="text-sm text-gray-600 leading-relaxed">
        This will permanently remove this photo or video from the gallery.
      </p>

      <div class="flex justify-end gap-3 mt-6">
        <button
          id="cancelDeleteMedia"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          id="confirmDeleteMedia"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Delete media item
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('#cancelDeleteMedia');
  const deleteBtn = modal.querySelector('#confirmDeleteMedia');

  const closeModal = () => {
    document.removeEventListener('keydown', handleDocumentKeydown);
    modal.remove();
  };

  const handleDelete = async () => {
    if (deleteBtn.disabled) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE'
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || 'Delete failed', 'error');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete media item';
        return;
      }

      profileMedia = profileMedia.filter(item => String(item.id) !== String(mediaId));
      galleryMedia = galleryMedia.filter(item => String(item.id) !== String(mediaId));

      const card = document.querySelector(`[data-media-card="${CSS.escape(String(mediaId))}"]`);
      if (card) card.remove();

      updateAlbumCountInPlace(albumName);

      closeModal();
      showToast('Media item deleted');
    } catch (err) {
      console.error(err);
      showToast('Delete error', 'error');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete media item';
    }
  };

  function handleDocumentKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.onclick = closeModal;
  deleteBtn.onclick = handleDelete;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', handleDocumentKeydown);
}

function openEditCaptionModal(mediaId, currentTitle) {
  closeAllMediaMenus();

  const existing = document.getElementById('editCaptionModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'editCaptionModal';
  modal.className = 'fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 class="text-lg font-semibold mb-4">Edit Caption</h2>

      <input
        id="editCaptionInput"
        type="text"
        maxlength="120"
        value="${escapeHtml(currentTitle)}"
        placeholder="Caption"
        class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
      >

      <p class="text-xs text-gray-400 mt-1">120 characters max</p>

      <div class="flex justify-end gap-3 mt-5">
        <button
          id="cancelEditCaption"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          id="saveEditCaption"
          class="px-4 py-2 bg-[#C76B4A] text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = modal.querySelector('#editCaptionInput');
  const saveBtn = modal.querySelector('#saveEditCaption');
  const cancelBtn = modal.querySelector('#cancelEditCaption');

  const closeModal = () => {
    document.removeEventListener('keydown', handleDocumentKeydown);
    modal.remove();
  };

  const handleSave = async () => {
    const newTitle = input ? input.value.trim() : '';

    if (saveBtn.disabled) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.item) {
        showToast(data.error || 'Update failed', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        return;
      }

      profileMedia = profileMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      galleryMedia = galleryMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      updateCaptionInPlace(mediaId, newTitle);

      closeModal();
      showToast('Caption updated');
    } catch (err) {
      console.error(err);
      showToast('Update error', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  };

  function handleDocumentKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.onclick = closeModal;
  saveBtn.onclick = handleSave;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', handleDocumentKeydown);

  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
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
                        class="hidden absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden text-sm transform origin-top-right transition duration-100 ease-out opacity-0 scale-95 pointer-events-none"
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

window.openAlbumModal = openAlbumModal;
window.openEditCaptionModal = openEditCaptionModal;
window.openDeleteMediaModal = openDeleteMediaModal;
window.toggleMediaMenu = toggleMediaMenu;
window.closeAllMediaMenus = closeAllMediaMenus;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('userUploads')) loadUserUploads();
});
