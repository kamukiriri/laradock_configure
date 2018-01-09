'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;  

const path = require('path');
const url = require('url');

// app config
global.config = {
  title: 'Laradock Config',
  debug: false,
}
  
let mainWindow;
  
// create window & main html
app.on('ready', () => {
  mainWindow = new BrowserWindow({
  	width: 1024, height: 720,
    //webPreferences: { nodeIntegration : false } 
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../render/index.html'),
    protocol: 'file:',
    slashes: true
  }));
  
  // for debug
  if(global.config.debug){
    mainWindow.webContents.openDevTools();
  }
});

// on all window close
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || global.config.debug) {
    app.quit();
  }
});

// on app active
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

process.on('uncaughtException', (exception) => {
  mainWindow.webContents.send('error', exception.message);
});
