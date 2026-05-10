#!/bin/bash

# Backend Setup Script
# ====================
# Installs all Python dependencies for the Flask backend with feature drift detection

echo "🔧 Setting up Flask backend..."

# Create virtual environment (optional but recommended)
python -m venv venv

# Activate virtual environment
# Windows:
# venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install flask==2.3.0
pip install flask-cors==4.0.0
pip install torch==2.0.0
pip install torchvision==0.15.0
pip install timm==0.9.0
pip install opencv-python==4.7.0
pip install numpy==1.24.0
pip install scipy==1.10.0
pip install scikit-learn==1.2.0
pip install Pillow==9.5.0

# For production deployment (optional):
pip install gunicorn==20.1.0

echo "✅ Backend dependencies installed!"
echo ""
echo "📋 Next steps:"
echo "1. Update the MODEL_PATH in app.py to your model location"
echo "2. Verify model checkpoint exists at:"
echo "   C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"
echo "3. Test backend health:"
echo "   python app.py"
echo "4. Navigate to http://localhost:5000/health in your browser"
