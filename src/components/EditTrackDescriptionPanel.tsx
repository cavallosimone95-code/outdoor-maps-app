import React, { useState } from 'react';
import { SavedTrack } from '../services/trackStorage';

interface EditTrackDescriptionPanelProps {
  track: SavedTrack;
  onCancel: () => void;
  onSave: (trackId: string, description: string) => void;
}

export default function EditTrackDescriptionPanel({ track, onCancel, onSave }: EditTrackDescriptionPanelProps) {
  const [description, setDescription] = useState<string>(track.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (desc.length === 0) {
      if (!confirm('La descrizione è vuota. Vuoi salvare comunque?')) return;
    }
    onSave(track.id, desc);
  };

  return (
    <div style={{ color: 'white', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '2px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ margin: 0 }}>✏️ Aggiorna descrizione</h2>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid rgba(255,255,255,0.3)',
            color: 'white',
            padding: '8px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          ✕ Chiudi
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Nome</div>
        <div style={{ fontWeight: 700 }}>{track.name}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)' }}>Descrizione del sentiero</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            maxLength={2000}
            placeholder="Descrivi il sentiero, caratteristiche, consigli, stato attuale, accessi..."
            style={{
              width: '100%',
              borderRadius: 8,
              padding: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.25)',
              color: 'white',
              resize: 'vertical'
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{description.length}/2000</span>
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: '#7f8c8d',
              border: 'none',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Annulla
          </button>
          <button
            type="submit"
            style={{
              background: '#2ecc71',
              border: 'none',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Salva descrizione
          </button>
        </div>
      </form>
    </div>
  );
}
