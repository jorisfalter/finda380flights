from FlightRadar24 import FlightRadar24API
import json
import time


def get_flight_data():
    api = FlightRadar24API()
    # flight_data = api.get_flights(aircraft_type="A388", details=True)
    # return flight_data

    # for flight in api.get_flights(aircraft_type="A388", details="true"):
    #     print(flight.__dict__)
    #     break

    for flight in api.get_flights(aircraft_type="A388"):
        flight_details = api.get_flight_details(flight)

        # print(json.dumps(flight_details,
        #       sort_keys=True, indent=4)[0:25000])

        print(flight_details['time']['scheduled'])
        print(time.localtime(flight_details['time']['scheduled']['departure']))

        # print(flight.__dict__)
        # print(flight.number, flight.origin_airport_iata,
        #      flight.destination_airport_iata)
        break


if __name__ == "__main__":
    flight_data = get_flight_data()

    # if flight_data:
    #     # Print or process the flight data
    #     print(flight_data.number)
    # else:
    #     print("Failed to fetch data")
