import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // UNSPLASH_ACCESS_KEY is intentionally read only in this server route. Never
  // mirror it into Vite or return it to the browser.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.UNSPLASH_ACCESS_KEY) return res.status(503).json({ error: 'Image search is not configured' });

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 200) return res.status(400).json({ error: 'query must be between 1 and 200 characters' });

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } },
    );
    if (!response.ok) {
      console.error(`Unsplash API error: ${response.status}`);
      return res.status(502).json({ error: 'Image search failed' });
    }

    const data = await response.json() as { results?: Array<Record<string, any>> };
    const results = Array.isArray(data.results) ? data.results.map(result => ({
      id: result.id,
      url: result.urls?.regular,
      thumbnail: result.urls?.small,
      alt: result.alt_description || 'Unsplash Image',
      photographer: result.user?.name || 'Unsplash photographer',
      photographerUrl: result.user?.links?.html || 'https://unsplash.com',
    })).filter(result => typeof result.id === 'string' && typeof result.url === 'string' && typeof result.thumbnail === 'string') : [];

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Image search failed:', error);
    return res.status(502).json({ error: 'Image search failed' });
  }
}
