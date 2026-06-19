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
    "a340": {
        # A340-300 / -500 / -600. Mostly retired from passenger service;
        # a handful of operators left (Mahan Air, Lufthansa Cargo, some
        # leisure/charter ops).
        "icao_types": ["A343", "A345", "A346"],
        "flights_collection": "a340flightsCollection",
        "routes_collection": "a340routesCollection",
        "display_name": "A340",
    },
    "a350": {
        # A350-900 / -1000. Modern flagship widebody — flown by SQ, CX,
        # QR, EY, AF/KL, LH, DL, UA, ANA/JL, EVA/CI, etc.
        "icao_types": ["A359", "A35K"],
        "flights_collection": "a350flightsCollection",
        "routes_collection": "a350routesCollection",
        "display_name": "A350",
    },
    "b787": {
        # 787-8 / -9 / -10. Most widely operated modern widebody.
        "icao_types": ["B788", "B789", "B78X"],
        "flights_collection": "b787flightsCollection",
        "routes_collection": "b787routesCollection",
        "display_name": "787",
    },
    "b757": {
        # 757-200 / -300. Mix of passenger (DL, UA, Icelandair, Condor)
        # and cargo (FedEx, UPS, DHL).
        "icao_types": ["B752", "B753"],
        "flights_collection": "b757flightsCollection",
        "routes_collection": "b757routesCollection",
        "display_name": "757",
    },
    "b767": {
        # 767-300 / -400. Mix: passenger (DL, UA, ANA, JL) and cargo
        # (FedEx, UPS, DHL, ABX Air).
        "icao_types": ["B763", "B764"],
        "flights_collection": "b767flightsCollection",
        "routes_collection": "b767routesCollection",
        "display_name": "767",
    },
}


def get_config(key):
    key = (key or "").lower()
    if key not in AIRCRAFT_TYPES:
        raise SystemExit(
            f"Unknown aircraft key '{key}'. Valid: {sorted(AIRCRAFT_TYPES.keys())}"
        )
    return AIRCRAFT_TYPES[key]


def resolve_keys(args):
    """Resolve CLI args to a list of aircraft keys.
       no args      → ["a380"]  (backward-compat default for old crons)
       ["all"]      → every key in AIRCRAFT_TYPES
       ["a380","b747"] → those specific keys (validated)"""
    if not args:
        return ["a380"]
    args = [a.lower() for a in args]
    if "all" in args:
        return list(AIRCRAFT_TYPES.keys())
    return args
