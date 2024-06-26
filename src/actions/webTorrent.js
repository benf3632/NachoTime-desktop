const { ipcRenderer } = window.require("electron");

export const startNewTorrent = (
  movieID,
  torrentName,
  magnetURI,
  infoHash,
  path
) => {
  return (dispatch, getState) => {
    const state = getState().torrents;
    const existingTorrent = state.find(
      (torrent) => torrent.infoHash === infoHash
    );
    if (!existingTorrent)
      dispatch(
        addTorrent({
          movieID,
          infoHash,
          magnetURI,
          name: torrentName,
          progress: 0.0,
          downloaded: 0,
          downloadSpeed: 0.0,
          uploadSpeed: 0.0,
          numPeers: 0,
          length: 0,
          ready: false,
          stopped: false,
        })
      );
    else {
      if (!existingTorrent.stopped) return;
    }
    dispatch(startTorrent(magnetURI, path));
  };
};

export const startTorrent = (magnetURI, torrentPath) => {
  return (dispatch, getState) => {
    ipcRenderer.send("wt-start-torrenting", magnetURI, torrentPath);
    ipcRenderer.once("wt-torrenting-started", (event, torrent) => {
      dispatch(updateTorrent(torrent));
    });
  };
};

export const addTorrent = (torrent) => ({
  type: "ADD_TORRENT",
  torrent,
});

export const updateTorrent = (torrent) => ({
  type: "UPDATE_TORRENT",
  torrent,
});

export const updateTorrents = (torrents) => {
  return (dispatch, getState) => {
    torrents.map((torrent) => dispatch(updateTorrent(torrent)));
  };
};

export const stopTorrent = (magnetURI) => {
  ipcRenderer.send("wt-stop-torrenting", decodeURI(magnetURI));
  return {
    type: "STOP_TORRENT",
    magnetURI,
  };
};

export const deleteTorrent = (infoHash, torrentPath) => {
  return (dispatch, getState) => {
    const { torrents } = getState();
    const currentTorrent = torrents.find(
      (torrent) => torrent.infoHash === infoHash
    );
    if (!currentTorrent.stopped) {
      ipcRenderer.send(
        "wt-start-torrenting",
        currentTorrent.magnetURI,
        torrentPath
      );
      ipcRenderer.send(
        "wt-destroy-torrent",
        decodeURI(currentTorrent.magnetURI)
      );
    }
    dispatch({
      type: "DELETE_TORRENT",
      magnetURI: currentTorrent.magnetUri,
    });
  };
};
