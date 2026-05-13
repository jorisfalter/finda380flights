"""Aircraft-type config shared by ingest + routes-build scripts.

Adding a new aircraft type:
  1. Add an entry below with the ICAO type codes ingest scripts should
     query (FR24 + adsb.lol both use ICAO type codes like "B748").
  2. Optionally add it to Heroku Scheduler with `python3 ... <key>`.
  3. The matching collections are created lazily by MongoDB on first
     insert — no migration needed.
"""

AIRCRAFT_TYPES = {
    "a380": {
        "icao_types": ["A388"],
        "flights_collection": "a380flightsCollectionV2",
        "routes_collection": "a380routesCollection",
        "display_name": "A380",
    },
    "b747": {
        # B748 = 747-8 (pax + freighter), B744 = 747-400 (mostly cargo now,
        # a few pax holdouts), B74F = some freighter listings. All three
        # surface as "747" to end users.
        "icao_types": ["B748", "B744", "B74F"],
        "flights_collection": "b747flightsCollection",
        "routes_collection": "b747routesCollection",
        "display_name": "747",
    },
}


def get_config(key):
    key = (key or "").lower()
    if key not in AIRCRAFT_TYPES:
        raise SystemExit(
            f"Unknown aircraft key '{key}'. Valid: {sorted(AIRCRAFT_TYPES.keys())}"
        )
    return AIRCRAFT_TYPES[key]
