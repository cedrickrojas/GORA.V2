import { boundingBox, distanceKm, roundDistanceKm } from './geo-distance';

const BGC = { latitude: 14.5509, longitude: 121.0503 };
const RIZAL_PARK = { latitude: 14.5831, longitude: 120.9794 };

describe('geo-distance', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(BGC, BGC)).toBe(0);
  });

  it('measures a known distance within a few metres', () => {
    // BGC to Rizal Park, Manila: about 8.4 km in a straight line.
    const km = distanceKm(BGC, RIZAL_PARK);
    expect(km).toBeGreaterThan(8.3);
    expect(km).toBeLessThan(8.5);
    expect(distanceKm(RIZAL_PARK, BGC)).toBeCloseTo(km, 10);
  });

  it('measures one degree of latitude as about 111.2 km', () => {
    expect(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }),
    ).toBeCloseTo(111.19, 1);
  });

  it('handles the antimeridian', () => {
    expect(
      distanceKm(
        { latitude: 0, longitude: 179.9 },
        { latitude: 0, longitude: -179.9 },
      ),
    ).toBeCloseTo(22.24, 1);
  });

  it('rounds to two decimals', () => {
    expect(roundDistanceKm(1.23456)).toBe(1.23);
    expect(roundDistanceKm(0.005)).toBe(0.01);
  });

  it('builds a box that contains every point within the radius', () => {
    const box = boundingBox(BGC, 10);

    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const radians = (bearing * Math.PI) / 180;
      const point = {
        latitude: BGC.latitude + (9.99 / 111.19) * Math.cos(radians),
        longitude:
          BGC.longitude +
          ((9.99 / 111.19) * Math.sin(radians)) /
            Math.cos((BGC.latitude * Math.PI) / 180),
      };
      expect(distanceKm(BGC, point)).toBeLessThanOrEqual(10.05);
      expect(point.latitude).toBeGreaterThanOrEqual(box.minLatitude);
      expect(point.latitude).toBeLessThanOrEqual(box.maxLatitude);
      expect(point.longitude).toBeGreaterThanOrEqual(box.minLongitude!);
      expect(point.longitude).toBeLessThanOrEqual(box.maxLongitude!);
    }
  });

  it('drops the longitude bounds near a pole or across the antimeridian', () => {
    expect(
      boundingBox({ latitude: 89.99, longitude: 0 }, 5).minLongitude,
    ).toBeNull();
    expect(
      boundingBox({ latitude: 0, longitude: 179.99 }, 5).maxLongitude,
    ).toBeNull();
  });
});
