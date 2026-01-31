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

    // Load upload history on page load
    loadUploadHistory();
    updateDashboardStats();

    // Get browse button reference
    const browseBtn = document.getElementById('browseBtn');
    const dropZone = document.getElementById('dropZone');

    // Browse button handler
    if (browseBtn) {
        browseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });
    }

    // Second "View All" button handler
    const viewAllUploadsBtn2 = document.getElementById('viewAllUploadsBtn2');
    if (viewAllUploadsBtn2) {
        viewAllUploadsBtn2.addEventListener('click', function() {
            loadAllUploads();
        });
    }

    // File input change handler
    fileInput.addEventListener('change', function(e) {
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
    }, false);

    // Drag and drop functionality
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        dropZone.addEventListener('drop', handleDrop, false);

        // Click on drop zone to browse (but not on the browse button itself)
        dropZone.addEventListener('click', function(e) {
            // Don't trigger if clicking the browse button or its children
            const browseButton = document.getElementById('browseBtn');
            if (e.target === browseButton || (browseButton && browseButton.contains(e.target))) {
                return;
            }
            // Don't trigger if clicking the file input
            if (e.target === fileInput) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });
    }

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
        // Hide drop zone
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.style.display = 'none';
        }

        // Show selected file section
        const selectedFileSection = document.getElementById('selectedFileSection');
        if (selectedFileSection) {
            selectedFileSection.style.display = 'block';
        }

        // Update file info
        const selectedFileName = document.getElementById('selectedFileName');
        const selectedFileSize = document.getElementById('selectedFileSize');

        if (selectedFileName) {
            selectedFileName.innerHTML = `<strong>${sanitizeHtml(file.name)}</strong>`;
        }

        if (selectedFileSize) {
            selectedFileSize.textContent = `Size: ${formatFileSize(file.size)} | Type: ${sanitizeHtml(file.type || 'Unknown')}`;
        }
    }

    // Clear file selection handler
    const clearFileBtn = document.getElementById('clearFileBtn');
    if (clearFileBtn) {
        clearFileBtn.addEventListener('click', function() {
            clearFileSelection();
        });
    }

    window.clearFileSelection = function() {
        fileInput.value = '';

        // Hide selected file section
        const selectedFileSection = document.getElementById('selectedFileSection');
        if (selectedFileSection) {
            selectedFileSection.style.display = 'none';
        }

        // Show drop zone again
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.style.display = 'block';
        }
    };

    function startUpload(file) {
        // Disable form
        uploadBtn.disabled = true;
        fileInput.disabled = true;
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Uploading...';

        // Hide selected file section
        const selectedFileSection = document.getElementById('selectedFileSection');
        if (selectedFileSection) {
            selectedFileSection.style.display = 'none';
        }

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

        // Reload upload history from server to get updated count
        setTimeout(() => {
            // Clear existing history first
            uploadHistory.innerHTML = '';
            loadUploadHistory();
        }, 500);

        // Update dashboard statistics
        updateDashboardStats();

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

        // Hide selected file section
        const selectedFileSection = document.getElementById('selectedFileSection');
        if (selectedFileSection) {
            selectedFileSection.style.display = 'none';
        }

        // Show drop zone again
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.style.display = 'block';
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
        // This function is no longer used since we reload history from server
        // We now reload the entire history after upload to keep it in sync
    }

    function loadUploadHistory() {
        fetch('/upload-history')
            .then(response => response.json())
            .then(uploads => {
                if (uploads.length === 0) {
                    return;
                }

                // Remove "no files" message
                const noFilesMsg = uploadHistory.querySelector('.text-center');
                if (noFilesMsg) {
                    noFilesMsg.remove();
                }

                // Add each upload to history
                uploads.forEach((upload, index) => {
                    const uploadItem = document.createElement('div');
                    uploadItem.className = 'upload-history-item';
                    uploadItem.style.animationDelay = `${index * 0.1}s`;

                    const uploadDate = upload.created_at ? new Date(upload.created_at).toLocaleString() : 'Unknown';
                    const relativeTime = upload.created_at ? getRelativeTime(new Date(upload.created_at)) : 'Unknown';

                    // Get file extension for icon
                    const fileName = upload.filename || '';
                    const extension = fileName.split('.').pop().toLowerCase();
                    const fileIcon = getFileIcon(extension);
                    const fileColor = getFileColor(extension);

                    uploadItem.innerHTML = `
                        <div class="upload-item-content">
                            <div class="file-icon-wrapper" style="background-color: ${fileColor};">
                                <i class="bi ${fileIcon}"></i>
                            </div>
                            <div class="file-details">
                                <h6 class="file-name">${sanitizeHtml(fileName)}</h6>
                                <div class="file-meta">
                                    <span class="meta-item">
                                        <i class="bi bi-clock"></i> ${relativeTime}
                                    </span>
                                    <span class="meta-item">
                                        <i class="bi bi-shield-check text-success"></i> Encrypted
                                    </span>
                                </div>
                            </div>
                            <div class="file-status">
                                ${upload.status === 'completed'
                                    ? '<span class="status-badge status-success"><i class="bi bi-check-circle-fill"></i> Completed</span>'
                                    : '<span class="status-badge status-pending"><i class="bi bi-clock-fill"></i> Pending</span>'}
                            </div>
                        </div>
                    `;

                    uploadHistory.appendChild(uploadItem);
                });
            })
            .catch(error => {
                console.error('Failed to load upload history:', error);
            });
    }

    // Helper function to get relative time
    function getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    // Helper function to get file icon based on extension
    function getFileIcon(extension) {
        const iconMap = {
            // Documents
            'pdf': 'bi-file-earmark-pdf-fill',
            'doc': 'bi-file-earmark-word-fill',
            'docx': 'bi-file-earmark-word-fill',
            'txt': 'bi-file-earmark-text-fill',
            'rtf': 'bi-file-earmark-text-fill',

            // Spreadsheets
            'xls': 'bi-file-earmark-excel-fill',
            'xlsx': 'bi-file-earmark-excel-fill',
            'csv': 'bi-file-earmark-excel-fill',

            // Presentations
            'ppt': 'bi-file-earmark-ppt-fill',
            'pptx': 'bi-file-earmark-ppt-fill',

            // Images
            'jpg': 'bi-file-earmark-image-fill',
            'jpeg': 'bi-file-earmark-image-fill',
            'png': 'bi-file-earmark-image-fill',
            'gif': 'bi-file-earmark-image-fill',
            'svg': 'bi-file-earmark-image-fill',

            // Archives
            'zip': 'bi-file-earmark-zip-fill',
            'rar': 'bi-file-earmark-zip-fill',
            '7z': 'bi-file-earmark-zip-fill',

            // Code
            'js': 'bi-file-earmark-code-fill',
            'html': 'bi-file-earmark-code-fill',
            'css': 'bi-file-earmark-code-fill',
            'py': 'bi-file-earmark-code-fill',
            'java': 'bi-file-earmark-code-fill',

            // Video
            'mp4': 'bi-file-earmark-play-fill',
            'avi': 'bi-file-earmark-play-fill',
            'mov': 'bi-file-earmark-play-fill',

            // Audio
            'mp3': 'bi-file-earmark-music-fill',
            'wav': 'bi-file-earmark-music-fill',
            'flac': 'bi-file-earmark-music-fill',
        };

        return iconMap[extension] || 'bi-file-earmark-fill';
    }

    // Helper function to get file color based on extension
    function getFileColor(extension) {
        const colorMap = {
            'pdf': 'rgba(220, 53, 69, 0.1)',
            'doc': 'rgba(13, 110, 253, 0.1)',
            'docx': 'rgba(13, 110, 253, 0.1)',
            'xls': 'rgba(25, 135, 84, 0.1)',
            'xlsx': 'rgba(25, 135, 84, 0.1)',
            'csv': 'rgba(25, 135, 84, 0.1)',
            'ppt': 'rgba(253, 126, 20, 0.1)',
            'pptx': 'rgba(253, 126, 20, 0.1)',
            'jpg': 'rgba(111, 66, 193, 0.1)',
            'jpeg': 'rgba(111, 66, 193, 0.1)',
            'png': 'rgba(111, 66, 193, 0.1)',
            'zip': 'rgba(108, 117, 125, 0.1)',
            'rar': 'rgba(108, 117, 125, 0.1)',
            'mp4': 'rgba(220, 53, 69, 0.1)',
            'mp3': 'rgba(13, 202, 240, 0.1)',
        };

        return colorMap[extension] || 'rgba(102, 126, 234, 0.1)';
    }

    // Update dashboard statistics
    function updateDashboardStats() {
        fetch('/upload-archive')
            .then(response => response.json())
            .then(uploads => {
                // Total files count
                const totalFilesCount = document.getElementById('totalFilesCount');
                if (totalFilesCount) {
                    totalFilesCount.textContent = uploads.length;
                }

                // Encrypted count (completed status)
                const encryptedCount = document.getElementById('encryptedCount');
                if (encryptedCount) {
                    const encrypted = uploads.filter(u => u.status === 'completed').length;
                    encryptedCount.textContent = encrypted;
                }

                // Storage size (calculate actual total from file sizes)
                const storageSize = document.getElementById('storageSize');
                if (storageSize) {
                    // Calculate total storage in bytes
                    const totalBytes = uploads.reduce((sum, upload) => sum + (upload.file_size || 0), 0);

                    // Format bytes to human-readable format
                    storageSize.textContent = formatFileSize(totalBytes);
                }

                // Last upload time
                const lastUploadTime = document.getElementById('lastUploadTime');
                if (lastUploadTime && uploads.length > 0) {
                    const latestUpload = uploads[0]; // Already sorted by created_at desc
                    if (latestUpload.created_at) {
                        const uploadDate = new Date(latestUpload.created_at);
                        const now = new Date();
                        const diffMinutes = Math.floor((now - uploadDate) / 60000);

                        if (diffMinutes < 1) {
                            lastUploadTime.textContent = 'Just now';
                        } else if (diffMinutes < 60) {
                            lastUploadTime.textContent = `${diffMinutes}m ago`;
                        } else if (diffMinutes < 1440) {
                            const hours = Math.floor(diffMinutes / 60);
                            lastUploadTime.textContent = `${hours}h ago`;
                        } else {
                            const days = Math.floor(diffMinutes / 1440);
                            lastUploadTime.textContent = `${days}d ago`;
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Failed to load dashboard stats:', error);
            });
    }

    // Handle "View All Uploads" button
    const viewAllUploadsBtn = document.getElementById('viewAllUploadsBtn');
    const allUploadsModal = new bootstrap.Modal(document.getElementById('allUploadsModal'), {
        backdrop: 'static', // Prevent closing on backdrop click
        keyboard: false // Prevent closing on ESC key
    });
    let uploadsDataTable = null;

    // Initialize confirmation modals
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const downloadConfirmModal = new bootstrap.Modal(document.getElementById('downloadConfirmModal'));
    const tamperDetectionModal = new bootstrap.Modal(document.getElementById('tamperDetectionModal'));

    // Store pending action data
    let pendingDeleteData = null;
    let pendingDownloadData = null;

    if (viewAllUploadsBtn) {
        viewAllUploadsBtn.addEventListener('click', function() {
            loadAllUploads();
        });
    }

    function loadAllUploads() {
        // Show modal
        allUploadsModal.show();

        // If DataTable already exists, destroy it first
        if (uploadsDataTable) {
            uploadsDataTable.destroy();
        }

        // Fetch all uploads
        fetch('/upload-archive')
            .then(response => response.json())
            .then(uploads => {
                // Prepare data for DataTables
                const tableData = uploads.map(upload => {
                    const uploadId = upload.upload_id || '';
                    const s3Key = upload.s3_key || '';
                    const fileSize = upload.file_size ? formatFileSize(upload.file_size) : 'N/A';

                    return [
                        upload.filename || 'N/A',
                        fileSize,
                        upload.status === 'completed'
                            ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Completed</span>'
                            : '<span class="badge bg-warning"><i class="bi bi-clock"></i> Pending</span>',
                        upload.created_at ? new Date(upload.created_at).toLocaleString() : 'N/A',
                        upload.completed_at ? new Date(upload.completed_at).toLocaleString() : 'N/A',
                        `<div class="action-buttons">
                            <button class="btn btn-sm btn-outline-success verify-btn" data-uploadid="${uploadId}" data-filename="${upload.filename}" title="Verify Integrity">
                                <i class="bi bi-shield-check"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary download-btn" data-s3key="${s3Key}" data-filename="${upload.filename}" title="Download">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-btn" data-uploadid="${uploadId}" data-filename="${upload.filename}" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>`
                    ];
                });

                // Initialize DataTable
                uploadsDataTable = $('#uploadsDataTable').DataTable({
                    data: tableData,
                    pageLength: 10,
                    lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
                    order: [[3, 'desc']], // Sort by upload date descending (column 3 now)
                    colReorder: true, // Enable column reordering
                    autoWidth: false, // Disable auto width for better resize control
                    responsive: {
                        details: {
                            type: 'column',
                            target: 'tr'
                        }
                    },
                    columnDefs: [
                        {
                            targets: -1, // Last column (Actions)
                            orderable: false, // Disable sorting
                            searchable: false, // Exclude from search
                            className: 'actions-column-cell'
                        },
                        {
                            targets: 1, // File Size column
                            className: 'text-end' // Right-align file sizes
                        },
                        {
                            targets: [3, 4], // Date columns
                            className: 'date-column'
                        }
                    ],
                    language: {
                        search: "_INPUT_",
                        searchPlaceholder: "Search uploads...",
                        lengthMenu: "Show _MENU_ entries",
                        info: "Showing _START_ to _END_ of _TOTAL_ uploads",
                        infoEmpty: "No uploads found",
                        infoFiltered: "(filtered from _MAX_ total uploads)",
                        zeroRecords: "No matching uploads found",
                        emptyTable: "No uploads available"
                    },
                    scrollX: true,
                    scrollCollapse: true,
                    dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                         '<"row"<"col-sm-12"tr>>' +
                         '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>'
                });

                // Add column resize functionality
                makeColumnsResizable($('#uploadsDataTable'));

                // Add click handlers for action buttons
                setupActionButtons();
            })
            .catch(error => {
                console.error('Failed to load upload archive:', error);
                window.toastManager.show('Error', 'Failed to load upload archive', 'error');
            });
    }

    // Setup click handlers for download and delete buttons
    function setupActionButtons() {
        // Verify/Tamper Detection button handler
        $('#uploadsDataTable').on('click', '.verify-btn', function() {
            const uploadId = $(this).data('uploadid');
            const filename = $(this).data('filename');
            const buttonElement = this;

            if (!uploadId) {
                window.toastManager.show('Error', 'Unable to verify file: Upload ID not found', 'error');
                return;
            }

            // Call tamper detection function
            verifyFileIntegrity(uploadId, filename, buttonElement);
        });

        // Download button handler
        $('#uploadsDataTable').on('click', '.download-btn', function() {
            const s3Key = $(this).data('s3key');
            const filename = $(this).data('filename');

            if (!s3Key) {
                window.toastManager.show('Error', 'Unable to download file: S3 key not found', 'error');
                return;
            }

            // Store pending download data
            pendingDownloadData = { s3Key, filename };

            // Update modal content
            document.getElementById('downloadFileName').textContent = filename;

            // Show download confirmation modal
            downloadConfirmModal.show();
        });

        // Delete button handler
        $('#uploadsDataTable').on('click', '.delete-btn', function() {
            const uploadId = $(this).data('uploadid');
            const filename = $(this).data('filename');

            if (!uploadId) {
                window.toastManager.show('Error', 'Unable to delete file: Upload ID not found', 'error');
                return;
            }

            // Store pending delete data
            pendingDeleteData = { uploadId, filename };

            // Update modal content
            document.getElementById('deleteFileName').textContent = filename;

            // Show delete confirmation modal
            deleteConfirmModal.show();
        });
    }

    // Handle delete confirmation
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        if (pendingDeleteData) {
            deleteConfirmModal.hide();
            deleteFile(pendingDeleteData.uploadId, pendingDeleteData.filename);
            pendingDeleteData = null;
        }
    });

    // Handle download confirmation
    document.getElementById('confirmDownloadBtn').addEventListener('click', function() {
        if (pendingDownloadData) {
            downloadConfirmModal.hide();
            downloadFile(pendingDownloadData.s3Key, pendingDownloadData.filename);
            pendingDownloadData = null;
        }
    });

    // Clear pending data when modals are closed
    document.getElementById('deleteConfirmModal').addEventListener('hidden.bs.modal', function() {
        pendingDeleteData = null;
    });

    document.getElementById('downloadConfirmModal').addEventListener('hidden.bs.modal', function() {
        pendingDownloadData = null;
    });

    // Download file function
    function downloadFile(s3Key, filename) {
        // Show loading modal
        showDownloadLoadingModal(filename);

        fetch(`/download/${encodeURIComponent(s3Key)}`)
            .then(async response => {
                // Check if response is not OK (error response)
                if (!response.ok) {
                    // Try to parse error message from JSON response
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();

                        // Create detailed error object
                        const error = new Error(errorData.error || 'Download failed');
                        error.errorType = errorData.error_type;
                        error.suggestion = errorData.suggestion;
                        error.isDetailedError = true;

                        throw error;
                    } else {
                        throw new Error('Download failed: Server error');
                    }
                }

                // Success - return blob for download
                return response.blob();
            })
            .then(blob => {
                // Hide loading modal
                hideDownloadLoadingModal();

                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                window.toastManager.show('Success', `${filename} downloaded successfully`, 'success');
            })
            .catch(error => {
                console.error('Download error:', error);

                // Hide loading modal
                hideDownloadLoadingModal();

                // Check if this is a detailed error from backend
                if (error.isDetailedError && error.errorType) {
                    // Build user-friendly toast message
                    let toastTitle = 'Download Failed';
                    let toastMessage = error.message;

                    // Add suggestion if available
                    if (error.suggestion) {
                        toastMessage += ` | ${error.suggestion}`;
                    }

                    // Show toast with detailed error
                    window.toastManager.show(toastTitle, toastMessage, 'error');
                } else {
                    // Generic error
                    const errorMessage = error.message || `Failed to download ${filename}`;
                    window.toastManager.show('Download Failed', errorMessage, 'error');
                }
            });
    }

    // Delete file function
    function deleteFile(uploadId, filename) {
        fetch(`/delete-upload/${encodeURIComponent(uploadId)}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.toastManager.show('Success', `${filename} deleted successfully`, 'success');

                    // Reload the uploads data
                    loadAllUploads();
                } else {
                    throw new Error(data.error || 'Delete failed');
                }
            })
            .catch(error => {
                console.error('Delete error:', error);
                window.toastManager.show('Error', `Failed to delete ${filename}`, 'error');
            });
    }

    // Verify file integrity function
    function verifyFileIntegrity(uploadId, filename, buttonElement) {
        // Show loading modal
        showVerificationLoadingModal(filename);

        // Disable the button and show loading state
        if (buttonElement) {
            buttonElement.disabled = true;
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="bi bi-hourglass-split spinner-icon"></i>';
            buttonElement.classList.add('btn-verifying');

            // Store original HTML to restore later
            buttonElement.dataset.originalHtml = originalHTML;
        }

        fetch(`/verify-file/${encodeURIComponent(uploadId)}`)
            .then(response => response.json())
            .then(data => {
                // Hide loading modal
                hideVerificationLoadingModal();

                // Re-enable button
                if (buttonElement) {
                    buttonElement.disabled = false;
                    buttonElement.innerHTML = buttonElement.dataset.originalHtml || '<i class="bi bi-shield-check"></i>';
                    buttonElement.classList.remove('btn-verifying');
                }

                if (data.error) {
                    throw new Error(data.error);
                }

                // Update modal with results
                displayTamperDetectionResult(data, filename);
            })
            .catch(error => {
                console.error('Verification error:', error);

                // Hide loading modal
                hideVerificationLoadingModal();

                // Re-enable button
                if (buttonElement) {
                    buttonElement.disabled = false;
                    buttonElement.innerHTML = buttonElement.dataset.originalHtml || '<i class="bi bi-shield-check"></i>';
                    buttonElement.classList.remove('btn-verifying');
                }

                window.toastManager.show('Error', `Failed to verify ${filename}`, 'error');
            });
    }

    // Display tamper detection results in modal
    function displayTamperDetectionResult(data, filename) {
        const modalHeader = document.getElementById('tamperModalHeader');
        const tamperIcon = document.getElementById('tamperIcon');
        const tamperStatus = document.getElementById('tamperStatus');
        const tamperFileName = document.getElementById('tamperFileName');
        const tamperOriginalHash = document.getElementById('tamperOriginalHash');
        const tamperCurrentHash = document.getElementById('tamperCurrentHash');
        const tamperDetails = document.getElementById('tamperDetails');

        tamperFileName.textContent = filename;
        tamperOriginalHash.textContent = data.original_hash || 'N/A';
        tamperCurrentHash.textContent = data.current_hash || 'N/A';

        if (data.tampered) {
            // File has been tampered with
            modalHeader.className = 'modal-header bg-danger text-white';
            tamperIcon.innerHTML = '<i class="bi bi-shield-exclamation text-danger" style="font-size: 4rem;"></i>';
            tamperStatus.innerHTML = '<span class="text-danger">⚠️ File Integrity Compromised</span>';
            tamperDetails.className = 'alert alert-danger mt-3';
            tamperDetails.innerHTML = `
                <strong><i class="bi bi-exclamation-triangle"></i> Warning:</strong> The file has been modified or tampered with.
                The current hash does not match the original hash stored during upload.
                Do not trust this file.
            `;
            window.toastManager.show('Tampered', `${filename} has been tampered with!`, 'error');
        } else {
            // File is intact
            modalHeader.className = 'modal-header bg-success text-white';
            tamperIcon.innerHTML = '<i class="bi bi-shield-check text-success" style="font-size: 4rem;"></i>';
            tamperStatus.innerHTML = '<span class="text-success">✓ File Integrity Verified</span>';
            tamperDetails.className = 'alert alert-success mt-3';
            tamperDetails.innerHTML = `
                <strong><i class="bi bi-check-circle"></i> Success:</strong> The file is intact and has not been tampered with.
                The current hash matches the original hash stored during upload.
                This file can be trusted.
            `;
            window.toastManager.show('Verified', `${filename} integrity verified successfully`, 'success');
        }

        // Show the modal
        tamperDetectionModal.show();
    }

    // Show verification loading modal
    function showVerificationLoadingModal(filename) {
        // Create loading modal HTML if it doesn't exist
        let loadingModal = document.getElementById('verificationLoadingModal');
        if (!loadingModal) {
            const modalHTML = `
                <div class="modal fade" id="verificationLoadingModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content verification-loading-content">
                            <div class="modal-body text-center p-4">
                                <div class="verification-loader mb-3">
                                    <div class="gears-container">
                                        <i class="bi bi-gear-fill gear-1"></i>
                                        <i class="bi bi-gear-fill gear-2"></i>
                                    </div>
                                </div>
                                <h5 class="mb-2">Verifying Integrity</h5>
                                <p class="text-muted mb-1 small" id="verifyingFileName"></p>
                                <div class="verification-stage mt-3">
                                    <div class="stage-indicator">
                                        <i class="bi bi-hourglass-split"></i>
                                        <span id="verificationStage">Please wait...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            loadingModal = document.getElementById('verificationLoadingModal');
        }

        // Update filename
        document.getElementById('verifyingFileName').textContent = filename;

        // Show modal
        const modal = new bootstrap.Modal(loadingModal);
        modal.show();
    }

    // Hide verification loading modal
    function hideVerificationLoadingModal() {
        const loadingModal = document.getElementById('verificationLoadingModal');
        if (loadingModal) {
            const modal = bootstrap.Modal.getInstance(loadingModal);
            if (modal) {
                modal.hide();
            }
        }
    }

    // Show download loading modal
    function showDownloadLoadingModal(filename) {
        // Create loading modal HTML if it doesn't exist
        let loadingModal = document.getElementById('downloadLoadingModal');
        if (!loadingModal) {
            const modalHTML = `
                <div class="modal fade" id="downloadLoadingModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content download-loading-content">
                            <div class="modal-body text-center p-4">
                                <div class="download-loader mb-3">
                                    <div class="gears-container">
                                        <i class="bi bi-gear-fill gear-1"></i>
                                        <i class="bi bi-gear-fill gear-2"></i>
                                    </div>
                                </div>
                                <h5 class="mb-2">Downloading File</h5>
                                <p class="text-muted mb-1 small" id="downloadingFileName"></p>
                                <div class="download-stage mt-3">
                                    <div class="stage-indicator">
                                        <i class="bi bi-cloud-download"></i>
                                        <span id="downloadStage">Please wait...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            loadingModal = document.getElementById('downloadLoadingModal');
        }

        // Update filename
        document.getElementById('downloadingFileName').textContent = filename;

        // Show modal
        const modal = new bootstrap.Modal(loadingModal);
        modal.show();
    }

    // Hide download loading modal
    function hideDownloadLoadingModal() {
        const loadingModal = document.getElementById('downloadLoadingModal');
        if (loadingModal) {
            const modal = bootstrap.Modal.getInstance(loadingModal);
            if (modal) {
                modal.hide();
            }
        }
    }

    // Function to make table columns resizable
    function makeColumnsResizable(table) {
        const thElm = table.find('thead th');
        let curCol, curColWidth, pageX, curColIndex;

        thElm.each(function(index) {
            const th = $(this);

            // Skip the Actions column (no resizing allowed)
            if (th.hasClass('actions-column')) {
                return;
            }

            // Create resize handle
            const resizer = $('<div class="column-resizer"></div>');
            th.append(resizer);

            resizer.on('mousedown', function(e) {
                curCol = th;
                curColIndex = index;
                pageX = e.pageX;
                curColWidth = th.outerWidth();

                // Add resizing class to show visual feedback
                th.addClass('column-resizing');

                // Prevent text selection during resize
                $(document).on('mousemove', onMouseMove);
                $(document).on('mouseup', onMouseUp);

                e.preventDefault();
            });
        });

        function onMouseMove(e) {
            if (curCol) {
                const diffX = e.pageX - pageX;
                const newWidth = curColWidth + diffX;

                // Set minimum width
                if (newWidth >= 80) {
                    curCol.outerWidth(newWidth);

                    // Also update corresponding body cells
                    const colIndex = curCol.index();
                    $('#uploadsDataTable tbody tr').each(function() {
                        $(this).find('td').eq(colIndex).css('width', newWidth + 'px');
                    });

                    // Trigger table redraw
                    if (uploadsDataTable) {
                        uploadsDataTable.columns.adjust();
                    }
                }
            }
        }

        function onMouseUp() {
            if (curCol) {
                curCol.removeClass('column-resizing');
            }
            curCol = undefined;
            pageX = undefined;
            curColWidth = undefined;
            curColIndex = undefined;
            $(document).off('mousemove', onMouseMove);
            $(document).off('mouseup', onMouseUp);
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (progressInterval) {
            clearInterval(progressInterval);
        }
    });
});