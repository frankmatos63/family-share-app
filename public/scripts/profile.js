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

function openEditCaptionModal(mediaId, currentTitle) {
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
        value="${escapeHtml(currentTitle)}"
        placeholder="Caption"
        class="w-full px-4 py-2.5 border border-[#E8DED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C76B4A]"
      >

      <div class="flex justify-end gap-3 mt-5">
        <button
          id="cancelEditCaption"
          class="px-4 py-2 border border-[#E8DED2] rounded-lg"
        >
          Cancel
        </button>

        <button
          id="saveEditCaption"
          class="px-4 py-2 bg-[#C76B4A] text-white rounded-lg"
        >
          Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cancelEditCaption').onclick = () => modal.remove();

  modal.querySelector('#saveEditCaption').onclick = async () => {
    const input = modal.querySelector('#editCaptionInput');
    const newTitle = input ? input.value.trim() : '';

    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.item) {
        showToast(data.error || 'Update failed', 'error');
        return;
      }

      profileMedia = profileMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      galleryMedia = galleryMedia.map(item =>
        String(item.id) === String(mediaId) ? data.item : item
      );

      modal.remove();

      const albumName = normalizeAlbum(data.item.album) || 'Misc';
      const albumModal = document.getElementById('albumManagerModal');

      if (albumModal) {
        openAlbumModal(albumName);
      }

      if (document.getElementById('userUploads')) {
        loadUserUploads();
      }

      showToast('Caption updated');
    } catch (err) {
      console.error(err);
      showToast('Update error', 'error');
    }
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
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
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button
            id="backAlbumManager"
            class="text-white text-xl px-3 py-1 rounded-lg hover:bg-white/10"
            aria-label="Back to profile"
          >
            ←
          </button>

          <div>
            <h2 class="text-white text-xl font-semibold">${escapeHtml(albumName)}</h2>
            <p class="text-white/60 text-sm">${items.length} item${items.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <button
          id="closeAlbumManager"
          class="text-white text-3xl leading-none px-2"
          aria-label="Close album"
        >
          ×
        </button>
      </div>

      ${
        items.length === 0
          ? '<p class="text-white/70">No media in this album.</p>'
          : `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              ${items.map(item => {
                const caption = String(item.title || '').trim();

                return `
                  <div class="bg-white rounded-2xl overflow-hidden shadow-md">
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
                          ? `<p class="text-sm font-medium mb-1">${escapeHtml(caption)}</p>`
                          : '<p class="text-sm text-gray-400 italic mb-1">No caption</p>'
                      }
                      <p class="text-xs text-gray-500 mb-3">${formatDate(item.uploadedAt)}</p>

                      <div class="flex gap-4">
                        <button
                          onclick='openEditCaptionModal(${JSON.stringify(item.id)}, ${JSON.stringify(caption)})'
                          class="text-xs text-[#C76B4A] hover:underline"
                        >
                          Edit Caption
                        </button>

                        <button
                          onclick='deleteMedia(${JSON.stringify(item.id)})'
                          class="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
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
  modal.querySelector('#backAlbumManager').onclick = () => closeAlbumModal(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAlbumModal(modal);
  });
}

window.openAlbumModal = openAlbumModal;
window.openEditCaptionModal = openEditCaptionModal;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('userUploads')) loadUserUploads();
});
