/*
 * Configuração do Spotify:
 * 1. Crie um app em https://developer.spotify.com/dashboard.
 * 2. Copie o Client ID e informe-o em SPOTIFY_CLIENT_ID abaixo.
 * 3. Em Settings > Redirect URIs, adicione a URL exata deste app no Live Server,
 *    por exemplo: http://127.0.0.1:5500/index.html
 *    A URL usada para abrir esta página deve ser idêntica à cadastrada.
 * Contas Spotify Free podem criar playlists; no modo de desenvolvimento, o
 * proprietário do app precisa de Premium e as contas de teste devem ser permitidas.
 * Este app usa Authorization Code com PKCE; não crie nem exponha um Client Secret.
 *
 * Configuração do player do YouTube:
 * 1. Ative "YouTube Data API v3" em https://console.cloud.google.com/.
 * 2. Crie uma chave de API e restrinja-a ao HTTP referrer do Live Server
 *    (por exemplo, http://127.0.0.1:5500/*) e somente à YouTube Data API v3.
 * 3. Informe a chave em YOUTUBE_API_KEY. A chave fica visível no navegador,
 *    então as restrições no Google Cloud são essenciais.
 */

const SPOTIFY_CLIENT_ID = "b06784a9d22243c78f5dc55d9f8af263";
const YOUTUBE_API_KEY = "AIzaSyCtCClONMJJnTfWWGRJeORZHEYn52nkXEA";
const REDIRECT_URI = `${window.location.origin}${window.location.pathname}`;
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const TOKEN_STORAGE_KEY = "frame-spotify-token";
const VERIFIER_STORAGE_KEY = "frame-spotify-verifier";
const STATE_STORAGE_KEY = "frame-spotify-state";
const SCOPES = ["playlist-modify-private", "user-read-private"];
const MAX_PLAYLIST_TRACKS = 100;
const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const SPOTIFY_SEARCH_LIMIT = 10;
const MAX_SOUNDTRACK_ALBUMS = 3;
const IGNORED_TITLE_WORDS = new Set(["a", "as", "o", "os", "de", "do", "da", "dos", "das", "e", "the", "of", "and", "in", "to"]);

const elements = {
  accountStatus: document.querySelector("#account-status"),
  connectButton: document.querySelector("#connect-button"),
  disconnectButton: document.querySelector("#disconnect-button"),
  form: document.querySelector("#movie-form"),
  movieTitle: document.querySelector("#movie-title"),
  generateButton: document.querySelector("#generate-button"),
  formHint: document.querySelector("#form-hint"),
  loading: document.querySelector("#loading"),
  loadingLabel: document.querySelector("#loading-label"),
  message: document.querySelector("#message"),
  results: document.querySelector("#results"),
  playlistLink: document.querySelector("#playlist-link"),
  playlistCaption: document.querySelector("#playlist-caption"),
  trackList: document.querySelector("#track-list"),
  youtubePlayer: document.querySelector("#youtube-player"),
  youtubeFrame: document.querySelector("#youtube-frame"),
  youtubeTrackTitle: document.querySelector("#youtube-track-title"),
  youtubeStatus: document.querySelector("#youtube-status"),
  youtubeFallback: document.querySelector("#youtube-fallback"),
};

let currentTracks = [];

function getStoredToken() {
  const saved = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
}

function saveToken(token) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

function updateAccountUi() {
  const token = getStoredToken();
  const connected = Boolean(
    token?.accessToken && (token.expiresAt > Date.now() || token.refreshToken),
  );

  elements.accountStatus.textContent = connected ? "Spotify conectado" : "Spotify desconectado";
  elements.connectButton.hidden = connected;
  elements.disconnectButton.hidden = !connected;
  elements.generateButton.disabled = !connected;
  elements.movieTitle.disabled = !connected;
  elements.formHint.textContent = connected
    ? "Vamos buscar trilhas sonoras e músicas relacionadas ao filme."
    : "Conecte sua conta do Spotify para começar.";
}

function showMessage(text) {
  elements.message.textContent = text;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.textContent = "";
  elements.message.hidden = true;
}

function setLoading(isLoading, label = "Procurando músicas do filme...") {
  elements.loading.hidden = !isLoading;
  elements.loadingLabel.textContent = label;
  elements.generateButton.disabled = isLoading || !getStoredToken();
  elements.connectButton.disabled = isLoading;
}

function createRandomString(length) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
}

async function createCodeChallenge(verifier) {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function connectToSpotify() {
  if (!SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID === "INSIRA_SEU_CLIENT_ID_AQUI") {
    showMessage("Insira seu Client ID do Spotify no início do arquivo app.js antes de conectar.");
    return;
  }

  const verifier = createRandomString(64);
  const state = createRandomString(24);
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const challenge = await createCodeChallenge(verifier);
  const parameters = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES.join(" "),
  });

  window.location.assign(`${AUTH_ENDPOINT}?${parameters.toString()}`);
}

async function exchangeAuthorizationCode() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const authError = url.searchParams.get("error");

  if (!code && !authError) return;
  window.history.replaceState({}, document.title, REDIRECT_URI);

  if (authError) {
    sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    throw new Error(`A autenticação foi cancelada ou recusada (${authError}).`);
  }

  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);

  if (!returnedState || returnedState !== expectedState) {
    throw new Error("Não foi possível validar a autenticação. Tente conectar novamente.");
  }
  if (!verifier) {
    throw new Error("A chave de autenticação expirou. Tente conectar novamente.");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "O Spotify não autorizou a conexão.");
  }
  saveToken({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

async function refreshAccessToken(token) {
  if (!token.refreshToken) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    updateAccountUi();
    throw new Error("Sua sessão do Spotify expirou. Conecte sua conta novamente.");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    updateAccountUi();
    throw new Error(data.error_description || "Não foi possível renovar a sessão do Spotify.");
  }

  const refreshedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveToken(refreshedToken);
  return refreshedToken.accessToken;
}

async function getAccessToken() {
  const token = getStoredToken();
  if (!token) throw new Error("Conecte sua conta do Spotify antes de gerar uma playlist.");
  if (token.expiresAt <= Date.now() + 60_000) return refreshAccessToken(token);
  return token.accessToken;
}

async function spotifyRequest(path, options = {}, canRetry = true) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && canRetry) {
    const token = getStoredToken();
    if (!token) throw new Error("Sua sessão do Spotify expirou. Conecte sua conta novamente.");
    token.expiresAt = 0;
    saveToken(token);
    return spotifyRequest(path, options, false);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const error = await response.json();
      detail = error.error?.message || error.error_description || "";
    } catch {
      detail = "";
    }
    if (response.status === 403) {
      throw new Error(
        `O Spotify negou acesso à API. Contas Free podem criar playlists, mas no modo de desenvolvimento o proprietário do app precisa ter Premium e esta conta deve estar na lista permitida em Settings > Users Management.${detail ? ` Detalhe: ${detail}` : ""}`,
      );
    }
    throw new Error(detail || `O Spotify retornou um erro (${response.status}).`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTitleTokens(movieTitle) {
  const tokens = normalizeText(movieTitle).split(/\s+/).filter((word) => word && !IGNORED_TITLE_WORDS.has(word));
  return tokens.length ? tokens : normalizeText(movieTitle).split(/\s+/).filter(Boolean);
}

function relevanceScore(candidateText, movieTitle) {
  const candidate = normalizeText(candidateText);
  const title = normalizeText(movieTitle);
  const tokens = getTitleTokens(movieTitle);
  const matches = tokens.filter((token) => candidate.split(" ").includes(token)).length;
  if (!matches) return 0;

  let score = matches * 12;
  if (candidate.includes(title)) score += 100;
  return score;
}

function getSearchQueries(movieTitle) {
  return [
    `${movieTitle} songs`,
    `music from ${movieTitle}`,
    `${movieTitle} music`,
    `"${movieTitle}"`,
  ];
}

function getAlbumSearchQueries(movieTitle) {
  return [
    `${movieTitle} original motion picture soundtrack`,
    `${movieTitle} soundtrack`,
    `${movieTitle} film score`,
  ];
}

async function searchSoundtrackAlbums(movieTitle) {
  const albumsById = new Map();

  for (const query of getAlbumSearchQueries(movieTitle)) {
    const parameters = new URLSearchParams({
      q: query,
      type: "album",
      limit: String(SPOTIFY_SEARCH_LIMIT),
    });
    const result = await spotifyRequest(`/search?${parameters.toString()}`);
    for (const album of result.albums.items) {
      const candidateText = `${album.name} ${album.artists.map((artist) => artist.name).join(" ")}`;
      const score = relevanceScore(candidateText, movieTitle);
      if (score > 0) albumsById.set(album.id, { album, score });
    }
  }

  return Array.from(albumsById.values())
    .sort((first, second) => second.score - first.score)
    .slice(0, MAX_SOUNDTRACK_ALBUMS)
    .map(({ album }) => album);
}

async function getSoundtrackAlbumTracks(album) {
  const tracks = [];
  let next = `/albums/${encodeURIComponent(album.id)}/tracks?limit=${SPOTIFY_SEARCH_LIMIT}`;

  while (next && tracks.length < MAX_PLAYLIST_TRACKS) {
    const page = await spotifyRequest(next);
    tracks.push(
      ...page.items
        .filter((track) => track.uri && track.is_playable !== false)
        .map((track) => ({
          ...track,
          album: {
            name: album.name,
            images: album.images,
            external_urls: album.external_urls,
          },
        })),
    );
    next = page.next?.replace(API_BASE, "") || null;
  }

  return tracks.slice(0, MAX_PLAYLIST_TRACKS);
}

async function searchTracks(movieTitle) {
  const tracksById = new Map();

  for (const query of getSearchQueries(movieTitle)) {
    const parameters = new URLSearchParams({
      q: query,
      type: "track",
      limit: String(SPOTIFY_SEARCH_LIMIT),
    });
    const result = await spotifyRequest(`/search?${parameters.toString()}`);
    for (const track of result.tracks.items) {
      const candidateText = `${track.name} ${track.album.name}`;
      const score = relevanceScore(candidateText, movieTitle);
      if (track.uri && track.is_playable !== false && score > 0) {
        tracksById.set(track.id, { track, score });
      }
    }
  }

  return Array.from(tracksById.values())
    .sort(
      (first, second) =>
        second.score - first.score ||
        (second.track.popularity || 0) - (first.track.popularity || 0),
    )
    .slice(0, MAX_PLAYLIST_TRACKS)
    .map(({ track }) => track);
}

async function findMovieMusic(movieTitle) {
  const albums = await searchSoundtrackAlbums(movieTitle);
  const soundtrackTracks = [];

  for (const album of albums) {
    soundtrackTracks.push(...await getSoundtrackAlbumTracks(album));
    if (soundtrackTracks.length >= MAX_PLAYLIST_TRACKS) break;
  }

  const individualTracks = await searchTracks(movieTitle);
  const uniqueTracks = new Map();
  for (const track of [...soundtrackTracks, ...individualTracks]) {
    if (uniqueTracks.size >= MAX_PLAYLIST_TRACKS) break;
    uniqueTracks.set(track.id || track.uri, track);
  }
  const tracks = Array.from(uniqueTracks.values());
  if (tracks.length) return tracks;

  throw new Error(`Não encontrei trilhas sonoras ou músicas relacionadas a "${movieTitle}" no Spotify. Tente outro título ou confira a grafia.`);
}

function renderTracks(tracks) {
  currentTracks = tracks;
  elements.trackList.replaceChildren();

  for (const [index, track] of tracks.entries()) {
    const row = document.createElement("article");
    row.className = "track-row";

    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const image = document.createElement("img");
    image.className = "track-art";
    image.alt = "";
    image.loading = "lazy";
    image.src = track.album.images?.[track.album.images.length - 1]?.url || "";

    const meta = document.createElement("div");
    meta.className = "track-meta";
    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = track.name;
    const artists = document.createElement("span");
    artists.className = "track-artist";
    artists.textContent = track.artists.map((artist) => artist.name).join(", ");
    meta.append(title, artists);

    const albumName = document.createElement("span");
    albumName.className = "track-album";
    albumName.textContent = track.album.name;

    const playButton = document.createElement("button");
    playButton.className = "button button-youtube";
    playButton.type = "button";
    playButton.dataset.trackIndex = String(index);
    playButton.setAttribute("aria-label", `Tocar ${track.name} no YouTube`);
    playButton.innerHTML = '<span aria-hidden="true">▶</span><span class="youtube-button-label">YouTube</span>';

    row.append(number, image, meta, albumName, playButton);
    elements.trackList.append(row);
  }
}

async function playOnYouTube(track, button) {
  elements.youtubePlayer.hidden = false;
  elements.youtubeFrame.hidden = true;
  elements.youtubeFrame.removeAttribute("src");
  elements.youtubeFallback.hidden = true;
  elements.youtubeTrackTitle.textContent = `${track.name} — ${track.artists.map((artist) => artist.name).join(", ")}`;
  elements.youtubeStatus.textContent = "Buscando vídeo no YouTube...";
  button.disabled = true;

  const query = `${track.name} ${track.artists.map((artist) => artist.name).join(" ")} official audio`;
  elements.youtubeFallback.href = `https://www.youtube.com/results?${new URLSearchParams({ search_query: query })}`;

  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "INSIRA_SUA_CHAVE_DA_YOUTUBE_DATA_API_AQUI") {
    elements.youtubeStatus.textContent = "Configure a chave da YouTube Data API no início de app.js para buscar vídeos.";
    elements.youtubeFallback.hidden = false;
    button.disabled = false;
    elements.youtubePlayer.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  try {
    const parameters = new URLSearchParams({
      key: YOUTUBE_API_KEY,
      part: "snippet",
      q: query,
      type: "video",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      maxResults: "5",
    });
    const response = await fetch(`${YOUTUBE_API_ENDPOINT}?${parameters.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      const apiMessage = data.error?.message || `erro ${response.status}`;
      throw new Error(apiMessage);
    }

    const videoId = data.items?.[0]?.id?.videoId;
    if (!videoId) {
      elements.youtubeStatus.textContent = "Não encontrei um vídeo incorporável para esta faixa.";
      elements.youtubeFallback.hidden = false;
      return;
    }

    elements.youtubeFrame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
    elements.youtubeFrame.title = `YouTube: ${track.name}`;
    elements.youtubeFrame.hidden = false;
    elements.youtubeStatus.textContent = "Reprodução pelo YouTube. Alguns vídeos podem não permitir incorporação.";
    elements.youtubeFallback.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    elements.youtubeFallback.hidden = false;
  } catch (error) {
    elements.youtubeStatus.textContent = `Não foi possível carregar o vídeo: ${error.message}`;
    elements.youtubeFallback.hidden = false;
  } finally {
    button.disabled = false;
    elements.youtubePlayer.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderPlaylist(playlist, tracks, movieTitle) {
  elements.playlistLink.href = playlist.external_urls.spotify;
  elements.playlistCaption.textContent = `${tracks.length} faixas · trilhas sonoras e músicas encontradas no Spotify · playlist privada`;
  elements.results.hidden = false;
  renderTracks(tracks);
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.playlistLink.setAttribute("aria-label", `Abrir a playlist de ${movieTitle} no Spotify`);
}

async function generatePlaylist(movieTitle) {
  const tracks = await findMovieMusic(movieTitle);
  setLoading(true, "Criando sua playlist...");

  const playlist = await spotifyRequest("/me/playlists", {
    method: "POST",
    body: JSON.stringify({
      name: `${movieTitle} — Trilha sonora e músicas`,
      description: `Faixas de álbuns de trilha sonora e músicas associadas a ${movieTitle}, encontradas no Spotify.`,
      public: false,
    }),
  });
  renderPlaylist(playlist, tracks, movieTitle);

  const trackUris = tracks.map((track) => track.uri);
  try {
    for (let index = 0; index < trackUris.length; index += 100) {
      await spotifyRequest(`/playlists/${encodeURIComponent(playlist.id)}/items`, {
        method: "POST",
        body: JSON.stringify({ uris: trackUris.slice(index, index + 100) }),
      });
    }
  } catch (error) {
    throw new Error(`A playlist foi criada, mas não foi possível adicionar todas as faixas. Abra a playlist e tente novamente. ${error.message}`);
  }
}

elements.connectButton.addEventListener("click", async () => {
  hideMessage();
  try {
    await connectToSpotify();
  } catch (error) {
    showMessage(`Não foi possível iniciar a conexão: ${error.message}`);
  }
});

elements.disconnectButton.addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  elements.results.hidden = true;
  hideMessage();
  updateAccountUi();
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const movieTitle = elements.movieTitle.value.trim();
  if (!movieTitle) return;

  hideMessage();
  elements.results.hidden = true;
  elements.youtubePlayer.hidden = true;
  elements.youtubeFrame.removeAttribute("src");
  setLoading(true);

  try {
    await generatePlaylist(movieTitle);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
});

elements.trackList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-track-index]");
  if (!button) return;
  const track = currentTracks[Number(button.dataset.trackIndex)];
  if (track) playOnYouTube(track, button);
});

async function initialize() {
  try {
    await exchangeAuthorizationCode();
  } catch (error) {
    showMessage(error.message);
  }
  updateAccountUi();
}

initialize();
