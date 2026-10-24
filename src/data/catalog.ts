import type { Category, ServiceItem, Technician, Offer, ServiceRequest, AppNotification, Address } from '../types';
export const categories: Category[] = [
  { id: 'electricite', name: 'Électricité', icon: 'flash-outline', image: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900', description: 'Installation, dépannage et mise aux normes.', color: '#FFF4E5' },
  { id: 'electromenager', name: 'Électroménager', icon: 'cube-outline', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900', description: 'Réparez vos appareils du quotidien.', color: '#EAF5FC' },
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
  { id:'washer', categoryId:'electromenager', type:'Lave-linge', name:'Réparation lave-linge', description:'Diagnostic de panne à domicile.', min:200,max:500,image:photo('photo-1626806787461-102c1bfaaea1') },
  { id:'fridge', categoryId:'electromenager', type:'Réfrigérateur', name:'Dépannage réfrigérateur', description:'Diagnostic et réparation.', min:250,max:600,image:photo('photo-1571175443880-49e1d25b2bc5') },
  { id:'roompaint', categoryId:'peinture', type:'Pièce complète', name:'Peinture d’une pièce', description:'Préparation et finition soignée.', min:800,max:2200,image:photo('photo-1562259949-e8e7689d7828') },
  { id:'deepclean', categoryId:'nettoyage', type:'Nettoyage complet', name:'Ménage en profondeur', description:'Cuisine, salle de bain et surfaces.', min:300,max:700,image:photo('photo-1581578731548-c64695cc6952') },
];
export const typesByCategory: Record<string,string[]> = { plomberie:['Lavabo','Douche','Toilette','Bidet','Filtre d’eau','Chauffe-eau'], electricite:['Prise électrique','Éclairage','Panne électrique','Tableau électrique'], electromenager:['Lave-linge','Réfrigérateur','Four','Lave-vaisselle'], peinture:['Pièce complète','Mur','Retouches'], nettoyage:['Nettoyage complet','Cuisine','Canapé'] };
export const technicians: Technician[] = [
  {id:'t1',name:'Youssef El Amrani',specialty:'Plomberie',rating:4.9,reviews:128,jobs:340,experience:8,bio:'Artisan plombier à Casablanca, spécialisé en dépannage et installation.',avatar:'https://i.pravatar.cc/300?img=12'},
  {id:'t2',name:'Amine Berrada',specialty:'Plomberie',rating:4.8,reviews:86,jobs:215,experience:6,bio:'Interventions soignées et conseils transparents pour vos installations.',avatar:'https://i.pravatar.cc/300?img=11'},
  {id:'t3',name:'Karim Zahraoui',specialty:'Plomberie',rating:4.7,reviews:63,jobs:180,experience:5,bio:'Disponible rapidement dans le Grand Casablanca.',avatar:'https://i.pravatar.cc/300?img=14'},
];
export const seedAddresses: Address[] = [{id:'home',label:'Maison',address:'Maarif, Casablanca',details:'Résidence Al Amal, immeuble B'}, {id:'work',label:'Travail',address:'Sidi Maarouf, Casablanca'}];
export const seedRequests: ServiceRequest[] = [
  {id:'r-offers',ref:'PL-240518',categoryId:'plomberie',serviceNames:['Installation filtre d’eau'],description:'Le filtre est à installer sous l’évier.',address:seedAddresses[0],createdAt:'2026-10-22T10:30:00.000Z',status:'OFFERS_RECEIVED',urgency:'urgent',media:[],offerIds:['o1','o2','o3']},
  {id:'r-active',ref:'PL-240392',categoryId:'plomberie',serviceNames:['Réparation de lavabo'],description:'Le robinet goutte depuis hier.',address:seedAddresses[0],createdAt:'2026-10-20T09:00:00.000Z',status:'IN_PROGRESS',urgency:'scheduled',schedule:'2026-10-25T10:00:00.000Z',media:[],offerIds:['o4'],acceptedOfferId:'o4'},
  {id:'r-done',ref:'PL-239820',categoryId:'electricite',serviceNames:['Installation de luminaire'],description:'Pose d’un plafonnier dans le salon.',address:seedAddresses[1],createdAt:'2026-10-10T09:00:00.000Z',status:'COMPLETED',urgency:'scheduled',schedule:'2026-10-12T14:00:00.000Z',media:[],offerIds:[]},
  {id:'r-cancel',ref:'PL-239100',categoryId:'nettoyage',serviceNames:['Ménage en profondeur'],description:'Nettoyage appartement.',address:seedAddresses[0],createdAt:'2026-10-02T09:00:00.000Z',status:'CANCELLED',urgency:'urgent',media:[],offerIds:[]},
];
export const seedOffers: Offer[] = [
  {id:'o1',requestId:'r-offers',technicianId:'t1',price:250,message:'Je peux intervenir aujourd’hui. Matériel inclus.',availability:'Aujourd’hui · 16h–18h',status:'PENDING'},
  {id:'o2',requestId:'r-offers',technicianId:'t2',price:220,message:'Disponible demain matin, intervention rapide.',availability:'Demain · 9h–11h',status:'PENDING'},
  {id:'o3',requestId:'r-offers',technicianId:'t3',price:280,message:'Expert en filtration, déplacement inclus.',availability:'Aujourd’hui · 18h–20h',status:'PENDING'},
  {id:'o4',requestId:'r-active',technicianId:'t2',price:300,message:'Je confirme le rendez-vous.',availability:'25 oct. · 10h',status:'ACCEPTED'},
];
export const seedNotifications: AppNotification[] = [
  {id:'n1',title:'Nouvelle offre reçue',body:'Youssef vous a envoyé une offre pour votre demande.',kind:'offer',requestId:'r-offers',createdAt:'2026-10-23T08:30:00.000Z',read:false},
  {id:'n2',title:'Rendez-vous confirmé',body:'Votre intervention est prévue le 25 octobre.',kind:'appointment',requestId:'r-active',createdAt:'2026-10-21T10:00:00.000Z',read:false},
  {id:'n3',title:'Intervention terminée',body:'Votre demande PL-239820 est terminée.',kind:'status',requestId:'r-done',createdAt:'2026-10-12T16:00:00.000Z',read:true},
  {id:'n4',title:'Votre offre a été acceptée',body:'Votre rendez-vous avec Amine est confirmé.',kind:'appointment',requestId:'r-active',createdAt:'2026-10-20T11:00:00.000Z',read:true},
  {id:'n5',title:'Disponibilité mise à jour',body:'Une nouvelle disponibilité est affichée pour votre intervention.',kind:'appointment',requestId:'r-active',createdAt:'2026-10-19T15:00:00.000Z',read:true},
  {id:'n6',title:'Demande annulée',body:'Votre demande de nettoyage a été annulée.',kind:'status',requestId:'r-cancel',createdAt:'2026-10-02T12:00:00.000Z',read:true},
  {id:'n7',title:'Intervention en cours',body:'Votre artisan a commencé l’intervention.',kind:'status',requestId:'r-active',createdAt:'2026-10-21T12:00:00.000Z',read:true},
];
