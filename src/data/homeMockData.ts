export type HomeLocation = { id: string; label: string; address: string; latitude?: number; longitude?: number };

export const homeLocations: HomeLocation[] = [
  { id: 'casablanca', label: 'Ville · démo', address: 'Casablanca', latitude: 33.5731, longitude: -7.5898 },
  { id: 'maarif', label: 'Maison · démo', address: 'Maarif, Casablanca', latitude: 33.5835, longitude: -7.6324 },
  { id: 'anfa', label: 'Démo', address: 'Anfa, Casablanca', latitude: 33.5902, longitude: -7.6516 },
  { id: 'bourgogne', label: 'Démo', address: 'Bourgogne, Casablanca', latitude: 33.5943, longitude: -7.6381 },
  { id: 'gauthier', label: 'Démo', address: 'Gauthier, Casablanca', latitude: 33.5914, longitude: -7.6258 },
  { id: 'agadir', label: 'Ville · démo', address: 'Agadir', latitude: 30.4278, longitude: -9.5981 },
  { id: 'marrakech', label: 'Ville · démo', address: 'Marrakech', latitude: 31.6295, longitude: -7.9811 },
  { id: 'agdal', label: 'Démo', address: 'Agdal, Rabat', latitude: 33.9977, longitude: -6.8498 },
  { id: 'rabat', label: 'Ville · démo', address: 'Rabat', latitude: 34.0209, longitude: -6.8416 },
  { id: 'tangier', label: 'Ville · démo', address: 'Tangier', latitude: 35.7595, longitude: -5.8340 },
];
