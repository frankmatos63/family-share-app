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
          
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold truncate">${escapeHtml(album)}</h2>
              <p class="text-xs text-gray-500 mt-1">
                ${items.length} item${items.length > 1 ? 's' : ''} • ${formatDate(latest.uploadedAt)}
              </p>
            </div>

            <div class="relative">
              <button
                onclick="toggleAlbumMenu(event, '${escapeHtml(album)}')"
                class="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                ⋯
              </button>

              <div
                id="album-menu-${escapeHtml(album)}"
                class="hidden absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 text-sm"
              >
                <button
                  onclick="event.stopPropagation(); openAlbumModal('${escapeHtml(album)}')"
                  class="block w-full text-left px-4 py-2.5 hover:bg-gray-50"
                >
                  View album
                </button>

                <button
                  onclick="event.stopPropagation(); enableSelectionMode('${escapeHtml(album)}')"
                  class="block w-full text-left px-4 py-2.5 hover:bg-gray-50"
                >
                  Select & move
                </button>
              </div>
            </div>

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

/* =========================
   MENU TOGGLE
========================= */

function toggleAlbumMenu(event, album) {
  event.stopPropagation();

  const menu = document.getElementById(`album-menu-${album}`);
  if (!menu) return;

  const isOpen = !menu.classList.contains('hidden');

  document.querySelectorAll('[id^="album-menu-"]').forEach(m => m.classList.add('hidden'));

  if (!isOpen) {
    menu.classList.remove('hidden');
  }
}

document.addEventListener('click', () => {
  document.querySelectorAll('[id^="album-menu-"]').forEach(m => m.classList.add('hidden'));
});

/* ========================= */

window.loadUserUploads = loadUserUploads;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('userUploads')) loadUserUploads();
});
