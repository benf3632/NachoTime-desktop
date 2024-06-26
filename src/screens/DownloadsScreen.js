import { useEffect } from "react";
import { connect } from "react-redux";
import ProgressBar from "@ramonak/react-progress-bar";
import { useHistory } from "react-router";

// icons
import { IoMdCloudDownload, IoMdCloudUpload } from "react-icons/io/";
import { AiOutlinePauseCircle, AiOutlinePlayCircle } from "react-icons/ai";
import { FaTrashAlt } from "react-icons/fa";

// actions
import {
  updateTorrents,
  stopTorrent,
  startTorrent,
  deleteTorrent,
} from "../actions/webTorrent";

// assets
import Nacho from "../assets/nacho.png";

// css
import "./DownloadsScreen.css";

// eletcron
const { ipcRenderer } = window.require("electron");

const parseSpeed = (speed) => {
  let speedNumber = parseInt(speed);
  if (speedNumber >= 1000 * 1000) {
    speedNumber = speedNumber / (1000 * 1000);
    return `${speedNumber.toFixed(2)} MB/s`;
  } else if (speedNumber >= 1000) {
    speedNumber = speedNumber / 1000;
    return `${speedNumber.toFixed(2)} KB/s`;
  }
  return `${speed.toFixed(2)} B/s`;
};

const DownloadsScreen = ({
  torrents,
  settings,
  updateTorrents,
  stopTorrent,
  startTorrent,
  deleteTorrent,
}) => {
  let history = useHistory();
  const handleTorrentStopping = (magnetUri) => {
    stopTorrent(magnetUri);
  };

  const handleTorrentStarting = (magnetUri) => {
    startTorrent(magnetUri, settings.torrentsDownloadPath);
  };

  const handleClickWebPlayerWatch = (torrent) => {
    history.push(`/movie/${torrent.movieID}`);
  };

  useEffect(() => {
    ipcRenderer.on("wt-progress", (event, progress) => {
      updateTorrents(progress.torrents);
    });
    return () => ipcRenderer.removeAllListeners("wt-progress");
  }, [updateTorrents]);

  return (
    <div
      className={`TorrentsProgressContainer ${
        torrents.length === 0 ? "DownloadsEmpty" : ""
      }`}
    >
      {torrents.length === 0 && (
        <p
          style={{
            color: "gray",
          }}
        >
          Downloads list is empty
        </p>
      )}
      {torrents &&
        torrents.map((torrent) => {
          return (
            <div className="TorrentProgress" key={torrent.infoHash}>
              <div style={{ width: "100%" }}>
                <p>{torrent.name}</p>
                <ProgressBar
                  bgColor="#66bb6a"
                  labelAlignment="outside"
                  completed={Math.floor(parseFloat(torrent.progress) * 100)}
                />
                <div className="TorrentProgressInfoContainer">
                  <div>
                    {<IoMdCloudDownload />}
                    {"    "}
                    {parseSpeed(torrent.downloadSpeed)} {<IoMdCloudUpload />}
                    {"    "}
                    {parseSpeed(torrent.uploadSpeed)}
                  </div>
                  <div className="TorrentActions">
                    <img
                      src={Nacho}
                      className="ClickableIcon"
                      onClick={() => handleClickWebPlayerWatch(torrent)}
                      alt="nacho"
                    />
                    {torrent.stopped ? (
                      <AiOutlinePlayCircle
                        onClick={() => handleTorrentStarting(torrent.magnetUri)}
                        className="ClickableIcon"
                      />
                    ) : (
                      <AiOutlinePauseCircle
                        onClick={() => handleTorrentStopping(torrent.magnetUri)}
                        className="ClickableIcon"
                      />
                    )}{" "}
                    {
                      <FaTrashAlt
                        className="ClickableIcon"
                        onClick={() =>
                          deleteTorrent(
                            torrent.infoHash,
                            settings.torrentsDownloadPath
                          )
                        }
                      />
                    }
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
};

const mapStateToProps = (state) => ({
  torrents: state.torrents,
  settings: state.settings,
});

const mapDispatchToProps = (dispatch) => ({
  updateTorrents: (torrents) => dispatch(updateTorrents(torrents)),
  stopTorrent: (magnetURI) => dispatch(stopTorrent(magnetURI)),
  startTorrent: (magnetURI, torrentPath) =>
    dispatch(startTorrent(magnetURI, torrentPath)),
  deleteTorrent: (infoHash, torrentPath) =>
    dispatch(deleteTorrent(infoHash, torrentPath)),
});

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsScreen);
