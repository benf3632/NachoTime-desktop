const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const url = require("url");
const WebTorrent = require("webtorrent");
const util = require("util");

const client = new WebTorrent();
let prevProgress = null;

let mainWindow;

function createWindow() {
	const startUrl =
		process.env.ELECTRON_START_URL ||
		url.format({
			pathname: path.join(__dirname, "../index.html"),
			protocol: "file:",
			slashes: true,
		});
	mainWindow = new BrowserWindow({
		width: 1300,
		height: 720,
		minWidth: 1300,
		minHeight: 720,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
		icon: path.join(__dirname, "./icon.png"),
	});
	mainWindow.loadURL(startUrl);
	// mainWindow.removeMenu();
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
	setInterval(updateTorrentProgress, 1000);
}

app.on("ready", () => {
	createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform != "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === null) {
		createWindow();
	}
});

// Web Torrents events

// start torrenting event
ipcMain.on("wt-start-torrenting", (event, torrentId) => {
	if (!torrentId) return;
	const torrent = client.add(torrentId, {
		path: path.join(app.getPath("userData"), "downloads"),
	});
	torrent.on("ready", () => {
		event.reply("wt-torrenting-started", {
			magnetUri: torrent.magnetURI,
			infoHash: torrent.infoHash,
			name: torrent.name,
			ready: torrent.ready,
			progress: torrent.progress,
			downloaded: torrent.downloaded,
			downloadSpeed: torrent.downloadSpeed,
			uploadSpeed: torrent.uploadSpeed,
			numPeers: torrent.numPeers,
			length: torrent.length,
			paused: false,
			stopped: false,
		});
	});
});

ipcMain.on("wt-stop-torrenting", (event, magnetURI) => {
	if (!magnetURI) return;
	console.log("Stopping: ", magnetURI);
	const torrent = client.get(magnetURI);
	torrent.destroy({ destroyStore: false });
});

ipcMain.on("wt-destroy-torrent", (event, magnetURI) => {
	if (!magnetURI) return;
	const torrent = client.get(magnetURI);
	torrent.destroy({ destroyStore: true });
});

// get torrents event
ipcMain.on("wt-get-torrents", (event) => {
	event.returnValue = getTorrentProgress();
});

ipcMain.on("wt-pause-torrenting", (event, magnetUri) => {
	const torrent = client.get(magnetUri);
	torrent.pause();
});

ipcMain.on("wt-resume-torrenting", (event, magnetUri) => {
	const torrent = client.get(magnetUri);
	torrent.resume();
});

// sends torrent progress to renderer
const updateTorrentProgress = () => {
	const progress = getTorrentProgress();

	if (prevProgress && util.isDeepStrictEqual(progress, prevProgress)) {
		return;
	}

	mainWindow.webContents.send("wt-progress", progress);
	prevProgress = progress;
};

// gets the progress of all torrents
const getTorrentProgress = () => {
	const progress = client.progress;
	const hasActiveTorrents = client.torrents.some(
		(torrent) => torrent.progress !== 1
	);

	const torrentProg = client.torrents
		.filter((torrent) => torrent.ready)
		.map((torrent) => {
			const mp4File =
				torrent.files &&
				torrent.files.find((file) => {
					return file.name.endsWith(".mp4");
				});

			const fileProg = mp4File && {
				name: mp4File.name,
				progress: mp4File.progress,
				length: mp4File.length,
				downloaded: mp4File.downloaded,
				path: mp4File.path,
			};

			return {
				magnetUri: torrent.magnetURI,
				infoHash: torrent.infoHash,
				name: torrent.name,
				ready: torrent.ready,
				progress: torrent.progress,
				downloaded: torrent.downloaded,
				downloadSpeed: torrent.downloadSpeed,
				uploadSpeed: torrent.uploadSpeed,
				numPeers: torrent.numPeers,
				length: torrent.length,
				file: fileProg,
				paused: torrent.paused,
				stopped: false,
			};
		});

	return {
		torrents: torrentProg,
		progress,
		hasActiveTorrents,
	};
};
