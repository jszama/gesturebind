const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let popupWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: true,
        },
    });

    mainWindow.loadFile('./src/index.html');

    mainWindow.on('backend-ready', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('hide', () => {
        mainWindow.webContents.send('hidden');
    });
    
    mainWindow.on('show', () => {
        mainWindow.webContents.send('visible');
    });

    ipcMain.on('gesture-added', (event, data) => {
        mainWindow.webContents.send('gesture-added', data);
    });

    ipcMain.on('close-popup', () => {
        mainWindow.webContents.send('close-popup');
    });
}

function runPythonBackend() {
    const pythonScriptPath = path.join(__dirname, '../../backend/backend.py');
    const pythonProcess = spawn('python', [pythonScriptPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        data = data.toString();
        console.error(`stderr: ${data}`);
        if (data.includes('Created TensorFlow')) {
            mainWindow.show();
        }
    });
}

app.disableHardwareAcceleration();

app.on('ready', () => {
    runPythonBackend();
    createWindow();
    const tray = new Tray('./src/images/android-chrome-512x512.png');
    tray.setToolTip('GestureBind');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Exit',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show(); 
        }
    });

    ipcMain.on('gesture-new', (event, data) => {
        mainWindow.webContents.send('gesture-new', data);
    });
});

app.on('before-quit', () => {
    app.isQuiting = true; 
});


app.on('window-all-closed', (event) => {
    event.preventDefault();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

function createPopupWindow() {
    popupWindow = new BrowserWindow({
        width: 400,
        height: 300,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    popupWindow.loadFile('./src/popup.html');
    
    popupWindow.on('closed', () => {
        popupWindow = null;
    });

    ipcMain.on('open-file-dialog', (event) => {
        dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Executables', extensions: ['exe'] }
            ]
        }).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
                console.log('Selected file:', result.filePaths[0]);
                popupWindow.webContents.executeJavaScript(`
                    document.getElementById("gestureApp").value = '${result.filePaths[0].replace(/\\/g, '\\\\')}';
                `);
            }
        }).catch(err => {
            console.error('Error selecting file:', err);
        });
    });
}

ipcMain.on('open-popup', () => {
    if (!popupWindow) {
        createPopupWindow();
    }
});

ipcMain.on('close-popup', () => {
    console.log('close-popup event received');
    if (popupWindow) {
        console.log('Closing popup window');
        popupWindow.close();
    } else {
        console.log('popupWindow does not exist');
    }
});
