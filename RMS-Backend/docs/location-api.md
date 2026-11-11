# Location intelligence API (Lahore)

All endpoints are public `GET`s. Every distance, time and cost is an **estimate**: responses carry
`estimate: true`. Road distance is the straight-line distance multiplied by `ROAD_FACTOR` (default 1.35), and times use typical Lahore speeds per mode and distance band, with a peak-hour multiplier.

Data source: `src/data/lahorePlaces.js` (90 areas and 116 landmarks with approximate coordinates).
A JSON export is served at `/data/lahore-places.json`. Regenerate it with `npm run export:places`.

Location inputs (`from`, `to`, `near`) accept any of:
- a place slug (`dha-phase-5`, `lums`)
- a fuzzy name or alias (`DHA Ph 5`, `johr town`, `UCP`)
- `lat,lng` (`31.47,74.41`)
- a property `_id`

## Places
| Endpoint | Notes |
|---|---|
| `GET /api/places?type=area\|landmark&category=&q=&limit=` | Fuzzy search over names, aliases and slugs. `category` is a landmark category (`university`, `hospital`, `school`, `mall`, `transport`, `mosque`, `park`, `other`), a transport sub-type (`metro`, `orange-line`) or an area tier (`premium`, `upper-mid`, `mid`, `budget`). |
| `GET /api/places/:slug` | One place, plus `children` (for areas), `nearestAreas` and `nearbyLandmarks` grouped by category. |

## Areas
| Endpoint | Notes |
|---|---|
| `GET /api/areas` | Backward compatible: the same Area documents as before, plus `slug`, `aliases`, `parent`, `tier`, `description`, `center {lat,lng}` and live `stats`. `stats` has `listingCount`, `rentCount` and `saleCount`; `rent` and `sale` as `{count,min,avg,max}`; and the same figures broken down `byType`. A parent area such as `dha-lahore` includes its phases. |
| `GET /api/areas/:slug` | Area guide: description, centre, stats, `subdivisions` (blocks or sectors), `children`, `nearbyLandmarks` with distance and car/bike/rickshaw minutes, and up to 6 `listings` (`?listings=12` returns more). Accepts a slug, a fuzzy name or a Mongo id. |

## Travel
`GET /api/travel?from=<..>&to=<..>`
```json
{ "success": true, "from": {...}, "to": {...}, "distanceKm": 1.16, "straightLineKm": 0.86,
  "estimate": true, "source": "estimate", "peakNow": false,
  "modes": [
    { "mode": "car", "label": "Car", "minutes": 7, "minutesPeak": 10, "costPkr": 25, "note": "Petrol cost only" },
    { "mode": "motorbike", ... }, { "mode": "rickshaw", "label": "Rickshaw / InDrive", ... },
    { "mode": "bus", "label": "Metro Bus | Orange Line | Local bus / wagon", ... },
    { "mode": "walking", ..., "practical": true }
  ], "disclaimer": "Estimates only: ..." }
```
- **Bus/Metro:** the flat Metro Bus or Orange Line fare is used when both ends are within `STATION_WALK_KM` of stations on the same line. Otherwise the result is a local bus or wagon estimate.
- **Optional real routing:** set `ROUTING_URL` to an OSRM-compatible server. The endpoint then uses `/route/v1/driving` with a 2 s timeout (`ROUTING_TIMEOUT_MS`) and an in-memory cache, and returns `source: "osrm"`. If routing fails, it falls back to the estimate.

## Properties
| Endpoint | Notes |
|---|---|
| `GET /api/properties?area=<slug>` | Matches the area **and all its phases, blocks and sectors**. For example, `area=dha-lahore` returns every DHA phase, while `area=askari-1` does not match Askari 10 or 11. Matching uses the stored `areaSlug`, with name and alias matching on phase, society and location as a fallback. |
| `GET /api/properties?near=<..>&radiusKm=&maxMinutes=&mode=&sort=distance` | Adds `distanceKm` and `travel` `{distanceKm, carMinutes, bikeMinutes, rickshawMinutes, rickshawCostPkr, mode, minutes, from, estimate}` to each result. `mode` accepts `car`, `bike`/`motorbike`, `rickshaw`/`indrive`, `bus`/`metro` or `walk`. With `near`, results are sorted by distance by default. All other filters (`type`, `purpose`, `minPrice`, and so on) still apply. |
| `GET /api/properties/:id/nearby?category=&limit=` | Returns the nearest landmarks per category (default 3 each), or `limit` results for one category. Each result includes `distanceKm` and car, bike and rickshaw minutes. |

Every property now has `latitude`/`longitude` and an `areaSlug`. If a listing is saved without coordinates, the area centre plus a small offset is used and `locationApproximate: true` is set. Coordinates entered by an admin are never overwritten.

## Configuration (env, all optional)
`PETROL_PRICE_PKR` (265), `CAR_KM_PER_LITRE` (12), `BIKE_KM_PER_LITRE` (40), `RICKSHAW_BASE_FARE_PKR` (100),
`RICKSHAW_PER_KM_PKR` (40), `RICKSHAW_MIN_FARE_PKR` (150), `METRO_FARE_PKR` (30), `ORANGE_LINE_FARE_PKR` (40),
`BUS_FARE_PKR` (60), `STATION_WALK_KM` (1.5), `ROAD_FACTOR` (1.35), `ROUTING_URL` (off), `ROUTING_TIMEOUT_MS` (2000).

## Chatbot
`POST /api/chatbot` accepts an optional `property_id` (24-hex ObjectId). It forwards the ID to the AI service as `property_id` and silently drops it if it is invalid.
