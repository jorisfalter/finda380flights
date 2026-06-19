from FlightRadar24 import FlightRadar24API
import json
import time
import datetime
import pytz
import csv
import sys
import pymongo
import certifi
from dotenv import load_dotenv
import os

from aircraft_config import get_config, resolve_keys


def get_flight_data(aircraft_key="a380"):
    config = get_config(aircraft_key)
    api = FlightRadar24API()
    from pymongo import MongoClient
    ca = certifi.where()

    # Load environment variables from .env file
    load_dotenv()
    mongoPass = os.getenv("MONGO_ATLAS_PASS")

    client = pymongo.MongoClient(
        f'mongodb+srv://joris-a380:{mongoPass}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority&connectTimeoutMS=5000', tlsCAFile=ca)

    db = client['a380flightsDb']
    collection = db[config["flights_collection"]]

    # ICAO type codes per aircraft family (e.g. 747 has B748/B744/B74F).
    flights = []
    for icao_type in config["icao_types"]:
        flights.extend(api.get_flights(aircraft_type=icao_type))
    print(f"Found {len(flights)} {config['display_name']} flights "
          f"(types: {','.join(config['icao_types'])})")

    for idx, flight in enumerate(flights):
        # Throttle to stay under FR24's per-request rate limit
        if idx > 0:
            time.sleep(1.5)

        try:
            flight_details = api.get_flight_details(flight)
        except Exception as e:
            # 429s and intermittent failures should not kill the whole run
            print(f"skip {flight.number}: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(5)
            continue

        # get all flight details
        # print(json.dumps(flight_details,
        #       sort_keys=True, indent=4)[0:25000])

        if flight_details['airport']['destination'] is not None:
            target_timezone_origin = flight_details['airport']['origin']['timezone']['name']
            target_timezone_destination = flight_details['airport']['destination']['timezone']['name']

            # Unix timestamp
            unix_dep_time = flight_details['time']['scheduled']['departure']
            unix_arr_time = flight_details['time']['scheduled']['arrival']

            # Convert Unix timestamp to datetime object
            utc_dep_datetime = datetime.datetime.utcfromtimestamp(
                unix_dep_time)
            utc_arr_datetime = datetime.datetime.utcfromtimestamp(
                unix_arr_time)

            # Set the UTC time zone to the datetime object
            utc_dep_datetime = utc_dep_datetime.replace(tzinfo=pytz.utc)
            utc_arr_datetime = utc_arr_datetime.replace(tzinfo=pytz.utc)

            # Convert to the target time zone
            local_dep_datetime = utc_dep_datetime.astimezone(
                pytz.timezone(target_timezone_origin))
            local_arr_datetime = utc_arr_datetime.astimezone(
                pytz.timezone(target_timezone_destination))

            # print all details
            # print(flight.__dict__)

            now = datetime.datetime.now()

            departureTimeLocal = local_dep_datetime.strftime('%H:%M')
            arrivalTimeLocal = local_arr_datetime.strftime('%H:%M')
            departureDow = local_dep_datetime.weekday()
            arrivalDow = local_arr_datetime.weekday()


            # data for database
            dataOneFlight = {"loggingTime":now,"flightNumber": flight.number, "originIata": flight.origin_airport_iata,
                             "destinationIata": flight.destination_airport_iata, "departureDatetimeLocal": local_dep_datetime,
                             "arrivalDatetimeLocal": local_arr_datetime, "departureTimeLocal":departureTimeLocal, "arrivalTimeLocal":arrivalTimeLocal, "departureDow":departureDow, "arrivalDow":arrivalDow,
                             "icaoType": getattr(flight, "aircraft_code", None),
                             "source": "fr24"}

            result = collection.insert_one(dataOneFlight)

            # dataOneFlight = [flight.number, flight.origin_airport_iata,
            #  flight.destination_airport_iata, local_dep_datetime, local_arr_datetime]
            # data.append(dataOneFlight)

            print(flight.number, flight.origin_airport_iata,
                  flight.destination_airport_iata, local_dep_datetime, departureTimeLocal, departureDow, local_arr_datetime, arrivalTimeLocal, arrivalDow)


        else:
            print("no destination")
            # print(flight_details)

        # break
    # close db:
    client.close()


if __name__ == "__main__":

    # # take data out of collection
    # cursor = collection.find()

    # # write to file
    # filename = "data.csv"

    # # Open the file in write mode ('w')
    # with open(filename, mode='w', newline='') as file:
    #     csv_writer = csv.writer(file)
    #     for row in cursor:
    #         csv_writer.writerow(row)
    # file.close()

    # Accepts multiple keys or "all". `python3 flightradarapi.py` (no args)
    # = a380 only, for backward compat with the original cron.
    keys = resolve_keys(sys.argv[1:])
    for k in keys:
        try:
            get_flight_data(k)
        except Exception as e:
            print(f"{k} ingest failed: {type(e).__name__}: {e}")
