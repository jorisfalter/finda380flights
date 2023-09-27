import json
import time
import datetime
import pytz
import csv
import pymongo
import certifi
from dotenv import load_dotenv
import os

# deprecated
# i can also delete the db

if __name__ == "__main__":

    from pymongo import MongoClient
    ca = certifi.where()

    # Load environment variables from .env file
    load_dotenv()
    mongoPass = os.getenv("MONGO_ATLAS_PASS")

    client = pymongo.MongoClient(
        f'mongodb+srv://joris-a380:{mongoPass}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority&connectTimeoutMS=5000', tlsCAFile=ca)

    db = client['a380flightsDb']
    source_collection = db['a380flightsCollection']
    target_collection=db['a380flightsCollectionFiltered']

    # Find duplicates in the source collection
    pipeline = [
        {
        "$group": {
            "_id": {"flightNumber": "$flightNumber", "departureDatetimeLocal": "$departureDatetimeLocal"},
            "count": {"$sum": 1},
            "docs": {"$push": "$_id"},
            }
        },
        {
            "$match": {"count": {"$gt": 1}}
        }
    ]

    duplicates = list(source_collection.aggregate(pipeline))

    # Insert deduplicated documents into the target collection
    for duplicate in duplicates:
        docs_to_keep = duplicate["docs"][:1]  # Keep the first document, discard the rest
        deduplicated_docs = source_collection.find({"_id": {"$in": docs_to_keep}})
        target_collection.insert_many(deduplicated_docs)

    # close db:
    client.close()
