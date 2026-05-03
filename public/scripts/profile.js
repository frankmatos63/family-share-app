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

window.loadUserUploads = loadUserUploads;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('userUploads')) loadUserUploads();
});
