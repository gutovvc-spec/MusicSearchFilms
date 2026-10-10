/*
 * Configuração:
 * 1. Ative "YouTube Data API v3" em https://console.cloud.google.com/.
 * 2. Crie uma chave e restrinja-a ao endereço do Live Server, por exemplo
 *    http://127.0.0.1:5500/*, e somente à YouTube Data API v3.
 * 3. Cole a chave abaixo. Como ela é usada no navegador, mantenha as restrições
 *    de site e API ativas no Google Cloud.
 */

const YOUTUBE_API_KEY = "AIzaSyCtCClONMJJnTfWWGRJeORZHEYn52nkXEA";
const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_SEARCH_LIMIT = 10;

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
    `songs featured in ${movieTitle} movie`,
    `music from ${movieTitle} movie`,
    `${movieTitle} soundtrack songs`,
  ];
}

async function searchYouTube(query) {
  const parameters = new URLSearchParams({
    key: YOUTUBE_API_KEY,
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    maxResults: String(YOUTUBE_SEARCH_LIMIT),
    regionCode: "BR",
    relevanceLanguage: "pt",
  });
  const response = await fetch(`${YOUTUBE_API_ENDPOINT}?${parameters}`);
  const data = await response.json();

  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") {
      throw new Error("A cota diária gratuita da busca do YouTube acabou. Tente novamente amanhã.");
    }
    if (response.status === 403) {
      throw new Error("O Google recusou a chave. Confira se a YouTube Data API v3 está ativada e se a chave permite o endereço do Live Server.");
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
    if (id && !videos.has(id)) videos.set(id, video);
  }

  return Array.from(videos.values());
}

function playVideo(video) {
  const videoId = video.id.videoId;
  const title = video.snippet.title;

  elements.player.hidden = false;
  elements.playerTitle.textContent = title;
  elements.playerStatus.textContent = `Canal: ${video.snippet.channelTitle}`;
  elements.playerFrame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
  elements.playerFrame.title = `YouTube: ${title}`;
  elements.playerFrame.hidden = false;
  elements.youtubeFallback.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  elements.youtubeFallback.hidden = false;
  elements.player.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderVideos(videos, movieTitle) {
  elements.videoList.replaceChildren();
  elements.resultsHeading.textContent = `Vídeos sobre ${movieTitle}`;
  elements.resultsCaption.textContent =
    `${videos.length} resultados do YouTube. Confira o título e o canal: a busca não confirma em qual cena cada música toca.`;

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

let currentVideos = [];

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const movieTitle = elements.movieTitle.value.trim();
  if (!movieTitle) return;

  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "COLE_SUA_CHAVE_RESTRITA_AQUI") {
    showMessage("Configure sua chave restrita da YouTube Data API no início de app.js para buscar vídeos.");
    return;
  }

  hideMessage();
  elements.results.hidden = true;
  elements.player.hidden = true;
  elements.playerFrame.hidden = true;
  elements.playerFrame.removeAttribute("src");
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
  if (video) playVideo(video);
});
