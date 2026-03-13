import httpx
import logging

logger = logging.getLogger(__name__)


async def geocode_address(address: str) -> dict:
    """Convert address string to lat/lng using Nominatim (OpenStreetMap)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": address, "format": "json", "limit": 1},
                headers={"User-Agent": "TheDayLaborers/1.0 (contact@thedaylaborers.com)"}
            )
            data = response.json()
            if data:
                return {
                    "address": address,
                    "lat": float(data[0]["lat"]),
                    "lng": float(data[0]["lon"]),
                    "city": data[0].get("display_name", address).split(",")[0]
                }
    except Exception as e:
        logger.warning(f"Geocoding failed for '{address}': {e}")
    # Fallback: return a default location (New York)
    return {"address": address, "lat": 40.7128, "lng": -74.0060, "city": "New York"}


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles between two lat/lng points."""
    from math import radians, cos, sin, asin, sqrt
    R = 3959  # Earth's radius in miles
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    return 2 * R * asin(sqrt(a))
