// Cursor and some IDE terminals set ELECTRON_RUN_AS_NODE=1, which breaks
// require('electron') in Electron 44+. Clear it before loading the app.
delete process.env.ELECTRON_RUN_AS_NODE

void import('./app')
