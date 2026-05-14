import sqlite3
import os
import json

def debug_database():
    db_path = 'test.db'
    
    # Check if file exists
    if not os.path.exists(db_path):
        print(f"❌ Error: {db_path} not found in {os.getcwd()}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check total record count
        cursor.execute("SELECT COUNT(*) FROM analysis")
        count = cursor.fetchone()[0]
        print(f"📊 Total analysis records in database: {count}")
        
        if count == 0:
            print("⚠️ The database is empty. Your 200 OK might not have saved correctly.")
            return

        # Get the latest entry
        cursor.execute("SELECT id, resume_filename, skills FROM analysis ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        
        if row:
            analysis_id, filename, skills_data = row
            print(f"\n✅ Last Successful Analysis (ID: {analysis_id})")
            print(f"📄 Filename: {filename}")
            
            # Convert skills if they are stored as a string
            skills = json.loads(skills_data) if isinstance(skills_data, str) else skills_data
            
            print(f"🔍 Skills Found: {', '.join(skills.get('found', [])) if skills else 'None'}")
            print(f"❌ Skills Missing: {len(skills.get('missing', [])) if skills else '0'} items")
            
        conn.close()
    except Exception as e:
        print(f"❌ Database Error: {e}")

if __name__ == "__main__":
    debug_database()