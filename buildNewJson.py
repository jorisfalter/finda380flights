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
# uses the data in airports.json
# after generating the routesV2 file you have to manually drag it to the "public" folder



# Open and read the Airports and Airlines files
json_file_path = "airports.json"
json_file_path_airlines = "airlines.json"

with open(json_file_path, "r") as json_file:
    airport_data = json.load(json_file)

with open(json_file_path_airlines,"r") as json_file:
    airline_data = json.load(json_file)

# function to get the airline name
def get_airline_name(flight_number):
    # Extract the first two letters from the flight number (the airline abbreviation)
    airline_abbreviation = flight_number[:2].upper()  # Convert to uppercase for case-insensitive matching

    # Check if the airline abbreviation exists in the data
    if airline_abbreviation in airline_data:
        return airline_data[airline_abbreviation]
    else:
        return "Unknown"  # Return a default value if the abbreviation is not found


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
    # source_collection = db['a380flightsCollection']
    source_collection = db['a380flightsCollectionV2']

    # Query MongoDB and retrieve data
    data = []
    counter = 0
    countNewGoRoutes = 0
    countNewReturnRoutes = 0;
    ignoredRoutes = 0;
    for document in source_collection.find():

        origin_iata = document["originIata"]
        destination_iata = document["destinationIata"]

        # extract the time
        # testTime = document["departureDatetimeLocal"]
        # print(type(document["departureDatetimeLocal"]))
        # Extract and format the time in 24-hour format
        # print(testTime)
        # formatted_time = testTime.strftime('%H:%M')
        # print(formatted_time)
        # print(type(document["arrivalDatetimeLocal"]))
        # break

        # Check if the flight already exists in the "data" array
        matching_data_obj = next(
            (obj for obj in data if obj["originName"] == origin_iata and obj["destinationName"] == destination_iata), None)

        # if the matching flight already exists (EXIST1) we will check if the Flight Number already exists:
        if matching_data_obj:

            # Find the index of the matching object in the data array
            index_of_matching_obj = data.index(matching_data_obj)

            # check the flightnumbers
            if all(item.get("flightNumber") != document["flightNumber"] for item in matching_data_obj["goflights"]):

                print("going to add a similar flight but other number")
                print(document["departureDatetimeLocal"])
                print(document["departureDatetimeLocal"].strftime('%H:%M'))
                countNewGoRoutes += 1

                airlineName = get_airline_name(document["flightNumber"])
                new_subObject = {
                            "airline": airlineName,
                            "flightNumber": document["flightNumber"],
                            "daysOfWeek": [],
                            "departureTimeLocal": document["departureDatetimeLocal"].strftime('%H:%M'),
                            "arrivalTimeLocal": document["arrivalDatetimeLocal"].strftime('%H:%M')}
                matching_data_obj["goflights"].append(new_subObject)

                data[index_of_matching_obj] = matching_data_obj

            else: 
                # now check the DOW
                ignoredRoutes +=1
        
        # if no matching flight already exists, we will check if the opposite (return) flight already exists
        else:
            # check if the return flight already exists in the "data" array
            matching_data_obj_return = next(
                (obj for obj in data if obj["originName"] == destination_iata and obj["destinationName"] == origin_iata), None)
            
            # Now we do similar steps to if the matching flight already exists (see EXIST1), we will check if the Flight Number already exists
            if matching_data_obj_return:

                # Find the index of the matching object in the data array
                index_of_matching_obj_return = data.index(matching_data_obj_return)
                
                # check the flightnumbers
                if all(item.get("flightNumber") != document["flightNumber"] for item in matching_data_obj_return["returnflights"]):

                    print("going to add a similar return flight but other number")
                    airlineName = get_airline_name(document["flightNumber"])
                    countNewReturnRoutes += 1
                    new_subObject = {
                            "airline": airlineName,
                            "flightNumber": document["flightNumber"],
                            "daysOfWeek": [],
                            "departureTimeLocal": document["departureDatetimeLocal"].strftime('%H:%M'),
                            "arrivalTimeLocal": document["arrivalDatetimeLocal"].strftime('%H:%M')}
                    matching_data_obj_return["returnflights"].append(new_subObject)

                    data[index_of_matching_obj_return] = matching_data_obj_return

                else: 
                    # now check the DOW
                    ignoredRoutes +=1

            # if both the return and the go flights don't exist, we have to create a new route
            else:

                ## search the coordinates
                ## Origin
                # Look up the coordinates for the origin
                foundCoordinatesOrigin = airport_data.get(
                    document["originIata"])

                # for error handling now
                latitudeOrigin = 0
                longitudeOrigin = 0
                cityNameOrigin = "na"

                if foundCoordinatesOrigin:
                    latitudeOrigin = foundCoordinatesOrigin["latitude"]
                    longitudeOrigin = foundCoordinatesOrigin["longitude"]
                    cityNameOrigin = foundCoordinatesOrigin["cityName"]

                ## destination
                # look up the coordinates for the destination
                foundCoordinatesDestination = airport_data.get(
                    document["destinationIata"])

                # for error handling now
                latitudeDestination = 0
                longitudeDestination = 0
                cityNameDestination = "na"

                if foundCoordinatesDestination:
                    latitudeDestination = foundCoordinatesDestination["latitude"]
                    longitudeDestination = foundCoordinatesDestination["longitude"]
                    cityNameDestination = foundCoordinatesDestination["cityName"]

                ## get the airline name
                airlineName = get_airline_name(document["flightNumber"])

                newObject = {"originName": document["originIata"],
                            "originCityName": cityNameOrigin,
                            "originCoordinates": [longitudeOrigin, latitudeOrigin],
                            "destinationName":  document["destinationIata"],
                            "destinationCityName": cityNameDestination,
                            "destinationCoordinates": [longitudeDestination, latitudeDestination],
                            "goflights": [{
                                "airline": airlineName,
                                "flightNumber": document["flightNumber"],
                                "daysOfWeek": [],
                                "departureTimeLocal": document["departureDatetimeLocal"].strftime('%H:%M'),
                                "arrivalTimeLocal": document["arrivalDatetimeLocal"].strftime('%H:%M')}],
                            "returnflights": [
                                # {
                                # "airline": "",
                                # "flightNumber": "",
                                # "daysOfWeek": [],
                                # "departureTimeLocal": "",
                                # "arrivalTimeLocal": ""}
                                ]
                            }
                data.append(newObject)
                counter +=1

    print(f"array with {counter} objects created")
    print(f"{countNewGoRoutes} go routes added")
    print(f"{countNewReturnRoutes} return routes added")
    print(f"{ignoredRoutes} duplicates ignored")

    
    # Specify the file path where you want to save the JSON file
    file_path = "routesV2.json"

    # Open the file in write mode and use json.dump() to write the data
    with open(file_path, "w") as json_file:
        json.dump(data, json_file, indent=4, cls=DateTimeEncoder)

    # close db:
    client.close()
