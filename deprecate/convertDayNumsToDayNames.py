import json
from datetime import datetime


routes_file = "routesV2.json"

with open(routes_file, "r") as json_file:
    routes_data = json.load(json_file)

# Function to convert day numbers to abbreviated day names


# Custom JSON encoder that handles datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def convert_to_abbreviated_days(days_list):
    abbreviated_days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
    return [abbreviated_days[day] for day in sorted(days_list)]


# Process the data
for entry in routes_data:
    for flight in entry["goflights"] + entry["returnflights"]:
        flight["daysOfWeek"] = convert_to_abbreviated_days(
            flight["daysOfWeek"])

# Print the updated data
# print(json.dumps(routes_data, indent=4))

# Specify the file path where you want to save the JSON file
file_path = "routesV2_dates.json"

# Open the file in write mode and use json.dump() to write the data
with open(file_path, "w") as json_file:
    json.dump(routes_data, json_file, indent=4, cls=DateTimeEncoder)
