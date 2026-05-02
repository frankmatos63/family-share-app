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
  let isUploading = false;

  function showWarning() {
    if (warning) warning.classList.remove('hidden');
  }

  function hideWarning() {
    if (warning) warning.classList.add('hidden');
  }

  function setUploadStatus(message, type = 'info') {
    let status = document.getElementById('uploadStatus');

    if (!status && uploadForm) {
      status = document.createElement('div');
      status.id = 'uploadStatus';
      uploadForm.prepend(status);
    }

    if (!status) return;

    const styles = {
      info: 'bg-[#FAF7F2] text-[#1F2933] border-[#E8DED2]',
      success: 'bg-green-50 text-green-700 border-green-200',
      error: 'bg-red-50 text-red-700 border-red-200'
    };

    status.className = `mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${styles[type] || styles.info}`;
    status.textContent = message;
    status.classList.remove('hidden');
  }

  function clearUploadStatus() {
    const status = document.getElementById('uploadStatus');
    if (status) status.classList.add('hidden');
  }

  function setUploadingState(uploading) {
    isUploading = uploading;

    if (!uploadButton) return;

    uploadButton.disabled = uploading || selectedFiles.length === 0;

    if (uploading) {
      uploadButton.textContent = 'Uploading...';
      uploadButton.classList.add('opacity-70', 'cursor-not-allowed');
    } else {
      uploadButton.textContent = 'Upload';
      uploadButton.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }

  function canAddFiles(files) {
    if (selectedFiles.length + files.length > MAX_UPLOAD_FILES) {
      showWarning();
      setUploadStatus(`You can upload up to ${MAX_UPLOAD_FILES} files at a time.`, 'error');
      return false;
    }

    hideWarning();
    clearUploadStatus();
    return true;
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => e.preventDefault());

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (isUploading) return;

      const files = Array.from(e.dataTransfer.files);
      if (!canAddFiles(files)) return;

      selectedFiles = [...selectedFiles, ...files];
      updateSelectedFilesList();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (isUploading) return;

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
        div.className = 'flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E8DED2]';

        div.innerHTML = `
          <span class="text-sm text-[#1F2933] truncate">${escapeHtml(file.name)}</span>
          <button
            type="button"
            onclick="removeFile(${index})"
            class="shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg"
          >
            Remove
          </button>
        `;

        selectedFilesList.appendChild(div);
      });

      clearUploadStatus();
      setUploadingState(false);
    } else {
      selectedFilesContainer.style.display = 'none';
      setUploadingState(false);
    }
  }

  window.removeFile = function(index) {
    if (isUploading) return;

    selectedFiles.splice(index, 1);
    updateSelectedFilesList();

    if (selectedFiles.length <= MAX_UPLOAD_FILES) {
      hideWarning();
    }
  };

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isUploading) return;

    if (selectedFiles.length === 0) {
      setUploadStatus('Select media first.', 'error');
      showToast('Select media first', 'error');
      return;
    }

    if (selectedFiles.length > MAX_UPLOAD_FILES) {
      showWarning();
      setUploadStatus(`You can upload up to ${MAX_UPLOAD_FILES} files at a time.`, 'error');
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
      setUploadingState(true);
      setUploadStatus(`Uploading ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}...`, 'info');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setUploadStatus(`Upload complete: ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} uploaded.`, 'success');
        showToast('Media uploaded successfully', 'success');

        selectedFiles = [];
        updateSelectedFilesList();
        uploadForm.reset();
        hideWarning();
        populateUploadAlbums();
      } else {
        const data = await res.json().catch(() => ({}));
        setUploadStatus(data.error || 'Media upload failed.', 'error');
        showToast(data.error || 'Media upload failed', 'error');
      }
    } catch (err) {
      console.error(err);
      setUploadStatus('Upload error. Please try again.', 'error');
      showToast('Upload error', 'error');
    } finally {
      setUploadingState(false);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('uploadForm')) {
    initializeUpload();
    populateUploadAlbums();
  }
});
