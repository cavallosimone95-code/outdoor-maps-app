import React from 'react';
import { SavedTrack } from '../services/trackStorage';

interface ReviewHistoryPanelProps {
  track: SavedTrack;
  onClose: () => void;
}

const getTrailConditionLabel = (condition: string): string => {
  const labels: { [key: string]: string } = {
    'abbandonato': '🚫 Abbandonato',
    'sporco': '⚠️ Sporco',
    'percorribile': '✓ Percorribile',
    'pulito': '✓✓ Pulito',
    'perfetto': '⭐ Perfetto'
  };
  return labels[condition] || condition;
};

export default function ReviewHistoryPanel({ track, onClose }: ReviewHistoryPanelProps) {
  // Sort reviews by date (most recent first)
  const safeTs = (d: string) => {
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  };
  const sanitized = (track.reviews || []).filter(r => r && typeof r.rating === 'number' && !isNaN(r.rating));
  const sortedReviews = [...sanitized].sort((a, b) => safeTs(b.date) - safeTs(a.date));

  const avgRating = sortedReviews.length > 0
    ? (sortedReviews.reduce((sum, r) => sum + r.rating, 0) / sortedReviews.length).toFixed(1)
    : '0';

  return (
    <div style={{ color: 'white', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            📋 Storico Recensioni
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '16px', color: 'rgba(255, 255, 255, 0.8)' }}>
            {track.name}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        >
          ✕ Chiudi
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        gap: '30px',
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '5px' }}>
            Totale recensioni
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {sortedReviews.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '5px' }}>
            Media voti
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {avgRating} ⭐
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
        {sortedReviews.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '16px'
          }}>
            Nessuna recensione disponibile
          </div>
        ) : (
          sortedReviews.map((review, index) => (
            <div
              key={index}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '12px',
                border: index === 0 ? '2px solid rgba(46, 204, 113, 0.3)' : 'none'
              }}
            >
              {/* Review Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {index === 0 && (
                    <span style={{
                      background: '#2ecc71',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      PIÙ RECENTE
                    </span>
                  )}
                  <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {new Date(review.date).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {review.rating}/10 ⭐
                </div>
              </div>

              {/* Trail Condition */}
              <div style={{ marginBottom: '10px' }}>
                <span style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginRight: '8px'
                }}>
                  Stato sentiero:
                </span>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {getTrailConditionLabel(review.trailCondition)}
                </span>
              </div>

              {/* Comment */}
              {review.comment && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  "{review.comment}"
                </div>
              )}

              {/* User name if available */}
              {review.userName && (
                <div style={{
                  marginTop: '10px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'right'
                }}>
                  — {review.userName}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
