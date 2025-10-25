import os
import hashlib
import secrets
from io import BytesIO
from threading import Thread
import json
from datetime import datetime
from bson import ObjectId
import logging
import traceback

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_pymongo import PyMongo
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
import pymongo

load_dotenv()

# Configure logging (console only)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler()  # Console output only
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['MONGO_URI'] = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/secure_upload_db')
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Initialize MongoDB with connection pooling and optimized timeouts
app.config['MONGO_CONNECT_TIMEOUT_MS'] = 5000  # 5 seconds timeout
app.config['MONGO_SERVER_SELECTION_TIMEOUT_MS'] = 5000  # 5 seconds timeout
app.config['MONGO_MAX_POOL_SIZE'] = 10  # Connection pool for better performance
app.config['MONGO_MIN_POOL_SIZE'] = 2  # Keep 2 connections ready

mongo = PyMongo(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

# AWS Configuration
aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
aws_region = os.environ.get('AWS_REGION', 'us-east-1')
s3_bucket = os.environ.get('S3_BUCKET_NAME')

# Initialize AWS clients with optimized config
from botocore.config import Config

boto_config = Config(
    region_name=aws_region,
    connect_timeout=5,  # 5 seconds connection timeout
    read_timeout=60,    # 60 seconds read timeout
    retries={'max_attempts': 2, 'mode': 'standard'},  # Reduce retry attempts
    max_pool_connections=10  # Connection pooling
)

s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    config=boto_config
) if aws_access_key and aws_secret_key else None


# Global dictionary to store upload progress
upload_progress = {}

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.username = user_data['username']
        self.email = user_data['email']
        self.password_hash = user_data.get('password_hash')
        self.created_at = user_data.get('created_at', datetime.utcnow())

    @staticmethod
    def find_by_username(username):
        user_data = mongo.db.users.find_one({'username': username})
        return User(user_data) if user_data else None

    @staticmethod
    def find_by_email(email):
        user_data = mongo.db.users.find_one({'email': email})
        return User(user_data) if user_data else None

    @staticmethod
    def find_by_id(user_id):
        try:
            user_data = mongo.db.users.find_one({'_id': ObjectId(user_id)})
            return User(user_data) if user_data else None
        except Exception as e:
            logger.error(f"Error finding user by ID: {user_id} - {type(e).__name__}: {str(e)}")
            return None

    @staticmethod
    def create_user(username, email, password):
        user_data = {
            'username': username,
            'email': email,
            'password_hash': generate_password_hash(password),
            'created_at': datetime.utcnow()
        }
        result = mongo.db.users.insert_one(user_data)
        user_data['_id'] = result.inserted_id
        return User(user_data)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login_manager.user_loader
def load_user(user_id):
    return User.find_by_id(user_id)

def compute_sha1(file_data):
    """Compute SHA-1 hash of file data."""
    sha1_hash = hashlib.sha1()
    sha1_hash.update(file_data)
    return sha1_hash.hexdigest()

def encrypt_chunk(data, key, iv):
    """Encrypt data chunk using AES-256-CBC."""
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    # Pad data to be multiple of 16 bytes (AES block size)
    padding_length = 16 - (len(data) % 16)
    padded_data = data + bytes([padding_length]) * padding_length

    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    return encrypted_data

def upload_file_to_s3(file_data, filename, upload_id, user_id):
    """Upload file to S3 with multipart upload and encryption."""
    try:
        logger.info(f"Starting upload - User: {user_id}, File: {filename}, Upload ID: {upload_id}, Size: {len(file_data)} bytes")

        if not s3_client or not s3_bucket:
            error_msg = "AWS S3 not configured"
            logger.error(f"Upload failed - {error_msg} - User: {user_id}, File: {filename}, Upload ID: {upload_id}")
            upload_progress[upload_id]['status'] = 'error'
            upload_progress[upload_id]['message'] = error_msg
            return False

        file_hash = compute_sha1(file_data)

        # Generate encryption key and IV
        encryption_key = secrets.token_bytes(32)  # 256-bit key

        # Prepare for multipart upload
        # Split filename into name and extension, insert token before extension
        secure_name = secure_filename(filename)
        name_parts = os.path.splitext(secure_name)
        if name_parts[1]:  # Has extension
            key_name = f"uploads/{name_parts[0]}-{secrets.token_hex(8)}{name_parts[1]}"
        else:  # No extension
            key_name = f"uploads/{secure_name}-{secrets.token_hex(8)}"

        # Initialize multipart upload
        multipart_upload = s3_client.create_multipart_upload(
            Bucket=s3_bucket,
            Key=key_name,
            Metadata={
                'original_filename': filename
            }
        )
        upload_id_s3 = multipart_upload['UploadId']

        # Split file into chunks (5MB each)
        chunk_size = 5 * 1024 * 1024  # 5MB
        total_size = len(file_data)
        total_chunks = (total_size + chunk_size - 1) // chunk_size

        parts = []

        for chunk_num in range(total_chunks):
            start = chunk_num * chunk_size
            end = min(start + chunk_size, total_size)
            chunk_data = file_data[start:end]

            # Generate IV for this chunk
            iv = secrets.token_bytes(16)
        
            # Encrypt chunk
            encrypted_chunk = encrypt_chunk(chunk_data, encryption_key, iv)

            # Prepend IV to encrypted data
            chunk_with_iv = iv + encrypted_chunk

            # Upload part
            part_response = s3_client.upload_part(
                Bucket=s3_bucket,
                Key=key_name,
                PartNumber=chunk_num + 1,
                UploadId=upload_id_s3,
                Body=chunk_with_iv
            )

            parts.append({
                'ETag': part_response['ETag'],
                'PartNumber': chunk_num + 1
            })

            # Update progress
            progress = int(((chunk_num + 1) / total_chunks) * 100)
            upload_progress[upload_id]['progress'] = progress

            # Log chunk upload progress
            logger.info(f"------Uploaded chunk {chunk_num + 1}/{total_chunks} ({progress}%) - Upload ID: {upload_id}, Chunk size: {len(chunk_with_iv)} bytes------")

        # Complete multipart upload
        s3_client.complete_multipart_upload(
            Bucket=s3_bucket,
            Key=key_name,
            UploadId=upload_id_s3,
            MultipartUpload={'Parts': parts}
        )

        # Insert successful upload record in MongoDB
        upload_record = {
            'user_id': ObjectId(user_id),
            'filename': filename,
            'file_hash': file_hash,
            'upload_id': upload_id,
            'status': 'completed',
            's3_key': key_name,
            'encryption_key': encryption_key,
            'created_at': datetime.utcnow(),
            'completed_at': datetime.utcnow()
        }
        mongo.db.uploads.insert_one(upload_record)

        upload_progress[upload_id]['status'] = 'completed'
        upload_progress[upload_id]['progress'] = 100
        upload_progress[upload_id]['s3_key'] = key_name
        upload_progress[upload_id]['file_hash'] = file_hash
        upload_progress[upload_id]['encryption_key'] = encryption_key

        logger.info(f"Upload completed successfully - User: {user_id}, File: {filename}, Upload ID: {upload_id}, S3 Key: {key_name}, Hash: {file_hash}")

        return True

    except Exception as e:
        # Log detailed error with stack trace
        logger.error(
            f"Upload failed with exception - User: {user_id}, File: {filename}, Upload ID: {upload_id}\n"
            f"Error Type: {type(e).__name__}\n"
            f"Error Message: {str(e)}\n"
            f"Stack Trace:\n{traceback.format_exc()}"
        )

        # Update in-memory progress only (don't store failed uploads in MongoDB)
        upload_progress[upload_id]['status'] = 'error'
        upload_progress[upload_id]['message'] = str(e)

        return False

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        # Check if user exists
        if User.find_by_username(username):
            logger.warning(f"Registration attempt with existing username: {username}, IP: {request.remote_addr}")
            flash('Username already exists')
            return render_template('register.html')

        if User.find_by_email(email):
            logger.warning(f"Registration attempt with existing email: {email}, IP: {request.remote_addr}")
            flash('Email already registered')
            return render_template('register.html')

        # Create new user
        try:
            User.create_user(username, email, password)
            logger.info(f"New user registered - Username: {username}, Email: {email}, IP: {request.remote_addr}")
            flash('Registration successful')
            return redirect(url_for('login'))
        except Exception as e:
            logger.error(f"Registration failed - Username: {username}, Email: {email}\nError: {str(e)}\n{traceback.format_exc()}")
            flash('Registration failed. Please try again.')
            return render_template('register.html')

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.find_by_username(username)

        if user and user.check_password(password):
            login_user(user)
            logger.info(f"Successful login - User: {username}, IP: {request.remote_addr}")
            return redirect(url_for('home'))
        else:
            logger.warning(f"Failed login attempt - Username: {username}, IP: {request.remote_addr}")
            flash('Invalid username or password')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/home')
@login_required
def home():
    return render_template('home.html')

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    try:
        if 'file' not in request.files:
            logger.warning(f"Upload attempt with no file - User: {current_user.username}")
            return jsonify({'error': 'No file selected'}), 400

        file = request.files['file']
        if file.filename == '':
            logger.warning(f"Upload attempt with empty filename - User: {current_user.username}")
            return jsonify({'error': 'No file selected'}), 400

        # Generate unique upload ID
        upload_id = secrets.token_hex(16)
        upload_progress[upload_id] = {
            'status': 'starting',
            'progress': 0,
            'filename': file.filename
        }

        logger.info(f"Upload initiated - User: {current_user.username}, File: {file.filename}, Upload ID: {upload_id}")

        # Read file data
        file_data = file.read()

        # Start upload in background thread
        thread = Thread(target=upload_file_to_s3, args=(file_data, file.filename, upload_id, current_user.id))
        thread.start()

        return jsonify({'upload_id': upload_id})

    except Exception as e:
        logger.error(
            f"Error in upload route - User: {current_user.username}\n"
            f"Error: {type(e).__name__}: {str(e)}\n"
            f"Stack Trace:\n{traceback.format_exc()}"
        )
        return jsonify({'error': 'An error occurred during upload'}), 500

@app.route('/upload-progress/<upload_id>')
@login_required
def get_upload_progress(upload_id):
    if upload_id not in upload_progress:
        return jsonify({'error': 'Upload not found'}), 404

    return jsonify(upload_progress[upload_id])

@app.route('/upload-history')
@login_required
def upload_history():
    """Get user's upload history from MongoDB"""
    uploads = mongo.db.uploads.find({
        'user_id': ObjectId(current_user.id)
    }).sort('created_at', -1).limit(10)

    upload_list = []
    for upload in uploads:
        upload_list.append({
            'filename': upload.get('filename'),
            'status': upload.get('status'),
            'created_at': upload.get('created_at'),
            'file_hash': upload.get('file_hash')
        })

    return jsonify(upload_list)

@app.route('/health')
def health_check():
    """Health check endpoint to verify service status"""
    health_status = {
        'status': 'healthy',
        'mongodb': 'unknown',
        's3': 'unknown',
        'timestamp': datetime.utcnow().isoformat()
    }

    # Check MongoDB
    try:
        mongo.db.command('ping', maxTimeMS=1000)
        health_status['mongodb'] = 'connected'
    except Exception as e:
        health_status['mongodb'] = f'error: {str(e)}'
        health_status['status'] = 'degraded'

    # Check S3
    if s3_client and s3_bucket:
        health_status['s3'] = 'configured'
    else:
        health_status['s3'] = 'not configured'

    return jsonify(health_status), 200 if health_status['status'] == 'healthy' else 503

@app.errorhandler(404)
def not_found(error):
    logger.warning(f"404 Not Found - Path: {request.path}, Method: {request.method}, IP: {request.remote_addr}")
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(
        f"500 Internal Server Error - Path: {request.path}, Method: {request.method}, "
        f"User: {current_user.username if current_user.is_authenticated else 'Anonymous'}\n"
        f"Error: {str(error)}\n"
        f"Stack Trace:\n{traceback.format_exc()}"
    )
    return render_template('500.html'), 500

def test_mongodb_connection():
    """Test MongoDB connection with timeout"""
    try:
        # Test connection with short timeout
        mongo.db.command('ping', maxTimeMS=3000)
        logger.info("MongoDB connection successful!")
        return True
    except Exception as e:
        logger.error(f"MongoDB connection failed: {type(e).__name__}: {str(e)}")
        return False

if __name__ == '__main__':
    import time
    start_time = time.time()

    try:
        logger.info("Starting Flask application...")

        # Test MongoDB connection on startup for immediate feedback
        if test_mongodb_connection():
            logger.info("MongoDB connection successful and ready!")
        else:
            logger.warning("MongoDB connection failed. Application will start but database operations may fail.")

        startup_time = time.time() - start_time
        logger.info(f"Application started in {startup_time:.2f} seconds")
        logger.info(f"Starting Flask app on http://localhost:5000")

        app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=True, threaded=True)
    except Exception as e:
        logger.critical(f"Error starting application: {type(e).__name__}: {str(e)}\n{traceback.format_exc()}")
        logger.critical("Please check your configuration in the .env file")