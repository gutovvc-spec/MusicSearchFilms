const APP_STORAGE_KEY = "minhas-musicas";
const THEME_STORAGE_KEY = `${APP_STORAGE_KEY}:theme`;
const DATABASE_NAME = "minhas-musicas-media";
const AUDIO_BUCKET = "music-files";
const MAX_LOCAL_IMAGE_BYTES = 1024 * 1024;
const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const THEME_COLORS = {
  mint: "#a6ed8e",
  violet: "#c6a6ff",
  blue: "#80cde7",
  rose: "#ff91b4",
  amber: "#ffc779",
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  sidebar: $("#sidebar"),
  sidebarScrim: $("#sidebar-scrim"),
  playlistNav: $("#playlist-nav"),
  playlistGrid: $("#playlist-grid"),
  emptyState: $("#empty-state"),
  filterInput: $("#filter-input"),
  tracksSection: $("#tracks-section"),
  trackList: $("#track-list"),
  tracksTitle: $("#tracks-title"),
  tracksKicker: $("#tracks-kicker"),
  embedWrap: $("#embed-wrap"),
  playlistSourceLink: $("#playlist-source-link"),
  message: $("#message"),
  playerBar: $("#player-bar"),
  audio: $("#audio-player"),
  audioInput: $("#audio-input"),
  playerTitle: $("#player-title"),
  playerSubtitle: $("#player-subtitle"),
  playerCover: $("#player-cover"),
  playerPlay: $("#player-play"),
  progress: $("#progress"),
  elapsedTime: $("#elapsed-time"),
  totalTime: $("#total-time"),
  downloadTrack: $("#download-track"),
  playerLike: $("#player-like"),
  favoriteCount: $("#favorite-count"),
  storageBadge: $("#storage-badge"),
  syncTitle: $("#sync-title"),
  syncCopy: $("#sync-copy"),
  accountButton: $("#account-button"),
  topAccountButton: $("#top-account-button"),
  playlistDialog: $("#playlist-dialog"),
  playlistForm: $("#playlist-form"),
  linkTrackDialog: $("#link-track-dialog"),
  linkTrackForm: $("#link-track-form"),
  settingsDialog: $("#settings-dialog"),
  accountDialog: $("#account-dialog"),
  accountForm: $("#account-form"),
  confirmDialog: $("#confirm-dialog"),
};

let supabaseClient = null;
let currentUser = null;
let playlists = [];
let favorites = [];
let activePlaylistId = null;
let activeTrack = null;
let activeLinkedTrackId = null;
let playbackQueue = [];
let selectedCoverStyle = "sunset";
let accountMode = "signin";
let deletePlaylistId = null;
let syncPromise = Promise.resolve();
let mediaDatabasePromise;
let progressTimer = null;

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setMessage(text, isError = true) {
  ui.message.textContent = text;
  ui.message.classList.toggle("message-success", !isError);
  ui.message.hidden = false;
}

function hideMessage() {
  ui.message.hidden = true;
  ui.message.textContent = "";
}

function getStorageKey() {
  return currentUser ? `${APP_STORAGE_KEY}:user:${currentUser.id}` : `${APP_STORAGE_KEY}:local`;
}

function loadLocalData(storageKey = getStorageKey()) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return { playlists: [], favorites: [] };
  const data = JSON.parse(saved);
  if (!data || !Array.isArray(data.playlists) || !Array.isArray(data.favorites)) {
    throw new Error("Os dados salvos da biblioteca estão inválidos. Exporte-os antes de limpar os dados deste site.");
  }
  return {
    playlists: data.playlists.filter((item) => item && typeof item.id === "string" && typeof item.name === "string"),
    favorites: data.favorites.filter((item) => typeof item === "string"),
  };
}

function persistLocalData() {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify({ playlists, favorites }));
  } catch (error) {
    throw new Error(`Não foi possível salvar a biblioteca neste dispositivo: ${error.message}`);
  }
}

function openMediaDatabase() {
  if (mediaDatabasePromise) return mediaDatabasePromise;
  mediaDatabasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador não oferece armazenamento local para arquivos de áudio."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("audio")) {
        request.result.createObjectStore("audio");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento local de áudio."));
  });
  return mediaDatabasePromise;
}

async function storeLocalAudio(id, file) {
  const db = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("audio", "readwrite");
    transaction.objectStore("audio").put(file, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar o áudio neste dispositivo."));
  });
}

async function getLocalAudio(id) {
  const db = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("audio", "readonly").objectStore("audio").get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o áudio guardado."));
  });
}

async function deleteLocalAudio(id) {
  const db = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("audio", "readwrite");
    transaction.objectStore("audio").delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível remover o áudio guardado."));
  });
}

function isSupabaseConfigured() {
  const config = window.MINHAS_MUSICAS_SUPABASE;
  return Boolean(
    config &&
      typeof config.url === "string" &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url) &&
      typeof config.anonKey === "string" &&
      config.anonKey.length > 20 &&
      !config.anonKey.includes("YOUR_"),
  );
}

function initializeSupabase() {
  if (isSupabaseConfigured() && window.supabase?.createClient) {
    const config = window.MINHAS_MUSICAS_SUPABASE;
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (session?.user?.id !== currentUser?.id) {
        window.setTimeout(() => void activateUser(session?.user || null), 0);
      }
    });
  }
  updateAccountUi();
}

async function activateUser(user) {
  currentUser = user;
  try {
    const userStorageKey = getStorageKey();
    if (user && !localStorage.getItem(userStorageKey)) {
      const deviceData = localStorage.getItem(`${APP_STORAGE_KEY}:local`);
      if (deviceData) localStorage.setItem(userStorageKey, deviceData);
    }
    const local = loadLocalData(userStorageKey);
    playlists = local.playlists;
    favorites = local.favorites;
    if (user && supabaseClient) {
      await syncLocalPlaylists();
      await loadCloudPlaylists();
    }
    await refreshCloudAudioUrls();
    renderAll();
    updateAccountUi();
  } catch (error) {
    setMessage(error.message);
    renderAll();
    updateAccountUi();
  }
}

function updateAccountUi() {
  const connected = Boolean(currentUser);
  ui.accountButton.textContent = connected ? "Sair da conta" : (isSupabaseConfigured() ? "Conectar conta" : "Configurar Supabase");
  ui.syncTitle.textContent = connected ? "Conta conectada" : "Suas músicas, em todo lugar";
  ui.syncCopy.textContent = connected
    ? `Sincronizado como ${currentUser.email || "sua conta"}.`
    : isSupabaseConfigured()
      ? "Entre para sincronizar suas playlists entre dispositivos."
      : "Adicione as credenciais do Supabase para sincronizar entre dispositivos.";
  ui.storageBadge.classList.toggle("is-synced", connected);
  ui.storageBadge.lastChild.textContent = connected ? " Sincronizado" : " Neste dispositivo";
  ui.topAccountButton.textContent = connected ? (currentUser.email || "V").slice(0, 1).toUpperCase() : "V";
  ui.topAccountButton.setAttribute("aria-label", connected ? `Conta ${currentUser.email}` : "Conta");
}

function showAccountDialog() {
  if (!supabaseClient) {
    setMessage(
      isSupabaseConfigured()
        ? "A biblioteca do Supabase não carregou. Verifique sua conexão e tente novamente."
        : "Para ativar a sincronização, preencha supabase-config.js e configure as tabelas conforme supabase/schema.sql.",
    );
    return;
  }
  if (currentUser) {
    void supabaseClient.auth.signOut().then(({ error }) => {
      if (error) throw error;
      void activateUser(null);
    }).catch((error) => setMessage(`Não foi possível sair da conta: ${error.message}`));
    return;
  }
  ui.accountDialog.showModal();
}

async function syncLocalPlaylists() {
  if (!currentUser || !supabaseClient || playlists.length === 0) return;
  const payload = playlists.map((playlist) => ({
    id: playlist.id,
    user_id: currentUser.id,
    name: playlist.name,
    source_url: playlist.url || null,
    cover_url: playlist.cover || null,
    cover_style: playlist.coverStyle || "sunset",
    tracks: (playlist.tracks || []).map(({ signedUrl, ...track }) => track),
    favorites,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseClient.from("playlists").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`A sincronização das playlists falhou: ${error.message}`);
}

async function loadCloudPlaylists() {
  if (!currentUser || !supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("playlists")
    .select("id,name,source_url,cover_url,cover_style,tracks,favorites,updated_at")
    .eq("user_id", currentUser.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Não foi possível carregar suas playlists do Supabase: ${error.message}`);
  playlists = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    url: row.source_url || "",
    cover: row.cover_url || "",
    coverStyle: row.cover_style || "sunset",
    tracks: Array.isArray(row.tracks) ? row.tracks : [],
  }));
  if (data?.length && Array.isArray(data[0].favorites)) favorites = data[0].favorites;
  persistLocalData();
}

async function refreshCloudAudioUrls() {
  if (!currentUser || !supabaseClient) return;
  for (const playlist of playlists) {
    for (const track of playlist.tracks || []) {
      if (!track.storagePath) continue;
      const { data, error } = await supabaseClient.storage.from(AUDIO_BUCKET).createSignedUrl(track.storagePath, 3600);
      if (error) throw new Error(`Não foi possível abrir "${track.title}" no armazenamento privado: ${error.message}`);
      track.signedUrl = data.signedUrl;
    }
  }
}

function enqueueSync() {
  if (!currentUser || !supabaseClient) return;
  syncPromise = syncPromise
    .then(() => syncLocalPlaylists())
    .catch((error) => setMessage(error.message));
}

function renderAll() {
  renderPlaylistNav();
  renderPlaylistGrid();
  renderTracks();
  updateFavoriteCount();
  ui.emptyState.hidden = playlists.length > 0;
  ui.favoriteCount.textContent = String(favorites.length);
}

function getVisiblePlaylists() {
  const query = ui.filterInput.value.trim().toLocaleLowerCase("pt-BR");
  if (!query) return playlists;
  return playlists.filter((playlist) =>
    [playlist.name, playlist.url, ...(playlist.tracks || []).map((track) => `${track.title} ${track.artist}`)]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(query),
  );
}

function getPlaylist(playlistId) {
  return playlists.find((playlist) => playlist.id === playlistId);
}

function makePlaylistArtwork(playlist, className = "playlist-cover") {
  const art = document.createElement("span");
  art.className = `${className} cover-${playlist.coverStyle || "sunset"}`;
  const coverUrl = safeHttpUrl(playlist.cover);
  if (coverUrl) {
    const image = document.createElement("img");
    image.src = coverUrl;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    art.append(image);
  } else {
    const glyph = document.createElement("span");
    glyph.className = "playlist-cover-glyph";
    glyph.textContent = playlist.name.trim().charAt(0).toUpperCase() || "♪";
    art.append(glyph);
  }
  return art;
}

function renderPlaylistNav() {
  ui.playlistNav.replaceChildren();
  playlists.slice(0, 20).forEach((playlist) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nav-item${playlist.id === activePlaylistId ? " active" : ""}`;
    button.dataset.playlistId = playlist.id;
    const cover = makePlaylistArtwork(playlist, "nav-playlist-art");
    if (!playlist.cover) cover.classList.add("nav-playlist-fallback");
    button.append(cover);
    const title = document.createElement("span");
    title.className = "nav-playlist-title";
    title.textContent = playlist.name;
    button.append(title);
    ui.playlistNav.append(button);
  });
}

function renderPlaylistGrid() {
  ui.playlistGrid.replaceChildren();
  const items = getVisiblePlaylists();
  items.forEach((playlist) => {
    const card = document.createElement("article");
    card.className = `playlist-card${playlist.id === activePlaylistId ? " is-selected" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("aria-label", `Abrir playlist ${playlist.name}`);
    card.dataset.playlistId = playlist.id;
    card.append(makePlaylistArtwork(playlist));

    const play = document.createElement("span");
    play.className = "playlist-play-overlay";
    play.setAttribute("aria-hidden", "true");
    play.innerHTML = '<svg><use href="#i-play"/></svg>';
    card.append(play);
    const more = document.createElement("button");
    more.className = "playlist-more";
    more.type = "button";
    more.dataset.action = "delete";
    more.dataset.playlistId = playlist.id;
    more.setAttribute("aria-label", `Remover playlist ${playlist.name}`);
    more.innerHTML = "<span aria-hidden=\"true\">···</span>";
    card.append(more);

    const meta = document.createElement("span");
    meta.className = "playlist-meta";
    const title = document.createElement("strong");
    title.textContent = playlist.name;
    const description = document.createElement("span");
    const trackCount = playlist.tracks?.length || 0;
    description.textContent = playlist.url
      ? `${getProviderName(playlist.url)} · player oficial`
      : `${trackCount} ${trackCount === 1 ? "faixa" : "faixas"}${playlist.id.startsWith("favorites") ? "" : " · biblioteca"}`;
    meta.append(title, description);
    card.append(meta);
    ui.playlistGrid.append(card);
  });
  ui.emptyState.hidden = playlists.length > 0 || ui.filterInput.value.length > 0;
  if (items.length === 0 && playlists.length > 0) {
    ui.emptyState.hidden = false;
    ui.emptyState.querySelector("h3").textContent = "Nada encontrado";
    ui.emptyState.querySelector("p").textContent = "Tente outro título ou artista.";
    ui.emptyState.querySelector(".primary-button").hidden = true;
  } else {
    ui.emptyState.querySelector("h3").textContent = "A música começa por você";
    ui.emptyState.querySelector("p").textContent = "Crie sua primeira playlist ou adicione um link do Spotify ou YouTube.";
    ui.emptyState.querySelector(".primary-button").hidden = false;
  }
}

function getFavoriteTracks() {
  const saved = [];
  for (const playlist of playlists) {
    for (const track of playlist.tracks || []) {
      if (favorites.includes(track.id)) saved.push({ ...track, playlistName: playlist.name });
    }
  }
  return saved;
}

function renderTracks() {
  const isFavorites = activePlaylistId === "favorites";
  const playlist = isFavorites ? null : getPlaylist(activePlaylistId);
  if (!isFavorites && !playlist) {
    ui.tracksSection.hidden = true;
    ui.embedWrap.replaceChildren();
    ui.embedWrap.hidden = true;
    activeLinkedTrackId = null;
    return;
  }
  ui.tracksSection.hidden = false;
  ui.trackList.replaceChildren();
  ui.embedWrap.replaceChildren();
  ui.embedWrap.hidden = true;
  ui.embedWrap.classList.remove("youtube");
  const tracks = isFavorites
    ? getFavoriteTracks()
    : (playlist.tracks || []).map((track) => ({ ...track, playlistName: playlist.name }));

  ui.tracksTitle.textContent = isFavorites ? "Suas curtidas" : playlist.name;
  ui.tracksKicker.textContent = isFavorites ? "SUAS FAIXAS FAVORITAS" : `${tracks.length} ${tracks.length === 1 ? "FAIXA" : "FAIXAS"}`;
  const isYouTubePlaylist = playlist?.url && getProviderName(playlist.url) === "YouTube";
  ui.playlistSourceLink.hidden = !playlist?.url || isYouTubePlaylist;
  if (playlist?.url && !isYouTubePlaylist) {
    ui.playlistSourceLink.onclick = () => window.open(playlist.url, "_blank", "noopener,noreferrer");
  }

  const selectedLinkedTrack = tracks.find((track) => track.id === activeLinkedTrackId && track.url);
  if (selectedLinkedTrack) renderOfficialEmbed(playlist || findTrackPlaylist(selectedLinkedTrack.id), selectedLinkedTrack);
  else if (playlist?.url) renderOfficialEmbed(playlist);
  const query = ui.filterInput.value.trim().toLocaleLowerCase("pt-BR");
  const visibleTracks = tracks.filter((track) => !query || `${track.title} ${track.artist} ${track.playlistName}`.toLocaleLowerCase("pt-BR").includes(query));
  visibleTracks.forEach((track, index) => ui.trackList.append(createTrackRow(track, index, isFavorites)));
  ui.trackList.hidden = visibleTracks.length === 0;
  $("#add-track").hidden = isFavorites;
  $("#add-link-track").hidden = isFavorites;
  if (!isFavorites && tracks.length === 0 && !playlist.url) {
    const note = document.createElement("p");
    note.className = "dialog-note";
    note.textContent = "Adicione arquivos de áudio que você tem autorização para usar. Os arquivos ficam neste dispositivo ou na sua conta privada do Supabase.";
    ui.trackList.append(note);
    ui.trackList.hidden = false;
  }
}

function renderOfficialEmbed(playlist, track = null) {
  const embedUrl = getEmbedUrl(track?.url || playlist?.url);
  if (!embedUrl) return;
  const frame = document.createElement("iframe");
  const playerUrl = new URL(embedUrl);
  if (track) playerUrl.searchParams.set("autoplay", "1");
  frame.src = playerUrl.href;
  frame.title = `${getProviderName(track?.url || playlist.url)}: ${track?.title || playlist.name}`;
  frame.loading = "lazy";
  frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  ui.embedWrap.classList.toggle("youtube", embedUrl.includes("youtube"));
  ui.embedWrap.append(frame);
  ui.embedWrap.hidden = false;
}

function createTrackRow(track, index, favoritesView = false) {
  const row = document.createElement("div");
  row.className = `track-row${activeTrack?.id === track.id || activeLinkedTrackId === track.id ? " is-playing" : ""}`;
  const number = document.createElement("span");
  number.className = "track-number";
  number.textContent = String(index + 1).padStart(2, "0");
  const thumb = document.createElement("span");
  thumb.className = "track-thumb";
  const videoId = track.url ? getYoutubeVideoId(track.url) : null;
  const cover = safeHttpUrl(track.cover) || (videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : null);
  if (cover) {
    const image = document.createElement("img");
    image.src = cover;
    image.alt = "";
    image.loading = "lazy";
    thumb.append(image);
  } else {
    thumb.textContent = "♪";
  }
  const text = document.createElement("span");
  text.className = "track-text";
  const title = document.createElement("strong");
  title.textContent = track.title;
  const artist = document.createElement("span");
  artist.textContent = favoritesView ? `${track.artist || "Artista desconhecido"} · ${track.playlistName}` : track.artist || "Arquivo de áudio";
  text.append(title, artist);
  const duration = document.createElement("span");
  duration.className = "track-duration";
  duration.textContent = track.duration ? formatTime(track.duration) : "";
  const play = document.createElement("button");
  play.className = "track-action";
  play.type = "button";
  play.dataset.action = "play-track";
  play.dataset.trackId = track.id;
  play.dataset.playlistId = findTrackPlaylist(track.id)?.id || "";
  const isTrackActive = track.url
    ? activeLinkedTrackId === track.id
    : activeTrack?.id === track.id && !ui.audio.paused;
  play.setAttribute("aria-label", isTrackActive ? "Reproduzindo" : `Reproduzir ${track.title}`);
  play.innerHTML = `<svg><use href="${isTrackActive ? "#i-pause" : "#i-play"}"/></svg>`;
  row.append(number, thumb, text, duration, play);
  if (track.storagePath || track.localAudioId) {
    const download = document.createElement("button");
    download.className = "track-action track-download";
    download.type = "button";
    download.dataset.action = "download-track";
    download.dataset.trackId = track.id;
    download.dataset.playlistId = findTrackPlaylist(track.id)?.id || "";
    download.setAttribute("aria-label", `Baixar ${track.title}`);
    download.innerHTML = '<svg><use href="#i-download"/></svg>';
    row.append(download);
  }
  return row;
}

function findTrackPlaylist(trackId) {
  return playlists.find((playlist) => playlist.tracks?.some((track) => track.id === trackId)) || null;
}

function updateFavoriteCount() {
  ui.favoriteCount.textContent = String(favorites.length);
  $("#liked-caption").textContent = `${favorites.length} ${favorites.length === 1 ? "faixa curtida" : "faixas curtidas"}`;
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function getProviderName(value) {
  const url = safeHttpUrl(value);
  if (!url) return "Link";
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host.includes("spotify") ? "Spotify" : host.includes("youtube") || host === "youtu.be" ? "YouTube" : "Link";
}

function getYoutubeVideoId(value) {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  if (!(parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com") || parsed.hostname === "youtu.be")) return null;
  const videoId = parsed.hostname === "youtu.be"
    ? parsed.pathname.split("/").filter(Boolean)[0]
    : parsed.searchParams.get("v") || parsed.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,20})/)?.[1];
  return videoId && /^[\w-]{6,20}$/.test(videoId) ? videoId : null;
}

function getEmbedUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  if ((parsed.hostname === "open.spotify.com" || parsed.hostname === "spotify.com") && parsed.pathname.includes("/")) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const itemIndex = parts.findIndex((part) => ["playlist", "track", "album", "artist", "episode", "show"].includes(part));
    if (itemIndex < 0 || !parts[itemIndex + 1]) return null;
    return `https://open.spotify.com/embed/${parts[itemIndex]}/${encodeURIComponent(parts[itemIndex + 1])}?utm_source=generator`;
  }
  if (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com") || parsed.hostname === "youtu.be") {
    const videoId = getYoutubeVideoId(url);
    if (videoId && /^[\w-]{6,20}$/.test(videoId)) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
    const listId = parsed.searchParams.get("list");
    if (listId) return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
  }
  return null;
}

function showPlaylistDialog() {
  ui.playlistForm.reset();
  $("#playlist-dialog-title").textContent = "Nova playlist";
  $("#playlist-form .dialog-submit").textContent = "Criar playlist";
  $("#playlist-url").value = "";
  $("#playlist-name").value = "";
  selectedCoverStyle = "sunset";
  document.querySelectorAll(".cover-swatch").forEach((item) => item.classList.toggle("selected", item.dataset.cover === selectedCoverStyle));
  ui.playlistDialog.showModal();
}

function createPlaylist(name, url = "", cover = "", coverStyle = "sunset") {
  const playlist = { id: createId(), name: name.trim(), url: url.trim(), cover: cover.trim(), coverStyle, tracks: [] };
  playlists.unshift(playlist);
  persistLocalData();
  enqueueSync();
  activePlaylistId = playlist.id;
  renderAll();
  return playlist;
}

function handlePlaylistSubmit(event) {
  event.preventDefault();
  hideMessage();
  const name = $("#playlist-name").value.trim();
  const rawUrl = $("#playlist-url").value.trim();
  const cover = $("#playlist-cover").value.trim();
  if (!name) return;
  const safeUrl = rawUrl ? safeHttpUrl(rawUrl) : "";
  const safeCover = cover ? safeHttpUrl(cover) : "";
  if (rawUrl && !safeUrl) {
    setMessage("Informe um link válido começando com https:// para Spotify ou YouTube.");
    return;
  }
  if (rawUrl && !getEmbedUrl(safeUrl)) {
    setMessage("Esse endereço não parece ser um link direto de playlist, faixa, álbum, vídeo ou lista do Spotify/YouTube.");
    return;
  }
  if (cover && !safeCover) {
    setMessage("A imagem de capa deve usar um endereço http:// ou https:// válido.");
    return;
  }
  try {
    const playlist = createPlaylist(name, safeUrl || "", safeCover || "", selectedCoverStyle);
    ui.playlistDialog.close();
    setMessage(`Playlist "${playlist.name}" criada.`, false);
  } catch (error) {
    setMessage(error.message);
  }
}

function showLinkTrackDialog() {
  const playlist = getPlaylist(activePlaylistId);
  if (!playlist) {
    setMessage("Abra uma playlist antes de adicionar um link.");
    return;
  }
  ui.linkTrackForm.reset();
  $("#link-track-error").hidden = true;
  ui.linkTrackDialog.showModal();
  $("#track-link-url").focus();
}

function handleLinkTrackSubmit(event) {
  event.preventDefault();
  hideMessage();
  const playlist = getPlaylist(activePlaylistId);
  if (!playlist) {
    setMessage("Abra uma playlist antes de adicionar um link.");
    ui.linkTrackDialog.close();
    return;
  }

  const rawUrl = $("#track-link-url").value.trim();
  const safeUrl = safeHttpUrl(rawUrl);
  const title = $("#track-link-title").value.trim();
  if (!safeUrl) {
    setLinkTrackError("Informe um link válido começando com https://.");
    return;
  }

  const provider = getProviderName(safeUrl);
  const parsedUrl = new URL(safeUrl);
  const isYouTubeLink = provider === "YouTube" && (getYoutubeVideoId(safeUrl) || parsedUrl.searchParams.has("list"));
  const isSpotifyLink = provider === "Spotify" && parsedUrl.pathname.split("/").some((part) => ["track", "playlist", "album", "artist", "episode", "show"].includes(part));
  if (!getEmbedUrl(safeUrl) || (!isYouTubeLink && !isSpotifyLink)) {
    setLinkTrackError("Use um link válido de faixa, vídeo ou playlist do YouTube ou Spotify.");
    return;
  }

  const spotifyType = parsedUrl.pathname.split("/").find((part) => ["track", "playlist", "album", "artist", "episode", "show"].includes(part));
  const spotifyTitles = {
    track: "Faixa do Spotify",
    playlist: "Playlist do Spotify",
    album: "Álbum do Spotify",
    artist: "Artista do Spotify",
    episode: "Episódio do Spotify",
    show: "Programa do Spotify",
  };
  const defaultTitle = provider === "YouTube"
    ? getYoutubeVideoId(safeUrl) ? "Vídeo do YouTube" : "Playlist do YouTube"
    : spotifyTitles[spotifyType] || "Link do Spotify";
  const track = {
    id: createId(),
    title: title || defaultTitle,
    artist: provider,
    url: safeUrl,
  };
  playlist.tracks = playlist.tracks || [];
  playlist.tracks.push(track);
  try {
    persistLocalData();
    enqueueSync();
    activePlaylistId = playlist.id;
    playbackQueue = playlist.tracks;
    renderAll();
    ui.linkTrackDialog.close();
    setMessage(`Link adicionado à playlist "${playlist.name}".`, false);
  } catch (error) {
    playlist.tracks.pop();
    setLinkTrackError(error.message);
  }
}

function setLinkTrackError(message) {
  const error = $("#link-track-error");
  error.textContent = message;
  error.hidden = false;
}

function openPlaylist(playlistId) {
  if (activePlaylistId !== playlistId) activeLinkedTrackId = null;
  activePlaylistId = playlistId;
  const playlist = getPlaylist(playlistId);
  if (playlist) playbackQueue = playlist.tracks || [];
  ui.tracksSection.scrollIntoView({ behavior: "smooth", block: "start" });
  closeSidebar();
  renderAll();
}

function showFavorites() {
  activeLinkedTrackId = null;
  activePlaylistId = "favorites";
  playbackQueue = getFavoriteTracks();
  ui.tracksSection.scrollIntoView({ behavior: "smooth", block: "start" });
  closeSidebar();
  renderAll();
}

function startDeletePlaylist(playlistId) {
  const playlist = getPlaylist(playlistId);
  if (!playlist) return;
  deletePlaylistId = playlistId;
  $("#confirm-title").textContent = `Remover “${playlist.name}”?`;
  $("#confirm-copy").textContent = "A playlist e as informações dela serão removidas da biblioteca sincronizada. Arquivos de áudio salvos separadamente não serão apagados do armazenamento.";
  ui.confirmDialog.showModal();
}

async function confirmDeletePlaylist() {
  const playlist = getPlaylist(deletePlaylistId);
  if (!playlist) return;
  try {
    if (currentUser && supabaseClient) {
      const { error } = await supabaseClient.from("playlists").delete().eq("id", playlist.id).eq("user_id", currentUser.id);
      if (error) throw new Error(`Não foi possível remover a playlist no Supabase: ${error.message}`);
    }
    playlists = playlists.filter((item) => item.id !== playlist.id);
    favorites = favorites.filter((trackId) => !playlist.tracks?.some((track) => track.id === trackId));
    if (activePlaylistId === playlist.id) activePlaylistId = null;
    if (activeTrack && playlist.tracks?.some((track) => track.id === activeTrack.id)) stopAudio();
    persistLocalData();
    renderAll();
    ui.confirmDialog.close();
    setMessage("Playlist removida.", false);
  } catch (error) {
    setMessage(error.message);
  }
}

async function addAudioFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  hideMessage();
  let playlist = getPlaylist(activePlaylistId);
  if (!playlist || playlist.url) playlist = playlists.find((item) => !item.url);
  try {
    if (!playlist) playlist = createPlaylist("Meus arquivos", "", "", "forest");
    for (const file of files) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|ogg|wav|flac|aac|opus)$/i.test(file.name)) {
        throw new Error(`"${file.name}" não parece ser um arquivo de áudio compatível.`);
      }
      if (file.size > MAX_AUDIO_BYTES) {
        throw new Error(`"${file.name}" excede o limite de 40 MB por arquivo.`);
      }
      const trackId = createId();
      const track = {
        id: trackId,
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "Arquivo pessoal",
        mimeType: file.type || "audio/mpeg",
        size: file.size,
      };
      if (currentUser && supabaseClient) {
        const storagePath = `${currentUser.id}/${trackId}-${safeFileName(file.name)}`;
        const { error } = await supabaseClient.storage.from(AUDIO_BUCKET).upload(storagePath, file, {
          contentType: track.mimeType,
          upsert: false,
        });
        if (error) throw new Error(`Não foi possível enviar "${file.name}" para o Supabase: ${error.message}`);
        track.storagePath = storagePath;
        const { data, error: signedError } = await supabaseClient.storage.from(AUDIO_BUCKET).createSignedUrl(storagePath, 3600);
        if (signedError) throw new Error(`O arquivo foi enviado, mas não foi possível reproduzi-lo: ${signedError.message}`);
        track.signedUrl = data.signedUrl;
      } else {
        await storeLocalAudio(trackId, file);
        track.localAudioId = trackId;
      }
      playlist.tracks.push(track);
    }
    persistLocalData();
    enqueueSync();
    activePlaylistId = playlist.id;
    renderAll();
    setMessage(`${files.length} ${files.length === 1 ? "arquivo adicionado" : "arquivos adicionados"} à playlist "${playlist.name}".`, false);
  } catch (error) {
    setMessage(error.message);
  } finally {
    ui.audioInput.value = "";
  }
}

function safeFileName(name) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "audio";
}

async function getPlayableUrl(track) {
  if (track.storagePath) {
    if (!currentUser || !supabaseClient) throw new Error("Entre na conta Supabase que contém este arquivo para reproduzi-lo.");
    const { data, error } = await supabaseClient.storage.from(AUDIO_BUCKET).createSignedUrl(track.storagePath, 3600);
    if (error) throw new Error(`Não foi possível abrir o arquivo privado: ${error.message}`);
    track.signedUrl = data.signedUrl;
    return data.signedUrl;
  }
  const file = await getLocalAudio(track.localAudioId);
  if (!file) throw new Error(`O arquivo "${track.title}" não está guardado neste dispositivo. Entre na conta sincronizada para baixá-lo novamente.`);
  return URL.createObjectURL(file);
}

function playLinkedTrack(track, queue = playbackQueue) {
  hideMessage();
  activeLinkedTrackId = track.id;
  playbackQueue = queue.length ? queue : [track];
  stopAudio(false);
  renderTracks();
}

async function playTrack(track, queue = playbackQueue) {
  if (track.url) {
    playLinkedTrack(track, queue);
    return;
  }
  try {
    hideMessage();
    activeLinkedTrackId = null;
    const playlist = findTrackPlaylist(track.id);
    playbackQueue = queue.length ? queue : (playlist?.tracks || [track]);
    const source = await getPlayableUrl(track);
    activeTrack = track;
    ui.audio.src = source;
    ui.audio.load();
    ui.playerBar.hidden = false;
    ui.playerTitle.textContent = track.title;
    ui.playerSubtitle.textContent = track.artist || playlist?.name || "Arquivo de áudio";
    ui.playerCover.replaceChildren();
    if (track.cover && safeHttpUrl(track.cover)) {
      const image = document.createElement("img");
      image.src = track.cover;
      image.alt = "";
      ui.playerCover.append(image);
    } else {
      ui.playerCover.textContent = "♪";
    }
    ui.playerPlay.classList.add("is-playing");
    ui.playerPlay.setAttribute("aria-label", "Pausar");
    ui.playerLike.setAttribute("aria-pressed", String(favorites.includes(track.id)));
    ui.downloadTrack.hidden = false;
    updateMediaSession(track);
    renderTracks();
    await ui.audio.play();
  } catch (error) {
    setMessage(`Não foi possível reproduzir "${track.title}": ${error.message}`);
  }
}

function stopAudio(clearLinkedTrack = true) {
  ui.audio.pause();
  ui.audio.removeAttribute("src");
  ui.audio.load();
  window.clearInterval(progressTimer);
  activeTrack = null;
  if (clearLinkedTrack) activeLinkedTrackId = null;
  ui.playerBar.hidden = true;
  ui.playerBar.classList.remove("is-playing");
  ui.downloadTrack.hidden = true;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.metadata = null;
  }
  if (clearLinkedTrack) renderTracks();
}

async function downloadTrack(track) {
  try {
    const source = await getPlayableUrl(track);
    const response = await fetch(source);
    if (!response.ok) throw new Error(`O armazenamento respondeu ${response.status}.`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${safeFileName(track.title)}.${getExtension(track.mimeType)}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch (error) {
    setMessage(`Não foi possível baixar este arquivo autorizado: ${error.message}`);
  }
}

function getExtension(mimeType = "") {
  const extensions = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/wav": "wav", "audio/flac": "flac", "audio/opus": "opus" };
  return extensions[mimeType] || "audio";
}

function togglePlayer() {
  if (!activeTrack) return;
  if (ui.audio.paused) void ui.audio.play().catch((error) => setMessage(`Não foi possível retomar a música: ${error.message}`));
  else ui.audio.pause();
}

function playAdjacentTrack(direction) {
  if (!activeTrack || playbackQueue.length < 2) return;
  const currentIndex = playbackQueue.findIndex((track) => track.id === activeTrack.id);
  const nextIndex = (currentIndex + direction + playbackQueue.length) % playbackQueue.length;
  void playTrack(playbackQueue[nextIndex], playbackQueue);
}

function toggleFavorite(track) {
  const isSaved = favorites.includes(track.id);
  favorites = isSaved ? favorites.filter((id) => id !== track.id) : [...favorites, track.id];
  try {
    persistLocalData();
    enqueueSync();
    if (activePlaylistId === "favorites") playbackQueue = getFavoriteTracks();
    ui.playerLike.setAttribute("aria-pressed", String(!isSaved));
    renderAll();
  } catch (error) {
    setMessage(error.message);
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || "Minhas Músicas",
    album: findTrackPlaylist(track.id)?.name || "Minhas Músicas",
  });
  const actions = {
    play: () => togglePlayer(),
    pause: () => togglePlayer(),
    previoustrack: () => playAdjacentTrack(-1),
    nexttrack: () => playAdjacentTrack(1),
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

function applyTheme(theme) {
  const root = document.documentElement;
  const color = /^#[0-9a-f]{6}$/i.test(theme.color || "") ? theme.color : THEME_COLORS.mint;
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-rgb", hexToRgb(color).join(", "));
  root.style.setProperty("--accent-ink", getColorBrightness(color) > 150 ? "#172015" : "#18131b");
  if (theme.backgroundImage) {
    root.style.setProperty("--page-image", `url(${JSON.stringify(theme.backgroundImage)})`);
  } else {
    root.style.setProperty("--page-image", "none");
  }
  $("#custom-color").value = color;
  $("#background-url").value = theme.backgroundUrl || "";
  document.querySelectorAll(".theme-choice").forEach((button) => button.classList.toggle("selected", button.dataset.theme === theme.name));
  document.querySelector('meta[name="theme-color"]').content = "#10110f";
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function getColorBrightness(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    applyTheme(theme);
  } catch (error) {
    setMessage(`Não foi possível salvar esta aparência: ${error.message}`);
  }
}

function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "null");
    applyTheme(saved || { name: "mint", color: THEME_COLORS.mint });
  } catch (error) {
    console.warn("Não foi possível carregar as preferências visuais:", error);
    applyTheme({ name: "mint", color: THEME_COLORS.mint });
  }
}

async function setBackgroundFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setMessage("Escolha um arquivo de imagem.");
    return;
  }
  if (file.size > MAX_LOCAL_IMAGE_BYTES) {
    setMessage("A imagem de fundo precisa ter até 1 MB para não deixar a biblioteca lenta.");
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => setMessage("Não foi possível ler a imagem escolhida.");
  reader.onload = () => {
    const theme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{"name":"mint","color":"#a6ed8e"}');
    theme.backgroundImage = reader.result;
    theme.backgroundUrl = "";
    saveTheme(theme);
  };
  reader.readAsDataURL(file);
}

function closeSidebar() {
  ui.sidebar.classList.remove("is-open");
  ui.sidebarScrim.classList.remove("is-visible");
}

function openSidebar() {
  ui.sidebar.classList.add("is-open");
  ui.sidebarScrim.classList.add("is-visible");
}

function bindEvents() {
  ui.playlistForm.addEventListener("submit", handlePlaylistSubmit);
  $("#create-playlist").addEventListener("click", showPlaylistDialog);
  $("#empty-create").addEventListener("click", showPlaylistDialog);
  $("#sidebar-add").addEventListener("click", showPlaylistDialog);
  $("#quick-import").addEventListener("click", showPlaylistDialog);
  $("#settings-button").addEventListener("click", () => ui.settingsDialog.showModal());
  $("#nav-home").addEventListener("click", () => {
    activeLinkedTrackId = null;
    activePlaylistId = null;
    ui.tracksSection.hidden = true;
    renderAll();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#nav-favorites").addEventListener("click", showFavorites);
  $("#quick-favorites").addEventListener("click", showFavorites);
  $("#browse-playlists").addEventListener("click", () => $("#library-title").scrollIntoView({ behavior: "smooth" }));
  ui.playlistNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-playlist-id]");
    if (button) openPlaylist(button.dataset.playlistId);
  });
  ui.playlistGrid.addEventListener("click", (event) => {
    const remove = event.target.closest('[data-action="delete"]');
    if (remove) {
      event.stopPropagation();
      startDeletePlaylist(remove.dataset.playlistId);
      return;
    }
    const card = event.target.closest("[data-playlist-id]");
    if (card) openPlaylist(card.dataset.playlistId);
  });
  ui.playlistGrid.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".playlist-card")) {
      event.preventDefault();
      openPlaylist(event.target.dataset.playlistId);
    }
  });
  $("#confirm-delete").addEventListener("click", () => void confirmDeletePlaylist());
  ui.linkTrackForm.addEventListener("submit", handleLinkTrackSubmit);
  ui.linkTrackForm.addEventListener("input", () => { $("#link-track-error").hidden = true; });
  $("#add-link-track").addEventListener("click", showLinkTrackDialog);
  ui.trackList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const playlist = getPlaylist(button.dataset.playlistId);
    const track = playlist?.tracks.find((item) => item.id === button.dataset.trackId) || getFavoriteTracks().find((item) => item.id === button.dataset.trackId);
    if (!track) return;
    if (button.dataset.action === "play-track") {
      if (activeTrack?.id === track.id && !ui.audio.paused) ui.audio.pause();
      else void playTrack(track, activePlaylistId === "favorites" ? getFavoriteTracks() : playlist.tracks);
    } else if (button.dataset.action === "download-track") {
      void downloadTrack(track);
    }
  });
  $("#add-audio").addEventListener("click", () => ui.audioInput.click());
  $("#add-track").addEventListener("click", () => ui.audioInput.click());
  ui.audioInput.addEventListener("change", (event) => void addAudioFiles(event.target.files));
  ui.filterInput.addEventListener("input", () => {
    renderPlaylistGrid();
    renderTracks();
  });
  ui.accountButton.addEventListener("click", showAccountDialog);
  ui.topAccountButton.addEventListener("click", showAccountDialog);
  ui.accountForm.addEventListener("submit", (event) => void submitAccountForm(event));
  $("#account-switch").addEventListener("click", () => setAccountMode(accountMode === "signin" ? "signup" : "signin"));
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.close).close());
  });
  document.querySelectorAll(".cover-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCoverStyle = button.dataset.cover;
      document.querySelectorAll(".cover-swatch").forEach((item) => item.classList.toggle("selected", item === button));
    });
  });
  document.querySelectorAll(".theme-choice").forEach((button) => {
    button.addEventListener("click", () => {
      const color = THEME_COLORS[button.dataset.theme];
      saveTheme({ name: button.dataset.theme, color });
    });
  });
  $("#custom-color").addEventListener("input", (event) => saveTheme({ name: "custom", color: event.target.value }));
  $("#background-url").addEventListener("change", (event) => {
    const raw = event.target.value.trim();
    const url = raw ? safeHttpUrl(raw) : null;
    if (raw && !url) {
      setMessage("O fundo precisa ser um endereço de imagem http:// ou https:// válido.");
      return;
    }
    const theme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{"name":"mint","color":"#a6ed8e"}');
    theme.backgroundUrl = url || "";
    theme.backgroundImage = url || "";
    saveTheme(theme);
  });
  $("#background-file").addEventListener("change", (event) => void setBackgroundFile(event.target.files[0]));
  $("#reset-theme").addEventListener("click", () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    $("#background-file").value = "";
    loadTheme();
  });
  $("#menu-button").addEventListener("click", openSidebar);
  $("#sidebar-close").addEventListener("click", closeSidebar);
  ui.sidebarScrim.addEventListener("click", closeSidebar);
  ui.playerPlay.addEventListener("click", togglePlayer);
  $("#previous-track").addEventListener("click", () => playAdjacentTrack(-1));
  $("#next-track").addEventListener("click", () => playAdjacentTrack(1));
  $("#player-close").addEventListener("click", stopAudio);
  ui.playerLike.addEventListener("click", () => {
    if (activeTrack) toggleFavorite(activeTrack);
  });
  ui.audio.addEventListener("play", () => {
    ui.playerBar.classList.add("is-playing");
    ui.playerPlay.classList.add("is-playing");
    ui.playerPlay.setAttribute("aria-label", "Pausar");
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(updateProgress, 500);
    renderTracks();
  });
  ui.audio.addEventListener("pause", () => {
    ui.playerBar.classList.remove("is-playing");
    ui.playerPlay.classList.remove("is-playing");
    ui.playerPlay.setAttribute("aria-label", "Reproduzir");
    if ("mediaSession" in navigator && activeTrack) navigator.mediaSession.playbackState = "paused";
    window.clearInterval(progressTimer);
    if (activeTrack) renderTracks();
  });
  ui.audio.addEventListener("ended", () => {
    if (playbackQueue.length > 1) {
      playAdjacentTrack(1);
    } else {
      ui.playerBar.classList.remove("is-playing");
      ui.playerPlay.classList.remove("is-playing");
      renderTracks();
    }
  });
  ui.audio.addEventListener("loadedmetadata", () => {
    updateProgress();
    if (activeTrack && Number.isFinite(ui.audio.duration)) {
      activeTrack.duration = ui.audio.duration;
      try {
        persistLocalData();
        enqueueSync();
      } catch (error) {
        setMessage(error.message);
      }
    }
  });
  ui.audio.addEventListener("error", () => {
    if (activeTrack) setMessage(`Não foi possível decodificar "${activeTrack.title}". Verifique se o arquivo é compatível com este navegador.`);
  });
  ui.progress.addEventListener("input", () => {
    if (Number.isFinite(ui.audio.duration)) ui.audio.currentTime = ui.audio.duration * Number(ui.progress.value) / 100;
  });
  ui.downloadTrack.addEventListener("click", (event) => {
    event.preventDefault();
    if (activeTrack) void downloadTrack(activeTrack);
  });
}

function updateProgress() {
  const duration = ui.audio.duration;
  const current = ui.audio.currentTime;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return;
  ui.progress.value = String(Math.round(current / duration * 100));
  ui.elapsedTime.textContent = formatTime(current);
  ui.totalTime.textContent = formatTime(duration);
  if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
    try {
      navigator.mediaSession.setPositionState({ duration, position: current, playbackRate: ui.audio.playbackRate });
    } catch (error) {
      console.warn("O navegador não aceitou a posição atual da mídia:", error);
    }
  }
}

function setAccountMode(mode) {
  accountMode = mode;
  $("#account-title").textContent = mode === "signin" ? "Entre na sua conta" : "Crie sua conta";
  $("#account-submit").textContent = mode === "signin" ? "Entrar" : "Criar conta";
  $("#account-switch").textContent = mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar";
  $("#account-password").autocomplete = mode === "signin" ? "current-password" : "new-password";
  $("#account-error").hidden = true;
}

async function submitAccountForm(event) {
  event.preventDefault();
  if (!supabaseClient) return;
  const email = $("#account-email").value.trim();
  const password = $("#account-password").value;
  const submit = $("#account-submit");
  const errorElement = $("#account-error");
  submit.disabled = true;
  errorElement.hidden = true;
  try {
    const result = accountMode === "signin"
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({ email, password });
    if (result.error) throw result.error;
    if (accountMode === "signup" && !result.data.session) {
      errorElement.textContent = "Conta criada. Confirme o e-mail para concluir o acesso.";
      errorElement.hidden = false;
      return;
    }
    await activateUser(result.data.user);
    ui.accountDialog.close();
    setAccountMode("signin");
  } catch (error) {
    errorElement.textContent = error.message || "Não foi possível autenticar. Tente novamente.";
    errorElement.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

async function initializeApp() {
  loadTheme();
  bindEvents();
  try {
    const local = loadLocalData();
    playlists = local.playlists;
    favorites = local.favorites;
  } catch (error) {
    setMessage(error.message);
  }
  renderAll();
  initializeSupabase();
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Não foi possível ativar o modo offline:", error);
      setMessage(`O app abriu, mas não foi possível ativar o modo offline: ${error.message}`);
    });
  }
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (data.session?.user) await activateUser(data.session.user);
    } catch (error) {
      setMessage(`Não foi possível verificar sua sessão Supabase: ${error.message}`);
    }
  }
}

void initializeApp();
