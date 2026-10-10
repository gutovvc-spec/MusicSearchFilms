const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_SEARCH_LIMIT = 10;

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: { message: "Método não permitido." } });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return response
      .status(503)
      .json({ error: { message: "A busca do YouTube ainda não foi configurada no servidor." } });
  }

  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  if (!query || query.length > 150) {
    return response
      .status(400)
      .json({ error: { message: "Informe uma busca de até 150 caracteres." } });
  }

  const parameters = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    maxResults: String(YOUTUBE_SEARCH_LIMIT),
    regionCode: "BR",
    relevanceLanguage: "pt",
  });

  try {
    const youtubeResponse = await fetch(`${YOUTUBE_API_ENDPOINT}?${parameters.toString()}`);
    const data = await youtubeResponse.json();

    response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return response.status(youtubeResponse.status).json(data);
  } catch (error) {
    console.error("Falha ao consultar a YouTube Data API:", error);
    return response
      .status(502)
      .json({ error: { message: "Não foi possível consultar a YouTube Data API." } });
  }
};
