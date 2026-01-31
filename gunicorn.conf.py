# Gunicorn configuration file for production deployment

import os
import multiprocessing

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50

# Timeout settings - CRITICAL for large file operations
timeout = 300  # 5 minutes (increased from default 30 seconds)
graceful_timeout = 300  # 5 minutes for graceful worker restart
keepalive = 5  # Keep connections alive for 5 seconds

# Logging
accesslog = '-'  # Log to stdout
errorlog = '-'   # Log to stderr
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'secure_upload_app'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (if needed in future)
# keyfile = None
# certfile = None

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190
