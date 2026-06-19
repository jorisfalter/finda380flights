"""Daily cleanup: keep only the last RETENTION_DAYS of records.

Uses drop-and-repack instead of plain delete because MongoDB Atlas
M0 free tier's WiredTiger storage engine doesn't release allocated
disk space after deletes. The June 2026 incident: we deleted 1.5M
records but storage stayed at 150MB allocated, eventually hit the
512MB quota intermittently, and the adsb.lol cron started crashing.

Drop-and-repack pattern:
  1. Read records we want to keep into memory
  2. Drop the whole collection (releases ALL allocated storage)
  3. Re-insert the kept records (storage allocated fresh, minimal)

Daily cost is small at our scale (~200K kept docs ~= 30s of work).
RETENTION_DAYS=180 covers seasonal "parked fleet" lookups (Qatar
parks A380s every summer — April→October).
"""

import os
import sys
import datetime

import pymongo
import certifi
from dotenv import load_dotenv

from aircraft_config import get_config


def repack(client, collection_name, retention_days):
    db = client["a380flightsDb"]
    col = db[collection_name]
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=retention_days)

    before_count = col.count_documents({})
    before_storage = db.command("collStats", collection_name).get("storageSize", 0) / 1024 / 1024

    keep = list(col.find({"loggingTime": {"$gte": cutoff}}))
    dropped = before_count - len(keep)

    col.drop()

    if keep:
        # Re-insert in batches to stay within reasonable memory + payload size.
        new_col = db[collection_name]
        for i in range(0, len(keep), 5000):
            new_col.insert_many(keep[i : i + 5000], ordered=False)

    after_storage = db.command("collStats", collection_name).get("storageSize", 0) / 1024 / 1024
    print(
        f"{collection_name}: kept {len(keep)}, dropped {dropped}, "
        f"storage {before_storage:.1f}MB → {after_storage:.1f}MB"
    )


def main(aircraft_keys, retention_days):
    mongo_pass = os.getenv("MONGO_ATLAS_PASS")
    client = pymongo.MongoClient(
        f"mongodb+srv://joris-a380:{mongo_pass}@cluster0.1gi6i3v.mongodb.net/"
        f"?retryWrites=true&w=majority&connectTimeoutMS=5000",
        tlsCAFile=certifi.where(),
    )
    try:
        for key in aircraft_keys:
            try:
                config = get_config(key)
                repack(client, config["flights_collection"], retention_days)
            except Exception as e:
                print(f"{key} cleanup failed: {type(e).__name__}: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    load_dotenv()
    retention_days = int(os.getenv("RETENTION_DAYS", "180"))
    keys = sys.argv[1:] if len(sys.argv) > 1 else ["a380", "b747"]
    main(keys, retention_days)
