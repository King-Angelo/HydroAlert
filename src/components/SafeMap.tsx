import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import polyline from 'polyline';
import { LoadingSpinner } from './LoadingSpinner';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface SafeMapProps {
  userLocation?: [number, number];
  height?: string;
  adminSafeZones?: any[];
  onMapClick?: (lat: number, lng: number) => void;
  onDeleteSafeZone?: (id: string) => void;
  showOsmShelters?: boolean;
}

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, map.getZoom());
    }
  }, [coords, map]);
  return null;
};

const MapEvents = ({ onClick }: { onClick?: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      if (onClick) {
        onClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const SafeMap: React.FC<SafeMapProps> = ({ 
  userLocation, 
  height = "400px", 
  adminSafeZones = [], 
  onMapClick,
  onDeleteSafeZone,
  showOsmShelters = true
}) => {
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(userLocation || null);
  const [osmSafeZones, setOsmSafeZones] = useState<any[]>([]);
  const [nearestZone, setNearestZone] = useState<any | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const allSafeZones = [...adminSafeZones, ...(showOsmShelters ? osmSafeZones : [])];

  useEffect(() => {
    if (userLocation) {
      setCurrentPos(userLocation);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  }, [userLocation]);

  useEffect(() => {
    if (!showOsmShelters) {
      setOsmSafeZones([]);
      return;
    }

    const fetchShelters = async () => {
      if (!currentPos) return;
      setIsSearching(true);
      
      const [lat, lng] = currentPos;
      const radius = 5000; // 5km
      const query = `
        [out:json];
        (
          node["amenity"="shelter"](around:${radius},${lat},${lng});
          way["amenity"="shelter"](around:${radius},${lat},${lng});
          node["emergency"="waiting_area"](around:${radius},${lat},${lng});
          way["emergency"="waiting_area"](around:${radius},${lat},${lng});
        );
        out center;
      `;
      
      try {
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const zones = data.elements.map((el: any) => ({
          id: el.id.toString(),
          name: el.tags.name || "Designated Shelter",
          type: el.tags.amenity === "shelter" ? "Shelter" : "Evacuation Point",
          lat: el.lat || el.center.lat,
          lng: el.lon || el.center.lon,
        }));

        setOsmSafeZones(zones);
      } catch (error) {
        console.error("Failed to fetch OSM data:", error);
      } finally {
        setIsSearching(false);
      }
    };

    fetchShelters();
  }, [currentPos, showOsmShelters]);

  useEffect(() => {
    if (currentPos && allSafeZones.length > 0) {
      let minDistance = Infinity;
      let nearest = null;
      
      const adminZones = allSafeZones.filter(z => z.isCustom);
      const zonesToSearch = adminZones.length > 0 ? adminZones : allSafeZones;

      zonesToSearch.forEach(zone => {
        const dist = Math.sqrt(Math.pow(zone.lat - currentPos[0], 2) + Math.pow(zone.lng - currentPos[1], 2));
        if (dist < minDistance) {
          minDistance = dist;
          nearest = zone;
        }
      });
      setNearestZone(nearest);
    }
  }, [currentPos, allSafeZones]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!currentPos || !nearestZone) return;
      
      setIsLoadingRoute(true);
      try {
        const origin = `${currentPos[0]},${currentPos[1]}`;
        const destination = `${nearestZone.lat},${nearestZone.lng}`;
        const response = await fetch(`/api/directions?origin=${origin}&destination=${destination}`);
        const data = await response.json();
        
        if (data.status === "OK" && data.routes.length > 0) {
          setRouteData(data.routes[0]);
          const points = data.routes[0].overview_polyline.points;
          
          if (typeof points === 'string') {
            const decoded = polyline.decode(points);
            setRoutePoints(decoded as [number, number][]);
          } else {
            setRoutePoints(points);
          }
        }
      } catch (error) {
        console.error("Route fetching failed:", error);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [currentPos, nearestZone]);

  const defaultCenter: [number, number] = [14.6091, 121.0223];

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 relative" style={{ height }}>
      {(isLoadingRoute || isSearching) && (
        <div className="absolute inset-0 z-[2000] bg-blue-900/40 backdrop-blur-sm flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
      <MapContainer 
        center={currentPos || defaultCenter} 
        zoom={13} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEvents onClick={onMapClick} />
        
        {currentPos && (
          <>
            <Marker position={currentPos}>
              <Popup>You are here</Popup>
            </Marker>
            <RecenterMap coords={currentPos} />
          </>
        )}

        {allSafeZones.map(zone => (
          <Marker 
            key={zone.id} 
            position={[zone.lat, zone.lng]}
            icon={new L.Icon({
               iconUrl: zone.isCustom ? 
                'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png' :
                'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
               shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
               iconSize: [25, 41],
               iconAnchor: [12, 41],
               popupAnchor: [1, -34],
               shadowSize: [41, 41]
            })}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-blue-900">{zone.name}</h3>
                <p className="text-xs text-green-600 font-bold uppercase tracking-wider">{zone.type}</p>
                {zone.isCustom && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Admin Marked</p>}
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&origin=${currentPos?.[0]},${currentPos?.[1]}&destination=${zone.lat},${zone.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-center bg-blue-600 text-white text-[10px] font-bold py-1 px-2 rounded hover:bg-blue-700 transition"
                >
                  Open in Maps
                </a>
                {zone.isCustom && onDeleteSafeZone && (
                  <button 
                    onClick={() => onDeleteSafeZone(zone.id)}
                    className="mt-1 w-full text-center bg-red-100 text-red-600 text-[10px] font-bold py-1 px-2 rounded hover:bg-red-200 transition"
                  >
                    Remove Location
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {routePoints.length > 0 && (
          <Polyline 
            positions={routePoints} 
            color="#3b82f6" 
            weight={5}
            opacity={0.8}
            lineJoin="round"
          />
        )}
        
        {!isLoadingRoute && routePoints.length === 0 && currentPos && nearestZone && (
          <Polyline 
            positions={[currentPos, [nearestZone.lat, nearestZone.lng]]} 
            color="#94a3b8" 
            dashArray="10, 10"
            weight={3}
          />
        )}
      </MapContainer>

      {onMapClick && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-blue-100 shadow-xl z-[1000] text-[10px] font-bold text-blue-900 uppercase tracking-widest pointer-events-none">
          Click map to add safe zone
        </div>
      )}

      {nearestZone && (
         <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-blue-100 shadow-lg z-[1000] flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                {isLoadingRoute || isSearching ? "Searching Shelters..." : "Recommended Road Route"}
              </p>
              {routeData?.legs?.[0] && (
                <div className="flex gap-2 text-[10px] font-black text-blue-600">
                  <span>{routeData.legs[0].distance.text}</span>
                  <span>•</span>
                  <span>{routeData.legs[0].duration.text}</span>
                </div>
              )}
            </div>
            <h4 className="text-sm font-bold text-slate-800 truncate">Toward: {nearestZone.name}</h4>
            <p className="text-[10px] text-slate-500 font-medium">
              {routeData?.summary ? `Via ${routeData.summary}` : "Following safest available roads."}
            </p>
         </div>
      )}
    </div>
  );
};
