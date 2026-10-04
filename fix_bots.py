import json
import re

male_names = [
    "Ahmet", "Burak", "Can", "Doruk", "Emre", "Fatih", "Gökhan", "Hakan", "İbrahim", "Kaan",
    "Levent", "Mert", "Onur", "Ozan", "Polat", "Rüzgar", "Sinan", "Tolga", "Umut", "Volkan",
    "Yağız", "Zafer", "Alp", "Berk", "Cenk", "Çağatay", "Doğan", "Efe", "Furkan", "Görkem",
    "Halil", "İhsan", "Kerem", "Koray", "Mete", "Murat", "Orhan", "Ömer", "Poyraz", "Serkan",
    "Sarp", "Taha", "Uğur", "Ümit", "Veli", "Yalçın", "Yavuz", "Yunus", "Yasin", "Zeki"
]

with open('bot-profiles-new.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for i, bot in enumerate(data['bots']):
    new_name = male_names[i % len(male_names)]
    
    # Determine the correct Turkish suffix for "Sen X'sin"
    # Find the last vowel
    vowels = [c for c in new_name.lower() if c in 'aeıioöuü']
    last_vowel = vowels[-1] if vowels else 'a'
    
    if last_vowel in 'aı':
        suffix = "'sın"
    elif last_vowel in 'ei':
        suffix = "'sin"
    elif last_vowel in 'ou':
        suffix = "'sun"
    else:
        suffix = "'sün"
    
    # Update properties
    bot['name'] = f"{new_name} A."
    bot['gender'] = "erkek"
    
    # Replace persona "Sen [Name]'sın" with correct male name and suffix
    bot['persona'] = re.sub(r"Sen \w+'s[ıiuü]n", f"Sen {new_name}{suffix}", bot['persona'])
    
    # Fix photo path e.g. /bot-seeds/ahmet-001.webp
    num_str = f"{(i+1):03d}"
    url_name = new_name.lower().replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
    bot['photoPath'] = f"/bot-seeds/{url_name}-{num_str}.webp"

with open('bot-profiles-new.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated 50 bots to male.")
