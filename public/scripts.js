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

const REACTIONS = ['🥰', '🤗', '💪', '👍', '🎈', '❤️', '🎂', '🎉', '👏'];
const MAX_UPLOAD_FILES = 25;

let activeMediaCardId = null;

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

function showConfirm(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50';

    modal.innerHTML = `
      <div class="bg-white rounded-xl p-6 w-80 text-center shadow-lg">
        <p class="mb-6 text-sm text-[#1F2933]">${message}</p>
        <div class="flex justify-center gap-4">
          <button id="confirmCancel" class="px-4 py-2 border rounded-lg">Cancel</button>
          <button id="confirmOk" class="px-4 py-2 bg-red-500 text-white rounded-lg">${confirmLabel}</button>
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
  });
}

function showReactionsModal(reactions) {
  const activeReactions = Object.entries(reactions || {})
    .filter(([emoji, users]) => Array.isArray(users) && users.length > 0);

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4';

  const content = activeReactions.length
    ? activeReactions.map(([emoji, users]) => `
        <div class="py-3 border-b border-[#E8DED2] last:border-b-0">
          <div class="text-xl mb-1">${emoji}</div>
          <div class="text-sm text-gray-600">${users.join(', ')}</div>
        </div>
      `).join('')
    : '<p class="text-sm text-gray-500">No reactions yet.</p>';

  modal.innerHTML = `
    <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
      <h2 class="text-lg font-semibold mb-4">Reactions</h2>
      <div class="max-h-[60vh] overflow-y-auto">
        ${content}
      </div>
      <button
        id="closeReactionsModal"
        class="mt-5 w-full px-4 py-2 bg-[#C76B4A] text-white rounded-lg"
      >
        Close
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeReactionsModal').onclick = () => modal.remove();

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function openMediaViewer(item) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black z-50 flex items-center justify-center';

  // 🔒 Lock background scroll
  document.body.style.overflow = 'hidden';

  modal.innerHTML = `
    <button
      id="closeMediaViewer"
      class="absolute top-4 right-4 z-20 bg-white/15 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl"
    >
      ×
    </button>

    <div class="w-full h-full overflow-auto flex items-center justify-center p-4">
      ${
        item.type === 'image'
          ? `<img src="${item.url}" class="object-contain" style="width: auto; height: auto;">`
          : `<video src="${item.url}" controls autoplay class="max-w-full max-h-full"></video>`
      }
    </div>
  `;

  document.body.appendChild(modal);

  // ✅ Single clean close handler
  function closeViewer() {
    document.body.style.overflow = ''; // 🔓 Restore scroll
    modal.remove();
  }

  modal.querySelector('#closeMediaViewer').onclick = closeViewer;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeViewer();
  });
}

function setActiveMediaCard(mediaId) {
  activeMediaCardId = activeMediaCardId === mediaId ? null : mediaId;

  document.querySelectorAll('[data-media-card]').forEach(card => {
    const isActive = card.dataset.mediaId === String(activeMediaCardId);
    const overlay = card.querySelector('[data-media-overlay]');
    const deleteButton = card.querySelector('[data-delete-button]');
    const reactions = card.querySelector('[data-reactions]');
    const overlayActions = card.querySelector('[data-overlay-actions]');

    if (overlay) {
      overlay.classList.toggle('opacity-100', isActive);
      overlay.classList.toggle('bg-black/40', isActive);
      overlay.classList.toggle('pointer-events-auto', isActive);
      overlay.classList.toggle('pointer-events-none', !isActive);
    }

    if (deleteButton) {
      deleteButton.classList.toggle('opacity-100', isActive);
      deleteButton.classList.toggle('pointer-events-auto', isActive);
      deleteButton.classList.toggle('pointer-events-none', !isActive);
    }

    if (reactions) {
      reactions.classList.toggle('opacity-100', isActive);
      reactions.classList.toggle('translate-y-0', isActive);
      reactions.classList.toggle('scale-100', isActive);
      reactions.classList.toggle('pointer-events-auto', isActive);
      reactions.classList.toggle('pointer-events-none', !isActive);
    }

    if (overlayActions) {
      overlayActions.classList.toggle('pointer-events-auto', isActive);
      overlayActions.classList.toggle('pointer-events-none', !isActive);
    }
  });
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
          <span>${file.name}</span>
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

    formData.append('title', document.getElementById('title').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('album', document.getElementById('album').value);

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

  try {
    const currentUser = await getCurrentUser();

    const res = await fetch('/api/media');
    const data = await res.json();

    const username = currentUser?.username;

    if (photoCount) photoCount.textContent = `${data.length} media`;

    if (data.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-500">No media yet</p>';
      return;
    }

    activeMediaCardId = null;
    container.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';

    container.innerHTML = data.slice().reverse().map(item => {
      const hasReactions = Object.values(item.reactions || {})
        .some(users => Array.isArray(users) && users.length > 0);

      const reactionButtons = REACTIONS.map(emoji => {
        const users = item.reactions?.[emoji] || [];
        const count = users.length;
        const isActive = username && users.includes(username);
        const namesTitle = users.length > 0 ? users.join(', ') : 'No reactions yet';

        return `
          <button
            onclick='event.stopPropagation(); reactToMedia(${JSON.stringify(item.id)}, ${JSON.stringify(emoji)})'
            class="text-sm px-2 py-1 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
              isActive
                ? 'bg-[#C76B4A] text-white border-[#C76B4A] shadow-sm'
                : 'bg-white text-[#1F2933] border-[#E8DED2] hover:bg-[#FAF7F2]'
            }"
            title="${namesTitle}"
          >
            ${emoji}${count > 0 ? ` ${count}` : ''}
          </button>
        `;
      }).join('');

      return `
        <div
          data-media-card
          data-media-id="${item.id}"
          onclick='setActiveMediaCard(${JSON.stringify(item.id)})'
          class="relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group bg-white border border-[#E8DED2] cursor-pointer"
        >
          ${item.type === 'image'
            ? `<img
                src="${item.url}"
                class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
              >`
            : `<video
                src="${item.url}"
                class="w-full h-64 object-cover"
              ></video>`
          }

          <button
            data-delete-button
            onclick='event.stopPropagation(); deleteMedia(${JSON.stringify(item.id)})'
            class="absolute top-3 right-3 bg-white/90 text-red-600 text-xs px-3 py-1 rounded-lg shadow-sm opacity-0 pointer-events-none transition z-20"
          >
            Delete
          </button>

          <div
            data-media-overlay
            class="absolute inset-0 bg-black/0 transition-all flex flex-col justify-between p-4 pointer-events-none opacity-0"
          >
            <div class="text-white">
              <p class="text-sm font-medium">${item.title || 'Untitled'}</p>
              <p class="text-xs text-gray-200">${formatDate(item.uploadedAt)}</p>
              <p class="text-xs text-gray-200">Uploaded by ${item.uploadedByName || item.uploadedBy || 'Unknown'}</p>

              <div
                data-overlay-actions
                class="mt-2 flex items-center gap-4 pointer-events-none"
              >
                <button
                  onclick='event.stopPropagation(); openMediaViewer(${JSON.stringify(item)})'
                  class="text-xs underline text-white/90"
                >
                  View larger
                </button>

                ${hasReactions
                  ? `<button
                      onclick='event.stopPropagation(); showReactionsModal(${JSON.stringify(item.reactions || {})})'
                      class="text-xs underline text-white/90"
                    >
                      View reactions
                    </button>`
                  : ''
                }
              </div>
            </div>
            <div
              data-reactions
              class="flex flex-wrap gap-2 opacity-0 translate-y-2 scale-95 transition-all duration-200 pointer-events-none"
            >
              ${reactionButtons}
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    if (photoCount) photoCount.textContent = 'Error loading media';
  }
}

async function reactToMedia(mediaId, emoji) {
  try {
    const res = await fetch(`/api/media/${mediaId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji })
    });

    if (res.ok) {
      const previousActiveId = activeMediaCardId;

      await loadGallery();

      // Restore same card WITHOUT toggling off
      if (previousActiveId === mediaId) {
        activeMediaCardId = mediaId;

        const card = document.querySelector(`[data-media-id="${mediaId}"]`);
        if (card) {
          const overlay = card.querySelector('[data-media-overlay]');
          const reactions = card.querySelector('[data-reactions]');
          const deleteButton = card.querySelector('[data-delete-button]');
          const overlayActions = card.querySelector('[data-overlay-actions]');

          if (overlay) {
            overlay.classList.add('opacity-100', 'bg-black/40', 'pointer-events-auto');
          }

          if (reactions) {
            reactions.classList.add('opacity-100', 'translate-y-0', 'scale-100', 'pointer-events-auto');
          }

          if (deleteButton) {
            deleteButton.classList.add('opacity-100', 'pointer-events-auto');
          }

          if (overlayActions) {
            overlayActions.classList.add('pointer-events-auto');
          }
        }
      }
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'Reaction failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Reaction error', 'error');
  }
}

window.reactToMedia = reactToMedia;
window.showReactionsModal = showReactionsModal;
window.openMediaViewer = openMediaViewer;

window.deleteMedia = async function(mediaId) {
  const confirmed = await showConfirm('Delete this media item?', 'Delete');
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/media/${mediaId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Media deleted', 'success');

      if (document.getElementById('gallery')) {
        loadGallery();
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

    const albums = [...new Set(data.map(item => item.album || 'Fam Media'))];
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

    recentPhotos.innerHTML = recentItems.map(item => `
      <a href="gallery.html" class="block bg-white rounded-lg overflow-hidden border border-[#E8DED2] shadow-sm hover:shadow-md transition">
        <div class="h-40 overflow-hidden bg-gray-100">
          ${item.type === 'image'
            ? `<img src="${item.url}" class="w-full h-full object-cover">`
            : `<video src="${item.url}" class="w-full h-full object-cover"></video>`
          }
        </div>
        <div class="p-3">
          <p class="text-sm font-medium truncate">${item.title || 'Untitled'}</p>
          <p class="text-xs text-gray-500 mt-1">${formatDate(item.uploadedAt)}</p>
        </div>
      </a>
    `).join('');

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

    activeMediaCardId = null;

    container.innerHTML = userItems.map(item => `
      <div
        data-media-card
        data-media-id="${item.id}"
        onclick='setActiveMediaCard(${JSON.stringify(item.id)})'
        class="relative bg-white rounded-2xl overflow-hidden border border-[#E8DED2] shadow-sm cursor-pointer group"
      >
        <div class="aspect-square overflow-hidden">
          ${item.type === 'image'
            ? `<img
                src="${item.url}"
                class="w-full h-full object-cover"
              >`
            : `<video
                src="${item.url}"
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

        <div
          data-media-overlay
          class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end p-4 pointer-events-none opacity-0 group-hover:opacity-100"
        >
          <div class="text-white">
            <p class="text-sm font-medium">${item.title || 'Untitled'}</p>
            <p class="text-xs text-gray-200">${formatDate(item.uploadedAt)}</p>
          </div>
        </div>

        <div class="p-3">
          <p class="text-sm font-medium truncate">${item.title || 'Untitled'}</p>
          <p class="text-xs text-gray-500">${formatDate(item.uploadedAt)}</p>
        </div>
      </div>
    `).join('');

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
      <span>${message}</span>
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('uploadForm')) initializeUpload();
  if (document.getElementById('gallery')) loadGallery();
  if (document.getElementById('userUploads')) loadUserUploads();
  if (document.getElementById('totalCount')) loadHomePage();
});
