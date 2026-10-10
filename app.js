/*
 * A chave da YouTube Data API fica no servidor Vercel, na variável YOUTUBE_API_KEY.
 * Veja DEPLOY.md para configurar a variável e publicar o site.
 */

const YOUTUBE_API_ENDPOINT = "/api/youtube-search";
const FAVORITES_STORAGE_KEY = "music-search-films:favorites";
const MAX_VIDEO_RESULTS = 10;
const UNOFFICIAL_VIDEO_MARKERS = [
  "cover",
  "karaoke",
  "tribute",
  "fan made",
  "fanmade",
  "reaction",
  "remix",
  "slowed",
  "reverb",
  "nightcore",
  "8d audio",
];
const OFFICIAL_VIDEO_MARKERS = [
  "official",
  "vevo",
  "soundtrack",
  "original song",
  "original motion picture",
  "music video",
  "provided to youtube by",
  " - topic",
];

const elements = {
  form: document.querySelector("#movie-form"),
  movieTitle: document.querySelector("#movie-title"),
  searchButton: document.querySelector("#generate-button"),
  loading: document.querySelector("#loading"),
  loadingLabel: document.querySelector("#loading-label"),
  skeletonGrid: document.querySelector("#skeleton-grid"),
  formHint: document.querySelector("#form-hint"),
  message: document.querySelector("#message"),
  resultsHeading: document.querySelector("#results-heading"),
  resultsCaption: document.querySelector("#playlist-caption"),
  videoList: document.querySelector("#track-list"),
  favoritesFilter: document.querySelector("#favorites-filter"),
  favoriteCount: document.querySelector("#favorite-count"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-state h3"),
  emptyDescription: document.querySelector("#empty-state p"),
  player: document.querySelector("#mini-player"),
  playerFrame: document.querySelector("#youtube-frame"),
  playerFrameWrap: document.querySelector("#youtube-frame-wrap"),
  playerTitle: document.querySelector("#youtube-track-title"),
  playerStatus: document.querySelector("#youtube-status"),
  playerArtwork: document.querySelector("#mini-art"),
  playPauseButton: document.querySelector("#play-pause-button"),
  seekControl: document.querySelector("#seek-control"),
  currentTime: document.querySelector("#current-time"),
  durationTime: document.querySelector("#duration-time"),
  volumeControl: document.querySelector("#volume-control"),
  pipButton: document.querySelector("#pip-button"),
  closePlayerButton: document.querySelector("#close-player-button"),
  youtubeFallback: document.querySelector("#youtube-fallback"),
};

let currentVideos = [];
let currentMovieTitle = "";
let displayedVideos = [];
let playbackVideos = [];
let favorites = [];
let favoritesAvailable = true;
let youtubePlayer = null;
let youtubeApiPromise = null;
let activeVideoIndex = -1;
let playbackGeneration = 0;
let activeVideo = null;
let progressTimer = null;
let pictureInPictureWindow = null;

function showMessage(message) {
  elements.message.textContent = message;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.textContent = "";
  elements.message.hidden = true;
}

function setLoading(isLoading) {
  elements.loading.hidden = !isLoading;
  elements.searchButton.disabled = isLoading;
  elements.movieTitle.disabled = isLoading;
  elements.favoritesFilter.disabled = isLoading || !favoritesAvailable;
  elements.loading.setAttribute("aria-busy", String(isLoading));
}

function makeSkeletons() {
  elements.skeletonGrid.replaceChildren();
  for (let index = 0; index < 6; index += 1) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML =
      '<div class="skeleton-poster"></div><div class="skeleton-info"><span class="skeleton-line"></span><span class="skeleton-line"></span></div>';
    elements.skeletonGrid.append(card);
  }
}

function getSearchQueries(movieTitle) {
  return [
    `${movieTitle} movie official soundtrack song`,
    `${movieTitle} original song from the movie official audio`,
  ];
}

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getOfficialMatchScore(video) {
  const title = normalizeSearchText(video.snippet.title);
  const channel = normalizeSearchText(video.snippet.channelTitle);
  const description = normalizeSearchText(video.snippet.description || "");
  const metadata = `${title} ${channel} ${description}`;

  if (UNOFFICIAL_VIDEO_MARKERS.some((marker) => metadata.includes(marker))) return 0;

  return OFFICIAL_VIDEO_MARKERS.reduce(
    (score, marker) => score + (metadata.includes(marker) ? 1 : 0),
    0,
  );
}

async function searchYouTube(query) {
  const parameters = new URLSearchParams({ q: query });
  const response = await fetch(`${YOUTUBE_API_ENDPOINT}?${parameters}`);
  const data = await response.json();

  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") {
      throw new Error("A cota diária gratuita da busca do YouTube acabou. Tente novamente amanhã.");
    }
    if (response.status === 503) {
      throw new Error("A busca ainda não foi configurada no Vercel. Adicione a variável YOUTUBE_API_KEY e faça um novo deploy.");
    }
    if (response.status === 403) {
      throw new Error("O Google recusou a chave. Confira se a YouTube Data API v3 está ativada e se a chave do servidor está restringida a essa API.");
    }
    throw new Error(data.error?.message || `O YouTube retornou o erro ${response.status}.`);
  }

  return data.items || [];
}

async function findMovieVideos(movieTitle) {
  const results = await Promise.all(getSearchQueries(movieTitle).map(searchYouTube));
  const videos = new Map();

  for (const video of results.flat()) {
    const id = video.id?.videoId;
    const officialMatchScore = getOfficialMatchScore(video);
    if (id && officialMatchScore > 0) {
      const existing = videos.get(id);
      if (!existing || existing.officialMatchScore < officialMatchScore) {
        videos.set(id, { ...video, officialMatchScore });
      }
    }
  }

  return Array.from(videos.values())
    .sort((first, second) => second.officialMatchScore - first.officialMatchScore)
    .slice(0, MAX_VIDEO_RESULTS);
}

function loadFavorites() {
  const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (!storedFavorites) return [];

  const parsedFavorites = JSON.parse(storedFavorites);
  if (!Array.isArray(parsedFavorites)) {
    throw new Error("A lista de favoritas salva no navegador está inválida. Limpe os dados do site para continuar.");
  }

  return parsedFavorites.filter(
    (video) =>
      typeof video?.id?.videoId === "string" &&
      typeof video?.snippet?.title === "string" &&
      typeof video?.snippet?.channelTitle === "string",
  );
}

function isFavorite(video) {
  return favorites.some((favorite) => favorite.id.videoId === video.id.videoId);
}

function updateFavoriteCount() {
  elements.favoriteCount.textContent = String(favorites.length);
}

function getThumbnailUrl(video) {
  return (
    video.snippet.thumbnails?.medium?.url ||
    video.snippet.thumbnails?.default?.url ||
    ""
  );
}

function makeThumbnail(video, className) {
  const image = document.createElement("img");
  image.className = className;
  image.alt = "";
  image.loading = "lazy";
  const thumbnailUrl = getThumbnailUrl(video);
  if (thumbnailUrl) image.src = thumbnailUrl;
  image.addEventListener(
    "error",
    () => {
      image.remove();
    },
    { once: true },
  );
  return image;
}

function setEmptyState(title, description) {
  elements.emptyTitle.textContent = title;
  elements.emptyDescription.textContent = description;
}

function renderVideos(videos, movieTitle = "") {
  displayedVideos = videos;
  elements.videoList.replaceChildren();
  elements.emptyState.hidden = videos.length > 0;

  if (elements.favoritesFilter.getAttribute("aria-pressed") === "true") {
    setEmptyState(
      "Sua coleção começa aqui.",
      "Toque no coração de uma faixa para guardá-la nesta lista.",
    );
    elements.resultsHeading.innerHTML = "Minhas músicas <span>favoritas.</span>";
    elements.resultsCaption.textContent =
      videos.length === 1
        ? "1 faixa salva neste dispositivo. Sua coleção fica disponível offline."
        : `${videos.length} faixas salvas neste dispositivo. Sua coleção fica disponível offline.`;
  } else if (movieTitle) {
    elements.resultsHeading.innerHTML = "Encontre o seu <span>próximo play.</span>";
    elements.resultsCaption.textContent =
      `${videos.length} vídeos com sinais de lançamento oficial para “${movieTitle}”. Covers, remixes e vídeos de fãs são removidos quando identificados.`;
    setEmptyState("Nenhuma faixa por aqui.", "Tente buscar por outro filme.");
  } else {
    elements.resultsHeading.innerHTML = "Encontre o seu <span>próximo play.</span>";
    elements.resultsCaption.textContent = "";
    setEmptyState(
      "O que vamos ouvir hoje?",
      "Busque um filme para encontrar a trilha sonora que merece replay.",
    );
  }

  videos.forEach((video, index) => {
    const card = document.createElement("article");
    card.className = "track-card";

    const artwork = document.createElement("div");
    artwork.className = "card-artwork";
    artwork.append(makeThumbnail(video, "video-thumbnail"));

    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const playButton = document.createElement("button");
    playButton.className = "button-play";
    playButton.type = "button";
    playButton.dataset.action = "play";
    playButton.dataset.videoId = video.id.videoId;
    playButton.setAttribute("aria-label", `Reproduzir ${video.snippet.title}`);
    playButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-play"/></svg>';

    const favoriteButton = document.createElement("button");
    favoriteButton.className = "favorite-button";
    favoriteButton.type = "button";
    favoriteButton.dataset.action = "favorite";
    favoriteButton.dataset.videoId = video.id.videoId;
    favoriteButton.disabled = !favoritesAvailable;
    favoriteButton.setAttribute("aria-pressed", String(isFavorite(video)));
    favoriteButton.setAttribute(
      "aria-label",
      `${isFavorite(video) ? "Remover das" : "Adicionar às"} favoritas: ${video.snippet.title}`,
    );
    favoriteButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-heart"/></svg>';
    actions.append(playButton, favoriteButton);
    artwork.append(number, actions);

    const info = document.createElement("div");
    info.className = "card-info";
    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = video.snippet.title;
    const channel = document.createElement("span");
    channel.className = "track-artist";
    channel.textContent = video.snippet.channelTitle;
    info.append(title, channel);

    card.append(artwork, info);
    elements.videoList.append(card);
  });
}

function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error("Não foi possível carregar o player do YouTube."));
    };
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.append(script);
  });

  return youtubeApiPromise;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function getArtworkUrl(video) {
  return getThumbnailUrl(video) || new URL("./icon.svg", window.location.href).href;
}

function updateMediaSession(video = activeVideo) {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined" || !video) {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: video.snippet.title,
    artist: video.snippet.channelTitle,
    album: "Music Search Films",
    artwork: [{ src: getArtworkUrl(video) }],
  });
  navigator.mediaSession.playbackState =
    youtubePlayer?.getPlayerState() === 1 ? "playing" : "paused";
  updatePositionState();
}

function updatePositionState() {
  if (
    !("mediaSession" in navigator) ||
    !navigator.mediaSession.setPositionState ||
    !youtubePlayer
  ) {
    return;
  }

  const duration = youtubePlayer.getDuration();
  const position = youtubePlayer.getCurrentTime();
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(position)
  ) {
    return;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.min(Math.max(position, 0), duration),
      playbackRate: youtubePlayer.getPlaybackRate() || 1,
    });
  } catch (error) {
    console.warn("O navegador não aceitou a posição atual da mídia:", error);
  }
}

function setMediaActionHandlers() {
  if (!("mediaSession" in navigator)) return;

  const actions = {
    play: () => youtubePlayer?.playVideo(),
    pause: () => youtubePlayer?.pauseVideo(),
    stop: () => youtubePlayer?.stopVideo(),
    seekbackward: (details) =>
      youtubePlayer?.seekTo(
        Math.max(0, youtubePlayer.getCurrentTime() - (details.seekOffset || 10)),
        true,
      ),
    seekforward: (details) =>
      youtubePlayer?.seekTo(
        Math.min(
          youtubePlayer.getDuration(),
          youtubePlayer.getCurrentTime() + (details.seekOffset || 10),
        ),
        true,
      ),
    seekto: (details) => {
      if (Number.isFinite(details.seekTime)) youtubePlayer?.seekTo(details.seekTime, true);
    },
  };

  for (const [action, handler] of Object.entries(actions)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      if (error.name !== "NotSupportedError") {
        console.warn(`Não foi possível ativar o controle de mídia "${action}":`, error);
      }
    }
  }
}

function updatePlayerState(event) {
  if (elements.player.hidden) return;
  const isPlaying = event.data === window.YT.PlayerState.PLAYING;
  elements.player.classList.toggle("is-playing", isPlaying);
  elements.playPauseButton.disabled = false;
  elements.playPauseButton.setAttribute(
    "aria-label",
    isPlaying ? "Pausar" : "Reproduzir",
  );

  if (event.data === window.YT.PlayerState.PLAYING) {
    elements.playerStatus.textContent =
      `Canal: ${activeVideo?.snippet.channelTitle || "YouTube"}`;
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(updateProgress, 1000);
  } else if (event.data === window.YT.PlayerState.PAUSED) {
    elements.playerStatus.textContent = "Reprodução pausada";
    window.clearInterval(progressTimer);
  } else if (event.data === window.YT.PlayerState.BUFFERING) {
    elements.playerStatus.textContent = "Carregando vídeo...";
  } else if (event.data === window.YT.PlayerState.ENDED) {
    window.clearInterval(progressTimer);
    elements.playerStatus.textContent = "Vídeo finalizado";
  }

  updateMediaSession();
}

function updateProgress() {
  if (!youtubePlayer) return;

  const current = youtubePlayer.getCurrentTime();
  const duration = youtubePlayer.getDuration();
  if (!Number.isFinite(current) || !Number.isFinite(duration) || duration <= 0) return;

  elements.currentTime.textContent = formatTime(current);
  elements.durationTime.textContent = formatTime(duration);
  elements.seekControl.max = String(duration);
  if (document.activeElement !== elements.seekControl) {
    elements.seekControl.value = String(current);
  }
  updatePositionState();
}

function setPlayerVideoDetails(video) {
  activeVideo = video;
  elements.player.hidden = false;
  document.body.classList.add("has-mini-player");
  elements.playerTitle.textContent = video.snippet.title;
  elements.playerStatus.textContent = `Canal: ${video.snippet.channelTitle} · carregando player...`;
  elements.playerArtwork.src = getArtworkUrl(video);
  elements.playerArtwork.onerror = () => {
    elements.playerArtwork.onerror = null;
    elements.playerArtwork.src = new URL("./icon.svg", window.location.href).href;
  };
  elements.youtubeFallback.href =
    `https://www.youtube.com/watch?v=${encodeURIComponent(video.id.videoId)}`;
  elements.youtubeFallback.hidden = false;
  elements.playPauseButton.disabled = true;
  updateMediaSession(video);
}

async function playVideoAtIndex(index, generation) {
  if (generation !== playbackGeneration) return;
  if (index >= playbackVideos.length) {
    elements.playerStatus.textContent =
      "O YouTube bloqueou a reprodução incorporada dos resultados encontrados.";
    elements.youtubeFallback.hidden = false;
    return;
  }

  activeVideoIndex = index;
  const video = playbackVideos[index];
  setPlayerVideoDetails(video);

  try {
    const youtube = await loadYouTubePlayerApi();
    if (generation !== playbackGeneration) return;

    if (!youtubePlayer) {
      youtubePlayer = new youtube.Player(elements.playerFrame, {
        width: "480",
        height: "270",
        videoId: video.id.videoId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            const iframe = event.target.getIframe();
            iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
            event.target.setVolume(Number(elements.volumeControl.value));
            if (elements.player.hidden || !activeVideo) {
              event.target.stopVideo();
              return;
            }
            setMediaActionHandlers();
            if (generation === playbackGeneration) {
              event.target.playVideo();
            } else if (activeVideo) {
              event.target.loadVideoById(activeVideo.id.videoId);
            }
          },
          onStateChange: updatePlayerState,
          onError: handleYouTubePlayerError,
        },
      });
    } else {
      elements.playerStatus.textContent = `Canal: ${video.snippet.channelTitle} · carregando vídeo...`;
      youtubePlayer.loadVideoById(video.id.videoId);
    }
  } catch (error) {
    elements.playerStatus.textContent = error.message;
    elements.youtubeFallback.hidden = false;
  }
}

function handleYouTubePlayerError(event) {
  const errorCode = event.data;
  const failedIndex = activeVideoIndex;
  const failedGeneration = playbackGeneration;
  const canTryNextVideo = [2, 5, 100, 101, 150].includes(errorCode);

  if (canTryNextVideo && failedIndex + 1 < playbackVideos.length) {
    elements.playerStatus.textContent =
      "Este vídeo não pode ser reproduzido aqui. Tentando o próximo resultado...";
    window.setTimeout(
      () => playVideoAtIndex(failedIndex + 1, failedGeneration),
      300,
    );
    return;
  }

  elements.playerStatus.textContent =
    errorCode === 101 || errorCode === 150
      ? "O dono deste vídeo não permite reprodução em outros sites. Abra-o no YouTube."
      : `O player do YouTube retornou o erro ${errorCode}. Tente abrir o vídeo no YouTube.`;
  elements.youtubeFallback.hidden = false;
}

function playVideo(video) {
  playbackVideos = displayedVideos.some(
    (item) => item.id.videoId === video.id.videoId,
  )
    ? displayedVideos
    : [video];
  const index = playbackVideos.findIndex(
    (item) => item.id.videoId === video.id.videoId,
  );
  playbackGeneration += 1;
  activeVideoIndex = index;
  playVideoAtIndex(index, playbackGeneration);
}

function toggleFavorite(video) {
  if (!favoritesAvailable) {
    showMessage("Não foi possível acessar o armazenamento das favoritas neste navegador.");
    return;
  }

  const alreadyFavorite = isFavorite(video);
  const nextFavorites = alreadyFavorite
    ? favorites.filter((favorite) => favorite.id.videoId !== video.id.videoId)
    : [video, ...favorites];

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
  } catch (error) {
    showMessage(`Não foi possível salvar suas favoritas neste navegador: ${error.message}`);
    return;
  }

  favorites = nextFavorites;
  updateFavoriteCount();
  if (elements.favoritesFilter.getAttribute("aria-pressed") === "true") {
    renderVideos(favorites);
  } else {
    renderVideos(currentVideos, currentMovieTitle);
  }
}

function showFavorites() {
  const showingFavorites =
    elements.favoritesFilter.getAttribute("aria-pressed") !== "true";
  elements.favoritesFilter.setAttribute("aria-pressed", String(showingFavorites));
  renderVideos(
    showingFavorites ? favorites : currentVideos,
    showingFavorites ? "" : currentMovieTitle,
  );
  if (showingFavorites) {
    elements.resultsHeading.innerHTML = 'Minhas músicas <span>favoritas.</span>';
    if (favorites.length === 0) {
      setEmptyState(
        "Sua coleção começa aqui.",
        "Toque no coração de uma faixa para guardá-la nesta lista.",
      );
    }
  }
}

async function openPictureInPicture() {
  if (!window.documentPictureInPicture) {
    showMessage("Picture-in-Picture não está disponível neste navegador. Você ainda pode abrir o vídeo diretamente no YouTube.");
    return;
  }

  const iframe = elements.playerFrame.querySelector("iframe");
  if (!iframe) {
    showMessage("Aguarde o player do YouTube carregar antes de ativar Picture-in-Picture.");
    return;
  }

  try {
    if (pictureInPictureWindow) pictureInPictureWindow.close();
    pictureInPictureWindow = await window.documentPictureInPicture.requestWindow({
      width: 480,
      height: 300,
    });
    const pipWindow = pictureInPictureWindow;
    const style = pipWindow.document.createElement("style");
    style.textContent =
      "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#100f14}iframe{display:block;width:min(100vw,480px);height:min(56.25vw,270px);min-height:200px;border:0}";
    pipWindow.document.head.append(style);
    pipWindow.document.body.append(iframe);
    pipWindow.addEventListener(
      "pagehide",
      () => {
        elements.playerFrame.append(iframe);
        pictureInPictureWindow = null;
      },
      { once: true },
    );
  } catch (error) {
    showMessage(`Não foi possível abrir Picture-in-Picture: ${error.message}`);
  }
}

function closePlayer() {
  playbackGeneration += 1;
  window.clearInterval(progressTimer);
  if (pictureInPictureWindow) pictureInPictureWindow.close();
  activeVideo = null;
  youtubePlayer?.stopVideo();
  elements.player.hidden = true;
  document.body.classList.remove("has-mini-player");
  elements.player.classList.remove("is-playing");
  elements.playPauseButton.disabled = true;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.metadata = null;
    for (const action of [
      "play",
      "pause",
      "stop",
      "seekbackward",
      "seekforward",
      "seekto",
    ]) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch (error) {
        if (error.name !== "NotSupportedError") {
          console.warn(`Não foi possível remover o controle de mídia "${action}":`, error);
        }
      }
    }
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const movieTitle = elements.movieTitle.value.trim();
  if (!movieTitle) return;

  hideMessage();
  elements.videoList.replaceChildren();
  elements.emptyState.hidden = true;
  elements.resultsCaption.textContent = "";
  currentVideos = [];
  currentMovieTitle = "";
  elements.favoritesFilter.setAttribute("aria-pressed", "false");
  setLoading(true);
  makeSkeletons();
  elements.loadingLabel.textContent = `Buscando a trilha de “${movieTitle}”...`;

  try {
    currentVideos = await findMovieVideos(movieTitle);
    currentMovieTitle = movieTitle;
    renderVideos(currentVideos, movieTitle);
  } catch (error) {
    showMessage(error.message);
    elements.emptyState.hidden = true;
  } finally {
    setLoading(false);
  }
});

elements.videoList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const video = displayedVideos.find(
    (item) => item.id.videoId === button.dataset.videoId,
  );
  if (!video) return;

  if (button.dataset.action === "play") {
    playVideo(video);
  } else if (button.dataset.action === "favorite") {
    toggleFavorite(video);
  }
});

elements.favoritesFilter.addEventListener("click", showFavorites);
elements.closePlayerButton.addEventListener("click", closePlayer);
elements.pipButton.addEventListener("click", openPictureInPicture);
elements.playPauseButton.addEventListener("click", () => {
  if (!youtubePlayer) return;
  if (youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) {
    youtubePlayer.pauseVideo();
  } else {
    youtubePlayer.playVideo();
  }
});
elements.seekControl.addEventListener("input", () => {
  elements.currentTime.textContent = formatTime(Number(elements.seekControl.value));
});
elements.seekControl.addEventListener("change", () => {
  if (youtubePlayer) youtubePlayer.seekTo(Number(elements.seekControl.value), true);
});
elements.volumeControl.addEventListener("input", () => {
  youtubePlayer?.setVolume(Number(elements.volumeControl.value));
});

try {
  favorites = loadFavorites();
  updateFavoriteCount();
} catch (error) {
  favoritesAvailable = false;
  elements.favoritesFilter.disabled = true;
  showMessage(error.message);
}

if (!favoritesAvailable) {
  elements.favoritesFilter.title = "Armazenamento de favoritas indisponível";
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Não foi possível registrar o service worker:", error);
    });
  });
}
