async function populateUploadAlbums() {
  const select = document.getElementById('album');
  if (!select) return;

  try {
    const res = await fetch('/api/media');
    const data = await res.json();

    const albums = [...new Set(
      data.map(item => normalizeAlbum(item.album)).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    select.innerHTML = `
      <option value="">Quick Upload / Misc</option>
      ${albums.map(album => `<option value="${escapeHtml(album)}">${escapeHtml(album)}</option>`).join('')}
    `;
  } catch (e) {
    console.error('Failed to load upload albums:', e);
  }
}

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
    const newAlbumInput = document.getElementById('newAlbum');

    const title = titleInput ? titleInput.value.trim() : '';
    const selectedAlbum = albumInput ? albumInput.value.trim() : '';
    const newAlbum = newAlbumInput ? newAlbumInput.value.trim() : '';

    const finalAlbum = newAlbum || selectedAlbum;

    formData.append('title', title);
    formData.append('description', '');
    formData.append('album', finalAlbum);

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
        populateUploadAlbums();
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

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('uploadForm')) {
    initializeUpload();
    populateUploadAlbums();
  }
});
