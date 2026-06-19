"""Daily cleanup: delete source-collection records older than N days.

Prevents the MongoDB Atlas free-tier 512MB quota from filling up and
silently blocking all writes — which is exactly what happened in
June 2026 (1.7M records accumulated since 2023, hit 517/512MB, every
ingest insert started failing, routes collection went empty, no
Telegram alert because the alert system only watched for unknown
airport codes).

RETENTION_DAYS=180 is plenty for our use:
- buildRoutesJson only reads the last LOOKBACK_DAYS (=30) for routes
- airline-status's "last A380 flight" lookback handles parked fleets
  up to RETENTION_DAYS old, which covers seasonal patterns like
  Qatar parking its A380s every summer
"""

import os
import sys
import datetime

import pymongo
import certifi
from dotenv import load_dotenv

from aircraft_config import get_config


def cleanup(aircraft_key, retention_days):
    config = get_config(aircraft_key)
    mongo_pass = os.getenv("MONGO_ATLAS_PASS")
    client = pymongo.MongoClient(
        f"mongodb+srv://joris-a380:{mongo_pass}@cluster0.1gi6i3v.mongodb.net/"
        f"?retryWrites=true&w=majority&connectTimeoutMS=5000",
        tlsCAFile=certifi.where(),
    )
    col = client["a380flightsDb"][config["flights_collection"]]
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=retention_days)
    before = col.count_documents({})
    result = col.delete_many({"loggingTime": {"$lt": cutoff}})
    after = col.count_documents({})
    print(
        f"{config['flights_collection']}: deleted {result.deleted_count} records "
        f"older than {cutoff.isoformat()}  (before={before} after={after})"
    )
    client.close()


if __name__ == "__main__":
    load_dotenv()
    retention_days = int(os.getenv("RETENTION_DAYS", "180"))
    keys = sys.argv[1:] if len(sys.argv) > 1 else ["a380", "b747"]
    for key in keys:
        try:
            cleanup(key, retention_days)
        except Exception as e:
            print(f"{key} cleanup failed: {type(e).__name__}: {e}")
