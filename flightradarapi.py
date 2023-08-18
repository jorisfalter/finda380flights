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
        
        # print timezone details

        print(flight_details['airport']['origin']['code'])
        print(flight_details['airport']['origin']['timezone'])
        print(flight_details['airport']['destination']['code'])
        print(flight_details['airport']['destination']['timezone'])    
        target_timezone_origin = flight_details['airport']['origin']['timezone']['name']
        target_timezone_destination = flight_details['airport']['destination']['timezone']['name']
        print(target_timezone_origin)
        print(target_timezone_destination)

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
        local_dep_datetime = utc_dep_datetime.astimezone(pytz.timezone(target_timezone_origin))
        local_arr_datetime = utc_arr_datetime.astimezone(pytz.timezone(target_timezone_destination))

        print(local_dep_datetime)
        print(local_arr_datetime)
        print(flight.number)


        # not sure what this was for
        # print(flight_details['time']['scheduled'])
        # print(time.localtime(flight_details['time']['scheduled']['departure']))
      
        # all details
        # print(flight.__dict__)

        # eventual code 

        # dep_time = time.localtime(flight_details['time']['scheduled']['departure'])
        # arr_time = time.localtime(flight_details['time']['scheduled']['arrival'])
        # print(flight.number, flight.origin_airport_iata,
        #      flight.destination_airport_iata,
        #      dep_time.tm_year,"-",dep_time.tm_mon,"-",dep_time.tm_mday,dep_time.tm_hour,":",dep_time.tm_min,
        #      arr_time.tm_year,"-",arr_time.tm_mon,"-",arr_time.tm_mday,arr_time.tm_hour,":",arr_time.tm_min)
        break

        # it's converting to my time zone again aaaarggg
        # goal: Number; dep airport, arr airport; dep time; arr time


if __name__ == "__main__":
    flight_data=get_flight_data()

    # if flight_data:
    #     # Print or process the flight data
    #     print(flight_data.number)
    # else:
    #     print("Failed to fetch data")
