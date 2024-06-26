import { useCallback, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router";
import { Link } from "react-router-dom";
import { connect } from "react-redux";
import { MdOutlineArrowBackIos } from "react-icons/md";
import { SiVlcmediaplayer } from "react-icons/si";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Select from "@mui/material/Select";
import { MenuItem } from "@mui/material";

// providers
import OpenSubtitlesProvider from "../lib/providers/subtitles/opensubtitles";

// actions
import { startNewTorrent } from "../actions/webTorrent";
import { addMessage } from "../actions/messages";

// components
import MaterialButton from "../components/MaterialButton";

// assets
// import IMDBLogo from "../assets/IMDB_Logo.svg";
import Nacho from "../assets/nacho.png";

// css
import "./MovieScreen.css";

// electron
const { ipcRenderer } = window.require("electron");

// consts
const trackers =
  "tr=udp://glotorrents.pw:6969/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://torrent.gresille.org:80/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969&tr=udp://tracker.leechers-paradise.org:6969&tr=udp://p4p.arenabg.ch:1337&tr=udp://tracker.internetwarriors.net:1337";

const fetchMovieDetails = async (movieId) => {
  const response = await fetch(
    `https://yts.mx/api/v2/movie_details.json?movie_id=${movieId}`
  );
  const json = await response.json();
  return json.data.movie;
};

const MovieScreen = ({ torrents, settings, startNewTorrent, addMessage }) => {
  let { movieID } = useParams();
  let history = useHistory();
  const [movieDetails, setMovieDetails] = useState(null);
  const [coverLoading, setCoverLoading] = useState(true);
  const [movieQuality, setMovieQuality] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [selectedWatchMethod, setSelectedWatchMethod] = useState(null);
  const [watchMethodOptions, setWatchMethodOptions] = useState(null);
  const [subtitles, setSubtitles] = useState([
    { langcode: "disable", lang: "None" },
  ]);
  const [selectedSubtitle, setSelectedSubtitle] = useState({
    langcode: "disable",
    lang: "None",
  });

  const handleCoverLoaded = () => {
    setCoverLoading(false);
  };

  const startTorrenting = () => {
    const torrentToDownload = getBestSeedMovie();
    const torrentId = `magnet:?xt=urn:btih:${torrentToDownload.hash}&${trackers}`;
    startNewTorrent(
      movieDetails.id,
      `${torrentToDownload.title_long} (${torrentToDownload.quality})`,
      torrentId,
      torrentToDownload.hash.toLowerCase(),
      settings.torrentsDownloadPath
    );
  };

  const handleDownloadMovieClick = () => {
    const torrentToDownload = getBestSeedMovie();
    const torrentExists = torrents.some(
      (torrent) => torrent.infoHash === torrentToDownload.hash.toLowerCase()
    );
    if (torrentExists && !torrentExists.stopped) {
      addMessage("The Movie is already in downloads!", "error");
      return;
    }
    startTorrenting();
    addMessage(`Started downloading: ${movieDetails.title_long}!`, "success");
  };

  const getBestSeedMovie = () => {
    const qualityTorrents = movieDetails.torrents.filter(
      (torrent) => torrent.quality === selectedQuality
    );

    const bestSeedMovie = qualityTorrents.reduce(
      (prev, current) => (current.seed > prev.seed ? current : prev),
      qualityTorrents[0]
    );
    return bestSeedMovie;
  };

  const handleWatchMovieClick = () => {
    const torrentToDownload = getBestSeedMovie();
    const torrentExists = torrents.some(
      (torrent) => torrent.infoHash === torrentToDownload.hash.toLowerCase()
    );
    if (!torrentExists || torrentExists.stopped) {
      startTorrenting();
      addMessage(`Started downloading: ${movieDetails.title_long}!`, "success");
    }
    let path = `/buffer/${torrentToDownload.hash.toLowerCase()}`;
    if (selectedSubtitle.langcode !== "disable") {
      path += `/${movieDetails.imdb_code}/${selectedSubtitle.langcode}`;
    }

    history.push({
      pathname: path,
      state: {
        bufferLoadedCallback: selectedWatchMethod.method,
      },
    });
  };

  const watchWithVLC = useCallback(
    (torrent, imdbid, langcode) => {
      if (!torrent) {
        addMessage("Torrent doesn't exists!", "error");
        return;
      }

      ipcRenderer.send(
        "open-vlc",
        settings.vlcPath ?? "vlc",
        torrent.file.path
      );
    },
    [settings.vlcPath, addMessage]
  );

  const watchWithWebPlayer = useCallback(
    (torrent, imdbid, langcode) => {
      let path = `/player/${encodeURIComponent(torrent.file.path)}`;
      if (imdbid && langcode) {
        path += `/${imdbid}/${langcode}`;
      }
      history.replace(path);
    },
    [history]
  );

  const handleQualitySelectionChange = (event) => {
    setSelectedQuality(event.target.value);
  };

  const handleSelectWatchMethod = (event) => {
    setSelectedWatchMethod(
      watchMethodOptions.find((method) => method.value === event.target.value)
    );
  };

  const handleSelectSubtitle = (event) => {
    setSelectedSubtitle(
      subtitles.find((subtitle) => subtitle.langcode === event.target.value)
    );
  };

  useEffect(() => {
    const watchMethods = [
      {
        value: "WebPlayer",
        label: (
          <img
            alt="nacho"
            src={Nacho}
            style={{ width: "20px", height: "20px" }}
          />
        ),
        method: watchWithWebPlayer,
      },
      { value: "VLC", label: <SiVlcmediaplayer />, method: watchWithVLC },
    ];
    setWatchMethodOptions(watchMethods);
    setSelectedWatchMethod(watchMethods[0]);
    const fetchMovie = async () => {
      const movie = await fetchMovieDetails(movieID);

      // get available qualities
      const movieQualitySet = new Set();
      movie.torrents.forEach((torrent) => {
        movieQualitySet.add(torrent.quality);
      });

      const movieQualityOptions = Array.from(movieQualitySet).map(
        (quality) => ({ value: quality, label: quality })
      );
      setMovieQuality(movieQualityOptions);
      setSelectedQuality(movieQualityOptions[0].value);

      setMovieDetails(movie);
    };
    fetchMovie();
  }, [movieID, watchWithVLC, watchWithWebPlayer]);

  useEffect(() => {
    const fetchSubtitles = async () => {
      if (movieDetails === null) return;

      const result = await OpenSubtitlesProvider.getAllSubtitles(
        movieDetails.imdb_code
      );
      if (result.error !== null) {
        return;
      }

      setSubtitles((subtitles) => [...subtitles, ...result.subtitles]);
    };
    fetchSubtitles();
  }, [movieDetails]);

  return (
    <div className="MovieScreenContainer">
      <Link to="/" className="MovieScreenBackIconContainer">
        <MdOutlineArrowBackIos className="MovieScreenBackIcon" />
      </Link>
      <div className="MovieScreenContentContainer">
        <div className="MovieScreenMovieCoverContainer">
          {coverLoading && (
            <SkeletonTheme
              className="MovieScreenMovieCover"
              highlightColor="#444"
              color="#202020"
            >
              <Skeleton
                width={400}
                height={600}
                className="MovieScreenMovieCover"
              />
            </SkeletonTheme>
          )}
          <img
            className="MovieScreenMovieCover"
            style={coverLoading ? { display: "none" } : {}}
            onLoad={handleCoverLoaded}
            src={movieDetails && movieDetails.large_cover_image}
            alt="movieCover"
          />
        </div>
        <div className="MovieScreenMovieDetailsContainer">
          <div>
            <p className="MovieScreenTitle">
              {movieDetails && movieDetails.title_long}
            </p>
            <p>
              {movieDetails && movieDetails.genres.join(" - ")}
              {" - "}
              {movieDetails && movieDetails.runtime} min
            </p>
            <p>{movieDetails && movieDetails.description_full}</p>
          </div>
          <div>
            <div className="MovieOptionsWrapper">
              <div
                style={{
                  width: "120px",
                  paddingBottom: "1%",
                }}
              >
                <Select
                  className="QualitySelect"
                  id="quality"
                  value={selectedQuality ?? ""}
                  onChange={handleQualitySelectionChange}
                >
                  {movieQuality &&
                    movieQuality.map((quality, index) => (
                      <MenuItem id={index} value={quality.value}>
                        {quality.label}
                      </MenuItem>
                    ))}
                </Select>
              </div>
              <div style={{ marginRight: "1%" }}>
                <Select
                  className="SubtitlesSelect"
                  id="subtitles"
                  value={selectedSubtitle ? selectedSubtitle.langcode : ""}
                  onChange={handleSelectSubtitle}
                >
                  {subtitles.length > 0 &&
                    subtitles.map((subtitle, index) => (
                      <MenuItem id={index} value={subtitle.langcode}>
                        {subtitle.lang}
                      </MenuItem>
                    ))}
                </Select>
              </div>
            </div>
            <div className="MovieButtons">
              <MaterialButton onClick={handleWatchMovieClick}>
                Watch Movie
              </MaterialButton>
              <Select
                className="WatchMethodSelect"
                style={{ color: "white" }}
                id="watchMethod"
                value={
                  selectedWatchMethod ? selectedWatchMethod.value : "loading"
                }
                onChange={handleSelectWatchMethod}
              >
                {watchMethodOptions &&
                  watchMethodOptions.map((method, index) => (
                    <MenuItem id={index} value={method.value}>
                      {method.label}
                    </MenuItem>
                  ))}
              </Select>
              <MaterialButton
                onClick={handleDownloadMovieClick}
                style={{ marginLeft: "1%" }}
              >
                Download Movie
              </MaterialButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const mapDispatchToProps = (dispatch) => ({
  startNewTorrent: (movieID, torrentName, magnetURI, infoHash, path) =>
    dispatch(startNewTorrent(movieID, torrentName, magnetURI, infoHash, path)),
  addMessage: (message, type) => dispatch(addMessage(message, type)),
});

const mapStateToProps = (state) => ({
  torrents: state.torrents,
  settings: state.settings,
});

export default connect(mapStateToProps, mapDispatchToProps)(MovieScreen);
