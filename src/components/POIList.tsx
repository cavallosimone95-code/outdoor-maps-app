import React from 'react';
import { POI } from '../types';

export default function POIList({ pois }: { pois: POI[] }) {
  const handleSelect = (poi: POI) => {
    // dispatch a global event that MapView listens to
    window.dispatchEvent(new CustomEvent('poi:select', { detail: poi }));
  };

  const getPoiColor = (type?: string): string => {
    const colors: Record<string, string> = {
      bikeshop: '#e74c3c',        // Rosso per ciclofficine
      restaurant: '#f39c12',      // Arancione per bar/ristoranti
      fountain: '#3498db',        // Blu per fontane
      market: '#9b59b6',          // Viola per market
      sleepnride: '#27ae60'       // Verde per sleep'n'ride
    };
    return type ? (colors[type] ?? '#95a5a6') : '#95a5a6';
  };

  return (
    <ul className="poi-list">
      {pois.map((p) => (
        <li key={p.id} className="poi-item">
          <button className="poi-button" onClick={() => handleSelect(p)}>
            <span
              className="poi-dot"
              style={{ background: getPoiColor(p.type) }}
            />
            <div className="poi-meta">
              <div className="poi-name">{p.name}</div>
              {p.distance != null && <div className="poi-distance">{Math.round(p.distance)} m away</div>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}