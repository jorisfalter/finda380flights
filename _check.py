import os, pymongo, certifi, datetime
from dotenv import load_dotenv
load_dotenv()
c = pymongo.MongoClient(
    f"mongodb+srv://joris-a380:{os.getenv('MONGO_ATLAS_PASS')}@cluster0.1gi6i3v.mongodb.net/?retryWrites=true&w=majority",
    tlsCAFile=certifi.where(),
)
col = c['a380flightsDb']['a380flightsCollectionV2']
print('Total docs:', col.count_documents({}))
last = list(col.find({}).sort('loggingTime', -1).limit(5))
for d in last:
    print('Recent:', d.get('loggingTime'), d.get('flightNumber'), d.get('originIata'), '->', d.get('destinationIata'))
now = datetime.datetime.utcnow()
for d in [1, 7, 14, 30, 60, 90, 180]:
    since = now - datetime.timedelta(days=d)
    print(f'Last {d}d:', col.count_documents({'loggingTime': {'$gte': since}}))
last_before_today = list(col.find({'loggingTime': {'$lt': now.replace(hour=0,minute=0,second=0,microsecond=0)}}).sort('loggingTime', -1).limit(1))
if last_before_today:
    print('Last insert before today:', last_before_today[0]['loggingTime'])
routes_col = c['a380flightsDb']['a380routesCollection']
print('Routes collection docs:', routes_col.count_documents({}))
