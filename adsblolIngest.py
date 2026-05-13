"""Backup A380 ingest using adsb.lol (live ADS-B) + adsbdb (route lookup).

Runs alongside flightradarapi.py. Records are written to the same
a380flightsCollectionV2 collection so buildRoutesJson picks them up.
Marked with source="adsblol" so we can tell origin in queries.

Independent of FlightRadar24, so when FR24 starts blocking again
(see April 30 → May 7 2026 incident), the map keeps showing routes.
"""

import os
import time
import datetime
import requests
import pymongo
import certifi
from dotenv import load_dotenv


ADSB_LOL_URL = "https://api.adsb.lol/v2/type/A388"
ADSBDB_URL = "https://api.adsbdb.com/v0/callsign/{callsign}"
HEADERS = {"User-Agent": "wheredoesthea380fly.com backup ingest"}


def fetch_a380s():
    r = requests.get(ADSB_LOL_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json().get("ac", [])


def lookup_route(callsign):
    """Returns adsbdb flightroute dict or None."""
    try:
        r = requests.get(ADSBDB_URL.format(callsign=callsign), headers=HEADERS, timeout=15)
        if r.status_code == 404:
            return None
        if r.status_code == 429:
            time.sleep(10)
            return None
        r.raise_for_status()
        return r.json().get("response", {}).get("flightroute")
    except Exception as e:
        print(f"  adsbdb {callsign} failed: {type(e).__name__}: {str(e)[:80]}")
        return None


def main():
    load_dotenv()
    mongo_pass = os.getenv("MONGO_ATLAS_PASS")
    client = pymongo.MongoClient(
        f"mongodb+srv://joris-a380:{mongo_pass}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority&connectTimeoutMS=5000",
        tlsCAFile=certifi.where(),
    )
    collection = client["a380flightsDb"]["a380flightsCollectionV2"]

    aircraft = fetch_a380s()
    print(f"adsb.lol: {len(aircraft)} A380s currently airborne")

    seen_callsigns = set()
    inserted = 0
    skipped_no_route = 0
    skipped_dupe = 0

    for ac in aircraft:
        callsign = (ac.get("flight") or "").strip()
        if not callsign or callsign in seen_callsigns:
            skipped_dupe += 1
            continue
        seen_callsigns.add(callsign)

        route = lookup_route(callsign)
        time.sleep(0.4)  # be polite to adsbdb

        if not route:
            skipped_no_route += 1
            continue

        try:
            origin_iata = route["origin"]["iata_code"]
            destination_iata = route["destination"]["iata_code"]
        except (KeyError, TypeError):
            skipped_no_route += 1
            continue

        flight_number = route.get("callsign_iata") or callsign
        now = datetime.datetime.utcnow()

        # FR24 schema parity. Time fields are not authoritative from
        # ADS-B (we only know the plane is in the air right now), so
        # we leave the precise scheduled-time fields None — buildRoutesJson
        # tolerates missing times in deduped flightNumber matches.
        doc = {
            "loggingTime": now,
            "flightNumber": flight_number,
            "originIata": origin_iata,
            "destinationIata": destination_iata,
            "departureDatetimeLocal": None,
            "arrivalDatetimeLocal": None,
            "departureTimeLocal": None,
            "arrivalTimeLocal": None,
            "departureDow": now.weekday(),
            "arrivalDow": now.weekday(),
            "source": "adsblol",
            "hex": ac.get("hex"),
            "registration": ac.get("r"),
        }
        collection.insert_one(doc)
        inserted += 1
        print(f"  {flight_number} {origin_iata}→{destination_iata} ({ac.get('r')})")

    print(
        f"Done. inserted={inserted} no_route={skipped_no_route} dupes={skipped_dupe}"
    )
    client.close()


if __name__ == "__main__":
    main()
