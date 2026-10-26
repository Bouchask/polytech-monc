import type { Category, ServiceItem, Technician, Address } from '../types';
export const categories: Category[] = [
  { id: 'electricite', name: 'Électricité', icon: 'flash-outline', image: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900', description: 'Installation, dépannage et mise aux normes.', color: '#FFF4E5' },
  { id: 'electromenager', name: 'Électroménager', icon: 'cube-outline', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=900', description: 'Réparez vos appareils du quotidien.', color: '#EAF5FC' },
  { id: 'plomberie', name: 'Plomberie', icon: 'water-outline', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=900', description: 'Des solutions fiables pour vos installations.', color: '#E7F7F9' },
  { id: 'peinture', name: 'Peinture', icon: 'color-palette-outline', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900', description: 'Rafraîchissez vos espaces avec soin.', color: '#F5EDFA' },
  { id: 'nettoyage', name: 'Nettoyage', icon: 'sparkles-outline', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900', description: 'Un intérieur propre, sans effort.', color: '#EDF7EF' },
];
const photo = (id: string) => `https://images.unsplash.com/${id}?w=900`;
export const serviceItems: ServiceItem[] = [
  { id:'filter', categoryId:'plomberie', type:'Filtre d’eau', name:'Installation filtre d’eau', description:'Installation et vérification des raccords.', min:200,max:300,image:photo('photo-1621905252507-b35492cc74b4') },
  { id:'cartridge', categoryId:'plomberie', type:'Filtre d’eau', name:'Remplacement de la cartouche', description:'Remplacement et test de votre filtre.', min:200,max:250,image:photo('photo-1607472586893-edb57bdc0e39') },
  { id:'sink', categoryId:'plomberie', type:'Lavabo', name:'Réparation de lavabo', description:'Fuite, siphon ou robinetterie.', min:150,max:350,image:photo('photo-1620626011761-996317b8d101') },
  { id:'shower', categoryId:'plomberie', type:'Douche', name:'Réparation de douche', description:'Robinet, flexible ou évacuation.', min:180,max:400,image:photo('photo-1620626011761-996317b8d101') },
  { id:'toilet', categoryId:'plomberie', type:'Toilette', name:'Dépannage toilette', description:'Chasse d’eau et fuite.', min:150,max:350,image:photo('photo-1584622650111-993a426fbf0a') },
  { id:'heater', categoryId:'plomberie', type:'Chauffe-eau', name:'Entretien chauffe-eau', description:'Diagnostic et entretien courant.', min:250,max:500,image:photo('photo-1621905251918-48416bd8575a') },
  { id:'outlet', categoryId:'electricite', type:'Prise électrique', name:'Installation de prise', description:'Pose ou remplacement sécurisé.', min:150,max:300,image:photo('photo-1621905251918-48416bd8575a') },
  { id:'lighting', categoryId:'electricite', type:'Éclairage', name:'Installation de luminaire', description:'Montage et raccordement.', min:120,max:280,image:photo('photo-1507473885765-e6ed057f782c') },
  { id:'electrical-fault', categoryId:'electricite', type:'Panne électrique', name:'Dépannage électrique', description:'Recherche de panne et remise en service.', image:photo('photo-1621905251918-48416bd8575a') },
  { id:'electrical-panel', categoryId:'electricite', type:'Tableau électrique', name:'Vérification du tableau électrique', description:'Contrôle des protections et des connexions.', image:photo('photo-1621905251918-48416bd8575a') },
  { id:'washer', categoryId:'electromenager', type:'Lave-linge', name:'Réparation lave-linge', description:'Diagnostic de panne à domicile.', min:200,max:500,image:photo('photo-1626806787461-102c1bfaaea1') },
  { id:'fridge', categoryId:'electromenager', type:'Réfrigérateur', name:'Dépannage réfrigérateur', description:'Diagnostic et réparation.', min:250,max:600,image:photo('photo-1571175443880-49e1d25b2bc5') },
  { id:'oven', categoryId:'electromenager', type:'Four', name:'Réparation de four', description:'Diagnostic et réparation à domicile.', image:photo('photo-1585238342024-78d387f4a707') },
  { id:'dishwasher', categoryId:'electromenager', type:'Lave-vaisselle', name:'Dépannage lave-vaisselle', description:'Recherche de panne et vérification.', image:photo('photo-1626806787461-102c1bfaaea1') },
  { id:'bidet', categoryId:'plomberie', type:'Bidet', name:'Réparation de bidet', description:'Robinetterie, fuite ou évacuation.', image:photo('photo-1607472586893-edb57bdc0e39') },
  { id:'roompaint', categoryId:'peinture', type:'Pièce complète', name:'Peinture d’une pièce', description:'Préparation et finition soignée.', min:800,max:2200,image:photo('photo-1562259949-e8e7689d7828') },
  { id:'wallpaint', categoryId:'peinture', type:'Mur', name:'Peinture d’un mur', description:'Préparation de surface et finition.', image:photo('photo-1562259949-e8e7689d7828') },
  { id:'paint-touchups', categoryId:'peinture', type:'Retouches', name:'Retouches de peinture', description:'Petites réparations et finitions.', image:photo('photo-1562259949-e8e7689d7828') },
  { id:'deepclean', categoryId:'nettoyage', type:'Nettoyage complet', name:'Ménage en profondeur', description:'Cuisine, salle de bain et surfaces.', min:300,max:700,image:photo('photo-1581578731548-c64695cc6952') },
  { id:'kitchen-clean', categoryId:'nettoyage', type:'Cuisine', name:'Nettoyage de cuisine', description:'Nettoyage des surfaces et équipements.', image:photo('photo-1581578731548-c64695cc6952') },
  { id:'sofa-clean', categoryId:'nettoyage', type:'Canapé', name:'Nettoyage de canapé', description:'Entretien des tissus et assises.', image:photo('photo-1581578731548-c64695cc6952') },
];
export const typesByCategory: Record<string,string[]> = { plomberie:['Lavabo','Douche','Toilette','Bidet','Filtre d’eau','Chauffe-eau'], electricite:['Prise électrique','Éclairage','Panne électrique','Tableau électrique'], electromenager:['Lave-linge','Réfrigérateur','Four','Lave-vaisselle'], peinture:['Pièce complète','Mur','Retouches'], nettoyage:['Nettoyage complet','Cuisine','Canapé'] };
export const technicians: Technician[] = [
  {id:'t1',name:'Youssef El Amrani',specialty:'Plomberie',rating:4.9,reviews:128,jobs:340,experience:8,bio:'Artisan plombier à Casablanca, spécialisé en dépannage et installation.',avatar:'https://i.pravatar.cc/300?img=12'},
  {id:'t2',name:'Amine Berrada',specialty:'Plomberie',rating:4.8,reviews:86,jobs:215,experience:6,bio:'Interventions soignées et conseils transparents pour vos installations.',avatar:'https://i.pravatar.cc/300?img=11'},
  {id:'t3',name:'Karim Zahraoui',specialty:'Plomberie',rating:4.7,reviews:63,jobs:180,experience:5,bio:'Disponible rapidement dans le Grand Casablanca.',avatar:'https://i.pravatar.cc/300?img=14'},
];
export const seedAddresses: Address[] = [{id:'home',label:'Maison',address:'Maarif, Casablanca',details:'Résidence Al Amal, immeuble B'}, {id:'work',label:'Travail',address:'Sidi Maarouf, Casablanca'}];
