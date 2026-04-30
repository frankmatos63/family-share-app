const dailyMessages = [
  "We don’t take normal pictures around here.",
  "Good media doesn’t fade. We just get better at telling the story.",
  "Some of these uploads explain a lot.",
  "Captured forever. No takebacks.",
  "Every family has these moments.",
  "This seemed like a great idea at the time.",
  "Not perfect, but definitely ours.",
  "A little chaotic, but worth keeping.",
  "Some media comes with sound effects.",
  "This is peak us.",
  "Every picture adds to the story.",
  "We don’t delete. We document.",
  "Some things never change.",
  "The best moments are rarely planned.",
  "This one deserves a second look."
];

const REACTION_CONFIG = [
  { value: '≡ƒÑ░', display: '😂' },
  { value: '≡ƒñù', display: '🥰' },
  { value: '≡ƒÆ¬', display: '💪' },
  { value: '≡ƒæì', display: '👍' },
  { value: '≡ƒÄê', display: '🎉' },
  { value: 'Γ¥ñ∩╕Å', display: '❤️' },
  { value: '≡ƒÄé', display: '🎂' },
  { value: '≡ƒÄë', display: '🎁' },
  { value: '≡ƒæÅ', display: '👏' }
];

const MAX_UPLOAD_FILES = 25;

let galleryMedia = [];
let galleryCurrentUser = null;
let activeAlbumFilter = '';

function getDailyMessage() {
  const today = new Date().toDateString();
  const index = today
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % dailyMessages.length;

  return dailyMessages[index];
}

async function getCurrentUser() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    return data.loggedIn && data.user ? data.user : null;
  } catch (err) {
    console.error('Failed to get current user:', err);
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeAlbum(album) {
  const value = String(album || '').trim();

  if (!value || value === 'Fam Media') {
    return '';
  }

  return value;
}

function getReactionDisplay(value) {
  const found = REACTION_CONFIG.find(r => r.value === value || r.display === value);
  return found ? found.display : value;
}

function getReactionValue(displayOrValue) {
  const found = REACTION_CONFIG.find(r => r.display === displayOrValue || r.value === displayOrValue);
  return found ? found.value : displayOrValue;
}

function getReactionUsers(item, reactionValue) {
  const reactions = item.reactions || {};
  const config = REACTION_CONFIG.find(r => r.value === reactionValue);

  if (Array.isArray(reactions[reactionValue])) return reactions[reactionValue];
  if (config && Array.isArray(reactions[config.display])) return reactions[config.display];

  return [];
}

function getActiveReactionEntries(item) {
  return REACTION_CONFIG
    .map(reaction => ({
      value: reaction.value,
      display: reaction.display,
      users: getReactionUsers(item, reaction.value)
    }))
    .filter(reaction => Array.isArray(reaction.users) && reaction.users.length > 0);
}

function showConfirm(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4';

    modal.innerHTML = `
      <div class="bg-white rounded-xl p-6 w-full max-w-xs text-center shadow-lg">
        <p class="mb-6 text-sm text-[#1F2933]">${escapeHtml(message)}</p>
        <div class="flex justify-center gap-4">
          <button id="confirmCancel" class="px-4 py-2 border border-[#E8DED2] rounded-lg">Cancel</button>
          <button id="confirmOk" class="px-4 py-2 bg-red-500 text-white rounded-lg">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#confirmCancel').onclick = () => {
      modal.remove();
      resolve(false);
    };

    modal.querySelector('#confirmOk').onclick = () => {
      modal.remove();
      resolve(true);
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });
  });
}

function openMediaViewer(item) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black z-50 flex items-center justify-center';

  document.body.style.overflow = 'hidden';

  modal.innerHTML = `
    <button
      id="closeMediaViewer"
      class="absolute top-4 right-4 z-20 bg-white/15 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl"
      aria-label="Close viewer"
    >
      ×
    </button>

    <div class="w-full h-full overflow-auto flex items-center justify-center p-4">
      ${
        item.type === 'image'
          ? `<img src="${escapeHtml(item.url)}" class="max-w-full max-h-full object-contain">`
          : `<video src="${escapeHtml(item.url)}" controls autoplay class="max-w-full max-h-full"></video>`
      }
    </div>
  `;

  document.body.appendChild(modal);

  function closeViewer() {
    document.body.style.overflow = '';
    modal.remove();
  }

  modal.querySelector('#closeMediaViewer').onclick = closeViewer;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeViewer();
  });
}

function openMediaViewerById(mediaId) {
  const item = galleryMedia.find(m => String(m.id) === String(mediaId));
  if (item) openMediaViewer(item);
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

function showReactionPicker(mediaId) {
  const item = galleryMedia.find(m => String(m.id) === String(mediaId));
  if (!item) return;

  const username = galleryCurrentUser?.username;
  const activeReactions = getActiveReactionEntries(item);

  const existing = document.getElementById('reactionPickerModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'reactionPickerModal';
  modal.dataset.mediaId = String(mediaId);
  modal.className = 'fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4';

  const activeSummary = activeReactions.length
    ? activeReactions.map(reaction => `
        <div class="flex items-center justify-between py-2 border-b border-[#F0E7DC] last:border-b-0">
          <div class="flex items-center gap-2">
            <span class="text-xl">${reaction.display}</span>
            <span class="text-sm text-[#1F2933]">${reaction.users.length}</span>
          </div>
          <div class="text-xs text-gray-500 truncate max-w-[190px]">
            ${escapeHtml(reaction.users.join(', '))}
          </div>
        </div>
      `).join('')
    : '<p class="text-sm text-gray-500 py-2">No reactions yet.</p>';

  const pickerButtons = REACTION_CONFIG.map(reaction => {
    const users = getReactionUsers(item, reaction.value);
    const isActive = username && users.includes(username);

    return `
      <button
        type="button"
        onclick='event.stopPropagation(); reactToMedia(${JSON.stringify(item.id)}, ${JSON.stringify(reaction.value)})'
        class="w-12 h-12 rounded-full border text-xl flex items-center justify-center transition active:scale-95 ${
          isActive
            ? 'bg-[#F3D6C9] text-[#8A3F2B] border-[#E8B8A3] shadow-sm'
            : 'bg-white text-[#1F2933] border-[#E8DED2] hover:bg-[#FAF7F2]'
        }"
        title="${isActive ? 'Remove reaction' : 'React'}"
      >
        ${reaction.display}
      </button>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-[#1F2933]">Reactions</h2>
        <button
          type="button"
          id="closeReactionPicker"
          class="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#1F2933] flex items-center justify-center"
          aria-label="Close reactions"
        >
          ×
        </button>
      </div>

      <div class="mb-4 max-h-32 overflow-y-auto">
        ${activeSummary}
      </div>

      <div class="grid grid-cols-5 gap-3 justify-items-center">
        ${pickerButtons}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeReactionPicker').onclick = () => modal.remove();

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function refreshOpenReactionPicker(mediaId) {
  const modal = document.getElementById('reactionPickerModal');
  if (!modal) return;

  const openMediaId = modal.dataset.mediaId;
  if (String(openMediaId) === String(mediaId)) {
    showReactionPicker(mediaId);
  }
}

function renderReactionRows(item) {
  return `
    <div class="px-4 pb-4 pt-3 border-t border-[#F0E7DC]">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          onclick='event.stopPropagation(); showReactionPicker(${JSON.stringify(item.id)})'
          class="text-xs font-medium text-gray-500 hover:text-[#1F2933] transition"
        >
          Reactions
        </button>

        <button
          type="button"
          onclick='event.stopPropagation(); showReactionPicker(${JSON.stringify(item.id)})'
          class="w-8 h-8 rounded-full border border-[#E8DED2] bg-[#FAF7F2] text-[#1F2933] text-lg leading-none flex items-center justify-center hover:bg-white transition"
          title="Add reaction"
        >
          +
        </button>
      </div>
    </div>
  `;
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
          onclick='event.stopPropagation(); toggleCardMenu(${JSON.stringify(item.id)})'
          class="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-xl text-[#1F2933]"
          aria-label="Media options"
        >
          ⋯
        </button>

        <div
          data-card-menu
          data-menu-id="${escapeHtml(item.id)}"
          class="hidden absolute top-14 right-3 z-30 bg-white rounded-xl shadow-lg border border-[#E8DED2] overflow-hidden min-w-32"
        >
          <button
            type="button"
            onclick='event.stopPropagation(); deleteMedia(${JSON.stringify(item.id)})'
            class="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>

        <button
          type="button"
          onclick='event.stopPropagation(); openMediaViewerById(${JSON.stringify(item.id)})'
          class="block w-full text-left"
          aria-label="View media larger"
        >
          ${
            item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-72 object-cover">`
              : `<video src="${escapeHtml(item.url)}" class="w-full h-72 object-cover"></video>`
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
    galleryMedia
      .map(item => normalizeAlbum(item.album))
      .filter(Boolean)
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

async function reactToMedia(mediaId, emoji) {
  try {
    const reactionValue = getReactionValue(emoji);

    const res = await fetch(`/api/media/${mediaId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: reactionValue })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.item) {
      replaceGalleryCard(data.item);
      refreshOpenReactionPicker(mediaId);
    } else if (res.ok && data.reactions) {
      const existing = galleryMedia.find(item => String(item.id) === String(mediaId));
      if (existing) {
        existing.reactions = data.reactions;
        replaceGalleryCard(existing);
        refreshOpenReactionPicker(mediaId);
      }
    } else {
      showToast(data.error || 'Reaction failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Reaction error', 'error');
  }
}

// ===== UPLOAD PAGE =====
function initializeUpload() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileUpload');
  const selectedFilesContainer = document.getElementById('selectedFilesContainer');
  const selectedFilesList = document.getElementById('fileList');
  const uploadForm = document.getElementById('uploadForm');
  const uploadButton = document.getElementById('uploadButton');
  const warning = document.getElementById('uploadLimitWarning');

  let selectedFiles = [];

  function showWarning() {
    if (warning) warning.classList.remove('hidden');
  }

  function hideWarning() {
    if (warning) warning.classList.add('hidden');
  }

  function canAddFiles(files) {
    if (selectedFiles.length + files.length > MAX_UPLOAD_FILES) {
      showWarning();
      return false;
    }
    hideWarning();
    return true;
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => e.preventDefault());

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);

      if (!canAddFiles(files)) return;

      selectedFiles = [...selectedFiles, ...files];
      updateSelectedFilesList();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);

      if (!canAddFiles(files)) {
        fileInput.value = '';
        return;
      }

      selectedFiles = [...selectedFiles, ...files];
      updateSelectedFilesList();
      fileInput.value = '';
    });
  }

  function updateSelectedFilesList() {
    if (selectedFiles.length > 0) {
      selectedFilesContainer.style.display = 'block';
      selectedFilesList.innerHTML = '';

      selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between p-2 bg-white rounded';
        div.innerHTML = `
          <span>${escapeHtml(file.name)}</span>
          <button onclick="removeFile(${index})">X</button>
        `;
        selectedFilesList.appendChild(div);
      });

      uploadButton.disabled = false;
    } else {
      selectedFilesContainer.style.display = 'none';
      uploadButton.disabled = true;
    }
  }

  window.removeFile = function(index) {
    selectedFiles.splice(index, 1);
    updateSelectedFilesList();

    if (selectedFiles.length <= MAX_UPLOAD_FILES) {
      hideWarning();
    }
  };

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      showToast('Select media first', 'error');
      return;
    }

    if (selectedFiles.length > MAX_UPLOAD_FILES) {
      showWarning();
      return;
    }

    const formData = new FormData();

    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    const titleInput = document.getElementById('title');
    const albumInput = document.getElementById('album');

    formData.append('title', titleInput ? titleInput.value.trim() : '');
    formData.append('description', '');
    formData.append('album', albumInput ? albumInput.value.trim() : '');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        showToast('Media uploaded successfully', 'success');
        selectedFiles = [];
        updateSelectedFilesList();
        uploadForm.reset();
        hideWarning();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Media upload failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Upload error', 'error');
    }
  });
}

// ===== GALLERY PAGE =====
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

window.reactToMedia = reactToMedia;
window.showReactionPicker = showReactionPicker;
window.openMediaViewer = openMediaViewer;
window.openMediaViewerById = openMediaViewerById;
window.toggleCardMenu = toggleCardMenu;

window.deleteMedia = async function(mediaId) {
  const confirmed = await showConfirm('Delete this media item?', 'Delete');
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/media/${mediaId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Media deleted', 'success');

      galleryMedia = galleryMedia.filter(item => String(item.id) !== String(mediaId));

      if (document.getElementById('gallery')) {
        populateAlbumFilter();
        renderGallery();
        return;
      }

      if (document.getElementById('userUploads')) {
        loadUserUploads();
      }

      if (document.getElementById('totalCount')) {
        loadHomePage();
      }
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'Delete failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Delete error', 'error');
  }
};

// ===== HOME PAGE =====
async function loadHomePage() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();

    const totalCount = document.getElementById('totalCount');
    const albumCount = document.getElementById('albumCount');
    const recentCount = document.getElementById('recentCount');
    const recentPhotos = document.getElementById('recentPhotos');
    const dailyMessage = document.getElementById('dailyMessage');

    const albums = [...new Set(data.map(item => normalizeAlbum(item.album)).filter(Boolean))];
    const recentItems = data.slice().reverse().slice(0, 3);

    if (totalCount) totalCount.textContent = data.length;
    if (albumCount) albumCount.textContent = albums.length;
    if (recentCount) recentCount.textContent = recentItems.length;
    if (dailyMessage) dailyMessage.textContent = getDailyMessage();

    if (!recentPhotos) return;

    if (recentItems.length === 0) {
      recentPhotos.innerHTML = '<p class="text-gray-500 col-span-full">No media yet.</p>';
      return;
    }

    recentPhotos.innerHTML = recentItems.map(item => {
      const caption = String(item.title || '').trim();

      return `
        <a href="gallery.html" class="block bg-white rounded-lg overflow-hidden border border-[#E8DED2] shadow-sm hover:shadow-md transition">
          <div class="h-40 overflow-hidden bg-gray-100">
            ${item.type === 'image'
              ? `<img src="${escapeHtml(item.url)}" class="w-full h-full object-cover">`
              : `<video src="${escapeHtml(item.url)}" class="w-full h-full object-cover"></video>`
            }
          </div>
          <div class="p-3">
            ${
              caption
                ? `<p class="text-sm font-medium truncate">${escapeHtml(caption)}</p>`
                : ''
            }
            <p class="text-xs text-gray-500 ${caption ? 'mt-1' : ''}">${formatDate(item.uploadedAt)}</p>
          </div>
        </a>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
  }
}

// ===== PROFILE PAGE =====
async function loadUserUploads() {
  const container = document.getElementById('userUploads');
  const uploadStats = document.getElementById('uploadStats');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      if (uploadStats) uploadStats.textContent = 'Not logged in';
      container.innerHTML = '<p class="text-gray-500 col-span-full">Please log in.</p>';
      return;
    }

    const res = await fetch('/api/media');
    const data = await res.json();

    const userItems = data
      .filter(item => item.uploadedBy === currentUser.username)
      .slice()
      .reverse()
      .slice(0, 6);

    if (uploadStats) uploadStats.textContent = `${userItems.length} uploads`;

    if (userItems.length === 0) {
      container.innerHTML = '<p class="text-gray-500 col-span-full">No uploads yet.</p>';
      return;
    }

    container.innerHTML = userItems.map(item => {
      const caption = String(item.title || '').trim();

      return `
        <div
          data-media-card
          data-media-id="${escapeHtml(item.id)}"
          class="relative bg-white rounded-2xl overflow-hidden border border-[#E8DED2] shadow-sm group"
        >
          <div class="aspect-square overflow-hidden">
            ${item.type === 'image'
              ? `<img
                  src="${escapeHtml(item.url)}"
                  class="w-full h-full object-cover"
                >`
              : `<video
                  src="${escapeHtml(item.url)}"
                  class="w-full h-full object-cover"
                ></video>`
            }
          </div>

          <button
            data-delete-button
            onclick='event.stopPropagation(); deleteMedia(${JSON.stringify(item.id)})'
            class="absolute top-3 right-3 bg-white/90 text-red-600 text-xs px-3 py-1 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition"
          >
            Delete
          </button>

          <div class="p-3">
            ${
              caption
                ? `<p class="text-sm font-medium truncate">${escapeHtml(caption)}</p>`
                : ''
            }
            <p class="text-xs text-gray-500 ${caption ? '' : ''}">${formatDate(item.uploadedAt)}</p>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    if (uploadStats) uploadStats.textContent = 'Error loading uploads';
  }
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const existingToast = document.getElementById('appToast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'appToast';

  const icon = type === 'success' ? '✓' : '!';
  const iconColor = type === 'success' ? 'bg-[#C76B4A]' : 'bg-red-500';

  toast.className = `
    fixed top-6 left-1/2 -translate-x-1/2 z-50
    bg-white border border-[#E8DED2]
    shadow-lg rounded-xl px-5 py-4
    text-sm text-[#1F2933]
    min-w-[260px] text-center
  `;

  toast.innerHTML = `
    <div class="flex items-center justify-center gap-3">
      <div class="w-6 h-6 ${iconColor} text-white rounded-full flex items-center justify-center text-xs font-semibold">
        ${icon}
      </div>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2200);
}

// ===== HELPERS =====
function formatDate(dateString) {
  if (!dateString) return '';

  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ===== GLOBAL CLICK HANDLER =====
document.addEventListener('click', () => {
  document.querySelectorAll('[data-card-menu]').forEach(menu => {
    menu.classList.add('hidden');
  });
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('uploadForm')) initializeUpload();
  if (document.getElementById('gallery')) loadGallery();
  if (document.getElementById('userUploads')) loadUserUploads();
  if (document.getElementById('totalCount')) loadHomePage();
});
