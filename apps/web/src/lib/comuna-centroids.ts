// Approximate centroid for each Medellín comuna (1..16) and corregimiento
// (50..90). Used to place the choropleth markers; not for routing.
// Source: cross-referenced with OSM + POT polygon centroids, rounded to
// 4 decimal degrees.

export type CentroidEntry = {
  numero: number;
  nombre: string;
  lat: number;
  lng: number;
  tipo: "comuna" | "corregimiento";
};

export const COMUNA_CENTROIDS: readonly CentroidEntry[] = [
  { numero: 1, nombre: "Popular", lat: 6.2972, lng: -75.5525, tipo: "comuna" },
  { numero: 2, nombre: "Santa Cruz", lat: 6.2925, lng: -75.5548, tipo: "comuna" },
  { numero: 3, nombre: "Manrique", lat: 6.2837, lng: -75.5497, tipo: "comuna" },
  { numero: 4, nombre: "Aranjuez", lat: 6.2791, lng: -75.5577, tipo: "comuna" },
  { numero: 5, nombre: "Castilla", lat: 6.2860, lng: -75.5744, tipo: "comuna" },
  { numero: 6, nombre: "Doce de Octubre", lat: 6.2913, lng: -75.5836, tipo: "comuna" },
  { numero: 7, nombre: "Robledo", lat: 6.2810, lng: -75.5910, tipo: "comuna" },
  { numero: 8, nombre: "Villa Hermosa", lat: 6.2608, lng: -75.5428, tipo: "comuna" },
  { numero: 9, nombre: "Buenos Aires", lat: 6.2473, lng: -75.5532, tipo: "comuna" },
  { numero: 10, nombre: "La Candelaria", lat: 6.2447, lng: -75.5680, tipo: "comuna" },
  { numero: 11, nombre: "Laureles-Estadio", lat: 6.2450, lng: -75.5870, tipo: "comuna" },
  { numero: 12, nombre: "La América", lat: 6.2430, lng: -75.6000, tipo: "comuna" },
  { numero: 13, nombre: "San Javier", lat: 6.2516, lng: -75.6138, tipo: "comuna" },
  { numero: 14, nombre: "El Poblado", lat: 6.2110, lng: -75.5680, tipo: "comuna" },
  { numero: 15, nombre: "Guayabal", lat: 6.2152, lng: -75.5893, tipo: "comuna" },
  { numero: 16, nombre: "Belén", lat: 6.2256, lng: -75.6045, tipo: "comuna" },
  // Corregimientos (IDs 50..90 by local convention)
  { numero: 50, nombre: "Palmitas", lat: 6.3389, lng: -75.6497, tipo: "corregimiento" },
  { numero: 60, nombre: "San Cristóbal", lat: 6.2789, lng: -75.6475, tipo: "corregimiento" },
  { numero: 70, nombre: "Altavista", lat: 6.2144, lng: -75.6400, tipo: "corregimiento" },
  { numero: 80, nombre: "San Antonio de Prado", lat: 6.1839, lng: -75.6543, tipo: "corregimiento" },
  { numero: 90, nombre: "Santa Elena", lat: 6.2019, lng: -75.4997, tipo: "corregimiento" },
];
