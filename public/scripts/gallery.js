galleryMedia = galleryMedia || [];
galleryVisibleMedia = [];
galleryCurrentUser = galleryCurrentUser || null;
activeAlbumFilter = activeAlbumFilter || '';

function getGalleryUserFilter() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('user') || '').trim();
}

function getDisplayNameForUser(username, mediaItems) {
  const match = mediaItems.find(item => String(item.uploadedBy || '') === String(username));
  return match?.uploadedByName || username;
}

function applyGalleryUserMode() {
  const userFilter = getGalleryUserFilter();

  if (!userFilter) {
    galleryVisibleMedia = galleryMedia;
    return;
  }

  galleryVisibleMedia = galleryMedia.filter(item => String(item.uploadedBy || '') === userFilter);

  const displayName = getDisplayNameForUser(userFilter, galleryMedia);
  document.title = `${displayName}'s Gallery | FamGallery`;

  const heading =
    document.getElementById('galleryTitle') ||
    document.querySelector('h1');

  if (heading) {
    heading.textContent = `${displayName}'s Gallery`;
  }
}

function renderFamilyMemberTiles() {
  const section = document.getElementById('familyMembers');
  const grid = document.getElementById('familyMembersGrid');

  if (!section || !grid) return;

  const userFilter = getGalleryUserFilter();

  if (userFilter) {
    section.classList.add('hidden');
    return;
  }

  const membersMap = new Map();

  galleryMedia.forEach(item => {
    const username = String(item.uploadedBy || '').trim();
    if (!username) return;

    if (!membersMap.has(username)) {
      membersMap.set(username, {
        username,
        displayName: item.uploadedByName || username,
        count: 0
      });
    }

    membersMap.get(username).count += 1;
  });

  const members = [...membersMap.values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (members.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  grid.innerHTML = members.map(member => `
    <a
      href="gallery.html?user=${encodeURIComponent(member.username)}"
      class="inline-flex items-center gap-3 rounded-2xl border border-[#E8DED2] bg-white px-4 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
    >
      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4E7D6] text-[#7A4E2D] font-semibold">
        ${escapeHtml(member.displayName.charAt(0).toUpperCase())}
      </span>
      <span>
        <span class="block text-sm font-semibold text-[#1F2933]">${escapeHtml(member.displayName)}</span>
        <span class="block text-xs text-gray-500">${member.count} media</span>
      </span>
    </a>
  `).join('');
}

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
  const album = normalizeAlbum(item.album) || '';
  const showAlbum = album && album !== 'Misc';

  return `
    <article
      data-media-card
      data-media-id="${escapeHtml(item.id)}"
      class="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition duration-200 ease-out border border-[#E8DED2]"
    >
      <div class="relative bg-gray-100 overflow-hidden">
        <button
          type="button"
          onclick='event.stopPropagation(); openMediaViewerById(${JSON.stringify(item.id)})'
          class="block w-full text-left"
          aria-label="View media larger"
        >
          ${
            item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-56 sm:h-72 object-cover transition duration-300 ease-out group-hover:scale-105">`
              : `<video src="${escapeHtml(item.url)}" poster="${escapeHtml(item.thumbnailUrl || '')}" muted playsinline preload="metadata" class="w-full h-56 sm:h-72 object-cover transition duration-300 ease-out group-hover:scale-105"></video>`
          }
        </button>
      </div>

      <div class="p-4">
        <p class="text-sm font-semibold text-[#1F2933] truncate h-5">
          ${caption ? escapeHtml(caption) : '&nbsp;'}
        </p>

        ${
          showAlbum
            ? `<p class="text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(album)}</p>`
            : ''
        }

        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>${formatDate(item.uploadedAt)}</span>
          <span>&bull;</span>
          <span>Uploaded by ${escapeHtml(uploadedBy)}</span>
        </div>
      </div>

      ${renderReactionRows(item)}
    </article>
  `;
}

function getFilteredGalleryMedia() {
  if (!activeAlbumFilter) return galleryVisibleMedia;
  return galleryVisibleMedia.filter(item => normalizeAlbum(item.album) === activeAlbumFilter);
}

function renderGallery() {
  const container = document.getElementById('gallery');
  const photoCount = document.getElementById('photoCount');

  if (!container) return;

  const filteredMedia = getFilteredGalleryMedia();

  if (photoCount) {
    photoCount.textContent = activeAlbumFilter
      ? `${filteredMedia.length} media in ${activeAlbumFilter}`
      : `${galleryVisibleMedia.length} media`;
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
    galleryVisibleMedia.map(item => normalizeAlbum(item.album)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  albumFilter.innerHTML = `
    <option value="">${getGalleryUserFilter() ? "All User Albums" : "All Albums"}</option>
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

  applyGalleryUserMode();
  renderFamilyMemberTiles();
  populateAlbumFilter();

  const existingCard = document.querySelector(`[data-media-id="${CSS.escape(String(updatedItem.id))}"]`);
  const belongsToCurrentUserView = galleryVisibleMedia.some(item => String(item.id) === String(updatedItem.id));

  if (!belongsToCurrentUserView) {
    if (existingCard) renderGallery();
    return;
  }

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

    applyGalleryUserMode();
    renderFamilyMemberTiles();
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
