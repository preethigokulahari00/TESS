TESS (Tamper-proof Encrypted Secure Storage).

# Secure File Upload - Production-Ready Flask Application

A production-ready Flask web application that provides secure file upload functionality with AES-256 encryption, SHA-1 hashing, AWS S3 multipart upload, and AWS Secrets Manager integration.

## 🔒 Security Features

- **AES-256 Encryption**: Files are encrypted using military-grade AES-256-CBC encryption
- **SHA-1 File Hashing**: File integrity verification through SHA-1 hashing
- **AWS Secrets Manager**: Secure storage of file hashes and encryption keys
- **Multipart Upload**: Large files are split into chunks for reliable uploading
- **Session-based Authentication**: Secure user authentication using Flask-Login
- **Password Security**: Bcrypt hashing for password storage

## 🚀 Features

- **User Authentication**: Registration and login system with secure password hashing
- **File Upload Dashboard**: Clean, responsive interface for file uploads
- **Real-time Progress**: Live upload progress tracking with progress bars
- **Toast Notifications**: User-friendly success/error notifications
- **Responsive Design**: Mobile-friendly UI built with Bootstrap 5
- **Error Handling**: Comprehensive error handling and validation
- **Drag & Drop**: Support for drag-and-drop file uploads

## 🛠 Tech Stack

**Backend:**
- Flask 3.0.0
- SQLAlchemy (PostgreSQL)
- Flask-Login
- Boto3 (AWS SDK)
- Cryptography library
- Werkzeug

**Frontend:**
- Bootstrap 5
- JavaScript (ES6+)
- HTML5/CSS3
- Bootstrap Icons

**Infrastructure:**
- PostgreSQL Database
- AWS S3
- AWS Secrets Manager

## 📁 Project Structure

```
secure-file-upload/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── README.md             # This file
├── templates/            # Jinja2 templates
│   ├── base.html         # Base template
│   ├── login.html        # Login page
│   ├── register.html     # Registration page
│   ├── home.html         # File upload dashboard
│   ├── 404.html          # 404 error page
│   └── 500.html          # 500 error page
└── static/               # Static assets
    ├── css/
    │   └── style.css     # Custom styles
    └── js/
        ├── main.js       # Main JavaScript functions
        └── upload.js     # Upload functionality
```

## ⚙️ Setup Instructions

### Prerequisites

- Python 3.8+
- PostgreSQL
- AWS Account with S3 and Secrets Manager access
- pip package manager

### 1. Clone and Setup Virtual Environment

```bash
# Clone the repository (if using git)
git clone <repository-url>
cd secure-file-upload

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Install PostgreSQL and create database
createdb secure_upload_db

# Or using PostgreSQL command line:
psql -U postgres
CREATE DATABASE secure_upload_db;
\q
```

### 3. AWS Configuration

#### S3 Bucket Setup
1. Create an S3 bucket in AWS Console
2. Configure bucket permissions for your AWS user
3. Note the bucket name for environment variables

#### AWS Secrets Manager Setup
1. Ensure your AWS user has permissions for Secrets Manager
2. The application will automatically create secrets for file hashes and encryption keys

#### IAM Permissions
Your AWS user needs the following permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:CreateSecret",
                "secretsmanager:GetSecretValue",
                "secretsmanager:PutSecretValue"
            ],
            "Resource": "*"
        }
    ]
}
```

### 4. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
```

Update `.env` with your settings:

```bash
# Generate a secure secret key
SECRET_KEY=your-generated-secret-key-32-characters

# Database configuration
DATABASE_URL=postgresql://username:password@localhost:5432/secure_upload_db

# AWS configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

### 5. Initialize Database

```bash
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

### 6. Run the Application

```bash
# Development mode
python app.py

# Production mode (using gunicorn)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

The application will be available at `http://localhost:5000`

## 📋 Usage

### 1. User Registration
- Navigate to `/register`
- Create an account with username, email, and password
- Passwords are securely hashed using bcrypt

### 2. Login
- Use your credentials to log in at `/login`
- Session-based authentication keeps you logged in

### 3. File Upload
- Access the dashboard at `/home`
- Select files using the file input or drag-and-drop
- Files are automatically:
  - Validated for size (max 500MB)
  - Hashed using SHA-1
  - Encrypted with AES-256
  - Split into 5MB chunks
  - Uploaded to S3 with multipart upload
  - Keys stored securely in AWS Secrets Manager

### 4. Upload Progress
- Real-time progress tracking with visual progress bar
- Status updates throughout the upload process
- Success/error notifications via toast messages

## 🔧 Configuration Options

### File Upload Limits
- Maximum file size: 500MB (configurable in `app.py`)
- Chunk size: 5MB (configurable for multipart upload)

### Security Settings
- Session timeout: Browser session (configurable)
- Password minimum length: 8 characters
- Username length: 3-80 characters

### AWS Settings
- Default region: us-east-1
- S3 storage class: Standard
- Secrets Manager: Automatic secret naming

## 🚦 API Endpoints

| Endpoint | Method | Description | Authentication |
|----------|---------|-------------|----------------|
| `/` | GET | Redirect to login/home | - |
| `/login` | GET, POST | User login | - |
| `/register` | GET, POST | User registration | - |
| `/logout` | GET | User logout | Required |
| `/home` | GET | File upload dashboard | Required |
| `/upload` | POST | File upload endpoint | Required |
| `/upload-progress/<id>` | GET | Upload progress tracking | Required |

## 🛡 Security Considerations

### Implemented Security Measures
- CSRF protection via Flask's built-in features
- SQL injection prevention through SQLAlchemy ORM
- XSS protection through Jinja2 template escaping
- Secure file handling with validation
- Encrypted storage of sensitive data
- Secure secret management

### Additional Recommendations
- Use HTTPS in production
- Implement rate limiting
- Add file type validation
- Use Content Security Policy (CSP)
- Regular security audits
- Monitor AWS CloudTrail logs

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Error
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Verify database exists
psql -l | grep secure_upload_db
```

#### AWS Authentication Error
```bash
# Verify AWS credentials
aws configure list

# Test S3 access
aws s3 ls s3://your-bucket-name
```

#### File Upload Failures
- Check file size limits
- Verify S3 bucket permissions
- Check AWS Secrets Manager permissions
- Review application logs

### Error Logs
Application errors are logged to console in development mode. For production, configure proper logging:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

## 🔄 Development

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests
pytest
```

### Code Style
```bash
# Install formatting tools
pip install black flake8

# Format code
black app.py

# Check style
flake8 app.py
```

## 🚀 Deployment

### Production Checklist
- [ ] Set `FLASK_ENV=production`
- [ ] Use strong `SECRET_KEY`
- [ ] Configure HTTPS
- [ ] Set up proper logging
- [ ] Use production database
- [ ] Configure reverse proxy (nginx)
- [ ] Set up monitoring
- [ ] Regular backups

### Docker Deployment
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check this README
2. Review error logs
3. Check AWS service status
4. Open an issue with detailed information

## 🔮 Future Enhancements

- [ ] File download/decryption functionality
- [ ] User file management dashboard
- [ ] File sharing capabilities
- [ ] Advanced file type validation
- [ ] Audit logging
- [ ] Multi-factor authentication
- [ ] File versioning
- [ ] Bulk upload operations