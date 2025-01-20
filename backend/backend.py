import subprocess
import sys
import ensurepip

pip_installed = False

while not pip_installed:
    try:
        __import__('pip')
        print("pip is already installed.")
        pip_installed = True
    except ImportError:
        print("pip is not installed. Installing pip...")
        try:
            ensurepip.bootstrap()
            print("pip installed successfully.")
            pip_installed = True
        except Exception as e:
            print(f"Failed to install pip: {e}")
            sys.exit(1)

required_packages = ['flask', 'opencv-python', 'numpy', 'setuptools', 'wheel', 'waitress', 'mediapipe']

def install_package(package):
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
        print(f"Successfully installed {package}")
    except subprocess.CalledProcessError as e:
        print(f"Failed to install {package}: {e}")
        sys.exit(1)

for package in required_packages:
    try:
        __import__(package)
        print(f"'{package}' is already installed.")
    except ImportError:
        print(f"'{package}' is not installed. Installing it now...")
        install_package(package)

import base64
import cv2
from flask import Flask, request, jsonify
import numpy as np
import mediapipe as mp
from waitress import serve

app = Flask(__name__)

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands = mp_hands.Hands(min_detection_confidence=0.9, min_tracking_confidence=0.9)

def detect_gesture(img):
    height, width, _ = img.shape
    img_resized = cv2.resize(img, (640, 480))

    results = hands.process(cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB))

    num_fingers = 0
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            wrist = hand_landmarks.landmark[mp_hands.HandLandmark.WRIST]
            thumb_tip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]
            thumb_ip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_IP]
            thumb_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_MCP]
            index_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_MCP]
            
            palm_facing_camera = wrist.x < index_mcp.x
            
            if palm_facing_camera:
                if thumb_tip.x > thumb_ip.x and thumb_tip.y < wrist.y:
                    num_fingers += 1
            else:
                if thumb_tip.x < thumb_ip.x and thumb_tip.y < wrist.y:
                    num_fingers += 1

            for finger_tip, finger_pip in [
                (mp_hands.HandLandmark.INDEX_FINGER_TIP, mp_hands.HandLandmark.INDEX_FINGER_PIP),
                (mp_hands.HandLandmark.MIDDLE_FINGER_TIP, mp_hands.HandLandmark.MIDDLE_FINGER_PIP),
                (mp_hands.HandLandmark.RING_FINGER_TIP, mp_hands.HandLandmark.RING_FINGER_PIP),
                (mp_hands.HandLandmark.PINKY_TIP, mp_hands.HandLandmark.PINKY_PIP)
                ]:
                
                if hand_landmarks.landmark[finger_tip].y < hand_landmarks.landmark[finger_pip].y:
                    num_fingers += 1

    return num_fingers if num_fingers <= 5 else 0

@app.route('/process-frame', methods=['POST'])
def process_frame():
    print("Processing frame")
    data = request.json
    img_data = base64.b64decode(data['image'].split(',')[1])
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    gesture = detect_gesture(img)
    return jsonify({'gesture': gesture})

if __name__ == '__main__':
    serve(app, host='127.0.0.1', port=5000)
