import json
import time
from datetime import datetime
import pytz
import csv
import pymongo
import certifi
from dotenv import load_dotenv
import os


# imports the data from airports.json

# Specify the path to your JSON file
json_file_path = "airports.json"

# Open and read the JSON file
with open(json_file_path, "r") as json_file:
    airport_coordinates = json.load(json_file)

if __name__ == "__main__":

    # Custom JSON encoder that handles datetime objects
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return super().default(obj)

    from pymongo import MongoClient
    ca = certifi.where()

    # Load environment variables from .env file
    load_dotenv()
    mongoPass = os.getenv("MONGO_ATLAS_PASS")

    client = pymongo.MongoClient(
        f'mongodb+srv://joris-a380:{mongoPass}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority&connectTimeoutMS=5000', tlsCAFile=ca)

    db = client['a380flightsDb']
    source_collection = db['a380flightsCollection']

    # Query MongoDB and retrieve data
    data = []
    for document in source_collection.find():
        # if "data" has and object with the same document['originIata'] and document['destinationIata']
        # else if "data" has an object inverted origin and destination
        # if both not, build a new object
        # if one of both, check the goflights / returnflights, wel duidelijk maken welke van de twee checken, anders gaat ie duplicates genereren

        # search the coordinates
        # Look up the coordinates for the origin
        foundCoordinatesOrigin = airport_coordinates.get(
            document["originIata"])

        # for error handling now
        latitudeOrigin = 0
        longitudeOrigin = 0

        if foundCoordinatesOrigin:
            latitudeOrigin = foundCoordinatesOrigin["latitude"]
            longitudeOrigin = foundCoordinatesOrigin["longitude"]

        # look up the coordinates for the destination
        foundCoordinatesDestination = airport_coordinates.get(
            document["destinationIata"])

        # for error handling now
        latitudeDestination = 0
        longitudeDestination = 0

        if foundCoordinatesDestination:
            latitudeDestination = foundCoordinatesDestination["latitude"]
            longitudeDestination = foundCoordinatesDestination["longitude"]

        newObject = {"originName": document["originIata"],
                     "originCityName": "",
                     "originCoordinates": [longitudeOrigin, latitudeOrigin],
                     "destinationName":  document["destinationIata"],
                     "destinationCityName": "",
                     "destinationCoordinates": [longitudeDestination, latitudeDestination],
                     "goflights": [{
                         "airline": "",
                         "flightNumber": document["flightNumber"],
                         "daysOfWeek": [],
                         "departureTimeLocal": document["departureDatetimeLocal"],
                         "arrivalTimeLocal": document["arrivalDatetimeLocal"]}],
                     "returnflights": [{
                         "airline": "",
                         "flightNumber": "",
                         "daysOfWeek": [],
                         "departureTimeLocal": "",
                         "arrivalTimeLocal": ""}]
                     }
        data.append(newObject)
        # break

    # Specify the file path where you want to save the JSON file
    file_path = "data.json"

    # Open the file in write mode and use json.dump() to write the data
    with open(file_path, "w") as json_file:
        json.dump(data, json_file, indent=4, cls=DateTimeEncoder)

    # close db:
    client.close()
