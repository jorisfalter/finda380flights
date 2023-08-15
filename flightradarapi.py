from FlightRadar24 import FlightRadar24API


def get_flight_data():
    api = FlightRadar24API()
    # flight_data = api.get_flights(aircraft_type="A388", details=True)
    # return flight_data

    for flight in api.get_flights(aircraft_type="A388"):
        flight_details = api.get_flight_details(flight)
        # print(flight.__dict__)
        print(flight.number)
        break


if __name__ == "__main__":
    flight_data = get_flight_data()

    # if flight_data:
    #     # Print or process the flight data
    #     print(flight_data.number)
    # else:
    #     print("Failed to fetch data")
