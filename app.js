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
 */

const SPOTIFY_CLIENT_ID = "b06784a9d22243c78f5dc55d9f8af263";
const REDIRECT_URI = `${window.location.origin}${window.location.pathname}`;
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const TOKEN_STORAGE_KEY = "frame-spotify-token";
const VERIFIER_STORAGE_KEY = "frame-spotify-verifier";
const STATE_STORAGE_KEY = "frame-spotify-state";
const SCOPES = ["playlist-modify-private", "user-read-private"];
const MAX_PLAYLIST_TRACKS = 100;
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
};

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
    ? "Vamos buscar faixas relacionadas ao filme no Spotify."
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

async function searchTracks(movieTitle) {
  const tracksById = new Map();

  for (const query of getSearchQueries(movieTitle)) {
    const parameters = new URLSearchParams({ q: query, type: "track", limit: "20" });
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

async function findFeaturedSongs(movieTitle) {
  const tracks = await searchTracks(movieTitle);
  if (tracks.length) return tracks;

  throw new Error(`Não encontrei músicas relacionadas a "${movieTitle}" no Spotify. Tente outro título ou confira a grafia.`);
}

function renderTracks(tracks) {
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

    row.append(number, image, meta, albumName);
    elements.trackList.append(row);
  }
}

function renderPlaylist(playlist, tracks, movieTitle) {
  elements.playlistLink.href = playlist.external_urls.spotify;
  elements.playlistCaption.textContent = `${tracks.length} faixas · playlist privada · resultados aproximados do Spotify`;
  elements.results.hidden = false;
  renderTracks(tracks);
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.playlistLink.setAttribute("aria-label", `Abrir a playlist de ${movieTitle} no Spotify`);
}

async function generatePlaylist(movieTitle) {
  const tracks = await findFeaturedSongs(movieTitle);
  setLoading(true, "Criando sua playlist...");

  const playlist = await spotifyRequest("/me/playlists", {
    method: "POST",
    body: JSON.stringify({
      name: `${movieTitle} — Músicas do filme`,
      description: `Faixas encontradas no Spotify a partir da busca por músicas associadas ao filme ${movieTitle}.`,
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
  setLoading(true);

  try {
    await generatePlaylist(movieTitle);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
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
