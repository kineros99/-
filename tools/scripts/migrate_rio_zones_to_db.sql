-- ============================================================================
-- Migrate Existing Rio de Janeiro Zones to Database
-- ============================================================================
-- This migration populates the cities and neighborhoods tables with
-- the existing 27 Rio de Janeiro zones from places_nearby_google.js
-- ============================================================================

-- Insert Rio de Janeiro city
INSERT INTO cities (name, state, country, center_lat, center_lng)
VALUES ('Rio de Janeiro', 'Rio de Janeiro', 'Brasil', -22.9068, -43.1729)
ON CONFLICT (name, state, country) DO NOTHING;

-- Get the city_id for Rio de Janeiro
DO $$
DECLARE
    rio_city_id INTEGER;
BEGIN
    SELECT id INTO rio_city_id FROM cities WHERE name = 'Rio de Janeiro' AND state = 'Rio de Janeiro';

    -- Insert all 27 neighborhoods from the existing search zones

    -- Zona Sul - smaller, denser neighborhoods
    INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
    VALUES
        (rio_city_id, 'Copacabana', -22.9711, -43.1822, 3000, 0),
        (rio_city_id, 'Ipanema', -22.9838, -43.2044, 2000, 0),
        (rio_city_id, 'Leblon', -22.9842, -43.2200, 2000, 0),
        (rio_city_id, 'Botafogo', -22.9519, -43.1825, 3000, 0),
        (rio_city_id, 'Flamengo', -22.9297, -43.1760, 2500, 0),
        (rio_city_id, 'Laranjeiras', -22.9350, -43.1875, 2000, 0),
        (rio_city_id, 'Gávea', -22.9803, -43.2315, 2500, 0)
    ON CONFLICT (city_id, name) DO NOTHING;

    -- Zona Norte - medium to large neighborhoods
    INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
    VALUES
        (rio_city_id, 'Tijuca', -22.9209, -43.2328, 4000, 0),
        (rio_city_id, 'Vila Isabel', -22.9158, -43.2468, 2500, 0),
        (rio_city_id, 'Méier', -22.9029, -43.2781, 3000, 0),
        (rio_city_id, 'Madureira', -22.8713, -43.3376, 3500, 0),
        (rio_city_id, 'Penha', -22.8398, -43.2823, 3000, 0),
        (rio_city_id, 'Ramos', -22.8391, -43.2489, 2500, 0),
        (rio_city_id, 'Olaria', -22.8431, -43.2677, 2000, 0)
    ON CONFLICT (city_id, name) DO NOTHING;

    -- Zona Oeste - larger, spread out neighborhoods
    INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
    VALUES
        (rio_city_id, 'Barra da Tijuca', -23.0045, -43.3646, 5000, 0),
        (rio_city_id, 'Recreio', -23.0170, -43.4639, 4000, 0),
        (rio_city_id, 'Jacarepaguá', -22.9373, -43.3697, 4000, 0),
        (rio_city_id, 'Campo Grande', -22.9009, -43.5617, 5000, 0),
        (rio_city_id, 'Bangu', -22.8705, -43.4654, 4000, 0),
        (rio_city_id, 'Realengo', -22.8814, -43.4301, 3000, 0)
    ON CONFLICT (city_id, name) DO NOTHING;

    -- Centro - dense urban area
    INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
    VALUES
        (rio_city_id, 'Centro', -22.9099, -43.1763, 3000, 0),
        (rio_city_id, 'Lapa', -22.9130, -43.1799, 2000, 0),
        (rio_city_id, 'Santa Teresa', -22.9209, -43.1886, 2500, 0),
        (rio_city_id, 'São Cristóvão', -22.8991, -43.2236, 2500, 0)
    ON CONFLICT (city_id, name) DO NOTHING;

    -- Additional zones
    INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
    VALUES
        (rio_city_id, 'Ilha do Governador', -22.8147, -43.2073, 4000, 0),
        (rio_city_id, 'Pavuna', -22.8107, -43.3530, 3000, 0),
        (rio_city_id, 'Santa Cruz', -22.9166, -43.6926, 5000, 0)
    ON CONFLICT (city_id, name) DO NOTHING;

    RAISE NOTICE 'Successfully migrated 27 Rio de Janeiro neighborhoods';
END $$;
