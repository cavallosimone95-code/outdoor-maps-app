import React, { useState } from 'react';

interface SavedTrack {
    id: string;
    name: string;
    difficulty: string;
    terrain: string;
}

interface Review {
    rating: number;
    comment: string;
    date: string;
    userName?: string;
    trailCondition: 'abbandonato' | 'sporco' | 'percorribile' | 'pulito' | 'perfetto';
}

interface ReviewTrackFormProps {
    track: SavedTrack | null;
    onCancel: () => void;
    onSubmit: (trackId: string, review: Review) => void;
}

export default function ReviewTrackForm({ track, onCancel, onSubmit }: ReviewTrackFormProps) {
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [comment, setComment] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
    const [trailCondition, setTrailCondition] = useState<'abbandonato' | 'sporco' | 'percorribile' | 'pulito' | 'perfetto'>('percorribile');
    const [reviewDate] = useState<string>(new Date().toLocaleDateString('it-IT'));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!track) return;
        
        if (rating === 0) {
            alert('Seleziona una valutazione da 1 a 10');
            return;
        }

        const review: Review = {
            rating,
            comment: comment.trim(),
            date: new Date().toISOString(),
            userName: userName.trim() || undefined,
            trailCondition
        };

        onSubmit(track.id, review);
        
        // Reset form
        setRating(0);
        setComment('');
        setUserName('');
        setTrailCondition('percorribile');
    };

    if (!track) {
        return (
            <div className="review-track-form">
                <h3>Recensisci Singletrack</h3>
                <p className="no-track-selected">
                    Seleziona un singletrack sulla mappa per recensirlo
                </p>
            </div>
        );
    }

    return (
        <div className="review-track-form">
            <h3>Recensisci Singletrack</h3>
            
            <div className="track-preview">
                <h4>{track.name}</h4>
                <p className="track-details">
                    {track.difficulty} • {track.terrain}
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Data recensione</label>
                    <input
                        type="text"
                        value={reviewDate}
                        disabled
                        className="date-readonly"
                    />
                </div>

                <div className="form-group">
                    <label>Stato del sentiero *</label>
                    <select
                        value={trailCondition}
                        onChange={(e) => setTrailCondition(e.target.value as any)}
                        className="trail-condition-select"
                    >
                        <option value="abbandonato">🔴 Abbandonato</option>
                        <option value="sporco">🟠 Sporco</option>
                        <option value="percorribile">🟡 Percorribile</option>
                        <option value="pulito">🟢 Pulito</option>
                        <option value="perfetto">🟢 Perfetto</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>La tua valutazione (1-10) *</label>
                    <div className="rating-slider-container">
                        <input
                            type="range"
                            min="0"
                            max="10"
                            value={rating}
                            onChange={(e) => setRating(parseInt(e.target.value))}
                            className="rating-slider"
                        />
                        <div className="rating-display">
                            {rating === 0 ? 'Seleziona un voto' : `${rating}/10`}
                        </div>
                    </div>
                    <div className="rating-labels">
                        <span>1 - Pessimo</span>
                        <span>5 - Nella media</span>
                        <span>10 - Perfetto</span>
                    </div>
                </div>

                <div className="form-group">
                    <label>Il tuo nome (facoltativo)</label>
                    <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Come vuoi essere chiamato?"
                        maxLength={50}
                    />
                </div>

                <div className="form-group">
                    <label>Note e commenti</label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Racconta la tua esperienza: condizioni del percorso, difficoltà incontrate, panorama, consigli utili..."
                        rows={6}
                        maxLength={500}
                    />
                    <p className="char-count">{comment.length}/500 caratteri</p>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={onCancel}>
                        Annulla
                    </button>
                    <button type="submit" className="btn-submit">
                        Invia Recensione
                    </button>
                </div>
            </form>
        </div>
    );
}
