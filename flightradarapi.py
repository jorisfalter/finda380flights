from FlightRadar24 import FlightRadar24API
import json
import time
import datetime
import pytz


def get_flight_data():
    api = FlightRadar24API()
    # flight_data = api.get_flights(aircraft_type="A388", details=True)
    # return flight_data

    # for flight in api.get_flights(aircraft_type="A388", details="true"):
    #     print(flight.__dict__)
    #     break

    for flight in api.get_flights(aircraft_type="A388"):
        flight_details = api.get_flight_details(flight)

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
            utc_dep_datetime = datetime.datetime.utcfromtimestamp(unix_dep_time)
            utc_arr_datetime = datetime.datetime.utcfromtimestamp(unix_arr_time)

            # Set the UTC time zone to the datetime object
            utc_dep_datetime = utc_dep_datetime.replace(tzinfo=pytz.utc)
            utc_arr_datetime = utc_arr_datetime.replace(tzinfo=pytz.utc)

            # Convert to the target time zone
            local_dep_datetime = utc_dep_datetime.astimezone(
                pytz.timezone(target_timezone_origin))
            local_arr_datetime = utc_arr_datetime.astimezone(
                pytz.timezone(target_timezone_destination))

            # all details
            # print(flight.__dict__)

            # data for databse
            print(flight.number, flight.origin_airport_iata,
                flight.destination_airport_iata, local_dep_datetime, local_arr_datetime)
        else:
            print("no destination")
            # print(flight_details)
       
       # break

if __name__ == "__main__":
    flight_data=get_flight_data()

    # if flight_data:
    #     # Print or process the flight data
    #     print(flight_data.number)
    # else:
    #     print("Failed to fetch data")
