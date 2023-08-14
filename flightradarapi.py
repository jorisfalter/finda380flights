from FlightRadar24 import FlightRadar24API

def get_flight_data(flight_code):
    api = FlightRadar24API()
    flight_data = api.get_flights(aircraft_type = "A388")
    return flight_data

if __name__ == "__main__":
    flight_code = "EK397"  # Replace with the actual flight code you want to track
    flight_data = get_flight_data(flight_code)
    
    if flight_data:
        # Print or process the flight data
        print(flight_data)
    else:   
        print("Failed to fetch data")
