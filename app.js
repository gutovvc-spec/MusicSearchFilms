/*
 * A chave da YouTube Data API fica no servidor Vercel, na variável YOUTUBE_API_KEY.
 * Veja DEPLOY.md para configurar a variável e publicar o site.
 */

const YOUTUBE_API_ENDPOINT = "/api/youtube-search";
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
  formHint: document.querySelector("#form-hint"),
  message: document.querySelector("#message"),
  results: document.querySelector("#results"),
  resultsHeading: document.querySelector("#results-heading"),
  resultsCaption: document.querySelector("#playlist-caption"),
  videoList: document.querySelector("#track-list"),
  player: document.querySelector("#youtube-player"),
  playerFrame: document.querySelector("#youtube-frame"),
  playerTitle: document.querySelector("#youtube-track-title"),
  playerStatus: document.querySelector("#youtube-status"),
  youtubeFallback: document.querySelector("#youtube-fallback"),
};

let currentVideos = [];
let youtubePlayer = null;
let youtubeApiPromise = null;
let activeVideoIndex = -1;
let playbackGeneration = 0;

function showMessage(message) {
  elements.message.textContent = message;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.textContent = "";
  elements.message.hidden = true;
}

function setLoading(isLoading, message = "Buscando músicas no YouTube...") {
  elements.loading.hidden = !isLoading;
  elements.loadingLabel.textContent = message;
  elements.searchButton.disabled = isLoading;
  elements.movieTitle.disabled = isLoading;
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
      throw new Error("A busca ainda não foi configurada no Vercel. Adicione a variável YOUTUBE_API_KEY nas configurações do projeto e faça um novo deploy.");
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

function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Não foi possível carregar o player do YouTube."));
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.append(script);
  });

  return youtubeApiPromise;
}

function updateActiveVideo(video) {
  const title = video.snippet.title;
  elements.player.hidden = false;
  elements.playerTitle.textContent = title;
  elements.playerStatus.textContent = `Canal: ${video.snippet.channelTitle} · carregando player...`;
  elements.youtubeFallback.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id.videoId)}`;
  elements.youtubeFallback.hidden = false;
}

async function playVideoAtIndex(index, generation) {
  if (generation !== playbackGeneration) return;

  if (index >= currentVideos.length) {
    elements.playerStatus.textContent = "O YouTube bloqueou a reprodução incorporada dos resultados encontrados.";
    elements.youtubeFallback.hidden = false;
    return;
  }

  activeVideoIndex = index;
  const video = currentVideos[index];
  updateActiveVideo(video);

  try {
    const youtube = await loadYouTubePlayerApi();
    if (generation !== playbackGeneration) return;

    if (!youtubePlayer) {
      youtubePlayer = new youtube.Player(elements.playerFrame, {
        width: "100%",
        height: "100%",
        videoId: video.id.videoId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (generation === playbackGeneration) {
              elements.playerStatus.textContent = `Canal: ${video.snippet.channelTitle} · use os controles para reproduzir`;
              event.target.playVideo();
            }
          },
          onError: handleYouTubePlayerError,
        },
      });
    } else {
      elements.playerStatus.textContent = `Canal: ${video.snippet.channelTitle} · carregando vídeo...`;
      youtubePlayer.loadVideoById(video.id.videoId);
    }

    elements.player.scrollIntoView({ behavior: "smooth", block: "center" });
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

  if (canTryNextVideo && failedIndex + 1 < currentVideos.length) {
    elements.playerStatus.textContent = "Este vídeo não pode ser reproduzido aqui. Tentando o próximo resultado...";
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

function playVideo(video, index) {
  playbackGeneration += 1;
  elements.player.hidden = false;
  playVideoAtIndex(index, playbackGeneration);
}

function renderVideos(videos, movieTitle) {
  elements.videoList.replaceChildren();
  elements.resultsHeading.textContent = `Vídeos sobre ${movieTitle}`;
  elements.resultsCaption.textContent =
    `${videos.length} vídeos com sinais de lançamento oficial; covers, remixes e vídeos de fãs são removidos. A API não consegue confirmar 100% a origem nem a cena do filme.`;

  for (const [index, video] of videos.entries()) {
    const snippet = video.snippet;
    const row = document.createElement("article");
    row.className = "track-row video-row";

    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const image = document.createElement("img");
    image.className = "track-art video-thumbnail";
    image.alt = "";
    image.loading = "lazy";
    image.src =
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      "";

    const meta = document.createElement("div");
    meta.className = "track-meta";

    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = snippet.title;

    const channel = document.createElement("span");
    channel.className = "track-artist";
    channel.textContent = snippet.channelTitle;
    meta.append(title, channel);

    const playButton = document.createElement("button");
    playButton.className = "button button-youtube";
    playButton.type = "button";
    playButton.dataset.videoIndex = String(index);
    playButton.setAttribute("aria-label", `Reproduzir ${snippet.title}`);
    playButton.innerHTML = '<span aria-hidden="true">▶</span><span class="youtube-button-label">Assistir</span>';

    row.append(number, image, meta, playButton);
    elements.videoList.append(row);
  }

  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const movieTitle = elements.movieTitle.value.trim();
  if (!movieTitle) return;

  hideMessage();
  elements.results.hidden = true;
  elements.player.hidden = true;
  playbackGeneration += 1;
  youtubePlayer?.stopVideo();
  elements.youtubeFallback.hidden = true;
  setLoading(true);

  try {
    currentVideos = await findMovieVideos(movieTitle);
    if (!currentVideos.length) {
      throw new Error(`Não encontrei vídeos para "${movieTitle}". Tente outro título.`);
    }
    renderVideos(currentVideos, movieTitle);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
});

elements.videoList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-video-index]");
  if (!button) return;

  const video = currentVideos[Number(button.dataset.videoIndex)];
  if (video) playVideo(video, Number(button.dataset.videoIndex));
});
