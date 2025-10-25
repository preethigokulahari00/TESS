// Upload functionality with real-time progress tracking

document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadHistory = document.getElementById('uploadHistory');

    let currentUploadId = null;
    let progressInterval = null;

    // File input change handler
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const validation = validateFile(file);
            if (!validation.valid) {
                window.toastManager.show('Invalid File', validation.error, 'error');
                this.value = '';
                return;
            }

            // Show file info
            showFileInfo(file);
        }
    });

    // Drag and drop functionality
    const formCard = uploadForm.closest('.card-body');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        formCard.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        formCard.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        formCard.addEventListener(eventName, unhighlight, false);
    });

    formCard.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        formCard.classList.add('dragover');
    }

    function unhighlight(e) {
        formCard.classList.remove('dragover');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change'));
        }
    }

    // Form submission handler
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const file = fileInput.files[0];
        if (!file) {
            window.toastManager.show('No File Selected', 'Please select a file to upload.', 'warning');
            return;
        }

        const validation = validateFile(file);
        if (!validation.valid) {
            window.toastManager.show('Invalid File', validation.error, 'error');
            return;
        }

        startUpload(file);
    });

    function showFileInfo(file) {
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info mt-3';
        fileInfo.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1"><i class="bi bi-file-earmark"></i> ${sanitizeHtml(file.name)}</h6>
                    <small class="text-muted">Size: ${formatFileSize(file.size)} | Type: ${sanitizeHtml(file.type || 'Unknown')}</small>
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearFileSelection()">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;

        // Remove existing file info
        const existingInfo = uploadForm.querySelector('.file-info');
        if (existingInfo) {
            existingInfo.remove();
        }

        // Add new file info
        uploadForm.appendChild(fileInfo);
    }

    window.clearFileSelection = function() {
        fileInput.value = '';
        const fileInfo = uploadForm.querySelector('.file-info');
        if (fileInfo) {
            fileInfo.remove();
        }
    };

    function startUpload(file) {
        // Disable form
        uploadBtn.disabled = true;
        fileInput.disabled = true;
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Uploading...';

        // Show progress
        uploadProgress.style.display = 'block';
        updateProgress(0, 'Preparing upload...');

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        // Start upload
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }

            currentUploadId = data.upload_id;
            startProgressTracking();
        })
        .catch(error => {
            console.error('Upload error:', error);
            window.toastManager.show('Upload Failed', error.message, 'error');
            resetUploadForm();
        });
    }

    function startProgressTracking() {
        progressInterval = setInterval(() => {
            if (!currentUploadId) return;

            fetch(`/upload-progress/${currentUploadId}`)
                .then(response => response.json())
                .then(data => {
                    updateProgress(data.progress || 0, getStatusMessage(data));

                    if (data.status === 'completed') {
                        clearInterval(progressInterval);
                        handleUploadComplete(data);
                    } else if (data.status === 'error') {
                        clearInterval(progressInterval);
                        handleUploadError(data);
                    }
                })
                .catch(error => {
                    console.error('Progress tracking error:', error);
                    clearInterval(progressInterval);
                    handleUploadError({ message: 'Failed to track progress' });
                });
        }, 1000);
    }

    function updateProgress(percent, message) {
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = `${Math.round(percent)}%`;
        uploadStatus.textContent = message;

        // Update progress bar color based on percentage
        if (percent < 100) {
            progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated bg-primary';
        } else {
            progressBar.className = 'progress-bar bg-success';
        }
    }

    function getStatusMessage(data) {
        switch (data.status) {
            case 'starting':
                return 'Initializing upload...';
            case 'hashing':
                return 'Computing file hash...';
            case 'encrypting':
                return 'Encrypting file...';
            case 'uploading':
                return `Uploading... ${Math.round(data.progress || 0)}% complete`;
            case 'completing':
                return 'Finalizing upload...';
            case 'completed':
                return 'Upload completed successfully!';
            case 'error':
                return `Error: ${data.message || 'Unknown error'}`;
            default:
                return 'Processing...';
        }
    }

    function handleUploadComplete(data) {
        updateProgress(100, 'Upload completed successfully!');

        window.toastManager.show(
            'Upload Successful',
            `File "${sanitizeHtml(data.filename)}" has been uploaded securely.`,
            'success'
        );

        // Add to upload history
        addToUploadHistory(data);

        // Reset form after a delay
        setTimeout(resetUploadForm, 2000);
    }

    function handleUploadError(data) {
        const errorMessage = data.message || 'An unknown error occurred during upload.';

        window.toastManager.show(
            'Upload Failed',
            errorMessage,
            'error'
        );

        updateProgress(0, `Error: ${errorMessage}`);
        progressBar.className = 'progress-bar bg-danger';

        resetUploadForm();
    }

    function resetUploadForm() {
        // Re-enable form
        uploadBtn.disabled = false;
        fileInput.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Upload File Securely';

        // Clear file selection
        fileInput.value = '';
        const fileInfo = uploadForm.querySelector('.file-info');
        if (fileInfo) {
            fileInfo.remove();
        }

        // Hide progress after delay
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            updateProgress(0, 'Preparing upload...');
        }, 5000);

        // Clear tracking
        currentUploadId = null;
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    function addToUploadHistory(data) {
        const historyContainer = uploadHistory;

        // Remove "no files" message if present
        const noFilesMsg = historyContainer.querySelector('.text-center');
        if (noFilesMsg) {
            noFilesMsg.remove();
        }

        // Create upload item
        const uploadItem = document.createElement('div');
        uploadItem.className = 'list-group-item';
        uploadItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-1">
                        <i class="bi bi-file-earmark-check text-success"></i>
                        ${sanitizeHtml(data.filename)}
                    </h6>
                    <p class="mb-1 small text-muted">
                        Uploaded: ${new Date().toLocaleString()}
                    </p>
                    <small class="text-success">
                        <i class="bi bi-shield-check"></i> Encrypted and stored securely
                    </small>
                </div>
                <span class="badge bg-success">
                    <i class="bi bi-check-circle"></i>
                </span>
            </div>
        `;

        // Add to top of history
        historyContainer.insertBefore(uploadItem, historyContainer.firstChild);

        // Limit history to 10 items
        const items = historyContainer.querySelectorAll('.list-group-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }

        // Animate in
        uploadItem.style.opacity = '0';
        uploadItem.style.transform = 'translateX(-20px)';
        uploadItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            uploadItem.style.opacity = '1';
            uploadItem.style.transform = 'translateX(0)';
        }, 10);
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (progressInterval) {
            clearInterval(progressInterval);
        }
    });
});