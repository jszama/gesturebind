
import base64
import cv2
from flask import Flask, request, jsonify
import numpy as np
from waitress import serve

from GestureDetector import GestureDetector
from PackageInstaller import PackageInstaller

@app.route('/process-frame', methods=['POST'])
def process_frame():
    print("Processing frame")
    data = request.json
    img_data = base64.b64decode(data['image'].split(',')[1])
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    gesture = gesture_detector.detect_gesture(img)
    return jsonify({'gesture': gesture})

if __name__ == '__main__':
    app = Flask(__name__)

    package_installer = PackageInstaller(['flask', 'opencv-python', 'numpy', 'setuptools', 'wheel', 'waitress', 'mediapipe'])
    package_installer.install_missing_packages()
    
    if environment == 'test':
        gesture_detector = GestureDetector(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    else:
        gesture_detector = GestureDetector()
        
    serve(app, host='127.0.0.1', port=5000)
