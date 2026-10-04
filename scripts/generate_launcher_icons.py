import os
from pathlib import Path
from PIL import Image, ImageDraw

def generate_icons():
    root = Path(r'C:\MAMP\htdocs\lovask')
    logo_path = root / 'logo.png'
    res_dir = root / 'apps' / 'mobile' / 'android' / 'app' / 'src' / 'main' / 'res'
    
    assert logo_path.exists(), f"Logo not found at {logo_path}"
    logo = Image.open(logo_path).convert('RGBA')
    
    # 1. Mipmap standard icon sizes
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    
    # Adaptive foreground sizes (108dp canvas)
    fg_sizes = {
        'mipmap-mdpi': 108,
        'mipmap-hdpi': 162,
        'mipmap-xhdpi': 216,
        'mipmap-xxhdpi': 324,
        'mipmap-xxxhdpi': 432,
    }
    
    for folder, size in sizes.items():
        folder_path = res_dir / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Standard icon
        icon = logo.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(folder_path / 'ic_launcher.png', 'PNG')
        
        # Round icon (circle mask)
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)
        round_icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        round_icon.paste(icon, (0, 0), mask)
        round_icon.save(folder_path / 'ic_launcher_round.png', 'PNG')
        
        # Adaptive foreground (logo centered inside 108dp canvas, safe zone ~70%)
        fg_size = fg_sizes[folder]
        fg_canvas = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        logo_sub_size = int(fg_size * 0.72)
        logo_resized = logo.resize((logo_sub_size, logo_sub_size), Image.Resampling.LANCZOS)
        offset = (fg_size - logo_sub_size) // 2
        fg_canvas.paste(logo_resized, (offset, offset), logo_resized)
        fg_canvas.save(folder_path / 'ic_launcher_foreground.png', 'PNG')
        print(f"Generated {folder}: ic_launcher.png ({size}x{size}), round, and foreground ({fg_size}x{fg_size})")

    # 2. Adaptive icon XMLs (anydpi-v26)
    anydpi_dir = res_dir / 'mipmap-anydpi-v26'
    anydpi_dir.mkdir(parents=True, exist_ok=True)
    
    ic_launcher_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    (anydpi_dir / 'ic_launcher.xml').write_text(ic_launcher_xml, encoding='utf-8')
    (anydpi_dir / 'ic_launcher_round.xml').write_text(ic_launcher_xml, encoding='utf-8')
    print("Generated mipmap-anydpi-v26/ic_launcher.xml and ic_launcher_round.xml")
    
    # 3. Colors.xml for background
    values_dir = res_dir / 'values'
    values_dir.mkdir(parents=True, exist_ok=True)
    colors_file = values_dir / 'colors.xml'
    
    colors_xml = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FEF9F6</color>
</resources>
"""
    colors_file.write_text(colors_xml, encoding='utf-8')
    print("Generated values/colors.xml with #FEF9F6 background")

    # 4. Copy to mobile assets
    mobile_assets = root / 'apps' / 'mobile' / 'assets'
    mobile_assets.mkdir(parents=True, exist_ok=True)
    logo.save(mobile_assets / 'logo.png', 'PNG')
    print(f"Updated {mobile_assets / 'logo.png'}")

if __name__ == '__main__':
    generate_icons()
