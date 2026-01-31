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
                uploads.forEach(upload => {
                    const uploadItem = document.createElement('div');
                    uploadItem.className = 'list-group-item';

                    const uploadDate = upload.created_at ? new Date(upload.created_at).toLocaleString() : 'Unknown';
                    const statusBadge = upload.status === 'completed'
                        ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i></span>'
                        : '<span class="badge bg-warning"><i class="bi bi-clock"></i></span>';

                    uploadItem.innerHTML = `
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="mb-1">
                                    <i class="bi bi-file-earmark-check text-success"></i>
                                    ${sanitizeHtml(upload.filename)}
                                </h6>
                                <p class="mb-1 small text-muted">
                                    Uploaded: ${uploadDate}
                                </p>
                                <small class="text-success">
                                    <i class="bi bi-shield-check"></i> Encrypted and stored securely
                                </small>
                            </div>
                            ${statusBadge}
                        </div>
                    `;

                    uploadHistory.appendChild(uploadItem);
                });
            })
            .catch(error => {
                console.error('Failed to load upload history:', error);
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

                    return [
                        upload.filename || 'N/A',
                        upload.status === 'completed'
                            ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Completed</span>'
                            : '<span class="badge bg-warning"><i class="bi bi-clock"></i> Pending</span>',
                        upload.created_at ? new Date(upload.created_at).toLocaleString() : 'N/A',
                        upload.completed_at ? new Date(upload.completed_at).toLocaleString() : 'N/A',
                        upload.file_hash
                            ? `<code class="small">${upload.file_hash}</code>`
                            : 'N/A',
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
                    order: [[2, 'desc']], // Sort by upload date descending
                    colReorder: true, // Enable column reordering
                    autoWidth: false, // Disable auto width for better resize control
                    columnDefs: [
                        {
                            targets: -1, // Last column (Actions)
                            orderable: false, // Disable sorting
                            searchable: false // Exclude from search
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
                    scrollX: false,
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

            if (!uploadId) {
                window.toastManager.show('Error', 'Unable to verify file: Upload ID not found', 'error');
                return;
            }

            // Call tamper detection function
            verifyFileIntegrity(uploadId, filename);
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
        window.toastManager.show('Downloading', `Starting download for ${filename}...`, 'info');

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
    function verifyFileIntegrity(uploadId, filename) {
        // Show loading toast
        window.toastManager.show('Verifying', `Checking integrity of ${filename}...`, 'info');

        fetch(`/verify-file/${encodeURIComponent(uploadId)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }

                // Update modal with results
                displayTamperDetectionResult(data, filename);
            })
            .catch(error => {
                console.error('Verification error:', error);
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