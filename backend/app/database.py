from supabase import create_client, Client
from app.config import get_settings

_client: Client | None = None
_service_client: Client | None = None


def get_supabase() -> Client:
    """Get Supabase client using anon key (respects RLS)."""
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_key)
    return _client


def get_supabase_service() -> Client:
    """Get Supabase client using service-role key (bypasses RLS).
    Use only for admin operations like user creation."""
    global _service_client
    if _service_client is None:
        s = get_settings()
        _service_client = create_client(s.supabase_url, s.supabase_service_key)
    return _service_client


def get_supabase_for_user(access_token: str) -> Client:
    """Get a Supabase client authenticated as a specific user.
    This client respects RLS policies using the user's JWT."""
    s = get_settings()
    client = create_client(s.supabase_url, s.supabase_key)
    client.postgrest.auth(access_token)
    return client
