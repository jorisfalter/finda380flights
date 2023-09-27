import json
import time
import datetime
import pytz
import csv
import pymongo
import certifi
from dotenv import load_dotenv
import os


if __name__ == "__main__":

    from pymongo import MongoClient
    ca = certifi.where()

    # Load environment variables from .env file
    load_dotenv()
    mongoPass = os.getenv("MONGO_ATLAS_PASS")

    client = pymongo.MongoClient(
        f'mongodb+srv://joris-a380:{mongoPass}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority&connectTimeoutMS=5000', tlsCAFile=ca)

    db = client['a380flightsDb']
    collection = db['a380flightsCollectionV2']

    # take data out of collection
    cursor = collection.find()

    # Specify the fields to export (all fields)
    fields = list(cursor[0].keys())

    # identify the csv file
    filename = "data.csv"

    # Open the file in write mode ('w')
    with open(filename, mode='w', newline='') as file:
        csv_writer = csv.DictWriter(file, fieldnames=fields)
        csv_writer.writeheader()
        for row in cursor:
            csv_writer.writerow(row)
    file.close()

    # close db:
    client.close()
