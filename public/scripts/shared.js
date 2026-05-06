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
  { id: 'laugh', emoji: '😂', label: 'Funny' },
  { id: 'love', emoji: '🥰', label: 'Love' },
  { id: 'smile', emoji: '🙂', label: 'Smile' },
  { id: 'strong', emoji: '💪', label: 'Strong' },
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
  { id: 'birthday', emoji: '🎂', label: 'Birthday' },
  { id: 'gift', emoji: '🎁', label: 'Gift' },
  { id: 'clap', emoji: '👏', label: 'Clap' }
];

const MAX_UPLOAD_FILES = 25;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

let galleryMedia = [];
let profileMedia = [];
let galleryCurrentUser = null;
let activeAlbumFilter = '';

let activeViewerModal = null;
let activeViewerKeyHandler = null;
let previousBodyOverflow = '';
let previousBodyTouchAction = '';
let previousBodyOverscrollBehavior = '';
let previousBodyPosition = '';
let previousBodyWidth = '';

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
  if (!value || value === 'Fam Media') return 'Misc';
  return value;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function formatDate(dateString) {
  if (!dateString) return '';

  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

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
      profileMedia = profileMedia.filter(item => String(item.id) !== String(mediaId));

      const albumModal = document.getElementById('albumManagerModal');
      if (albumModal) {
        document.body.style.overflow = '';
        albumModal.remove();
      }

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

window.deleteMedia = window.deleteMedia;
