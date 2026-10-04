
import os
import zipfile

def create_zip():
    output = "lovask-customer-handoff.zip"
    zipf = zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED)
    
    exclude_dirs = {".next", "node_modules", ".git", ".agents", ".codex", ".vercel", ".vercel.new", "backups", "tmp", ".temp", "instagram", "hatalar", "build", ".dart_tool", ".gradle", ".idea", "__pycache__"}
    exclude_files = {"zip_project.py", "lovask-sunucu.zip", "lovask-sunucu-yeni.zip", "lovask-customer-handoff.zip", "tsconfig.tsbuildinfo", "Ekran görüntüsü 2026-08-11 051731.png", "Lovask_15_Gunluk_Instagram_Takvimi.xlsx", "Lovask_30_Gunluk_Instagram_Takvimi (1).xlsx", "TEST_AUDIT_2026-08-16.md", "AI_HANDOFF.md", "SNAPSHOT_CONTENTS.md", "LOVASK-ERKENFINANS-KIMLIK-VE-PROJE-ENVANTERI.md"}
    
    for root, dirs, files in os.walk("."):
        # modify dirs in place to prevent os.walk from entering excluded dirs
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith("recovery")]
        if os.path.normpath(root) == "artifacts":
            dirs[:] = [d for d in dirs if d == "android-twa"]
            files = []
        
        for file in files:
            if (file in exclude_files and file != "zip_project.py") or file in {"fix_bots.py", "env.json", "local.properties", ".flutter-plugins-dependencies"} or (file.startswith(".env") and file != ".env.example") or file.endswith((".log", ".zip", ".tar", ".tgz", ".gz", ".idsig", ".jks", ".keystore", ".iml", ".pid", ".apk.new")):
                continue
            
            file_path = os.path.join(root, file)
            # Add to zip
            zipf.write(file_path, os.path.relpath(file_path, "."))
            
    zipf.close()
    print(f"Successfully created {output}")

create_zip()

