
import json

# use this file to manually dump all airports or airlines into console

# Specify the path to the JSON file
file_path = "dataDump.json"

# Open and read the JSON file
with open(file_path, "r") as json_file:
    data = json.load(json_file)

# Create an array with only the 'originIata' values
# origin_data = [item["originIata"] for item in data]
# unique_list = list(set(origin_data))

# create an array with only the first two letters of the flightnumber
airline_date = [item["flightNumber"][:2] for item in data]
unique_list = list(set(airline_date))


# 'origin_data' now contains only the 'originIata' values
print(unique_list)
