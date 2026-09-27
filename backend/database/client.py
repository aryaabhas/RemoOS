import time
from typing import Any, Callable
import httpx
from supabase import Client, create_client

from config import get_settings


class SupabaseNotConfigured(RuntimeError):
    pass


_cached_client: Client | None = None


def get_supabase(fresh: bool = False) -> Client:
    global _cached_client
    if _cached_client is not None and not fresh:
        return _cached_client

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SupabaseNotConfigured(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env before the "
            "backend can persist workflow state."
        )
    _cached_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _cached_client


def execute_query(query_or_func: Any, max_retries: int = 3) -> Any:
    """Executes a Supabase query with automatic retry on connection drops and HTTP/2 stream resets."""
    last_err: Exception | None = None
    for attempt in range(max_retries):
        try:
            if callable(query_or_func):
                return query_or_func().execute()
            return query_or_func.execute()
        except (httpx.TransportError, httpx.RemoteProtocolError, Exception) as exc:
            last_err = exc
            if attempt == max_retries - 1:
                raise exc
            time.sleep(0.3 * (attempt + 1))
            # Force refresh client connection
            get_supabase(fresh=True)
    if last_err:
        raise last_err
