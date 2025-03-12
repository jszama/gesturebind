from GestureDetector import GestureDetector
import kagglehub
import os
import pandas as pd
import cv2
from sklearn.metrics import accuracy_score, confusion_matrix
import seaborn as sns
import matplotlib.pyplot as plt
import shutil

def process_image(item):
    """
    Process a single image and return the label and the number of fingers detected.
    """
    image_path, label, detector = item
    img = cv2.imread(image_path)
    num_fingers = detector.detect_gesture(img)
    return label, num_fingers

def test_on_dataset(detector, batch_size=32):
    """
    Test the gesture detector on the dataset using batch processing.
    """
    # Create a DataFrame with image paths and ground truth labels
    image_folder = "test_images"
    data = []
    for image_name in os.listdir(image_folder):
        if image_name.endswith(".jpg") or image_name.endswith(".png"):
            image_path = os.path.join(image_folder, image_name)
            label = int(image_name[-6])  # Extract label from filename
            data.append((image_path, label, detector))

    ground_truth = []
    predictions = []

    # Process images in batches
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        for item in batch:
            label, num_fingers = process_image(item)
            ground_truth.append(label)
            predictions.append(num_fingers)
        print(f"Processed {min(i + batch_size, len(data))}/{len(data)} images")

    return ground_truth, predictions

def evaluate_performance(ground_truth, predictions):
    """
    Evaluate the performance of the gesture detector using accuracy and confusion matrix.
    """
    # Calculate accuracy
    accuracy = accuracy_score(ground_truth, predictions)
    print(f"Accuracy: {accuracy * 100:.2f}%")

    # Generate confusion matrix
    cm = confusion_matrix(ground_truth, predictions)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
    plt.xlabel('Predicted')
    plt.ylabel('Actual')
    plt.title('Confusion Matrix')
    plt.savefig('test_results/confusion_matrix.png')
    
def download_dataset_if_not_present():
    """
    If the dataset is not present, download it from Kaggle.
    """
    if "test_images" not in os.listdir():
        print("Downloading test dataset from Kaggle...")
        path = kagglehub.dataset_download("koryakinp/fingers")
        shutil.move(path + "/test", "test_images")
        shutil.rmtree(path)
    
if __name__ == '__main__':
    download_dataset_if_not_present()
    detector = GestureDetector(0.5, 0.5)
    print("Testing on dataset")
    ground_truth, predictions = test_on_dataset(detector)
    evaluate_performance(ground_truth, predictions)