import mediapipe as mp
import cv2

class GestureDetector:
    def __init__(self, min_detection_confidence=0.9, min_tracking_confidence=0.9):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(min_detection_confidence=min_detection_confidence, min_tracking_confidence=min_tracking_confidence)
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

    def detect_gesture(self, img):
        img_resized = cv2.resize(img, (320, 240))
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        results = self.hands.process(img_rgb)
        num_fingers = 0

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # draw hand landmarks on the image
                self.mp_drawing.draw_landmarks(
                    img_resized,
                    hand_landmarks,
                    self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing_styles.get_default_hand_landmarks_style(),
                    self.mp_drawing_styles.get_default_hand_connections_style())

                wrist = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]
                thumb_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_TIP]
                thumb_ip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_IP]
                thumb_mcp = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_MCP]
                index_mcp = hand_landmarks.landmark[self.mp_hands.HandLandmark.INDEX_FINGER_MCP]
                
                palm_facing_camera = wrist.x < index_mcp.x
                
                if palm_facing_camera:
                    if thumb_tip.x > thumb_ip.x and thumb_tip.y < thumb_mcp.y and thumb_tip.y < wrist.y:
                        num_fingers += 1
                else:
                    if thumb_tip.x < thumb_ip.x and thumb_tip.y < thumb_mcp.y and thumb_tip.y < wrist.y:
                        num_fingers += 1

                for finger_tip, finger_pip in [
                    (self.mp_hands.HandLandmark.INDEX_FINGER_TIP, self.mp_hands.HandLandmark.INDEX_FINGER_PIP),
                    (self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP, self.mp_hands.HandLandmark.MIDDLE_FINGER_PIP),
                    (self.mp_hands.HandLandmark.RING_FINGER_TIP, self.mp_hands.HandLandmark.RING_FINGER_PIP),
                    (self.mp_hands.HandLandmark.PINKY_TIP, self.mp_hands.HandLandmark.PINKY_PIP)
                    ]:
                    
                    if hand_landmarks.landmark[finger_tip].y < hand_landmarks.landmark[finger_pip].y:
                        num_fingers += 1

        return num_fingers if num_fingers <= 5 else 0
