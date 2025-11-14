import React, { useState, useRef, useEffect } from 'react';

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// Database di fallback ridotto (usato solo se API non disponibile)
const fallbackCities = [
  'Roma, Italia', 'Milano, Italia', 'Napoli, Italia', 'Torino, Italia', 'Firenze, Italia', 'Bologna, Italia', 'Venezia, Italia', 'Verona, Italia',
  'Parigi, Francia', 'Marsiglia, Francia', 'Lione, Francia', 'Tolosa, Francia', 'Nizza, Francia', 'Bordeaux, Francia',
  'Madrid, Spagna', 'Barcellona, Spagna', 'Valencia, Spagna', 'Siviglia, Spagna', 'Bilbao, Spagna', 'Malaga, Spagna',
  'Berlino, Germania', 'Monaco, Germania', 'Amburgo, Germania', 'Francoforte, Germania', 'Colonia, Germania',
  'Londra, Regno Unito', 'Manchester, Regno Unito', 'Birmingham, Regno Unito', 'Glasgow, Regno Unito', 'Edimburgo, Regno Unito',
  'Amsterdam, Paesi Bassi', 'Rotterdam, Paesi Bassi', 'L\'Aia, Paesi Bassi', 'Utrecht, Paesi Bassi',
  'Bruxelles, Belgio', 'Anversa, Belgio', 'Gand, Belgio', 'Bruges, Belgio',
  'Vienna, Austria', 'Salisburgo, Austria', 'Innsbruck, Austria', 'Graz, Austria',
  'Zurigo, Svizzera', 'Ginevra, Svizzera', 'Basilea, Svizzera', 'Berna, Svizzera', 'Losanna, Svizzera', 'Lugano, Svizzera',
  'Lisbona, Portogallo', 'Porto, Portogallo', 'Braga, Portogallo', 'Coimbra, Portogallo',
  'Atene, Grecia', 'Salonicco, Grecia', 'Santorini, Grecia', 'Mykonos, Grecia'
];

const CityAutocomplete: React.FC<CityAutocompleteProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Cerca città...', 
  label, 
  required = false 
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchCitiesWithNominatim = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Nominatim API di OpenStreetMap (completamente gratuita, senza limiti rigidi)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=20&` + // Aumentato per avere più risultati
        `countrycodes=it,fr,es,de,gb,ch,at,nl,be,pt,gr,se,no,dk,fi,cz,hu,pl,ro,bg,ie,hr,rs,si,sk,ba,mk,me,al,ee,lv,lt,is,lu,mt,cy`, // Europa
        {
          headers: {
            'Accept-Language': 'it,en',
            'User-Agent': 'SingletrackOutdoorMaps/1.0' // Richiesto da Nominatim per identificare l'app
          }
        }
      );

      if (!response.ok) {
        throw new Error('API error');
      }

      const data: NominatimResult[] = await response.json();
      
      console.log('Nominatim results for "' + query + '":', data); // Debug
      
      // Debug: mostra class e type di ogni risultato
      data.forEach((result, index) => {
        console.log(`Result ${index}: class="${result.class}", type="${result.type}", name="${result.display_name.split(',')[0]}"`);
      });
      
      // NESSUN FILTRO - accetta TUTTI i risultati che l'API restituisce
      const formattedCities = data
        .map(result => {
          // Estrai il nome della località e il paese dal display_name
          const parts = result.display_name.split(',').map(p => p.trim());
          
          // Prova a estrarre località e paese in modo intelligente
          let cityName = parts[0];
          let country = parts[parts.length - 1];
          
          // Se ci sono dati address, usali per migliorare il formato
          if (result.address) {
            const addr = result.address;
            cityName = addr.city || addr.town || addr.village || addr.municipality || 
                      addr.hamlet || addr.suburb || parts[0];
          }
          
          return `${cityName}, ${country}`;
        })
        .filter((city, index, self) => {
          // Rimuovi duplicati
          return self.indexOf(city) === index;
        })
        .slice(0, 12); // Mostra fino a 12 risultati

      console.log('Formatted cities:', formattedCities); // Debug

      setSuggestions(formattedCities);
      setShowSuggestions(formattedCities.length > 0);
      setActiveSuggestion(0);
      setIsLoading(false);
    } catch (error) {
      console.log('API Nominatim non disponibile, uso database locale fallback');
      
      // Fallback al database locale
      const filteredCities = fallbackCities
        .filter(city => city.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
      
      setSuggestions(filteredCities);
      setShowSuggestions(filteredCities.length > 0);
      setActiveSuggestion(0);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    onChange(input);

    // Cancella il timeout precedente
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    // Debounce: attendi 500ms prima di chiamare l'API (per ridurre il carico)
    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      searchCitiesWithNominatim(input);
    }, 500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestion(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[activeSuggestion]) {
          handleSuggestionClick(suggestions[activeSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: '5px',
          fontWeight: 500,
          fontSize: '14px',
          color: '#333'
        }}>
          {label}
          {required && <span style={{ color: '#e74c3c' }}> *</span>}
        </label>
      )}

      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required}
            style={{
              width: '100%',
              padding: '10px',
              paddingRight: isLoading ? '35px' : '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
          />
          {isLoading && (
            <div 
              className="spinner"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                border: '2px solid #ddd',
                borderTopColor: '#4CAF50',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} 
            />
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            {suggestions.map((city, index) => (
              <li
                key={index}
                onClick={() => handleSuggestionClick(city)}
                onMouseEnter={() => setActiveSuggestion(index)}
                style={{
                  padding: '10px 15px',
                  cursor: 'pointer',
                  backgroundColor: activeSuggestion === index ? '#f0f0f0' : 'white',
                  color: '#333',
                  transition: 'background-color 0.2s',
                  borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none'
                }}
              >
                {city}
              </li>
            ))}
          </ul>
        )}

        <p style={{
          marginTop: '5px',
          fontSize: '12px',
          color: '#666'
        }}>
          Cerca qualsiasi città europea (es: Milano, Chamonix, Innsbruck, Barcelona...)
        </p>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CityAutocomplete;
