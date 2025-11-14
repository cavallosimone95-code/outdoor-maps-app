import React, { useState, useEffect } from 'react';

interface TourStatsPanelProps {
    stats: {
        length?: number;
        elevationGain?: number;
        elevationLoss?: number;
        minElevation?: number;
        maxElevation?: number;
    };
    elevationProfile: { distance: number; elevation: number }[];
    loadingElevation: boolean;
    routePoints: { lat: number; lng: number }[];
}

export default function TourStatsPanel({ stats, elevationProfile, loadingElevation, routePoints }: TourStatsPanelProps) {
    const [hoverPosition, setHoverPosition] = useState<number | null>(null);
    
    // Listen for map polyline hover events
    useEffect(() => {
        const handleMapHover = (e: any) => {
            const ratio = e.detail?.ratio;
            if (typeof ratio === 'number' && !isNaN(ratio)) {
                setHoverPosition(ratio * 100);
            }
        };
        
        const handleMapLeave = () => {
            setHoverPosition(null);
        };
        
        window.addEventListener('map:polyline-hover', handleMapHover as EventListener);
        window.addEventListener('map:polyline-leave', handleMapLeave as EventListener);
        
        return () => {
            window.removeEventListener('map:polyline-hover', handleMapHover as EventListener);
            window.removeEventListener('map:polyline-leave', handleMapLeave as EventListener);
        };
    }, []);
    
    // Keep the panel visible during tour creation even when geometry is updating
    const hasAnyData = (elevationProfile && elevationProfile.length > 0) || !!stats.length || stats.elevationGain !== undefined || stats.elevationLoss !== undefined || routePoints.length > 0 || loadingElevation;

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 320,
            right: 0,
            background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
            borderTop: '3px solid #e8d4b8',
            padding: '20px',
            zIndex: 1000,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            gap: '30px',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            {/* Statistics */}
            <div style={{
                display: 'flex',
                gap: '30px',
                color: '#e8d4b8',
                minWidth: '400px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Lunghezza</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {stats.length ? `${stats.length.toFixed(1)} km` : '---'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Dislivello +</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                        {stats.elevationGain !== undefined ? `${Math.round(stats.elevationGain)} m` : '---'}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Dislivello -</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                        {stats.elevationLoss !== undefined ? `${Math.round(stats.elevationLoss)} m` : '---'}
                    </div>
                </div>
            </div>

            {/* Elevation Profile */}
            <div style={{ flex: 1, maxWidth: '800px' }}>
                {loadingElevation ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#e8d4b8',
                        fontSize: '14px'
                    }}>
                        ⏳ Caricamento dati di elevazione...
                    </div>
                ) : elevationProfile && elevationProfile.length > 0 ? (
                    <div style={{ width: '100%' }}>
                        <div style={{
                            fontSize: '12px',
                            color: '#e8d4b8',
                            marginBottom: '8px',
                            textAlign: 'center',
                            opacity: 0.8
                        }}>
                            Profilo di elevazione
                        </div>
                        <svg
                            viewBox="0 0 100 50"
                            preserveAspectRatio="none"
                            style={{
                                width: '100%',
                                height: '120px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: '1px solid rgba(232, 212, 184, 0.2)',
                                cursor: 'crosshair'
                            }}
                            onMouseMove={(ev) => {
                                const box = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
                                const x = Math.min(Math.max(ev.clientX - box.left, 0), box.width);
                                const ratio = box.width > 0 ? x / box.width : 0;
                                
                                setHoverPosition(ratio * 100);
                                const maxDist = Math.max(...elevationProfile.map(p => p.distance));
                                const targetDist = ratio * maxDist;
                                window.dispatchEvent(new CustomEvent('tour:elevation-hover', { detail: { distance: targetDist, ratio } }));
                            }}
                            onMouseLeave={() => {
                                setHoverPosition(null);
                                window.dispatchEvent(new CustomEvent('tour:elevation-leave'));
                            }}
                        >
                            <defs>
                                <linearGradient id="elevGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" style={{ stopColor: '#27ae60', stopOpacity: 0.8 }} />
                                    <stop offset="100%" style={{ stopColor: '#27ae60', stopOpacity: 0.1 }} />
                                </linearGradient>
                            </defs>

                            {(() => {
                                const maxDist = Math.max(...elevationProfile.map(p => p.distance));
                                const minElev = Math.min(...elevationProfile.map(p => p.elevation));
                                const maxElev = Math.max(...elevationProfile.map(p => p.elevation));
                                const elevRange = maxElev - minElev || 1;

                                const points = elevationProfile.map(p => {
                                    const x = (p.distance / maxDist) * 100;
                                    const y = 50 - ((p.elevation - minElev) / elevRange) * 40;
                                    return `${x},${y}`;
                                }).join(' ');

                                const pathData = `M 0,50 L ${points} L 100,50 Z`;

                                return (
                                    <>
                                        {/* Grid lines */}
                                        <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(232,212,184,0.1)" strokeWidth="0.2" />
                                        <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(232,212,184,0.1)" strokeWidth="0.2" />
                                        
                                        {/* Filled area */}
                                        <path d={pathData} fill="url(#elevGradient)" />
                                        
                                        {/* Line */}
                                        <polyline
                                            points={points}
                                            fill="none"
                                            stroke="#27ae60"
                                            strokeWidth="0.5"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        
                                        {/* Labels */}
                                        <text x="2" y="8" fontSize="3" fill="#e8d4b8" opacity="0.6">
                                            {Math.round(maxElev)} m
                                        </text>
                                        <text x="2" y="48" fontSize="3" fill="#e8d4b8" opacity="0.6">
                                            {Math.round(minElev)} m
                                        </text>
                                        <text x="96" y="48" fontSize="3" fill="#e8d4b8" opacity="0.6" textAnchor="end">
                                            {maxDist.toFixed(1)} km
                                        </text>
                                        
                                        {/* Hover marker */}
                                        {hoverPosition !== null && (() => {
                                            // Calculate exact Y position by interpolating between points
                                            const ratio = hoverPosition / 100;
                                            const targetDist = ratio * maxDist;
                                            
                                            // Find the two points that bracket targetDist
                                            let idx = 0;
                                            for (let i = 0; i < elevationProfile.length - 1; i++) {
                                                if (elevationProfile[i].distance <= targetDist && elevationProfile[i + 1].distance >= targetDist) {
                                                    idx = i;
                                                    break;
                                                }
                                            }
                                            
                                            // Interpolate elevation between the two points
                                            const p1 = elevationProfile[idx];
                                            const p2 = elevationProfile[idx + 1] || p1;
                                            const segmentRatio = p2.distance > p1.distance 
                                                ? (targetDist - p1.distance) / (p2.distance - p1.distance)
                                                : 0;
                                            const interpolatedElev = p1.elevation + segmentRatio * (p2.elevation - p1.elevation);
                                            
                                            // Calculate Y position on SVG
                                            const yPos = 50 - ((interpolatedElev - minElev) / elevRange) * 40;
                                            
                                            return (
                                                <>
                                                    <line
                                                        x1={hoverPosition}
                                                        y1="0"
                                                        x2={hoverPosition}
                                                        y2="50"
                                                        stroke="#3498db"
                                                        strokeWidth="0.5"
                                                        strokeDasharray="2,2"
                                                        opacity="0.8"
                                                    />
                                                    <circle
                                                        cx={hoverPosition}
                                                        cy={yPos}
                                                        r="1.5"
                                                        fill="#3498db"
                                                        stroke="white"
                                                        strokeWidth="0.3"
                                                    />
                                                </>
                                            );
                                        })()}
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#e8d4b8',
                        fontSize: '14px',
                        opacity: 0.6
                    }}>
                        {hasAnyData ? 'Dati di elevazione non disponibili' : 'Aggiungi almeno due punti per vedere il profilo di elevazione'}
                    </div>
                )}
            </div>
        </div>
    );
}
