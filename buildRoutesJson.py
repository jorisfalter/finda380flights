import json
import re
import sys
import time
from datetime import datetime, timedelta
import pytz
import csv
import pymongo
import certifi
from dotenv import load_dotenv
import os

from aircraft_config import get_config


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


# OurAirports fallback dataset: ~85k airports, public domain CSV.
# Used when an IATA code isn't in our curated airports.json — prevents
# the (0,0) ghost-route bug where unknown airports landed on the Africa
# coast instead of being properly placed.
ourairports_data = {}    # primary iata_code → airport
ourairports_alias = {}   # 3-letter keyword aliases → airport (lower priority)
try:
    with open("ourairports.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat = float(row["latitude_deg"])
                lon = float(row["longitude_deg"])
            except (KeyError, ValueError):
                continue
            entry = {
                "cityName": (row.get("municipality") or row.get("name") or "").strip() or "na",
                "latitude": lat,
                "longitude": lon,
            }
            iata = (row.get("iata_code") or "").strip().upper()
            if iata:
                ourairports_data[iata] = entry
            # OurAirports sometimes carries a stale iata_code and lists the
            # current code only in keywords (e.g. Bishkek: iata_code=BSZ but
            # keywords include FRU). Index 3-letter all-caps keyword tokens
            # as lower-priority aliases so those still resolve.
            for token in re.split(r"[,;]", row.get("keywords") or ""):
                token = token.strip().upper()
                if len(token) == 3 and token.isalpha():
                    ourairports_alias.setdefault(token, entry)
    print(f"Loaded {len(ourairports_data)} airports + {len(ourairports_alias)} keyword aliases from ourairports.csv")
except FileNotFoundError:
    print("WARNING: ourairports.csv missing — unknown airports will be skipped")


unknown_airports = {}  # iata → list of flight numbers seen, for end-of-run notify

# Junk values the upstream feeds emit when an airport is genuinely unknown.
# These are not real codes — skip the route silently, no Telegram alert.
INVALID_IATA = {"", "N/A", "NA", "NULL", "NONE", "-", "?", "XXX"}


def resolve_airport(iata, flight_number=None):
    """Look up IATA → (latitude, longitude, cityName).
    Returns None if the code is junk or unknown. Genuinely-unknown real
    codes are tracked for an end-of-run Telegram summary; junk codes
    (N/A etc.) are skipped without alerting."""
    code = (iata or "").strip().upper()
    if code in INVALID_IATA:
        return None  # junk — skip route, do not alert
    found = airport_data.get(iata)
    if found and found.get("latitude") is not None and found.get("longitude") is not None:
        return found["latitude"], found["longitude"], found.get("cityName", "na")
    found = ourairports_data.get(code) or ourairports_alias.get(code)
    if found:
        return found["latitude"], found["longitude"], found["cityName"]
    unknown_airports.setdefault(code, []).append(flight_number or "<no flight>")
    return None





# function to get the airline name
def get_airline_name(flight_number):
    # Extract the first two letters from the flight number (the airline abbreviation)
    airline_abbreviation = flight_number[:2].upper()  # Convert to uppercase for case-insensitive matching

    # Check if the airline abbreviation exists in the data
    if airline_abbreviation in airline_data:
        return airline_data[airline_abbreviation]
    else:
        return "Unknown"  # Return a default value if the abbreviation is not found

# Function to convert a number to a day of week
# deprecated > moved to external function
def number_to_day_name(number):
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    if 0 <= number <= 6:
        return days[number]
    else:
        return None

# Function to update the daysOfWeek for a specific flightNumber
def add_day_of_week(flights, flight_number, day_of_week):
    # print(flights)
    for flight in flights:
        # print(flight)
        # print(flight_number)
        # day_of_week_name = number_to_day_name(day_of_week)
        if flight["flightNumber"] == flight_number:
            if day_of_week not in flight["daysOfWeek"]:
                flight["daysOfWeek"].append(day_of_week)
            break  # No need to continue searching once found

def convert_to_abbreviated_days(days_list):
    abbreviated_days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
    return [abbreviated_days[day] for day in sorted(days_list)]

if __name__ == "__main__":

    # Default to a380 — preserves the existing Heroku Scheduler entry
    # that calls `python3 buildRoutesJson.py` without args.
    aircraft_key = sys.argv[1] if len(sys.argv) > 1 else "a380"
    aircraft_config = get_config(aircraft_key)
    print(f"Building routes for {aircraft_config['display_name']} "
          f"(source: {aircraft_config['flights_collection']}, "
          f"target: {aircraft_config['routes_collection']})")

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
    source_collection = db[aircraft_config["flights_collection"]]

    # Query MongoDB and retrieve data
    data = []
    counter = 0
    countNewGoRoutes = 0
    countNewReturnRoutes = 0;
    ignoredRoutes = 0;

    # Lookback window for which past flights count toward "current routes".
    # Defaults to 7 days. Set LOOKBACK_DAYS env var to widen, e.g. for backfill
    # after an ingest outage or to make the map more resilient to weekly gaps.
    lookback_days = int(os.getenv("LOOKBACK_DAYS", "7"))
    cutoff = datetime.utcnow() - timedelta(days=lookback_days)
    print(f"Using {lookback_days}-day lookback (cutoff {cutoff.isoformat()})")

    for document in source_collection.find({'loggingTime': {'$gte': cutoff}}):

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
                # print(document["departureTimeLocal"])
                countNewGoRoutes += 1

                airlineName = get_airline_name(document["flightNumber"])
                new_subObject = {
                            "airline": airlineName,
                            "flightNumber": document["flightNumber"],
                            "daysOfWeek": [document["departureDow"]],
                            "departureTimeLocal": document["departureTimeLocal"],
                            "arrivalTimeLocal": document["arrivalTimeLocal"]}
                matching_data_obj["goflights"].append(new_subObject)

                data[index_of_matching_obj] = matching_data_obj

            else: 
                # now check the DOW
                add_day_of_week(matching_data_obj["goflights"], document["flightNumber"], document["departureDow"])
        
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
                            "daysOfWeek": [document["departureDow"]],
                            "departureTimeLocal": document["departureTimeLocal"],
                            "arrivalTimeLocal": document["arrivalTimeLocal"]}
                    matching_data_obj_return["returnflights"].append(new_subObject)

                    data[index_of_matching_obj_return] = matching_data_obj_return

                else: 
                    # now check the DOW
                    add_day_of_week(matching_data_obj_return["returnflights"], document["flightNumber"], document["departureDow"])


            # if both the return and the go flights don't exist, we have to create a new route
            else:

                # Resolve both airports through curated → OurAirports fallback.
                # If either is unknown, skip the route entirely instead of
                # plotting it at (0,0) — that ghost-routes lines through the
                # Atlantic and breaks the map (see DRS / MUC-DRS LH9902).
                origin_resolved = resolve_airport(document["originIata"], document["flightNumber"])
                destination_resolved = resolve_airport(document["destinationIata"], document["flightNumber"])
                if origin_resolved is None or destination_resolved is None:
                    unknown = []
                    if origin_resolved is None:
                        unknown.append(document["originIata"])
                    if destination_resolved is None:
                        unknown.append(document["destinationIata"])
                    ignoredRoutes += 1
                    print(f"SKIP route — unknown airport(s) {unknown} on flight {document['flightNumber']}")
                    continue

                latitudeOrigin, longitudeOrigin, cityNameOrigin = origin_resolved
                latitudeDestination, longitudeDestination, cityNameDestination = destination_resolved

                ## get the airline name
                airlineName = get_airline_name(document["flightNumber"])

                # get the day of week
                # day_of_week_name = number_to_day_name(document["departureDow"])


                newObject = {"originName": document["originIata"],
                            "originCityName": cityNameOrigin,
                            "originCoordinates": [longitudeOrigin, latitudeOrigin],
                            "destinationName":  document["destinationIata"],
                            "destinationCityName": cityNameDestination,
                            "destinationCoordinates": [longitudeDestination, latitudeDestination],
                            "goflights": [{
                                "airline": airlineName,
                                "flightNumber": document["flightNumber"],
                                "daysOfWeek": [document["departureDow"]],
                                "departureTimeLocal": document["departureTimeLocal"],
                                "arrivalTimeLocal": document["arrivalTimeLocal"]}],
                            "returnflights": [
                                # empty array for now
                                ]
                            }
                data.append(newObject)
                counter +=1

    print(f"array with {counter} objects created")
    print(f"{countNewGoRoutes} go routes added")
    print(f"{countNewReturnRoutes} return routes added")
    # print(f"{ignoredRoutes} duplicates ignored")


    # convert to days of week
    for entry in data:
        for flight in entry["goflights"] + entry["returnflights"]:
            flight["daysOfWeek"] = convert_to_abbreviated_days(
                flight["daysOfWeek"])


    # clean up data: if return is empty, don't show
    filtered_data = [obj for obj in data if obj["returnflights"]]

    # clean up data: if airline is unknown remove nested object
    # Remove nested objects with "Unknown" airline
    second_filtered_data = [
    {
        **entry,
        "goflights": [flight for flight in entry["goflights"] if flight["airline"] != "Unknown"],
        "returnflights": [flight for flight in entry["returnflights"] if flight["airline"] != "Unknown"],
    }
    for entry in filtered_data
    ]

    # story locally
    # Specify the file path where you want to save the JSON file
    # file_path = "routesV2.json"

    # Open the file in write mode and use json.dump() to write the data
    # with open(file_path, "w") as json_file:
        # json.dump(second_filtered_data, json_file, indent=4, cls=DateTimeEncoder)

    # close db from which I retrieved data:
    client.close()

    # write to mongo db to store data
    # load Mongo
    from pymongo import MongoClient
    ca = certifi.where()

    # Load environment variables from .env file
    load_dotenv()
    mongoPass = os.getenv("MONGO_ATLAS_PASS")

    client = pymongo.MongoClient(
        f'mongodb+srv://joris-a380:{mongoPass}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority&connectTimeoutMS=5000', tlsCAFile=ca)

    db = client['a380flightsDb']
    collection = db[aircraft_config["routes_collection"]]

    # Defensive: refuse to wipe the routes collection if the new build
    # is empty. Without this guard, an upstream ingest outage cascades
    # into a blank map in prod (see April 30 → May 7 2026 incident).
    if not second_filtered_data:
        print(f"REFUSING to wipe routes — second_filtered_data is empty. "
              f"Existing route count preserved: {collection.count_documents({})}")
    else:
        collection.delete_many({})
        collection.insert_many(second_filtered_data)
        print(f"Routes rebuilt: {len(second_filtered_data)} entries")

    # End-of-run alert for unresolvable airports. Stays quiet when everything
    # was resolvable — only fires when there's a genuine new IATA to deal with.
    real_unknowns = {k: v for k, v in unknown_airports.items() if k and k != "<empty>"}
    if real_unknowns:
        from notify import telegram_notify
        lines = ["A380 map: unresolvable IATA codes this run"]
        for iata, flights in sorted(real_unknowns.items()):
            sample_flights = ", ".join(sorted(set(flights))[:5])
            lines.append(f"  • {iata} (flights: {sample_flights})")
        lines.append("Add to airports.json or extend ourairports.csv.")
        telegram_notify("\n".join(lines))

    # Per-airline last-seen date. Powers the frontend "parked fleet"
    # indicator — e.g. Qatar greyed out with "last A380 flight 1 Apr 2026"
    # when they seasonally park their A380s. Grouped by 2-letter flight
    # number prefix across the whole source collection (all-time).
    status_collection = db[aircraft_key + "airlineStatus"]
    pipeline = [
        {"$match": {"flightNumber": {"$type": "string", "$ne": ""}}},
        {"$group": {
            "_id": {"$toUpper": {"$substrCP": ["$flightNumber", 0, 2]}},
            "lastFlight": {"$max": "$loggingTime"},
            "totalSeen": {"$sum": 1},
        }},
    ]
    status_docs = []
    for row in source_collection.aggregate(pipeline):
        code = row["_id"]
        if not code or len(code) != 2:
            continue
        status_docs.append({
            "code": code,
            "airline": get_airline_name(code),
            "lastFlight": row["lastFlight"],
            "totalSeen": row["totalSeen"],
        })
    if status_docs:
        status_collection.delete_many({})
        status_collection.insert_many(status_docs)
        print(f"Airline status: {len(status_docs)} airline codes written")



  
