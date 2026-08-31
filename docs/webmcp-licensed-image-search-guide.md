# Building Licensed Image Search and Import with WebMCP

This guide shows how to let a browser agent search a legal image source, evaluate candidates, and insert a selected image into the same web app the human is viewing.

The right term is **licensed image search/import**, not HTML scraping. Search engines and raw pages do not provide a trustworthy machine-readable license contract. Use a provider API such as Wikimedia Commons, Openverse, the Smithsonian Open Access API, or the Metropolitan Museum API.

The example below uses:

- TypeScript in a browser web app
- Wikimedia Commons as the image provider
- Two WebMCP tools: one read tool and one write tool
- tldraw as the visible target UI

WebMCP is still a draft browser API. Confirm the current API before shipping. The canonical references are the [WebMCP specification](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api), and [Chrome WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

## 1. The architecture

Use two tools instead of one large “search and insert” tool:

```text
User goal
   │
   ▼
Agent calls search_licensed_images({ query })       read-only
   │
   ├─ compares captions, dimensions and licenses
   ├─ visually inspects thumbnails when supported
   └─ chooses one stable provider ID
   │
   ▼
Agent calls add_licensed_image({ id, x, y, ... })   write
   │
   ├─ re-fetches and re-verifies metadata
   ├─ loads a safe thumbnail
   ├─ creates the app's native image object
   └─ adds visible and stored credit
```

This split matters:

- Search results can become stale.
- Agents must not be trusted to repeat a license or URL correctly.
- The write tool can accept a stable provider ID and independently verify everything.
- The read tool can be marked safe while the write tool is correctly classified as mutating state.

Do **not** let the write tool accept arbitrary image URLs, license names, artist names, or credit strings. Those must come from the provider during the second verification.

## 2. Define a provider-neutral result

Keep the rest of the app independent from Wikimedia-specific response shapes:

```ts
export interface LicensedImageCandidate {
  id: number
  title: string
  caption: string
  thumbnailUrl: string
  thumbnailWidth: number
  thumbnailHeight: number
  originalWidth: number
  originalHeight: number
  mimeType: string
  artist: string
  credit: string
  licenseName: "CC0" | "Public domain"
  licenseCode: string
  licenseUrl: string
  sourcePageUrl: string
}

export interface LicensedImageProvider {
  search(query: string, signal?: AbortSignal): Promise<LicensedImageCandidate[]>
  getVerified(id: number, signal?: AbortSignal): Promise<LicensedImageCandidate>
}
```

When changing providers later, implement this interface again. The WebMCP and tldraw layers should not need to change.

## 3. Search Wikimedia Commons files

Wikipedia article HTML is the wrong source. A Wikipedia article can contain files with different licenses. Wikimedia Commons file pages expose machine-readable metadata through the MediaWiki `imageinfo` API.

Use:

- `generator=search`
- `gsrnamespace=6` to search the File namespace
- `iiprop=url|size|mime|thumbmime|mediatype|extmetadata`
- `iiurlwidth=330` for search thumbnails
- `iiextmetadatafilter` to request only required fields
- `origin=*` for browser CORS
- `Api-User-Agent` for a browser-based application

MediaWiki documents `imageinfo`, thumbnail sizing, and `extmetadata` filtering in its [Imageinfo API reference](https://www.mediawiki.org/wiki/API%3AImageinfo). Browser JavaScript cannot control the real `User-Agent` header, so Wikimedia recommends `Api-User-Agent`; see its [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy%3AWikimedia_Foundation_User-Agent_Policy/en).

```ts
const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
const API_USER_AGENT = "YourApp/0.1 (local development)"

const METADATA_FIELDS = [
  "Artist",
  "AttributionRequired",
  "Copyrighted",
  "Credit",
  "DeletionReason",
  "ImageDescription",
  "License",
  "LicenseShortName",
  "LicenseUrl",
  "NonFree",
  "Permission",
  "Restrictions",
  "UsageTerms",
].join("|")

function baseParams() {
  return new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    prop: "imageinfo",
  })
}

function addImageInfoParams(params: URLSearchParams, width: number) {
  params.set("iiprop", "url|size|mime|thumbmime|mediatype|extmetadata")
  params.set("iiurlwidth", String(width))
  params.set("iiextmetadatalanguage", "en")
  params.set("iiextmetadatafilter", METADATA_FIELDS)
}

async function fetchCommons(params: URLSearchParams, signal?: AbortSignal) {
  const response = await fetch(`${COMMONS_API_URL}?${params}`, {
    headers: { "Api-User-Agent": API_USER_AGENT },
    signal,
  })

  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After")
    throw new Error(
      `Commons returned ${response.status}` +
        (retryAfter ? `. Retry after ${retryAfter} seconds.` : "."),
    )
  }

  const data = await response.json()
  if (data.error) throw new Error(data.error.info ?? data.error.code)
  return data
}
```

Search in small sequential pages. Stop as soon as enough valid results are found:

```ts
const RESULT_LIMIT = 6
const PAGE_SIZE = 10
const MAX_PAGES = 3
const REQUEST_SPACING_MS = 250

export async function searchCommonsImages(
  rawQuery: string,
  signal?: AbortSignal,
): Promise<LicensedImageCandidate[]> {
  const query = rawQuery.trim().replace(/\s+/g, " ")
  if (query.length < 2 || query.length > 80) {
    throw new Error("Query must contain 2–80 characters.")
  }

  const results: LicensedImageCandidate[] = []
  const seen = new Set<number>()
  let offset: number | undefined

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    if (pageNumber > 0) await abortableDelay(REQUEST_SPACING_MS, signal)

    const params = baseParams()
    params.set("generator", "search")
    params.set("gsrsearch", query)
    params.set("gsrnamespace", "6")
    params.set("gsrlimit", String(PAGE_SIZE))
    if (offset !== undefined) params.set("gsroffset", String(offset))
    addImageInfoParams(params, 330)

    const data = await fetchCommons(params, signal)
    const pages = [...(data.query?.pages ?? [])].sort(
      (a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) -
        (b.index ?? Number.MAX_SAFE_INTEGER),
    )

    for (const page of pages) {
      const candidate = parseCandidate(page)
      if (!candidate || seen.has(candidate.id)) continue
      seen.add(candidate.id)
      results.push(candidate)
      if (results.length === RESULT_LIMIT) return results
    }

    offset = data.continue?.gsroffset
    if (offset === undefined) break
  }

  return results
}
```

Do not request on every keystroke. WebMCP calls should be explicit agent actions. Also cache completed searches by normalized query for a few minutes so repeated reasoning does not hit the provider again.

## 4. Fail closed on licensing

“Available on Commons” does not mean “allowed by this application.” Define the license policy explicitly.

This strict example accepts only:

- `CC0`
- `Public domain`
- `AttributionRequired: false`
- Empty `Restrictions`
- No deletion warning
- No non-free marker
- No explicit permission warning

Important edge case: a CC0 file can report `Copyrighted: True`. CC0 does not necessarily mean copyright never existed; it means the rights holder waived rights through the CC0 dedication. Public-domain files should report `Copyrighted: False`.

```ts
const REUSE_WARNING =
  /\b(do not use|not for reuse|permission required|no permission|not public domain)\b/i

function metadataText(metadata: Record<string, { value?: string }>, key: string) {
  return htmlToPlainText(metadata[key]?.value ?? "")
}

function metadataBoolean(
  metadata: Record<string, { value?: string }>,
  key: string,
) {
  const value = metadataText(metadata, key).toLowerCase()
  if (value === "true") return true
  if (value === "false") return false
  return null
}

function parseCandidate(page: any): LicensedImageCandidate | null {
  const info = page.imageinfo?.[0]
  const metadata = info?.extmetadata
  if (!page.pageid || !page.title || !info || !metadata) return null
  if (info.mediatype !== "BITMAP" && info.mediatype !== "DRAWING") return null

  const shortName = metadataText(metadata, "LicenseShortName")
  const licenseCode = metadataText(metadata, "License").toLowerCase()
  const isCc0 = shortName === "CC0" && licenseCode === "cc0"
  const isPublicDomain =
    shortName === "Public domain" && licenseCode.startsWith("pd")

  if (!isCc0 && !isPublicDomain) return null
  if (metadataBoolean(metadata, "AttributionRequired") !== false) return null
  if (isPublicDomain && metadataBoolean(metadata, "Copyrighted") !== false) {
    return null
  }
  if (metadataBoolean(metadata, "NonFree") === true) return null
  if (!Object.prototype.hasOwnProperty.call(metadata, "Restrictions")) return null
  if (metadataText(metadata, "Restrictions")) return null
  if (metadataText(metadata, "DeletionReason")) return null

  const permission = [
    metadataText(metadata, "Permission"),
    metadataText(metadata, "Credit"),
  ].join(" ")
  if (REUSE_WARNING.test(permission)) return null

  const thumbnailUrl = allowlistedUrl(info.thumburl, "upload.wikimedia.org")
  const sourcePageUrl = allowlistedUrl(
    info.descriptionurl,
    "commons.wikimedia.org",
  )
  if (!thumbnailUrl || !sourcePageUrl) return null

  const licenseUrl = normalizeLicenseUrl(
    metadataText(metadata, "LicenseUrl"),
  ) ?? sourcePageUrl

  const mimeType = info.thumbmime ?? info.mime ?? ""
  if (!mimeType.startsWith("image/")) return null

  return {
    id: page.pageid,
    title: page.title.replace(/^File:/, ""),
    caption:
      metadataText(metadata, "ImageDescription") ||
      page.title.replace(/^File:/, ""),
    thumbnailUrl,
    thumbnailWidth: info.thumbwidth,
    thumbnailHeight: info.thumbheight,
    originalWidth: info.width,
    originalHeight: info.height,
    mimeType,
    artist: metadataText(metadata, "Artist") || "Unknown creator",
    credit: metadataText(metadata, "Credit") || "Wikimedia Commons",
    licenseName: isCc0 ? "CC0" : "Public domain",
    licenseCode,
    licenseUrl,
    sourcePageUrl,
  }
}
```

Metadata fields can contain HTML. Never render them with `innerHTML` or `dangerouslySetInnerHTML`. Convert them to plain text:

```ts
function htmlToPlainText(value: string) {
  if (!value) return ""
  const document = new DOMParser().parseFromString(value, "text/html")
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim()
}

function allowlistedUrl(value: string | undefined, expectedHost: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.hostname !== expectedHost) return null
    return url.toString()
  } catch {
    return null
  }
}

function normalizeLicenseUrl(value: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol === "http:") url.protocol = "https:"
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}
```

License metadata is a safety filter, not a universal legal guarantee. It does not automatically clear trademarks, privacy rights, personality rights, or restrictions imposed outside copyright law. Preserve the provider page URL so a human can review the source.

## 5. Re-verify before the write

The search tool returns candidates for reasoning. It does not authorize insertion.

The write tool should accept only the provider ID and placement information:

```ts
export interface ImagePlacement {
  id: number
  x: number
  y: number
  maxWidth?: number
  maxHeight?: number
}
```

Before adding anything, request the file again by ID with a larger thumbnail:

```ts
export async function getVerifiedCommonsImage(
  id: number,
  signal?: AbortSignal,
) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Image ID must be a positive integer.")
  }

  const params = baseParams()
  params.set("pageids", String(id))
  addImageInfoParams(params, 1280)

  const data = await fetchCommons(params, signal)
  const candidate = parseCandidate(data.query?.pages?.[0])
  if (!candidate) {
    throw new Error(
      "The file is no longer verified for this application's license policy.",
    )
  }
  return candidate
}
```

This protects against:

- stale search results;
- license changes;
- a hallucinated or mistyped URL;
- an agent substituting a different file;
- arbitrary remote URLs being inserted into the app.

## 6. Insert a real tldraw image

tldraw image shapes refer to an asset record. Create both the asset and the shape. With the current tldraw API, use `AssetRecordType.createId()` for asset IDs—not `createAssetId()`.

The example also creates a small visible credit and groups it with the image so they move together.

```ts
import {
  AssetRecordType,
  Editor,
  TLImageAsset,
  createShapeId,
  toRichText,
} from "tldraw"

export async function insertCommonsImage(
  editor: Editor,
  placement: ImagePlacement,
  signal?: AbortSignal,
) {
  const image = await getVerifiedCommonsImage(placement.id, signal)
  const source = await resolveImageSource(image, signal)

  const maxWidth = placement.maxWidth ?? 640
  const maxHeight = placement.maxHeight ?? 480
  const scale = Math.min(
    maxWidth / image.thumbnailWidth,
    maxHeight / image.thumbnailHeight,
    1,
  )
  const width = Math.round(image.thumbnailWidth * scale)
  const height = Math.round(image.thumbnailHeight * scale)

  const assetId = AssetRecordType.createId()
  const imageShapeId = createShapeId()
  const creditShapeId = createShapeId()
  const groupId = createShapeId()
  const creditText =
    `Photo: ${image.artist} · ${image.licenseName} · Wikimedia Commons`

  const provenance = {
    provider: "wikimedia-commons",
    providerId: image.id,
    sourcePageUrl: image.sourcePageUrl,
    artist: image.artist,
    credit: image.credit,
    licenseName: image.licenseName,
    licenseCode: image.licenseCode,
    licenseUrl: image.licenseUrl,
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
  }

  const asset: TLImageAsset = {
    id: assetId,
    typeName: "asset",
    type: "image",
    props: {
      name: image.title,
      src: source,
      w: image.thumbnailWidth,
      h: image.thumbnailHeight,
      mimeType: image.mimeType,
      isAnimated: false,
    },
    meta: provenance,
  }

  editor.run(() => {
    editor.createAssets([asset])
    editor.createShapes([
      {
        id: imageShapeId,
        type: "image",
        x: placement.x,
        y: placement.y,
        props: {
          assetId,
          w: width,
          h: height,
          altText: image.caption,
        },
        meta: provenance,
      },
      {
        id: creditShapeId,
        type: "text",
        x: placement.x,
        y: placement.y + height + 8,
        props: {
          autoSize: false,
          color: "grey",
          font: "sans",
          richText: toRichText(creditText),
          scale: 0.75,
          size: "s",
          textAlign: "start",
          w: width,
        },
        meta: provenance,
      },
    ])

    editor.groupShapes([imageShapeId, creditShapeId], {
      groupId,
      select: true,
    })
  })

  return {
    assetId,
    imageShapeId,
    creditShapeId,
    groupId,
    bounds: { x: placement.x, y: placement.y, w: width, h: height },
    creditText,
    provenance,
  }
}
```

If the target app is not tldraw, replace this function with a small adapter that writes through the app’s existing UI/state model. The WebMCP tool should never maintain a second hidden version of the document.

## 7. Use a persistent image fallback

Start with the provider’s resized remote URL. If it cannot load, fetch the thumbnail as a blob and convert it to a capped data URL.

Do not use `URL.createObjectURL()` as the persistence fallback. Blob URLs stop working after refresh.

```ts
const MAX_FALLBACK_BYTES = 5 * 1024 * 1024

async function resolveImageSource(
  image: LicensedImageCandidate,
  signal?: AbortSignal,
) {
  try {
    await preloadImage(image.thumbnailUrl, signal)
    return image.thumbnailUrl
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
  }

  const response = await fetch(image.thumbnailUrl, { signal })
  if (!response.ok) throw new Error(`Thumbnail returned ${response.status}.`)

  const blob = await response.blob()
  if (!blob.type.startsWith("image/")) {
    throw new Error("Thumbnail fallback was not an image.")
  }
  if (blob.size > MAX_FALLBACK_BYTES) {
    throw new Error("Thumbnail fallback exceeds 5 MiB.")
  }

  return blobToDataUrl(blob, signal)
}
```

The `preloadImage` and `blobToDataUrl` helpers should remove abort listeners when they finish and reject with `AbortError` when cancelled.

## 8. Register the WebMCP tools

Feature-detect the page API. Missing WebMCP support must not break the human UI.

```ts
type ModelContext = {
  registerTool(
    tool: {
      name: string
      description: string
      inputSchema: object
      annotations?: {
        readOnlyHint?: boolean
        untrustedContentHint?: boolean
      }
      execute(input: unknown, options: { signal: AbortSignal }): unknown
    },
    options: { signal: AbortSignal },
  ): Promise<void> | void
}

export async function registerLicensedImageTools(
  editor: Editor,
  lifecycleSignal: AbortSignal,
) {
  const modelContext = (
    document as Document & { modelContext?: ModelContext }
  ).modelContext

  if (!modelContext?.registerTool) return { registered: false }

  await modelContext.registerTool(
    {
      name: "search_licensed_images",
      description:
        "Search for verified CC0 or public-domain images before choosing one to add.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: {
            type: "string",
            minLength: 2,
            maxLength: 80,
            description: "Short descriptive image query.",
          },
        },
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      async execute(input: unknown, { signal }) {
        try {
          const { query } = validateSearchInput(input)
          const images = await searchCommonsImages(query, signal)
          return {
            ok: true,
            query,
            count: images.length,
            images,
          }
        } catch (error) {
          return errorResult("search_licensed_images", error)
        }
      },
    },
    { signal: lifecycleSignal },
  )

  await modelContext.registerTool(
    {
      name: "add_licensed_image",
      description:
        "Re-verify and add one licensed image at exact canvas coordinates with visible credit.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["id", "x", "y"],
        properties: {
          id: {
            type: "integer",
            minimum: 1,
            description: "Provider ID returned by search_licensed_images.",
          },
          x: {
            type: "number",
            description: "Exact canvas X coordinate for the top-left.",
          },
          y: {
            type: "number",
            description: "Exact canvas Y coordinate for the top-left.",
          },
          maxWidth: {
            type: "number",
            minimum: 64,
            maximum: 1600,
            description: "Optional maximum displayed width. Default 640.",
          },
          maxHeight: {
            type: "number",
            minimum: 64,
            maximum: 1200,
            description: "Optional maximum displayed height. Default 480.",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      async execute(input: unknown, { signal }) {
        try {
          const placement = validateAddInput(input)
          const result = await insertCommonsImage(editor, placement, signal)
          return { ok: true, ...result }
        } catch (error) {
          return errorResult("add_licensed_image", error)
        }
      },
    },
    { signal: lifecycleSignal },
  )

  return { registered: true, count: 2 }
}
```

Register after the editor exists, then abort on component teardown:

```tsx
useEffect(() => {
  if (!editor) return

  const controller = new AbortController()
  void registerLicensedImageTools(editor, controller.signal)

  return () => controller.abort()
}, [editor])
```

`readOnlyHint` and `untrustedContentHint` are explicit on both tools. The search result contains open-web data, and the add result repeats verified external metadata, so both are untrusted from the agent’s perspective. Chrome recommends these annotations for agent decision-making and security.

## 9. Runtime validation still matters

JSON Schema helps an agent call a tool, but it is not a substitute for validation inside `execute`.

Use Zod, Valibot, Ajv, or small explicit validators:

```ts
function validateSearchInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Input must be an object.")
  }
  const query = String((input as Record<string, unknown>).query ?? "").trim()
  if (query.length < 2 || query.length > 80) {
    throw new Error("query must contain 2–80 characters.")
  }
  return { query }
}

function validateAddInput(input: unknown): ImagePlacement {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Input must be an object.")
  }
  const value = input as Record<string, unknown>
  const id = Number(value.id)
  const x = Number(value.x)
  const y = Number(value.y)
  const maxWidth = value.maxWidth === undefined ? undefined : Number(value.maxWidth)
  const maxHeight = value.maxHeight === undefined ? undefined : Number(value.maxHeight)

  if (!Number.isInteger(id) || id <= 0) throw new Error("id must be positive.")
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("x and y must be finite numbers.")
  }
  if (maxWidth !== undefined && (maxWidth < 64 || maxWidth > 1600)) {
    throw new Error("maxWidth must be between 64 and 1600.")
  }
  if (maxHeight !== undefined && (maxHeight < 64 || maxHeight > 1200)) {
    throw new Error("maxHeight must be between 64 and 1200.")
  }

  return { id, x, y, maxWidth, maxHeight }
}

function errorResult(tool: string, error: unknown) {
  return {
    ok: false,
    tool,
    error: error instanceof Error ? error.message : String(error),
  }
}
```

All tool results must be JSON-serializable. Do not return DOM nodes, `File`, `Blob`, editor instances, functions, or class instances.

## 10. Teach the agent how to use the tools

Tool descriptions should state the intended sequence, but avoid rigid flow-control instructions.

A useful agent workflow is:

1. Search with a short descriptive query such as `Mount Fuji sunset Japan`.
2. Compare only the returned candidates.
3. Prefer a result whose caption matches the subject, has useful resolution, and fits the intended layout.
4. Visually inspect the thumbnail when the browser agent supports it.
5. Choose one stable provider ID.
6. Calculate non-overlapping canvas coordinates.
7. Call the add tool once.
8. If verification fails, search again. Do not bypass the gate with the raw URL.

Example calls:

```json
{
  "tool": "search_licensed_images",
  "arguments": {
    "query": "Rio de Janeiro Sugarloaf sunset"
  }
}
```

```json
{
  "tool": "add_licensed_image",
  "arguments": {
    "id": 134699719,
    "x": 340,
    "y": 650,
    "maxWidth": 260,
    "maxHeight": 220
  }
}
```

Successful write result:

```json
{
  "ok": true,
  "assetId": "asset:...",
  "imageShapeId": "shape:...",
  "creditShapeId": "shape:...",
  "groupId": "shape:...",
  "bounds": { "x": 340, "y": 650, "w": 260, "h": 159 },
  "creditText": "Photo: Wilfredor · CC0 · Wikimedia Commons",
  "provenance": {
    "provider": "wikimedia-commons",
    "providerId": 134699719,
    "licenseName": "CC0",
    "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:..."
  }
}
```

## 11. Rate limiting and cancellation

Minimum safeguards:

- Search only on an explicit tool call.
- Cache normalized queries for about five minutes.
- Use sequential pagination; do not fetch pages concurrently.
- Space continuation requests.
- Stop when enough safe results are found.
- Pass the execution `AbortSignal` through every fetch and delay.
- Respect `Retry-After` and return a retryable error.
- Do not aggressively retry a 403 or 429.

Abortable delay example:

```ts
function abortableDelay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout)
      signal?.removeEventListener("abort", onAbort)
      reject(new DOMException("Aborted", "AbortError"))
    }
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}
```

## 12. Adapting this to another source

Keep these layers unchanged:

- WebMCP registration
- tool schemas
- runtime validation
- target-app insertion
- credit/provenance storage
- cancellation and error results

Replace only the provider adapter:

| Provider | Search filter | Stable ID | Re-verification field |
|---|---|---|---|
| Wikimedia Commons | `CC0` / public-domain `extmetadata` | `pageid` | `imageinfo.extmetadata` |
| Openverse | `license=cc0` | result ID | fetch result by ID and re-check license |
| Smithsonian Open Access | open-access flag | object ID | object metadata rights field |
| Metropolitan Museum | `isPublicDomain=true` | object ID | object `isPublicDomain` field |

Do not build a “universal” license parser before adding a second provider. Implement one provider correctly, then extract only the shared behavior that is actually identical.

## 13. Verification checklist

### Search

- A valid query returns no more than six candidates.
- Every candidate passes the exact license policy.
- Restricted, non-free, deletion-marked, and missing-metadata files are skipped.
- Metadata HTML becomes plain text.
- Only allowlisted HTTPS hosts are returned.
- Repeating a query uses the cache.
- Cancellation stops pagination.

### Write

- The stable ID is re-fetched before mutation.
- A changed or invalid license is rejected before creating an asset.
- The image appears at the requested coordinates.
- Aspect ratio is preserved without cropping.
- The credit is visible even for CC0/public-domain files.
- Full provenance is stored on the asset and shapes.
- Image and credit move together.
- Remote-load failure uses the capped persistent fallback.
- Oversized or non-image fallbacks create no partial canvas state.

### WebMCP

- Unsupported browsers retain a fully working human UI.
- Search is explicitly read-only and untrusted.
- Add is explicitly write and untrusted.
- Tools unregister through the lifecycle `AbortSignal`.
- Duplicate registration is avoided during remounts.
- The real browser agent can discover and call both tools.

## 14. Common mistakes

- Scraping Google Images, Pinterest, or raw Wikipedia HTML.
- Assuming every Commons file fits the application’s policy.
- Accepting a URL or license string from the agent.
- Checking metadata only during search and not during insertion.
- Rendering provider HTML directly.
- Omitting `untrustedContentHint` from web-derived results.
- Omitting explicit `readOnlyHint: false` from write tools when the inspector expects it.
- Returning blobs, DOM nodes, or editor objects from a tool.
- Using full-resolution originals when a 1280px thumbnail is enough.
- Cropping without user intent.
- Using blob URLs as persisted asset sources.
- Forgetting visible credit because attribution is legally optional.
- Using an API import that the installed app version does not export—for current tldraw asset IDs, use `AssetRecordType.createId()`.

## 15. Copy-paste prompt for another coding agent

```text
Implement licensed image search and visible image insertion through in-page WebMCP.

First inspect this app's existing UI/state model, installed library versions, WebMCP registration lifecycle, and asset/image APIs. Do not build backend MCP, HTTP/SSE/stdio transport, a service worker, or a hidden duplicate document model.

Architecture:
1. Create a provider adapter that searches a documented image API and returns at most six candidates with a stable ID, thumbnail, dimensions, artist, credit, license, and source-page URL.
2. Create one read WebMCP tool: search_licensed_images({query}). Mark it readOnlyHint=true and untrustedContentHint=true.
3. Create one write WebMCP tool: add_licensed_image({id,x,y,maxWidth?,maxHeight?}). Mark it readOnlyHint=false and untrustedContentHint=true.
4. The write tool must re-fetch metadata by stable ID and rerun the license gate. Never accept an arbitrary URL, artist, credit, or license from the agent.
5. Insert through the same app state/UI the human uses. Preserve aspect ratio, use a resized source, store provenance with the asset, render a small visible credit, and keep the credit attached to the image.
6. Pass AbortSignal into requests and delays. Cache repeated searches, space continuation requests, respect Retry-After, and return JSON-safe errors.
7. Feature-detect document.modelContext. Missing WebMCP must not break the human UI. Register with one AbortController and abort on teardown.

License policy for the Wikimedia Commons example:
- Search namespace 6 with imageinfo + extmetadata.
- Accept only exact CC0 or Public domain metadata.
- Require AttributionRequired=false.
- Require empty Restrictions and DeletionReason.
- Reject NonFree and explicit reuse warnings.
- Public-domain files require Copyrighted=False; CC0 may report Copyrighted=True.
- Allowlist upload.wikimedia.org thumbnails and commons.wikimedia.org source pages.
- Convert metadata HTML to plain text.
- Re-verify immediately before insertion.

For tldraw, use AssetRecordType.createId(), createShapeId(), editor.createAssets(), editor.createShapes(), and editor.groupShapes(). Do not assume createAssetId exists.

Keep the implementation minimal and source-specific. Do not add a universal provider framework until a second source is actually required. Show the focused diff and provide the smallest relevant verification commands.
```

## Sources

- [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API%3AImageinfo)
- [CommonsMetadata fields](https://www.mediawiki.org/wiki/Extension%3ACommonsMetadata/en)
- [Wikimedia User-Agent policy](https://foundation.wikimedia.org/wiki/Policy%3AWikimedia_Foundation_User-Agent_Policy/en)

