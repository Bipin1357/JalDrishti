import os

from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from CWD, backend/.env, or project root .env
load_dotenv()
_backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as err:
        print(f"Warning: Failed to initialize Supabase client: {err}")
else:
    print("Warning: Supabase credentials not found in environment. Supabase client is disabled.")