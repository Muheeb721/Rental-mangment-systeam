"""
Generates a labeled Roman Urdu / English training dataset for the Rental System chatbot.
Output: data/training_data_labeled.jsonl  (text, intent, entities=[[start, end, LABEL], ...])
        data/training_sentences.txt         (plain sentences, one per line)

Run:  python nlp/generate_dataset.py   (from the AI_Modal project root)

Entities: AREA, PROPERTY_TYPE, BUDGET, BEDROOMS, PURPOSE, FURNISHED, SIZE, ORDINAL,
          ORIGIN, DESTINATION, TRANSPORT, LANDMARK, FEATURE, DURATION, DISTANCE
Areas and landmarks come from the Lahore places dataset (app/services/gazetteer.py, which
loads the website's lahore-places.json), so every area / landmark of the website is covered.
Add your own areas / templates below and re-run to grow the dataset.
"""
import json
import random
import re
import sys
from pathlib import Path

random.seed(7)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.gazetteer import all_places  # noqa: E402

_PLACES = all_places()


def _surface_forms(place):
    """How people actually type a place: 'LUMS', 'Johar Town', 'JT', 'punjab uni' ..."""
    name = place["name"]
    forms = {name}
    m = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", name)
    if m:
        forms.add(m.group(1).strip())
        forms.add(m.group(2).strip())
    for a in place["aliases"]:
        if len(a) >= 2 and not re.search(r"[-]\d", a):
            forms.add(a.upper() if len(a) <= 4 and a.isalpha() else a.title() if random.random() < 0.6 else a)
    return sorted(forms)


GAZ_AREAS = sorted({f for p in _PLACES if p["kind"] == "area" for f in _surface_forms(p)})
GAZ_LANDMARKS = sorted({f for p in _PLACES if p["kind"] != "area" for f in _surface_forms(p)})
GAZ_UNIS = sorted({f for p in _PLACES if p["kind"] == "university" for f in _surface_forms(p)})

# ---------------------------------------------------------------- vocabulary
dha = [f"DHA Phase {i}" for i in range(1, 14)] + \
      [f"DHA Lahore Phase {i}" for i in range(1, 14)] + \
      ["DHA Phase 5 Lahore", "DHA Phase 6 Lahore", "DHA Phase 8 Lahore", "DHA Raya", "DHA Rahbar"]
askari = [f"Askari {i}" for i in range(1, 12)] + [f"Askari {i} Lahore" for i in range(1, 12)]
other_areas = [
    "Mall Road", "Eden society", "Eden Gardens", "Eden Avenue", "Bahria Town Lahore",
    "Shalimar Town", "naths singall village", "Johar Town", "Wapda Town", "Gulberg",
    "Model Town", "Valencia Town", "State Life Society", "LDA Avenue", "Samanabad",
    "Allama Iqbal Town", "Lake City", "Park View", "Central Park", "Paragon City",
    "Khayaban-e-Amin", "Al-Kabir Town", "Lahore Smart City", "Fazaia Housing Scheme",
    "Ferozepur Road", "Jail Road", "MM Alam Road", "Canal Bank Road", "Raiwind Road",
    "Ring Road", "Township", "Garden Town", "Faisal Town", "Iqbal Town", "Gulshan-e-Ravi",
    "Cavalry Ground", "Cantt", "Shadman", "Thokar Niaz Baig", "Bedian Road", "Multan Road",
    "Walton Road", "Barki Road", "Sabzazar", "Mughalpura", "Ichra", "Muslim Town",
    "Wahdat Road", "Ghari Shahu", "Harbanspura", "Baghbanpura", "Shalimar Garden",
]
prop_areas = dha + askari + other_areas + GAZ_AREAS

unis = [
    "LUMS", "UET Lahore", "FAST NUCES Lahore", "Punjab University", "GC University Lahore",
    "UMT", "UCP", "Superior University", "NCA Lahore", "Forman Christian College", "LCWU",
    "King Edward Medical University", "University of Lahore", "Beaconhouse National University",
    "COMSATS Lahore", "Kinnaird College", "Lahore Garrison University", "ITU Lahore",
    "Lahore Leads University", "University of Education Lahore", "UVAS Lahore",
    "Minhaj University", "Riphah International University Lahore", "Lahore School of Economics",
    "Institute of Business Administration Lahore",
]
landmarks = [
    "Lahore Railway Station", "Data Darbar", "Anarkali", "Liberty Market", "Emporium Mall",
    "Packages Mall", "Lahore Airport", "Gaddafi Stadium", "Shaukat Khanum Hospital",
    "Mayo Hospital", "Jinnah Hospital", "Services Hospital", "Minar-e-Pakistan",
]
origins_pool = prop_areas + unis + GAZ_UNIS
dest_pool = unis + other_areas + dha + askari + landmarks + GAZ_LANDMARKS + GAZ_LANDMARKS
landmark_pool = unis * 2 + landmarks + GAZ_LANDMARKS * 2

rent_ptypes = ["house", "flat", "apartment", "hostel", "room", "portion", "upper portion",
               "lower portion", "studio apartment", "hostel room", "kothi"]
ptype_weights = [4, 5, 5, 3, 2, 2, 2, 2, 1, 2, 1]
beds = ["1 bed", "2 bed", "3 bed", "4 bed", "5 bed", "1 bedroom", "2 bedrooms",
        "3 bedrooms", "4 bedrooms", "studio"]
sizes = ["3 marla", "5 marla", "7 marla", "10 marla", "1 kanal", "2 kanal", "8 marla", "4 marla", "12 marla"]
transports = ["bike", "car", "train", "motorcycle", "rickshaw", "metro bus", "Orange Line train", "bus"]

# monthly rent ranges in PKR (low, high) for a mid-tier area
rent_range = {
    "room": (8000, 20000), "hostel": (8000, 25000), "hostel room": (10000, 30000),
    "studio apartment": (25000, 60000), "flat": (25000, 90000), "apartment": (30000, 120000),
    "portion": (30000, 90000), "upper portion": (35000, 100000), "lower portion": (30000, 90000),
    "house": (60000, 250000), "kothi": (120000, 400000),
}
premium_words = ("DHA", "Askari")
premium_areas = {"Gulberg", "Model Town", "Bahria Town Lahore", "MM Alam Road", "Cantt",
                 "Mall Road", "Cavalry Ground", "Lahore Smart City"}
cheap_areas = {"Samanabad", "Mughalpura", "Ichra", "Harbanspura", "Baghbanpura", "Shalimar Town",
               "naths singall village", "Sabzazar", "Thokar Niaz Baig", "Bedian Road",
               "Gulshan-e-Ravi", "Ghari Shahu", "Township"}


def tier(area):
    if area is None:
        return 1.0
    if area.startswith(premium_words) or area in premium_areas:
        return 1.6
    if area in cheap_areas:
        return 0.65
    return 1.0


def make_budget(ptype, area):
    lo, hi = rent_range.get(ptype, (25000, 90000))
    m = tier(area)
    amount = random.uniform(lo * m, hi * m)
    amount = max(5000, int(round(amount / 5000.0)) * 5000)
    style = random.random()
    if amount >= 100000 and style < 0.2:
        return f"{amount / 100000:g} lakh"
    if style < 0.4:
        return f"{amount // 1000}k"
    if style < 0.6:
        return f"{amount // 1000} hazar"
    if style < 0.78:
        return f"Rs {amount:,}"
    if style < 0.9:
        return f"Rs {amount}"
    return f"{amount} rupay"


# ---------------------------------------------------------------- templates
# placeholders: {a},{a2} AREA | {s},{s2} ORIGIN | {d} DESTINATION | {p} PROPERTY_TYPE
# {hs} fixed "hostel" PROPERTY_TYPE | {b} BUDGET | {bd} BEDROOMS | {sz} SIZE
# {m} TRANSPORT | {car},{bike},{train},{walk} fixed TRANSPORT
T = {}

T["search_property"] = [
    "{a} mein {p} chahiye {b} tak",
    "mujhe {a} mein {p} rent par chahiye, budget {b} hai",
    "{a} me koi {p} available hai {b} tak?",
    "show me {p} for rent in {a} under {b}",
    "I need a {p} near {a} within {b}",
    "{a} ke qareeb {p} dikhao {b} ke andar",
    "{p} for rent {a} budget {b}",
    "{a} mein {bd} {p} kiraye par chahiye",
    "{a} me {bd} {p} {b} mein mil jayega?",
    "bhai {a} mein {p} batao {b} tak ka",
    "kya {a} mein {p} khali hai?",
    "mera budget {b} hai, {a} mein {p} dhoondo",
    "find me a {bd} {p} in {a}",
    "{a} area mein sasta {p} batao",
    "cheap {p} in {a} please",
    "{a} mein {sz} ka {p} chahiye",
    "{a} me {sz} {p} for rent {b}",
    "mujhe {a} ya {a2} mein {p} chahiye {b} tak",
    "{a} aur {a2} mein se koi {p} batao {b} ke andar",
    "any {p} available in {a} or {a2}?",
    "{a} mein furnished {p} chahiye",
    "furnished {p} in {a} under {b}",
    "{a} mein family ke liye {p} chahiye {b} tak",
    "students ke liye {p} chahiye {a} ke paas",
    "bachelor ke liye {p} {a} mein {b} tak",
    "{a} mein girls {hs} chahiye {b} monthly",
    "boys {hs} near {a} {b} per month",
    "{hs} {a} ke nazdeek {b} mahana",
    "{a} mein {p} dikhao jo abhi available ho",
    "available {p} list do {a} ki",
    "{a} ke {p} ki images dikhao",
    "{a} mein sab se sasta {p} konsa hai?",
    "{a} mein sab se mehnga {p} kya hai?",
    "mujhe {a} mein {bd} {p} chahiye jis ka rent {b} se kam ho",
    "{p} chahiye {a} mein, bijli pani gas sab ho, {b} tak",
    "can you suggest a {p} in {a} with budget {b}",
    "recommend me a {p} around {a}",
    "{a} ke aas paas {p} batao",
    "{a} mein {p} dhoond do",
    "yaar {a} mein koi achi {p} bata do {b} tak",
    "{b} mein {a} mein {p} mil sakta hai?",
    "{p} {a} {b}",
    "{a} {bd} {p} rent",
    "{a} mein {p} booked to nahi? available hai?",
]

T["price_inquiry"] = [
    "{a} mein {p} ka kiraya kitna hai?",
    "what is the rent of a {p} in {a}?",
    "{a} mein {bd} {p} ka rent kya chal raha hai?",
    "{a} me {p} ka average rent kya hai?",
    "average rent for a {bd} {p} in {a}",
    "{a} mein {sz} {p} ka kiraya kya hai?",
    "how much is the monthly rent for {p} in {a}?",
    "{a} ke {p} ka mahana kiraya batao",
    "{a} mein {p} kitne ka milta hai?",
    "{a} aur {a2} mein {p} ka rent compare karo",
]

T["book_property"] = [
    "mujhe {a} mein {p} book karna hai",
    "I want to book a {p} in {a}",
    "{a} mein {p} rent now karna hai {b} ke budget mein",
    "{a} wala {p} book kar do",
    "book a {bd} {p} in {a}",
    "{a} mein {p} kiraye par lena hai, kaise book karun?",
    "how can I rent a {p} in {a}?",
    "{p} rent karna hai {a} mein",
]

T["travel_time"] = [
    "{s} se {d} tak {m} par kitna time lagega?",
    "how long does it take from {s} to {d} by {m}?",
    "{s} to {d} travel time by {m}",
    "{d} pohanchne mein kitna waqt lagega {s} se {m} par?",
    "mere ghar {s} se {d} {m} par kitni der lagti hai?",
    "{s} se {d} jaane mein kitne minute lagenge {m} pe?",
    "main {s} mein hoon, {d} kitni der mein pohanchunga {m} se?",
    "I am at {s}, how much time to reach {d} by {m}?",
    "{d} kitni dair ki drive hai {s} se?",
    "estimated time {s} to {d} {m}",
    "{s} se {d} ka safar kitna lamba hai {m} par?",
    "agar main {s} rahun to {d} jaane mein kitna time lagega?",
    "{s} ya {s2} mein se {d} ke liye konsa qareeb hai?",
    "traffic ke saath {s} se {d} kitna time lagega?",
    "morning ke time {s} se {d} {m} par kitna time lagta hai?",
    "{s} se {d} {m} se kitni der ka rasta hai?",
    "{s} se {d} ka time batao {m} ke hisaab se",
    "mera university {d} hai, {s} se kitna time lagega?",
    "my office is near {d}, travel time from {s}?",
    "daily {s} se {d} {m} par aana jaana kitna time lega?",
]

T["distance"] = [
    "{s} se {d} kitni door hai?",
    "distance between {s} and {d}",
    "what is the distance from {s} to {d}?",
    "{s} se {d} kitne kilometer hai?",
    "{d} se {s} ka fasla batao",
    "how far is {d} from {s}?",
    "{s} se {d} ka rasta kitna hai?",
    "kya {s} se {d} {walk} ja sakte hain?",
    "{s} to {d} kitne km hai?",
    "{d} {s} se kitna door hai?",
    "if I live in {s}, how far is {d}?",
]

T["travel_cost"] = [
    "{s} se {d} {m} par kitna kharcha aayega?",
    "how much fuel cost from {s} to {d} by {m}?",
    "{s} to {d} petrol cost {m}",
    "{s} se {d} tak {m} ka kiraya kitna hai?",
    "{s} se {d} jaane mein kitna petrol lagega {m} mein?",
    "{s} to {d} fare by {m}",
    "{s} se {d} {train} ka kiraya kitna hai?",
    "{s} se {d} tak {m} ka kharcha batao",
    "mahine ka {m} ka kharcha {s} se {d} kitna banega?",
    "monthly travel cost {s} to {d} by {m}",
    "daily {s} se {d} {m} par kitna kharcha hoga?",
    "petrol {s} se {d} aane jaane ka kitna lagega?",
    "how much will it cost to go from {s} to {d} and back by {m}?",
    "{s} se {d} ka round trip {m} par kitne ka parega?",
    "mujhe {m} par {s} se {d} jane ka kharcha chahiye",
    "agar main {s} mein rahun to {d} ka {m} ka kharcha kitna hoga?",
    "if I stay in {s}, what is the fuel cost to {d} by {m}?",
    "{s} aur {s2} mein se {d} ke liye kis ka travel cost kam hai?",
    "{d} jaane ke liye {s} se {m} par kitne paise lagenge?",
    "{s} se {d} {m} se kitne rupay lagte hain?",
    "cost of travel {s} to {d} {m} per day",
    "{s} se {d} petrol ka kharcha {m} par kitna hai aaj kal?",
    "kitne ka petrol lagega {s} se {d} {m} par?",
    "{s} se {d} {bike} par petrol kitne ka lagega?",
    "{car} se {s} se {d} jaane mein fuel kitna jalega?",
    "how much petrol is needed for {s} to {d}?",
    "{d} tak {s} se {m} ka kiraya kya hoga?",
]

T["travel_time_cost"] = [
    "{s} se {d} ke liye {m} par kitna time aur kitna kharcha lagega?",
    "{s} se {d} time and cost by {m}",
    "{s} se {d} {m} par kitna waqt aur paisa lagega?",
    "time and fuel cost from {s} to {d} by {m}",
    "{s} to {d} by {m}: how long and how much?",
    "{s} se {d} jane mein kitna time lagta hai aur {m} ka kharcha kitna?",
    "{s} se {d} {m} par kitni der aur kitne rupay?",
    "how much time and money to go from {s} to {d} by {m}?",
]

T["property_with_travel"] = [
    "{a} mein {p} chahiye {b} tak jo {d} se qareeb ho aur {m} par time batao",
    "{lm} ke paas {p} dikhao {b} tak aur wahan se {m} par kitna kharcha hoga?",
    "I need a {p} near {lm} under {b}, and tell me travel cost by {m}",
    "{a} mein {p} batao aur {d} tak ka time aur kharcha bhi batao {m} par",
    "mujhe {lm} ke qareeb {p} chahiye, {b} budget, aur {m} ka kharcha bhi batao",
    "find a {p} near {lm} within {b} and show time from there by {m}",
    "{lm} ke nazdeek {hs} chahiye {b} tak, pohanchne ka time aur kharcha {m} par batao",
    "{a} mein {bd} {p} {b} tak, wahan se {d} kitni door hai aur {m} ka kharcha kitna?",
    "agar {a} mein {p} lun to {d} jaane mein {m} par kitna time aur paisa lagega?",
    "{a} ya {a2} mein se {d} ke liye konsa {p} behtar hai {b} tak, time aur cost ke hisaab se?",
    "pehle {lm} ke paas {p} dhoondo {b} tak, agar na mile to {a} mein dekho, aur travel time batao",
    "{a} mein {p} {b} tak chahiye, wahan se {d} {m} par kitna time aur petrol lagega?",
    "recommend a {p} in {a} under {b} and estimate fuel cost to {d} by {m}",
]


# ======================================================================
# v3: property-aware conversation (current property, near-place search,
# compare, area questions). New entities: LANDMARK, FEATURE, DURATION, DISTANCE
# placeholders: {lm} LANDMARK | {ft} FEATURE | {fam} FEATURE (who) | {dur} DURATION
# {dist} DISTANCE | {o2},{n2} second ORDINAL | {cat} nearby category (not an entity)
# {th} reference to the current property ("this house", "it" ...; not an entity)
# ======================================================================
feature_has = ["parking", "gas", "a gas connection", "backup power", "a generator", "solar", "a lift",
               "an elevator", "security", "cctv", "wifi", "internet", "a lawn", "a garden", "a servant quarter",
               "AC", "a kitchen", "water supply", "a car porch", "a store room", "a drawing room", "UPS"]
feature_has_ur = ["parking", "gas", "generator", "solar", "lift", "security guard", "internet", "lawn",
                  "pani", "bijli ka backup", "car porch", "servant quarter"]
feature_value = ["deposit", "security deposit", "advance", "maintenance charges", "rent", "size",
                 "covered area", "year built", "floor", "other charges"]
furnish_q = ["furnished", "fully furnished", "semi furnished", "unfurnished"]
family_words = ["family", "families", "students", "a student", "bachelors", "a small family",
                "a couple", "working professionals", "kids"]
categories = ["schools", "hospitals", "malls", "markets", "parks", "universities", "colleges",
              "metro stations", "mosques", "restaurants", "a school", "a hospital", "a mall",
              "a park", "a market", "grocery stores", "clinics"]
categories_ur = ["school", "hospital", "market", "park", "masjid", "mall"]
this_refs = ["this house", "this property", "this flat", "this apartment", "this place", "it",
             "this one", "the property", "this portion", "here"]
durations = ["10 minutes", "15 minutes", "20 minutes", "30 minutes", "5 minutes", "10 min", "15 min",
             "20 min", "25 mins", "half an hour", "an hour", "45 minutes", "aadha ghanta", "12 minutes"]
distances = ["1 km", "2 km", "3 km", "5 km", "2.5 km", "4 km", "10 km", "1.5 km", "3 kilometers",
             "5 kilometers", "500 m"]
ordinals2 = ["second", "third", "fourth", "last", "2nd", "3rd"]

T["property_question"] = [
    "is {th} {ft}?", "is {th} furnished?", "is it {ft}?", "does {th} have {fh}?", "does it have {fh}?",
    "is there {fh}?", "is there {fh} in {th}?", "any {fh} in {th}?", "has it got {fh}?",
    "what is the {fv} of {th}?", "what's the {fv}?", "how much is the {fv}?", "what is the {fv} for it?",
    "how old is {th}?", "how old is it?", "when was {th} built?", "is it a new construction?",
    "how far is {th} from {d}?", "how far is it from {d}?", "how far is this from {d}?",
    "distance from {th} to {d}?", "how long does it take from here to {d} by {m}?",
    "how long to reach {d} from {th}?", "is {th} close to {d}?", "is it near {d}?",
    "how many minutes from {th} to {d} by {m}?", "travel time from here to {d}?",
    "and from {d} by {m}?", "and from {d}?", "what about {d} by {m}?", "and to {d}?",
    "how much would I spend commuting daily to {d} by {m}?", "monthly travel cost from {th} to {d} by {m}",
    "what would my daily commute to {d} cost by {m}?", "how much will it cost me per month to go to {d} by {m}?",
    "is {th} good for {fam}?", "is it suitable for {fam}?", "would {th} work for {fam}?",
    "is it a good option for {fam}?", "is {th} safe for {fam}?",
    "can I keep pets here?", "are pets allowed in {th}?", "which floor is {th} on?",
    "is it still available?", "is {th} still available?", "how many bedrooms does it have?",
    "how many bathrooms are there?", "what is the size of {th}?", "is gas available here?",
    "is there load shedding backup?", "does the rent include maintenance?",
    "kya ye ghar {ft} hai?", "kya ye {ft} hai?", "is ghar mein {fhu} hai?", "kya isme {fhu} hai?",
    "iska {fv} kitna hai?", "is property ka {fv} kya hai?", "ye ghar kitna purana hai?",
    "yahan se {d} kitni door hai?", "is ghar se {d} {m} par kitna time lagega?",
    "yahan se {d} roz {m} par jaane ka mahana kharcha kitna hoga?", "kya ye {fam} ke liye theek hai?",
    "ye jagah {fam} ke liye kaisi hai?", "is ghar se {d} ka fasla kitna hai?",
]

T["nearby_places"] = [
    "what's nearby?", "what is near {th}?", "what is around {th}?", "anything nearby?",
    "{cat} near {th}", "{cat} near it", "any {cat} nearby?", "are there {cat} near {th}?",
    "nearest {cat} to {th}", "which {cat} are close to {th}?", "show {cat} around {th}",
    "is there {cat} close by?", "what's close to {th}?", "nearby places for {th}",
    "what's around {a}?", "{cat} near {a}", "what is near {a}?", "{a} ke paas kya kya hai?",
    "is ghar ke aas paas {catu} hai?", "yahan qareeb koi {catu} hai?", "aas paas kya hai?",
    "nearby {cat} for {th}", "how close are {cat} to {th}?", "what landmarks are near {th}?",
    "{cat} within walking distance?", "what facilities are nearby?",
]

T["near_search"] = [
    "{pe} near {lm} under {b}", "{pe} near {lm}", "{pe} for {pu} near {lm}", "{pe} near {lm} for {pu}",
    "{bd} {pe} near {lm} under {b}", "{f} {pe} near {lm}", "show me {pe} near {lm} under {b}",
    "find {pe} close to {lm}", "any {pe} close to {lm} under {b}?", "{pe} close to {lm} for students",
    "{pe} within {dur} of {lm}", "{pe} within {dur} of {lm} by {m}", "{pe} within {dist} of {lm}",
    "{bd} {pe} within {dist} of {lm}", "{pe} {dur} away from {lm}", "{pe} {dur} from {lm} by {m}",
    "{pe} walking distance from {lm}", "{pe} in walking distance of {lm}",
    "show me similar {pe} near {lm} under {b}", "similar {pe} near {lm}",
    "I need a {pe} near {lm} for {pu}", "looking for {pe} around {lm} under {b}",
    "rooms near {lm} for students", "{pe} near {lm} for students", "{pe} near {lm} for a family",
    "cheap {pe} near {lm}", "{pe} around {lm} within {b}", "which {pe} are closest to {lm}?",
    "{pe} nearest to {lm}", "{lm} ke paas {p} chahiye {b} tak", "{lm} ke qareeb {p} dikhao",
    "{lm} ke nazdeek {p} batao", "{lm} se {dur} ke andar {p} chahiye", "{lm} se {dist} ke andar {p}",
    "{lm} ke paas {bd} {p} chahiye", "{lm} ke paas students ke liye {p}", "{lm} ke aas paas {p} {b} tak",
    "{pe} near {lm} max {b}", "{pe} not more than {dur} from {lm}",
]

T["compare"] = [
    "compare the first two", "compare the first three", "compare the {o} and {o2} one",
    "compare the {o} and the {o2}", "compare {n} and {n2}", "compare option {n} and {n2}",
    "{o} vs {o2}", "{o} one vs {o2} one", "which is better, the {o} or the {o2}?",
    "which one is better {n} or {n2}?", "compare this with the {o} one", "compare this one with number {n}",
    "difference between option {n} and {n2}", "what's the difference between the {o} and {o2}?",
    "compare them", "compare these", "compare both", "compare the last two",
    "compare the first two by distance to {d}", "compare the {o} and {o2} for commute to {d}",
    "compare the first two for a commute to {d} by {m}", "compare them side by side",
    "pehli aur dusri property ka muqabla karo", "{o} aur {o2} mein kya farq hai?",
    "{o} aur {o2} compare karo", "dono ka muqabla karo", "compare {o} with {o2} please",
]

T["area_info"] = [
    "what is the average rent in {a}?", "average rent in {a}?", "what's the average rent in {a}",
    "average rent in {a} for {pu}", "what are rents like in {a}?", "how expensive is {a}?",
    "tell me about {a}", "tell me about {a} area", "how is {a} for living?", "is {a} a good area?",
    "is {a} a good area for families?", "is {a} safe?", "what is {a} like?", "info about {a}",
    "how much do properties cost in {a}?", "what is the price range in {a}?",
    "which area is cheapest for a {bd} {pe}?", "which area is cheapest for {pe} for {pu}?",
    "cheapest area for a {bd} {pe}", "which area is best for students?", "best area for families in Lahore?",
    "which areas have {pe} under {b}?", "most affordable area for {pe}", "which area has the cheapest {pe}?",
    "compare rents in {a} and {a2}", "{a} or {a2}, which area is cheaper?", "{a} kaisa area hai?",
    "{a} mein average kiraya kitna hai?", "{a} ke bare mein batao", "sab se sasta area konsa hai {pe} ke liye?",
    "{a} rehne ke liye kaisa hai?", "how many listings are in {a}?",
]

# ======================================================================
# English / sale / follow-up / small-talk extension (RMS chatbot v2)
# placeholders: {pe} English PROPERTY_TYPE (incl. plurals) | {pu} PURPOSE
# {f} FURNISHED | {o},{n} ORDINAL | {b2} second BUDGET
# ======================================================================
generic_areas = ["DHA", "DHA Lahore", "Askari", "Bahria", "Bahria Town", "Gulberg",
                 "Gulberg 2", "Gulberg 3", "Gulberg III", "Bahria Town Phase 8",
                 "Bahria Orchard", "Phase 5", "Phase 6", "Phase 7", "Askari 10", "Askari 11",
                 "Johar Town", "Model Town", "Wapda Town", "Cantt", "Valencia Town", "Lake City"]
en_areas = prop_areas + generic_areas * 4          # oversample the big societies
en_ptypes = ["house", "houses", "flat", "flats", "apartment", "apartments", "home", "homes",
             "portion", "upper portion", "lower portion", "room", "studio", "studio apartment",
             "penthouse", "villa", "plot", "plots", "shop", "office", "property", "properties"]
en_ptype_weights = [6, 6, 6, 6, 6, 5, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1, 2, 2]
rent_words = ["rent", "rent", "rent", "lease"]
sale_words = ["sale", "sale", "buy", "purchase"]
furnish_words = ["furnished", "furnished", "fully furnished", "semi furnished",
                 "semi-furnished", "unfurnished"]
ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "last", "1st", "2nd",
            "3rd", "4th", "5th"]
ordinal_nums = ["1", "2", "3", "4", "5", "6"]
en_beds = ["1 bed", "2 bed", "3 bed", "4 bed", "5 bed", "6 bed", "1 bedroom", "2 bedrooms",
           "3 bedrooms", "4 bedrooms", "5 bedrooms", "3 beds", "4 beds", "2 bedroom",
           "3 bedroom", "3-bed", "4-bed", "3 BHK", "2 bhk", "three bedrooms", "two bedroom",
           "four bed", "3 kamray", "4 kamron"]


def budget_text(amount):
    """Render a PKR amount in one of the many ways people write it."""
    style = random.random()
    if amount >= 10_000_000 and style < 0.55:
        return f"{amount / 10_000_000:g} crore"
    if amount >= 100_000 and style < 0.45:
        return f"{amount / 100_000:g} lakh"
    if amount < 1_000_000 and style < 0.65:
        return f"{amount // 1000}k"
    if style < 0.75:
        return f"{amount:,}"
    if style < 0.85:
        return f"PKR {amount:,}"
    if style < 0.93:
        return f"Rs. {amount:,}"
    return f"{amount} PKR"


def rent_budget():
    return budget_text(random.choice([15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85,
                                      90, 100, 110, 120, 125, 130, 150, 175, 180, 200, 250, 300,
                                      350, 400, 450, 500]) * 1000)


def sale_budget():
    return budget_text(random.choice([45, 60, 75, 80, 90, 95, 120, 150, 175, 200, 250, 300, 350,
                                      400, 450, 500, 650, 800, 1000, 1200]) * 100_000)


T["search_property"] += [
    "{bd} {pe} for {pu} in {a} under {b}",
    "{bd} {pe} for {pu} in {a}",
    "show me {f} {pe} in {a}",
    "show me {pe} for {pu} in {a}",
    "{pe} for {pu} in {a}",
    "{pe} for {pu} in {a} under {b}",
    "{pe} for {pu} in {a} below {b}",
    "{pe} for {pu} in {a} within {b}",
    "{f} {pe} for {pu} in {a}",
    "{f} {bd} {pe} in {a} for {pu}",
    "looking for a {bd} {pe} in {a} for {pu}, budget {b}",
    "I am looking for a {pe} to {pu} in {a}",
    "I want to {pu} a {pe} in {a}",
    "I want to {pu} a {bd} {pe} in {a} under {b}",
    "I need a {f} {pe} in {a} under {b}",
    "any {f} {pe} available in {a}?",
    "do you have any {pe} in {a}?",
    "do you have {bd} {pe} for {pu} in {a}?",
    "what {pe} are available for {pu} in {a}?",
    "list all {pe} for {pu} in {a}",
    "list {pe} in {a}",
    "cheap {pe} for {pu} near {a}",
    "affordable {pe} in {a} for {pu}",
    "{a} {pe} for {pu} max {b}",
    "{a} {bd} {pe} {pu} under {b}",
    "{bd} {pe} in {a} max budget {b}",
    "{pe} in {a} between {b} and {b2}",
    "{pe} for {pu} in {a} around {b}",
    "family {pe} in {a} with {bd} for {pu}",
    "properties for {pu} in {a}",
    "find {pe} for {pu} in {a} up to {b}",
    "search {pe} in {a}",
    "get me a {bd} {pe} in {a}",
    "is there any {pe} for {pu} in {a}?",
    "any {pe} in {a} under {b}?",
    "{a} me {pe} {pu} ke liye chahiye",
    "{a} mein {f} {pe} chahiye {pu} par",
    "{a} mein {bd} {pe} {pu} ke liye dikhao {b} tak",
    "{pe} available for {pu} in {a}?",
    "I'm searching for a {f} {pe} in {a}, my budget is {b}",
    "please show {bd} {pe} in {a}",
    "need {pe} on {pu} in {a} around {b}",
    "{a} {pe} for {pu}",
    "{pe} in {a}",
    "{bd} {pe} {a}",
    "best {pe} for {pu} in {a}",
    "new {pe} for {pu} in {a} under {b}",
    "{f} {pe} in {a} under {b} per month",
    "show me {pe} under {b}",
    "{bd} {pe} for {pu} under {b}",
    "{f} {pe} for {pu}",
    "I need a {pe} for {pu}",
]
T["price_inquiry"] += [
    "what is the price of a {pe} in {a}?",
    "how much does a {bd} {pe} cost in {a}?",
    "average price of {pe} for {pu} in {a}",
    "what's the rent range for {pe} in {a}?",
    "price range of {pe} in {a}",
    "how expensive are {pe} in {a}?",
    "{pe} prices in {a}",
    "what do {bd} {pe} go for in {a}?",
    "typical rent for a {f} {pe} in {a}",
]
T["book_property"] += [
    "how do I book this {pe}?",
    "I want to book the {o} one",
    "book the {o} {pe} for me",
    "how can I rent the {o} property?",
    "I'd like to schedule a visit for a {pe} in {a}",
    "can I book a {pe} in {a} online?",
    "reserve a {bd} {pe} in {a}",
    "how do I contact the owner of the {o} one?",
]
T["refine_search"] = [
    "only {bd}", "only {bd} please", "show only {bd} ones", "with {bd} only",
    "I need {bd} at least", "make it {bd}", "what about {bd}?", "{bd} wala dikhao",
    "cheaper ones", "show me cheaper ones", "anything cheaper?", "show me cheaper options",
    "any cheaper options?", "less expensive please", "koi sasta dikhao", "is se sasta",
    "too expensive, show cheaper", "cheapest first", "sort by price", "sort by lowest price",
    "more expensive ones", "show bigger ones", "something more luxurious",
    "under {b}", "keep it under {b}", "my budget is {b}", "budget {b} kar do",
    "max {b}", "below {b} please", "can you show under {b}?", "budget is {b} now",
    "what about {a}?", "and in {a}?", "how about {a}?", "{a} mein dikhao", "same in {a}",
    "show in {a} instead", "try {a}", "check {a} too", "what about {a} under {b}?",
    "{f} only", "only {f} ones", "make it {f}", "show {f} ones", "{f} chahiye",
    "for {pu} instead", "show {pu} options", "I want to {pu} instead", "{pu} wali dikhao",
    "{pe} instead", "show {pe} instead", "what about {pe}?", "only {pe}",
    "{pe} in that area", "same but {f}", "same but {bd}", "same area but under {b}",
    "{bd} and under {b}", "only {f} {pe}", "{bd} {f} ones only",
]
T["show_more"] = [
    "show more", "more", "more options", "next", "next page", "any more?", "show me more",
    "show me more results", "load more", "aur dikhao", "mazeed options", "kuch aur dikhao",
    "more please", "see more", "what else do you have?", "any other options?",
    "show other options", "aur options batao", "more results", "give me more",
    "next ones", "show the rest", "others?", "more listings please", "keep going",
]
T["property_details"] = [
    "tell me about the {o} one", "tell me more about the {o} one",
    "details of the {o} property", "{o} wali property ki details", "{o} wala ghar kaisa hai?",
    "more info on number {n}", "show details for option {n}", "details of {n}",
    "what are the amenities of the {o} one?", "is the {o} one furnished?",
    "how many bathrooms in the {o} one?", "where exactly is the {o} property?",
    "what is the size of the {o} one?", "tell me about property {n}",
    "I like the {o} one, details please", "describe the {o} {pe}",
    "full details of the {o} listing", "number {n} ki details batao",
    "can you give more details about the {o}?", "what about the {o} one?",
    "{o} option ka rent kitna hai?", "more about option {n}",
]
_greets = ["hi", "hello", "hey", "salam", "assalam o alaikum", "assalamualaikum", "aoa",
           "hi there", "hello there", "hey there", "good morning", "good evening",
           "good afternoon", "hey bot", "hello bot", "salaam", "hiya", "yo", "greetings"]
_greet_tails = ["", "!", " :)", ", how are you?", ", anyone there?", " bhai", " sir",
                ", I need some help", ", kaise ho?", "!!", "."]
_thanks = ["thanks", "thank you", "thank you so much", "thanks a lot", "shukriya",
           "bohat shukriya", "jazakallah", "great, thanks", "ok thanks", "perfect thank you",
           "thx", "ty", "much appreciated", "thanks for the help", "awesome thanks", "nice, thank you"]
_thanks_tails = ["", "!", " :)", " bhai", " a lot", ".", "!!"]
_helps = ["help", "what can you do?", "how does this work?", "madad chahiye", "what can I ask you?",
          "how do I search?", "options?", "how to use this chatbot", "what are you?",
          "who are you?", "help me", "I need help", "how can you help me?",
          "what kind of questions can I ask?", "guide me", "aap kya kar sakte ho?",
          "how do I find a property?", "what do you know?", "menu", "instructions"]
_help_tails = ["", " please", "?", " plz", "!"]
_resets = ["start over", "new search", "clear filters", "reset", "naya search", "nayi search",
           "reset filters", "clear everything", "let's start again", "forget that", "begin again",
           "dobara shuru karo", "clear all filters", "start a new search", "restart"]
_reset_tails = ["", " please", "!", " plz", "."]
SMALL = {"greeting": (_greets, _greet_tails), "thanks": (_thanks, _thanks_tails),
         "help": (_helps, _help_tails), "reset": (_resets, _reset_tails)}

TARGETS = {
    "search_property": 3600,
    "price_inquiry": 400,
    "book_property": 250,
    "travel_time": 900,
    "distance": 400,
    "travel_cost": 1200,
    "travel_time_cost": 300,
    "property_with_travel": 400,
    "refine_search": 900,
    "show_more": 120,
    "property_details": 350,
    "greeting": 150,
    "thanks": 100,
    "help": 90,
    "reset": 70,
    "property_question": 1300,
    "nearby_places": 450,
    "near_search": 1000,
    "compare": 380,
    "area_info": 650,
}
PROPERTY_INTENTS = {"search_property", "price_inquiry", "book_property",
                    "property_with_travel", "refine_search", "near_search", "area_info"}

# light Roman Urdu spelling variation applied to non-entity words only
NOISE = {
    "mein": ["me", "main"], "chahiye": ["chahye", "chaiye", "chahiyay"],
    "batao": ["btao", "bata do"], "kharcha": ["kharch"], "lagega": ["lgega"],
    "tak": ["tk"], "dikhao": ["dikha do"], "kitna": ["kitna"],
}


def noisy(segment):
    def repl(m):
        w = m.group(0)
        if w in NOISE and random.random() < 0.2:
            return random.choice(NOISE[w])
        return w
    return re.sub(r"[A-Za-z]+", repl, segment)


FIXED = {"hs": ("hostel", "PROPERTY_TYPE"), "car": ("car", "TRANSPORT"),
         "bike": ("bike", "TRANSPORT"), "train": ("train", "TRANSPORT"),
         "walk": ("paidal", "TRANSPORT")}

# words inside template text that are really entities (labelled automatically
# so the old Roman Urdu templates and the new English ones agree)
AUTO_LABELS = [
    (re.compile(r"\b(?:fully furnished|semi[- ]furnished|unfurnished|furnished)\b", re.I), "FURNISHED"),
    (re.compile(r"\b(?:rent|rental|lease|sale|buy|purchase|kiraye|kiraya|khareedna)\b", re.I), "PURPOSE"),
]


def render(template, intent):
    keys = set(re.findall(r"\{(\w+)\}", template))
    ctx = {}
    for k, v in FIXED.items():
        if k in keys:
            ctx[k] = v
    sale = False
    if "pu" in keys:
        sale = random.random() < 0.35
        ctx["pu"] = (random.choice(sale_words if sale else rent_words), "PURPOSE")
    if "p" in keys:
        ctx["p"] = (random.choices(rent_ptypes, ptype_weights)[0], "PROPERTY_TYPE")
    if "pe" in keys:
        ctx["pe"] = (random.choices(en_ptypes, en_ptype_weights)[0], "PROPERTY_TYPE")
    english = "pe" in keys or intent in {"refine_search", "property_details", "area_info"}
    area_pool = en_areas if english else prop_areas
    if "a" in keys:
        ctx["a"] = (random.choice(area_pool), "AREA")
    if "a2" in keys:
        ctx["a2"] = (random.choice([x for x in prop_areas if x != ctx["a"][0]]), "AREA")
    if "s" in keys:
        ctx["s"] = (random.choice(origins_pool), "ORIGIN")
    if "s2" in keys:
        ctx["s2"] = (random.choice([x for x in origins_pool if x != ctx["s"][0]]), "ORIGIN")
    if "d" in keys:
        taken = {ctx[k][0] for k in ("s", "s2", "a", "a2") if k in ctx}
        ctx["d"] = (random.choice([x for x in dest_pool if x not in taken]), "DESTINATION")
    if "bd" in keys:
        ctx["bd"] = (random.choice(en_beds if english else beds), "BEDROOMS")
    if "sz" in keys:
        ctx["sz"] = (random.choice(sizes), "SIZE")
    if "m" in keys:
        ctx["m"] = (random.choice(transports), "TRANSPORT")
    if "f" in keys:
        ctx["f"] = (random.choice(furnish_words), "FURNISHED")
    if "o" in keys:
        ctx["o"] = (random.choice(ordinals), "ORDINAL")
    if "n" in keys:
        ctx["n"] = (random.choice(ordinal_nums), "ORDINAL")
    if "b" in keys:
        if english or "pu" in keys:
            ctx["b"] = (sale_budget() if sale else rent_budget(), "BUDGET")
        else:
            ptype = ctx["p"][0] if "p" in keys else ("hostel" if "hs" in keys else "flat")
            tier_area = ctx["a"][0] if "a" in keys else (ctx["d"][0] if "d" in keys else None)
            ctx["b"] = (make_budget(ptype, tier_area), "BUDGET")
    if "lm" in keys:
        ctx["lm"] = (random.choice(landmark_pool), "LANDMARK")
    if "ft" in keys:
        ctx["ft"] = (random.choice(furnish_q), "FURNISHED")
    if "fh" in keys:
        ctx["fh"] = (random.choice(feature_has), "FEATURE")
    if "fhu" in keys:
        ctx["fhu"] = (random.choice(feature_has_ur), "FEATURE")
    if "fv" in keys:
        ctx["fv"] = (random.choice(feature_value), "FEATURE")
    if "fam" in keys:
        ctx["fam"] = (random.choice(family_words), "FEATURE")
    if "dur" in keys:
        ctx["dur"] = (random.choice(durations), "DURATION")
    if "dist" in keys:
        ctx["dist"] = (random.choice(distances), "DISTANCE")
    if "o2" in keys:
        ctx["o2"] = (random.choice([o for o in ordinals2 if o != ctx.get("o", ("",))[0]]), "ORDINAL")
    if "n2" in keys:
        ctx["n2"] = (random.choice([n for n in ordinal_nums if n != ctx.get("n", ("",))[0]]), "ORDINAL")
    if "cat" in keys:
        ctx["cat"] = (random.choice(categories), None)
    if "catu" in keys:
        ctx["catu"] = (random.choice(categories_ur), None)
    if "th" in keys:
        ctx["th"] = (random.choice(this_refs), None)
    if "b2" in keys:
        ctx["b2"] = (sale_budget() if sale else rent_budget(), "BUDGET")

    text, spans = "", []
    for part in re.split(r"(\{\w+\})", template):
        if not part:
            continue
        if part.startswith("{"):
            val, label = ctx[part[1:-1]]
            if label:
                spans.append([len(text), len(text) + len(val), label])
            text += val
        else:
            text += noisy(part)
    if intent in PROPERTY_INTENTS:
        for pattern, label in AUTO_LABELS:
            for m in pattern.finditer(text):
                if not any(m.start() < e and m.end() > s for s, e, _ in spans):
                    spans.append([m.start(), m.end(), label])
    spans.sort()
    return text, spans


def render_small(intent):
    heads, tails = SMALL[intent]
    text = random.choice(heads) + random.choice(tails)
    if random.random() < 0.3:
        text = text[:1].upper() + text[1:]
    return text, []


def variate(text, spans):
    r = random.random()
    if r < 0.12:
        text = text.lower()
    elif r < 0.18:
        text = text[:1].upper() + text[1:]
    if random.random() < 0.06 and not text.lower().startswith("bhai"):
        text = "bhai " + text
        spans = [[s + 5, e + 5, l] for s, e, l in spans]
    if random.random() < 0.08 and text.endswith("?"):
        text = text[:-1] + " plz"
    elif random.random() < 0.05:
        text = text + " jaldi batao"
    return text, spans


def main():
    seen, rows = set(), []
    for intent, n in TARGETS.items():
        count, tries = 0, 0
        while count < n and tries < 200000:
            tries += 1
            if intent in SMALL:
                text, spans = render_small(intent)
            else:
                text, spans = variate(*render(random.choice(T[intent]), intent))
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            rows.append({"text": text, "intent": intent, "entities": spans})
            count += 1
        if count < n:
            print(f"note: only {count}/{n} unique sentences possible for {intent}")
    random.shuffle(rows)

    out = Path(__file__).resolve().parents[1] / "data"
    out.mkdir(exist_ok=True)
    with open(out / "training_data_labeled.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(out / "training_sentences.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(r["text"] for r in rows) + "\n")
    counts = {}
    for r in rows:
        counts[r["intent"]] = counts.get(r["intent"], 0) + 1
    print(f"wrote {len(rows)} labeled sentences to {out}")
    for k, v in sorted(counts.items()):
        print(f"  {k:22s} {v}")


if __name__ == "__main__":
    main()
