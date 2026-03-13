import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const jobIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#0000FF;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,255,0.5)"></div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

const emergencyJobIcon = L.divIcon({
  html: `<div style="width:32px;height:32px;background:#EF4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,0.6)"></div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const crewIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#050A30;border-radius:50%;border:3px solid #7EC8E3;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const userIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#10B981;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(16,185,129,0.3)"></div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function JobMap({ jobs = [], crew = [], userLocation, onJobClick, height = "500px" }) {
  const defaultCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [37.0902, -95.7129]; // Center of US
  const defaultZoom = userLocation ? 12 : 4;

  return (
    <div style={{ height, width: "100%" }} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="font-semibold text-green-700">Your Location</div>
            </Popup>
          </Marker>
        )}

        {jobs.map(job => (
          job.location?.lat && job.location?.lng && (
            <Marker
              key={job.id}
              position={[job.location.lat, job.location.lng]}
              icon={job.is_emergency ? emergencyJobIcon : jobIcon}
              eventHandlers={{ click: () => onJobClick?.(job) }}
            >
              <Popup>
                <div style={{ fontFamily: "Inter, sans-serif", minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong>{job.title}</strong>
                    <span style={{ color: "#0000FF", fontWeight: "bold" }}>${job.pay_rate}/hr</span>
                  </div>
                  <p style={{ color: "#666", fontSize: 12, margin: "4px 0" }}>{job.contractor_name}</p>
                  <p style={{ fontSize: 12 }}>Trade: {job.trade}</p>
                  <p style={{ fontSize: 12 }}>Crew: {job.crew_accepted?.length || 0}/{job.crew_needed}</p>
                  {job.is_emergency && <span style={{ background: "#FEE2E2", color: "#DC2626", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: "bold" }}>EMERGENCY</span>}
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {crew.map(member => (
          member.location?.lat && member.location?.lng && (
            <Marker
              key={member.id}
              position={[member.location.lat, member.location.lng]}
              icon={crewIcon}
            >
              <Popup>
                <div style={{ fontFamily: "Inter, sans-serif" }}>
                  <strong>{member.name}</strong>
                  <p style={{ fontSize: 12, color: "#666" }}>{member.trade || "General Labor"}</p>
                  <p style={{ fontSize: 12 }}>Rating: {member.rating?.toFixed(1) || "New"} ⭐</p>
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {userLocation && <RecenterMap center={[userLocation.lat, userLocation.lng]} />}
      </MapContainer>
    </div>
  );
}
