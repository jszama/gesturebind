const { ipcRenderer } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');
const { shell } = require('electron');

const selectMenu = document.getElementById('webcamSelect');
const gestureBox = document.getElementById('gestureBox');

let commands = {}

let videoFeed = '';

function loadButtons() {
    const addGestureButton = document.createElement('button');
    addGestureButton.id = 'addGestureButton';
    addGestureButton.addEventListener('click', () => {
        ipcRenderer.send('open-popup');
    });
    addGestureButton.className = 'flex justify-center items-center p-2 bg-green-400 h-16 w-16 rounded-lg font-bold text-2xl cursor-pointer';
    addGestureButton.textContent = '+';

    gestureBox.appendChild(addGestureButton);

    fs.readFile('./user/binds.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }
    
        const lines = data.split('\n');
        lines.forEach(line => {
            if (line) {
                const [gesture, description, action] = line.split(';');
                commands[gesture] = action;
                createGestureButton(description, gesture);
            }
        });
    });
}

function clearButtons() {
    console.log("clearing buttons")
    gestureBox.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    loadButtons();

    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const videoInputSources = devices.filter(device => device.kind === 'videoinput');
            videoInputSources.forEach(source => {
                const option = document.createElement('option');
                option.value = source.deviceId;
                option.text = source.label;
                selectMenu.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error retrieving video input sources:', error);
        });
});

function handleSelectMenuChange() {
    if (selectMenu.selectedIndex === 0) {
        return;
    }

    const selectedDeviceId = selectMenu.value;
    const infoText = document.getElementById('infoText');
    infoText.textContent = `Waiting for gesture...`;
    
    const constraints = {
        video: { deviceId: selectedDeviceId, width: { ideal: 1920 }, height: { ideal: 1080 } }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            const videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.autoplay = true;
            let canvasElement; 
            
            videoElement.onloadedmetadata = () => {
                let isGestureDetected = false;

                setInterval(() => {
                    canvasElement = document.getElementById('webcam');
                    const canvasContext = canvasElement.getContext('2d');
            
                    canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                }, 1000 / 60);

                setInterval(() => {
                    if (isGestureDetected) return;

                    const dataUrl = canvasElement.toDataURL('image/jpeg');
                    fetch('http://127.0.0.1:5000/process-frame', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ image: dataUrl })
                    }).then(response => response.json())
                        .then(data => {
                            if (data.gesture) {
                                infoText.textContent = `Detected gesture: ${data.gesture} fingers`;
                                if (commands[data.gesture]) {
                                    gestureDetected(data.gesture);
                                    isGestureDetected = true;

                                    setTimeout(() => {
                                        isGestureDetected = false;
                                    }, 5000);
                                }
                            } else if (data.error) {
                                infoText.textContent = `${data.error}`;
                            } else {
                                infoText.textContent = `Waiting for gesture...`;
                            }
                        }).catch(error => {
                            console.error('Error processing frame:', error);
                        });
                }, 500);
            }
        }).catch(error => {
            console.error('Error accessing webcam:', error);
        });
}

selectMenu.addEventListener('change', handleSelectMenuChange);

ipcRenderer.on('gesture-new', (event, data) => {
    createGesture(data.description, data.gesture, data.action, !!commands[data.gesture]);
});

function createGesture(description, gesture, action, duplicate=false) {
    if (duplicate) {
        console.log("duplicate")
        fs.readFile('./user/binds.txt', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                return;
            }
        
            const lines = data.split('\n');
            lines.forEach(line => {
                if (line) {
                    const [existingGesture, existingDescription, existingAction] = line.split(';');
                    if (existingGesture === gesture) {
                        const bindText = `${gesture}; ${description}; ${action}\n`;
                        const updatedData = data.replace(line, bindText);
                        fs.writeFile('./user/binds.txt', updatedData, (err) => {
                            if (err) {
                                console.error('Error writing to file:', err);
                            }
                        });
                    }
                }
            });
            clearButtons();
            loadButtons();
        });
    } else {
        const bindText = `${gesture}; ${description}; ${action}\n`;

        fs.appendFile('./user/binds.txt', bindText, (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            }
        });
    }

    ipcRenderer.send('gesture-added', { description, gesture, action });
}

ipcRenderer.on('gesture-added', (event, data) => {
    createGestureButton(data.description, data.gesture, data.action);
    commands[data.gesture] = data.action;
    ipcRenderer.send('close-popup');
});

function createGestureButton(description, gesture) {
    const gestureElement = document.createElement('button');
    const gestureImage = document.createElement('img');
    gestureElement.className = 'justify-center items-center p-2 bg-gray-200 h-16 w-16 rounded-lg';
    gestureImage.src = `./images/${gesture}.png`;
    gestureImage.width = 100;
    gestureImage.height = 100;
    gestureImage.title = description;
    gestureImage.alt = description;

    gestureImage.addEventListener('click', () => {
        gestureDetected(gesture);
    });

    gestureElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();

        const dropdown = document.createElement('select');
        dropdown.className = 'bg-white border border-gray-300 text-gray-700 py-1 px-2 rounded';

        const actions = ['Delete'];
        actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action.toLowerCase();
            option.text = action;
            dropdown.appendChild(option);
        });

        dropdown.addEventListener('change', (event) => {
            const selectedAction = event.target.value;
            if (selectedAction === 'delete') {
                if (confirm(`Do you want to delete the gesture: ${description}?`)) {
                    deleteGesture(gesture);
                    gestureBox.removeChild(gestureElement);
                }
            }
            dropdown.value = '';
        });

        gestureElement.appendChild(dropdown);
        dropdown.focus();
    });

    gestureElement.appendChild(gestureImage);
    gestureBox.appendChild(gestureElement);
}

function deleteGesture(gesture) {
    fs.readFile('./user/binds.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }

        const lines = data.split('\n');
        const updatedLines = lines.filter(line => {
            const [existingGesture] = line.split(';');
            return existingGesture !== gesture;
        });

        fs.writeFile('./user/binds.txt', updatedLines.join('\n'), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            }
        });

        delete commands[gesture];
    });
}

function editGesture(gesture) {
    fs.readFile('./user/binds.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }

        const lines = data.split('\n');
        lines.forEach(line => {
            if (line) {
                const [existingGesture, existingDescription, existingAction] = line.split(';');
                if (existingGesture === gesture) {
                    ipcRenderer.send('open-popup', { description: existingDescription, gesture: existingGesture, action: existingAction });
                }
            }
        });
    });
}

ipcRenderer.on('gesture-detected', (event, data) => {
    gestureDetected(data.gesture);
});

function gestureDetected(gesture) {
    const action = commands[gesture].substring(0,4).trim();
    const path = commands[gesture].substring(4).trim();
    console.log(action, path);
    if (action === 'app') {
        openFile(path);
    } else if (action === 'web') {
        openWeb(path);
    }
}

function openFile(path) {
    exec(path, (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing file:', error);
        }
    });
}

function openWeb(path) {
    shell.openExternal(path);
}

ipcRenderer.on('hidden', (event) => {
    videoFeed = document.getElementById('webcamSelect').value;
    document.getElementById('webcamSelect').value = '';
});

ipcRenderer.on('visible', (event) => {
    document.getElementById('webcamSelect').value = videoFeed;
});