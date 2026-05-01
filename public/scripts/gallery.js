function toggleCardMenu(mediaId) {
  document.querySelectorAll('[data-card-menu]').forEach(menu => {
    if (menu.dataset.menuId !== String(mediaId)) {
      menu.classList.add('hidden');
    }
  });

  const menu = document.querySelector(`[data-card-menu][data-menu-id="${CSS.escape(String(mediaId))}"]`);
  if (menu) menu.classList.toggle('hidden');
}

function renderGalleryCard(item) {
  const uploadedBy = item.uploadedByName || item.uploadedBy || 'Unknown';
  const caption = String(item.title || '').trim();

  return `
    <article
      data-media-card
      data-media-id="${escapeHtml(item.id)}"
      class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition border border-[#E8DED2]"
    >
      <div class="relative bg-gray-100">
        

        <button
          type="button"
          onclick='event.stopPropagation(); openMediaViewerById(${JSON.stringify(item.id)})'
          class="block w-full text-left"
          aria-label="View media larger"
        >
          ${
            item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-56 sm:h-72 object-cover">`
              : `<video src="${escapeHtml(item.url)}" muted playsinline preload="metadata" class="w-full h-56 sm:h-72 object-cover"></video>`
          }
        </button>
      </div>

      <div class="p-4">
        ${
          caption
            ? `<p class="text-sm font-semibold text-[#1F2933] truncate">${escapeHtml(caption)}</p>`
            : ''
        }
        <div class="${caption ? 'mt-1' : ''} flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>${formatDate(item.uploadedAt)}</span>
          <span>•</span>
          <span>Uploaded by ${escapeHtml(uploadedBy)}</span>
        </div>
      </div>

      ${renderReactionRows(item)}
    </article>
  `;
}

function getFilteredGalleryMedia() {
  if (!activeAlbumFilter) return galleryMedia;
  return galleryMedia.filter(item => normalizeAlbum(item.album) === activeAlbumFilter);
}

function renderGallery() {
  const container = document.getElementById('gallery');
  const photoCount = document.getElementById('photoCount');

  if (!container) return;

  const filteredMedia = getFilteredGalleryMedia();

  if (photoCount) {
    photoCount.textContent = activeAlbumFilter
      ? `${filteredMedia.length} media in ${activeAlbumFilter}`
      : `${galleryMedia.length} media`;
  }

  if (filteredMedia.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500">No media found</p>';
    return;
  }

  container.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
  container.innerHTML = filteredMedia.map(item => renderGalleryCard(item)).join('');
}

function populateAlbumFilter() {
  const albumFilter = document.getElementById('albumFilter');
  if (!albumFilter) return;

  const albums = [...new Set(
    galleryMedia.map(item => normalizeAlbum(item.album)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  albumFilter.innerHTML = `
    <option value="">All Albums</option>
    ${albums.map(album => `<option value="${escapeHtml(album)}">${escapeHtml(album)}</option>`).join('')}
  `;

  albumFilter.value = activeAlbumFilter;

  albumFilter.onchange = () => {
    activeAlbumFilter = albumFilter.value;
    renderGallery();
  };
}

function replaceGalleryCard(updatedItem) {
  const index = galleryMedia.findIndex(item => String(item.id) === String(updatedItem.id));

  if (index >= 0) {
    galleryMedia[index] = updatedItem;
  } else {
    galleryMedia.push(updatedItem);
  }

  populateAlbumFilter();

  const existingCard = document.querySelector(`[data-media-id="${CSS.escape(String(updatedItem.id))}"]`);

  if (!existingCard) {
    renderGallery();
    return;
  }

  if (activeAlbumFilter && normalizeAlbum(updatedItem.album) !== activeAlbumFilter) {
    renderGallery();
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderGalleryCard(updatedItem).trim();

  const newCard = wrapper.firstElementChild;
  existingCard.replaceWith(newCard);
}

async function loadGallery() {
  const container = document.getElementById('gallery');
  const photoCount = document.getElementById('photoCount');

  if (!container) return;

  try {
    galleryCurrentUser = await getCurrentUser();

    const res = await fetch('/api/media');
    const data = await res.json();

    galleryMedia = Array.isArray(data) ? data.slice().reverse() : [];

    populateAlbumFilter();
    renderGallery();

  } catch (e) {
    console.error(e);
    if (photoCount) photoCount.textContent = 'Error loading media';
  }
}

window.toggleCardMenu = toggleCardMenu;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('gallery')) loadGallery();
});
