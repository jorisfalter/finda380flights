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

    # Per-run counters for end-of-run health summary + Telegram alert.
    stats = {"inserted": 0, "rate_limited": 0, "other_error": 0, "no_destination": 0, "insert_failed": 0}

    for idx, flight in enumerate(flights):
        # Throttle to stay under FR24's per-request rate limit
        if idx > 0:
            time.sleep(1.5)

        try:
            flight_details = api.get_flight_details(flight)
        except Exception as e:
            # 429s and intermittent failures should not kill the whole run
            msg = str(e)[:120]
            if "429" in msg or "Too Many" in msg:
                stats["rate_limited"] += 1
            else:
                stats["other_error"] += 1
            print(f"skip {flight.number}: {type(e).__name__}: {msg}")
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

            try:
                collection.insert_one(dataOneFlight)
                stats["inserted"] += 1
            except Exception as e:
                stats["insert_failed"] += 1
                print(f"insert fail {flight.number}: {type(e).__name__}: {str(e)[:120]}")

            print(flight.number, flight.origin_airport_iata,
                  flight.destination_airport_iata, local_dep_datetime, departureTimeLocal, departureDow, local_arr_datetime, arrivalTimeLocal, arrivalDow)


        else:
            stats["no_destination"] += 1
            print("no destination")

    # Health summary — printed every run, alerted to Telegram only when
    # FR24 has effectively given up. Threshold is intentionally strict
    # (inserted==0 with a non-trivial fleet) because FR24's normal hit
    # rate is 5-15% with rate-limiting — alerting on every "low" run
    # would spam. Dedupe via a state collection: max one alert per
    # aircraft per 12h.
    found = len(flights)
    inserted = stats["inserted"]
    rate = (inserted / found) if found else 0
    print(
        f"FR24 {config['display_name']} summary: found={found} inserted={inserted} "
        f"rate_limited={stats['rate_limited']} other_error={stats['other_error']} "
        f"no_destination={stats['no_destination']} insert_failed={stats['insert_failed']} "
        f"success_rate={rate:.0%}"
    )
    DEAD_THRESHOLD_FOUND = 20
    DEAD_ALERT_DEDUPE_HOURS = 12
    if found >= DEAD_THRESHOLD_FOUND and inserted == 0:
        health_col = client["a380flightsDb"]["_ingestHealth"]
        key = f"fr24:{aircraft_key}"
        last = health_col.find_one({"_id": key})
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=DEAD_ALERT_DEDUPE_HOURS)
        if not last or last.get("lastAlertAt", datetime.datetime.min) < cutoff:
            try:
                from notify import telegram_notify
                telegram_notify(
                    f"⚠️ FR24 {config['display_name']} ingest is dead: "
                    f"0/{found} captured. {stats['rate_limited']} rate-limited, "
                    f"{stats['other_error']} other errors. "
                    f"adsb.lol backup still covers most routes."
                )
                health_col.update_one(
                    {"_id": key},
                    {"$set": {"lastAlertAt": datetime.datetime.utcnow(),
                              "found": found, "inserted": inserted,
                              "rate_limited": stats["rate_limited"]}},
                    upsert=True,
                )
            except Exception as e:
                print(f"  (telegram alert failed: {e})")

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
