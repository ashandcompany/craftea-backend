/**
 * =============================================================
 *  Craftea â€“ Seed de données de démo
 *  ~35 artistes - ~50 boutiques - ~320 produits
 *
 *  Usage (depuis le dossier backend/) :
 *    docker run --rm --network backend_default \
 *      -v ${PWD}:/seeds -w /seeds \
 *      node:24-alpine \
 *      sh -c "npm install pg bcryptjs && node seed-demo-data.mjs"
 * =============================================================
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

// == Connexions ==============================================================
const DB_BASE = { host: 'db', port: 5432, user: 'craftea', password: 'craftea_pass' };
const usersDb        = new Client({ ...DB_BASE, database: 'craftea_users' });
const artistsDb      = new Client({ ...DB_BASE, database: 'craftea_artists' });
const catalogDb      = new Client({ ...DB_BASE, database: 'craftea_catalog' });
const interactionsDb = new Client({ ...DB_BASE, database: 'craftea_interactions' });

// == Helpers =================================================================
const rand  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const range = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
let imgSeed = 10;
const nextImg = () => `https://picsum.photos/seed/${imgSeed++}/800/800`;

// == Mot de passe commun ======================================================
const PASSWORD_HASH = bcrypt.hashSync('Craftea123!', 10);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DATA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const USERS_DATA = [
  { firstname: 'Margot',     lastname: 'Dupont',    email: 'margot.dupont@craftea.dev',    specialty: 'ceramique' },
  { firstname: 'Thomas',     lastname: 'Lefèvre',   email: 'thomas.lefevre@craftea.dev',   specialty: 'poster' },
  { firstname: 'Emma',       lastname: 'Laurent',   email: 'emma.laurent@craftea.dev',     specialty: 'bijoux' },
  { firstname: 'Hugo',       lastname: 'Moreau',    email: 'hugo.moreau@craftea.dev',      specialty: 'vetements' },
  { firstname: 'Chloé',      lastname: 'Simon',     email: 'chloe.simon@craftea.dev',      specialty: 'decoration' },
  { firstname: 'Antoine',    lastname: 'Martin',    email: 'antoine.martin@craftea.dev',   specialty: 'art' },
  { firstname: 'Julie',      lastname: 'Richard',   email: 'julie.richard@craftea.dev',    specialty: 'ceramique' },
  { firstname: 'Nicolas',    lastname: 'Petit',     email: 'nicolas.petit@craftea.dev',    specialty: 'poster' },
  { firstname: 'Léa',        lastname: 'Bernard',   email: 'lea.bernard@craftea.dev',      specialty: 'papeterie' },
  { firstname: 'Maxime',     lastname: 'Dubois',    email: 'maxime.dubois@craftea.dev',    specialty: 'bijoux' },
  { firstname: 'Camille',    lastname: 'Thomas',    email: 'camille.thomas@craftea.dev',   specialty: 'vetements' },
  { firstname: 'Baptiste',   lastname: 'Garcia',    email: 'baptiste.garcia@craftea.dev',  specialty: 'decoration' },
  { firstname: 'Sarah',      lastname: 'Martinez',  email: 'sarah.martinez@craftea.dev',   specialty: 'art' },
  { firstname: 'Paul',       lastname: 'Roux',      email: 'paul.roux@craftea.dev',        specialty: 'ceramique' },
  { firstname: 'Marine',     lastname: 'Blanc',     email: 'marine.blanc@craftea.dev',     specialty: 'poster' },
  { firstname: 'Julien',     lastname: 'Vincent',   email: 'julien.vincent@craftea.dev',   specialty: 'bijoux' },
  { firstname: 'Alice',      lastname: 'Fournier',  email: 'alice.fournier@craftea.dev',   specialty: 'papeterie' },
  { firstname: 'Pierre',     lastname: 'Morel',     email: 'pierre.morel@craftea.dev',     specialty: 'art' },
  { firstname: 'Charlotte',  lastname: 'Girard',    email: 'charlotte.girard@craftea.dev', specialty: 'decoration' },
  { firstname: 'François',   lastname: 'Bonnet',    email: 'francois.bonnet@craftea.dev',  specialty: 'ceramique' },
  { firstname: 'Laura',      lastname: 'Rousseau',  email: 'laura.rousseau@craftea.dev',   specialty: 'bijoux' },
  { firstname: 'Adrien',     lastname: 'Henry',     email: 'adrien.henry@craftea.dev',     specialty: 'poster' },
  { firstname: 'Clara',      lastname: 'Philippe',  email: 'clara.philippe@craftea.dev',   specialty: 'vetements' },
  { firstname: 'Mathieu',    lastname: 'Garnier',   email: 'mathieu.garnier@craftea.dev',  specialty: 'decoration' },
  { firstname: 'AnaÃ¯s',      lastname: 'Lecomte',   email: 'anais.lecomte@craftea.dev',    specialty: 'art' },
  { firstname: 'Romain',     lastname: 'Renard',    email: 'romain.renard@craftea.dev',    specialty: 'ceramique' },
  { firstname: 'Lisa',       lastname: 'Leroy',     email: 'lisa.leroy@craftea.dev',       specialty: 'bijoux' },
  { firstname: 'Kevin',      lastname: 'Lambert',   email: 'kevin.lambert@craftea.dev',    specialty: 'poster' },
  { firstname: 'Zoé',        lastname: 'Nicolas',   email: 'zoe.nicolas@craftea.dev',      specialty: 'papeterie' },
  { firstname: 'Arnaud',     lastname: 'David',     email: 'arnaud.david@craftea.dev',     specialty: 'art' },
  { firstname: 'Manon',      lastname: 'Robert',    email: 'manon.robert@craftea.dev',     specialty: 'decoration' },
  { firstname: 'Florian',    lastname: 'Faure',     email: 'florian.faure@craftea.dev',    specialty: 'ceramique' },
  { firstname: 'Pauline',    lastname: 'Bertrand',  email: 'pauline.bertrand@craftea.dev', specialty: 'poster' },
  { firstname: 'Victor',     lastname: 'Chevalier', email: 'victor.chevalier@craftea.dev', specialty: 'bijoux' },
  { firstname: 'Inès',       lastname: 'Fontaine',  email: 'ines.fontaine@craftea.dev',    specialty: 'vetements' },
];

const BIOS = {
  ceramique: [
    "Céramiste autodidacte, je façonne l\'argile depuis dix ans dans mon atelier du Lubéron. Chaque pièce porte la trace de mes mains.",
    "Passionnée par le grès et la faÃ¯ence, je crée des objets du quotidien alliant fonctionnalité et beauté brute.",
    "Mon atelier sentait la terre depuis l\'enfance. Aujourd\'hui je transforme l\'argile en pièces uniques inspirées des paysages bretons.",
    "Formée aux Beaux-Arts de Lyon, je travaille essentiellement le grès chamotté au tour et à la main.",
    "Chaque bol, chaque vase sort de mes mains avec l\'ambition d\'être utilisé tous les jours et transmis aux générations suivantes.",
  ],
  poster: [
    "Graphiste et illustrateur, je conçois des affiches minimalistes qui habillent vos murs avec justesse et poésie.",
    "Mes impressions sont tirées sur papier épais 300g, dans un atelier de sérigraphie parisien. Edition limitée, toujours.",
    "Ancien directeur artistique reconverti, je dessine des posters qui racontent le quotidien avec humour et sobriété.",
    "Je mélange typographie et illustration pour créer des affiches décoratives qui font sourire et réfléchir.",
    "Chaque poster est une invitation au voyage, à la rêverie ou à l\'introspection. Tirage numéroté, signé à la main.",
  ],
  bijoux: [
    "Bijoutière créatrice, je travaille l\'argent, le laiton et les pierres semi-précieuses dans mon studio parisien.",
    "Mes bijoux s\'inspirent des formes organiques et des textures naturelles. Chaque pièce est unique, jamais moulée.",
    "Formée en joaillerie à Toulouse, je crée des bijoux contemporains qui mêlent géométrie stricte et matières brutes.",
    "Du métal aux pierres, je façonne des bijoux portables au quotidien, robustes mais délicats, pour les amoureux du fait-main.",
    "Passionnée de minéraux depuis l\'enfance, je crée des bijoux qui célèbrent la beauté naturelle des pierres.",
  ],
  vetements: [
    "Créatrice de mode éthique, je cous des vêtements en lin et coton bio dans mon atelier bordelais.",
    "Ex-couturière haute couture, je crée maintenant des pièces capsule artisanales, loin du fast fashion.",
    "Mes vêtements sont pensés pour durer : matières naturelles, coupes intemporelles, finitions soignées à la main.",
    "Autodidacte passionnée, je crée des tote bags et t-shirts imprimés à la main avec des encres naturelles.",
  ],
  decoration: [
    "Créateur d\'objets décoratifs en bois, métal et céramique. Mon atelier est un laboratoire d\'expériences.",
    "Je sélectionne des matériaux récupérés pour créer des pièces uniques qui habillent les intérieurs avec caractère.",
    "Formé en design d\'espace, je crée des objets décoratifs qui questionnent notre rapport aux choses simples.",
    "Tisserande et créatrice de macramés, j\'habille les murs avec des œuvres textiles inspirées du wabi-sabi.",
    "Du métal soufflé aux suspensions en corde, je crée des pièces décoratives qui transforment un espace ordinaire.",
  ],
  art: [
    "Peintre à l\'acrylique et à l\'aquarelle, j\'explore les paysages imaginaires et les architectures oniriques.",
    "Illustratrice indépendante, je travaille la linogravure et le cyanotype pour créer des œuvres en édition limitée.",
    "Peintre expressionniste, j\'explore la figure humaine à travers des portraits intenses aux couleurs vibrantes.",
    "Mes œuvres naissent d\'une intuition, d\'une lumière, d\'un moment. Je peins à l\'huile sur toile de lin.",
  ],
  papeterie: [
    "Créatrice de carnets artisanaux reliés à la main, chaque exemplaire est unique et conçu pour durer.",
    "Passionnée de papier, je crée des stickers, cartes et carnets illustrés qui rendent le quotidien plus joyeux.",
    "Ancienne libraire, je fabrique des carnets et agendas reliés en cuir ou en tissu, cousus main.",
    "Mes créations papeterie mêlent illustrations botaniques et typographie soignée pour un résultat élégant et poétique.",
  ],
};

const SHOPS = {
  ceramique: [
    { name: 'Terre & Cendres', description: 'Pièces en grès et grès chamotté façonnées à la main dans un atelier indépendant.' },
    { name: 'Argile & Co', description: 'Céramique du quotidien : mugs, bols, vases. Production de petite série artisanale.' },
    { name: 'La Poterie Sauvage', description: 'Objets en céramique bruts et naturels, inspirés des paysages..' },
    { name: 'Atelier Kaolin', description: 'Grès blanc, faÃ¯ence et porcelaine. Formés à Lyon, travaillons depuis Marseille.' },
    { name: 'Céramiques du Nord', description: 'Pièces utilitaires et décoratives, toutes cuites au four à bois.' },
    { name: 'Le Four Rond', description: 'Tournage et émaillage artisanal dans un atelier de Normandie.' },
    { name: 'Grès & Lumière', description: 'Céramique contemporaine avec des émaux naturels récoltés localement.' },
  ],
  poster: [
    { name: 'Studio Mural', description: 'Affiches sérigraphiées à la main, tirages limités signés.' },
    { name: 'Plein Cadre', description: 'Posters graphiques et typographiques imprimés sur papier coton épais.' },
    { name: 'Les Murs Parlent', description: 'Affiches illustrées en édition limitée pour décorer avec goÃ»t.' },
    { name: 'Papier Peint Club', description: 'Illustrations décoratives pour votre intérieur, imprimées en France.' },
    { name: 'La Galerie des Murs', description: 'Posters d\'artistes, du minimalisme à l\'expressionnisme graphique.' },
  ],
  bijoux: [
    { name: 'Ã‰clat Brut', description: 'Bijoux en argent sterling et pierres naturelles, faits à la main à Paris.' },
    { name: 'Métal & Mousse', description: 'Bijoux en laiton oxydé inspirés de la nature et des formes organiques.' },
    { name: 'Pépite Studio', description: 'Joaillerie contemporaine en or et argent recyclés. Chaque pièce est unique.' },
    { name: 'La Forge Dorée', description: 'Créations en métal martelé à la main. Délicates et robustes à la fois.' },
    { name: 'Minéral & Or', description: 'Pendentifs, bagues et colliers sertis de pierres brutes ou taillées.' },
  ],
  vetements: [
    { name: 'Lin & Liberté', description: 'Vêtements en lin naturel cousus main. Mode lente et durable.' },
    { name: 'Atelier Fil', description: 'T-shirts et tote bags à motifs sérigraphiés, produits en petite série.' },
    { name: 'La Couture Libre', description: 'Robes et vêtements féminins en matières naturelles, coupes intemporelles.' },
    { name: 'Brins de Fil', description: 'Pulls tricotés main, bonnets et écharpes en laine mérinos et alpaga.' },
  ],
  decoration: [
    { name: 'Bois & Âme', description: 'Objets décoratifs en bois massif récupéré. Unique et durable.' },
    { name: 'Maison Brute', description: 'Déco intérieure artisanale : bougies, coussins, suspensions.' },
    { name: 'Studio Wabi', description: 'Objets du quotidien inspirés de l\'esthétique japonaise wabi-sabi.' },
    { name: 'Les Fils du Vent', description: 'Macramés, suspensions et miroirs faits main pour embellir vos murs.' },
    { name: 'Lumière Douce', description: 'Bougies artisanales, bougeoirs et diffuseurs pour une atmosphère chaleureuse.' },
  ],
  art: [
    { name: 'Palette Libre', description: 'Peintures originales à l\'huile et à l\'acrylique, formats variés.' },
    { name: 'Encre & Chair', description: 'Illustrations originales, linogravures et estampes en édition limitée.' },
    { name: 'Aquarelle Sauvage', description: 'Peintures aquarelle sur papier coton fabriqué main.' },
    { name: 'Studio Clair-Obscur', description: 'Portraits à l\'huile, natures mortes et paysages expressionnistes.' },
  ],
  papeterie: [
    { name: 'Atelier Feuilles', description: 'Carnets reliés main, agendas et accessoires pour les amoureux de l\'écriture.' },
    { name: 'Le Petit Kiosque', description: 'Stickers, cartes illustrées et papeterie joyeuse pour le quotidien.' },
    { name: 'Papier & Plume', description: 'Papeterie fine : lettres illustrées, enveloppes et sets d\'écriture.' },
    { name: 'Studio Calligraphie', description: 'Carnets et cahiers illustrés à la plume, tirages numérotés.' },
  ],
};

// == Produits par catégorie ===================================================

const PRODUCTS = {
  ceramique: [
    { title: 'Bol en grès naturel', desc: 'Bol à céréales tourné à la main en grès chamotté, émail mat ivoire. Contenance 400ml.', pMin: 28, pMax: 45, stock: [3, 15] },
    { title: 'Mug artisanal bicolore', desc: 'Mug à café en grès avec anse confort, émail bicolore au trempage. Passe au lave-vaisselle.', pMin: 22, pMax: 38, stock: [5, 20],
      variants: [{ name: 'Couleur', options: [{ label: 'Terre', stock: 5, price: null, imageIndex: 0 }, { label: 'Océan', stock: 5, price: null, imageIndex: 1 }, { label: 'Forêt', stock: 4, price: null, imageIndex: 2 }, { label: 'Sable', stock: 4, price: null, imageIndex: 3 }] }] },
    { title: 'Vase colonne émail bleu', desc: 'Vase de table en grès, col étroit, émail bleu céladon lustré. Hauteur 22cm.', pMin: 48, pMax: 75, stock: [2, 8] },
    { title: 'Assiette à motifs géométriques', desc: 'Assiette plate en faÃ¯ence blanche, décorée à l\'engobe de motifs géométriques peints à la main.', pMin: 32, pMax: 55, stock: [4, 12] },
    { title: 'Pot à plantes grès rouge', desc: 'Pot à plantes en grès rouge brun, fond percé, émail intérieur beige. Diamètre 12cm.', pMin: 25, pMax: 40, stock: [5, 15] },
    { title: 'Théière en grès fumé', desc: 'Théière pour 2 personnes, 600ml, en grès fumé au four à bois. Filtre intégré.', pMin: 68, pMax: 95, stock: [2, 6] },
    { title: 'Tasse à espresso tournée', desc: 'Petite tasse à espresso en grès, 90ml, avec soucoupe assortie. Email ocre mat.', pMin: 18, pMax: 28, stock: [8, 25] },
    { title: 'Bol à soupe fond mat', desc: 'Grand bol à soupe ou bol à ramen en grès blanc, 700ml. Ã‰mail mat sable.', pMin: 30, pMax: 48, stock: [4, 12] },
    { title: 'Support à bagues céramique', desc: 'Petit support à bagues en forme de feuille, céramique blanche émaillée. Longueur 12cm.', pMin: 14, pMax: 22, stock: [10, 30] },
    { title: 'Pichet en faÃ¯ence ivoire', desc: 'Pichet de table 1L en faÃ¯ence ivoire, bec verseur large, anse confort.', pMin: 52, pMax: 70, stock: [3, 8] },
    { title: 'Set de 4 mugs assortis', desc: 'Coffret de 4 mugs en grès, même forme mais émaux différents : terre, océan, forêt, sable.', pMin: 75, pMax: 110, stock: [2, 5] },
    { title: 'Bol à dip façon shino', desc: 'Petit bol à mise en bouche ou dip, émail shino blanc rosé, traces de cuisson visibles.', pMin: 16, pMax: 24, stock: [8, 20] },
    { title: 'Vase aplati à bouches multiples', desc: 'Vase sculptural en grès avec trois ouvertures, pour compositions florales contemporaines.', pMin: 62, pMax: 88, stock: [2, 5] },
    { title: 'Carafe en céramique', desc: 'Carafe filtrante en grès cuit au four à bois. Le goulot en bois de hêtre est amovible.', pMin: 80, pMax: 120, stock: [2, 6] },
    { title: 'Plat de service ovale', desc: 'Grand plat à partager en grès, 35Ã—22cm, émail marbré bleu-vert.', pMin: 55, pMax: 80, stock: [2, 7] },
    { title: 'Bol enfant avec oreilles', desc: 'Bol pour enfant en céramique blanche avec petites oreilles, sécurisé four et lave-vaisselle.', pMin: 20, pMax: 32, stock: [6, 15] },
    { title: 'Coupelle à sel céramique', desc: 'Petite coupelle à sel ou à épices, 8cm de diamètre, céramique blanche émail satiné.', pMin: 10, pMax: 16, stock: [10, 25] },
    { title: 'Chandelier en grès torsadé', desc: 'Chandelier pour bougie cylindrique, grès torsadé à la main, hauteur 10cm.', pMin: 22, pMax: 34, stock: [5, 12] },
  ],
  poster: [
    { title: 'Affiche "La Montagne" â€“ A3', desc: 'Impression risographie bicolore sur papier vergé 300g. Edition limitée à 50 exemplaires numérotés.', pMin: 20, pMax: 35, stock: [10, 30] },
    { title: 'Poster botanique "Monstera"', desc: 'Illustration botanique détaillée, impression jet d\'encre sur papier coton 250g. Format 40Ã—50cm.', pMin: 25, pMax: 40, stock: [15, 40] },
    { title: 'Affiche typographique "Lundi Matin"', desc: 'Citation illustrée en typographie Bauhaus, impression offset sur papier matte 200g. A2.', pMin: 18, pMax: 28, stock: [20, 50] },
    { title: 'Poster Paris â€“ vue aérienne', desc: 'Vue stylisée de Paris depuis les airs, lignes fines noires sur fond blanc cassé. A2.', pMin: 22, pMax: 38, stock: [10, 25] },
    { title: 'Impression "Aurore Boréale"', desc: 'Composition abstraite aux couleurs de l\'aurore boréale, imprimée en sérigraphie 3 passes. A2.', pMin: 30, pMax: 50, stock: [8, 20] },
    { title: 'Affiche minimaliste "Café"', desc: 'Illustration minimaliste d\'une tasse de café, lignes épurées. Impression numérique A3.', pMin: 15, pMax: 22, stock: [20, 50] },
    { title: 'Poster géographique France', desc: 'Carte de France illustrée avec des régions colorées, style rétro, impression lithographique. A2.', pMin: 28, pMax: 42, stock: [12, 30] },
    { title: 'Affiche "Solstice d\'été"', desc: 'Illustration solaire aux tons chauds, sérigraphie 4 couleurs sur papier naturel. 50Ã—70cm.', pMin: 35, pMax: 55, stock: [6, 15] },
    { title: 'Print "Mélancolie architecturale"', desc: 'Dessin à la plume numérisé d\'une architecture brutaliste, impression pigment A3.', pMin: 22, pMax: 36, stock: [8, 20] },
    { title: 'Poster voyage "Kyoto"', desc: 'Illustration de ruelle japonaise au pinceau, tons pastels, impression sur papier japonais. A3.', pMin: 28, pMax: 45, stock: [10, 25] },
    { title: 'Affiche "Bonjour" typographique', desc: 'Lettering à la plume, "Bonjour" en grandes lettres fleuries. Edition numérotée 30ex. A3.', pMin: 20, pMax: 32, stock: [15, 30] },
    { title: 'Poster faune "Renard"', desc: 'Illustration de renard au trait fin, émail de couleurs douces. Impression offset A2.', pMin: 24, pMax: 38, stock: [10, 25] },
    { title: 'Affiche astronomique "Saturne"', desc: 'Gravure de Saturne et ses anneaux, style scientifique du XIXe siècle. Impression A3 papier vergé.', pMin: 22, pMax: 34, stock: [12, 30] },
    { title: 'Print "Liberté" en sérigraphie', desc: 'Composition typographique autour du mot Liberté, 3 couleurs sérigraphiées. 40Ã—60cm.', pMin: 32, pMax: 48, stock: [8, 18] },
  ],
  bijoux: [
    { title: 'Collier chaîne serpent argent 925', desc: 'Collier chaîne serpent en argent sterling 925, longueur 45cm. Fermeture mousqueton.', pMin: 38, pMax: 58, stock: [5, 20] },
    { title: 'Boucles d\'oreilles créoles laiton', desc: 'Grandes créoles martelées en laiton doré, diamètre 4cm. Hypoallergéniques.', pMin: 22, pMax: 35, stock: [8, 25] },
    { title: 'Bague ajustable quartz rose', desc: 'Bague en argent 925 sertie d\'un quartz rose brut, taille ajustable.', pMin: 32, pMax: 52, stock: [5, 15] },
    { title: 'Pendentif lune argent', desc: 'Pendentif lune croissante en argent sterling, finition brossée. Chaîne non incluse.', pMin: 28, pMax: 42, stock: [6, 20] },
    { title: 'Bracelet jonc martelé laiton', desc: 'Jonc rigide en laiton martelé à la main, finition dorée. Diamètre interne 6cm.', pMin: 25, pMax: 40, stock: [6, 18] },
    { title: 'Collier perles de verre bohème', desc: 'Collier multi-rangs en perles de verre tchèques, tons neutres ivoire et taupe. 40cm.', pMin: 30, pMax: 48, stock: [5, 15] },
    { title: 'Boucles d\'oreilles asymétriques', desc: 'Paire asymétrique : un anneau et un pendentif, argent 925. Minimaliste et moderne.', pMin: 28, pMax: 45, stock: [5, 12] },
    { title: 'Anneau texturé en or 9K', desc: 'Anneau fin en or 9 carats avec texture naturaliste inspirée de l\'écorce. Taille au choix.', pMin: 65, pMax: 95, stock: [3, 8],
      variants: [{ name: 'Taille', options: [{ label: '50', stock: 2, price: null }, { label: '52', stock: 2, price: null }, { label: '54', stock: 2, price: null }, { label: '56', stock: 1, price: null }, { label: '58', stock: 1, price: null }] }] },
    { title: 'Collier diamant brut pendentif', desc: 'Pendentif en argent 925 serti d\'un diamant brut naturel non traité. Chaîne 42cm incluse.', pMin: 85, pMax: 130, stock: [2, 6] },
    { title: 'Parure collier + boucles labradorite', desc: 'Parure complète en laiton et labradorite : collier 45cm + boucles d\'oreilles pendantes.', pMin: 72, pMax: 105, stock: [2, 6] },
    { title: 'Bracelet jonc argent petites étoiles', desc: 'Jonc en argent 925 orné de petites étoiles frappées à chaud. Taille ajustable.', pMin: 34, pMax: 52, stock: [6, 18] },
    { title: 'Boucles puces turquoise', desc: 'Petites puces décorées d\'une turquoise naturelle en cabochon, monture argent.', pMin: 22, pMax: 34, stock: [8, 22] },
    { title: 'Collier sautoir perles mate', desc: 'Long sautoir 80cm en perles de céramique mates, coloris neutres, fermoir à vis.', pMin: 40, pMax: 62, stock: [4, 12] },
    { title: 'Bague chevalière gravée', desc: 'Chevalière en argent 925, plateau carré 12mm, gravure motif géométrique à la main.', pMin: 55, pMax: 80, stock: [3, 8],
      variants: [{ name: 'Taille', options: [{ label: '50', stock: 2, price: null }, { label: '52', stock: 2, price: null }, { label: '54', stock: 2, price: null }, { label: '56', stock: 1, price: null }, { label: '58', stock: 1, price: null }] }] },
    { title: 'Chaîne cheville argent', desc: 'Chaîne de cheville en argent 925, longueur 24cm ajustable, avec breloque coquillage.', pMin: 28, pMax: 42, stock: [6, 18] },
    { title: 'Pendentif céramique et laiton', desc: 'Pendentif original associant une pastille de céramique faite main à une monture en laiton brut.', pMin: 32, pMax: 50, stock: [4, 12] },
  ],
  vetements: [
    { title: 'T-shirt sérigraphié "Forêt"', desc: 'T-shirt unisexe en coton bio 180g, sérigraphie végétale à l\'encre à l\'eau. Tailles XS-XL.', pMin: 28, pMax: 42, stock: [10, 30],
      variants: [{ name: 'Taille', options: [{ label: 'XS', stock: 3, price: null }, { label: 'S', stock: 5, price: null }, { label: 'M', stock: 6, price: null }, { label: 'L', stock: 4, price: null }, { label: 'XL', stock: 2, price: null }] }] },
    { title: 'Tote bag illustré botanique', desc: 'Tote bag en coton naturel épais, illustration botanique sérigraphiée à la main. 38×42cm.', pMin: 18, pMax: 28, stock: [15, 40] },
    { title: 'Pull col rond laine mérinos', desc: 'Pull tricoté à la main en laine mérinos superwash. Col rond, coupe loose. Tailles S-XL.', pMin: 95, pMax: 145, stock: [3, 8],
      variants: [{ name: 'Taille', options: [{ label: 'S', stock: 2, price: null }, { label: 'M', stock: 3, price: null }, { label: 'L', stock: 2, price: null }, { label: 'XL', stock: 1, price: null }] }] },
    { title: 'Robe en lin naturel', desc: 'Robe midi en lin naturel non teint, col V, manches courtes. Couture à la main. Tailles 36-44.', pMin: 88, pMax: 128, stock: [3, 8],
      variants: [{ name: 'Taille', options: [{ label: '36', stock: 1, price: null }, { label: '38', stock: 2, price: null }, { label: '40', stock: 2, price: null }, { label: '42', stock: 2, price: null }, { label: '44', stock: 1, price: null }] }] },
    { title: 'Casquette brodée "Craftea"', desc: 'Casquette dad hat en coton bio, broderie "Craft" en fil beige. Taille unique ajustable.', pMin: 22, pMax: 32, stock: [8, 20] },
    { title: 'Cardigan grosses mailles alpaga', desc: 'Cardigan oversized tricoté en alpaga doux, boutons en bois de noyer. Tailles S-XL.', pMin: 120, pMax: 175, stock: [2, 6],
      variants: [{ name: 'Taille', options: [{ label: 'S', stock: 1, price: null }, { label: 'M', stock: 2, price: null }, { label: 'L', stock: 2, price: null }, { label: 'XL', stock: 1, price: null }] }] },
    { title: 'Sweat brodé à la main "Soleil"', desc: 'Sweat molleton coton bio avec broderie solaire faite à la main sur le devant.', pMin: 58, pMax: 82, stock: [4, 10],
      variants: [{ name: 'Taille', options: [{ label: 'S', stock: 2, price: null }, { label: 'M', stock: 3, price: null }, { label: 'L', stock: 2, price: null }, { label: 'XL', stock: 1, price: null }] }] },
    { title: 'Jupe plissée en lin', desc: 'Jupe longue plissée en lin lavé, taille élastique, coloris écru.', pMin: 68, pMax: 95, stock: [3, 8],
      variants: [{ name: 'Taille', options: [{ label: '36', stock: 1, price: null }, { label: '38', stock: 2, price: null }, { label: '40', stock: 2, price: null }, { label: '42', stock: 2, price: null }, { label: '44', stock: 1, price: null }] }] },
    { title: 'Bonnet tricoté laine épaisse', desc: 'Bonnet chaud en laine épaisse naturelle non traitée. Point côtes 2/2. Taille unique.', pMin: 35, pMax: 52, stock: [6, 15],
      variants: [{ name: 'Couleur', options: [{ label: 'Naturel', stock: 4, price: null, imageIndex: 0 }, { label: 'Gris chiné', stock: 3, price: null, imageIndex: 1 }, { label: 'Noir', stock: 3, price: null, imageIndex: 2 }, { label: 'Terracotta', stock: 2, price: null, imageIndex: 3 }] }] },
    { title: 'Tote bag cyanotype unique', desc: 'Tote bag coton naturel avec impression cyanotype unique réalisée au soleil. Pièce unique.', pMin: 32, pMax: 48, stock: [3, 8] },
  ],
  decoration: [
    { title: 'Bougeoir en bois flotté', desc: 'Bougeoir sculpté dans un morceau de bois flotté de la cÃ´te Atlantique. Pour bougie chauffe-plat.', pMin: 18, pMax: 28, stock: [5, 15] },
    { title: 'Miroir rond cadre macramé', desc: 'Miroir diamètre 30cm, cadre en corde de coton naturel tressée à la main. Suspension incluse.', pMin: 55, pMax: 82, stock: [3, 8] },
    { title: 'Suspension macramé coton brut', desc: 'Grande suspension murale en macramé coton naturel. 80cm de hauteur, 45cm de large.', pMin: 45, pMax: 68, stock: [4, 10] },
    { title: 'Bougie soja parfumée miel et cire', desc: 'Bougie artisanale en cire de soja naturelle, parfum miel de thym et cire d\'abeille. 200g.', pMin: 18, pMax: 28, stock: [10, 25],
      variants: [{ name: 'Parfum', options: [{ label: 'Miel de thym', stock: 6, price: null, imageIndex: 0 }, { label: 'Lavande', stock: 6, price: null, imageIndex: 1 }, { label: 'Bois de cèdre', stock: 5, price: null, imageIndex: 2 }, { label: 'Agrumes', stock: 5, price: null, imageIndex: 3 }] }] },
    { title: 'Plateau en chêne huilé', desc: 'Plateau de service ou décoratif en chêne massif huilé avec huile de lin naturelle. 30Ã—20cm.', pMin: 38, pMax: 58, stock: [4, 12] },
    { title: 'Mobile décoratif feuilles de laiton', desc: 'Mobile fenêtre en laiton brossé avec 7 feuilles découpées à la main. Fil de lin.', pMin: 35, pMax: 55, stock: [3, 8] },
    { title: 'Diffuseur de parfum en céramique', desc: 'Diffuseur d\'huiles essentielles en céramique blanche non émaillée, avec 10 bÃ¢tonnets.', pMin: 28, pMax: 42, stock: [6, 15] },
    { title: 'Cadre photo en rotin naturel', desc: 'Cadre photo 15Ã—20cm monté en rotin naturel, format portrait ou paysage. Fond en lin.', pMin: 22, pMax: 34, stock: [5, 12] },
    { title: 'Coussin brodé main "Feuilles"', desc: 'Coussin 40×40cm, coton naturel brodé à la main avec motif végétal, garnissage en kapok.', pMin: 55, pMax: 80, stock: [3, 8],
      variants: [{ name: 'Couleur', options: [{ label: 'Naturel', stock: 3, price: null, imageIndex: 0 }, { label: 'Sauge', stock: 3, price: null, imageIndex: 1 }, { label: 'Terracotta', stock: 3, price: null, imageIndex: 2 }] }] },
    { title: 'Panier tressé herbe marine', desc: 'Panier de rangement tressé à la main en herbe marine naturelle. 25cm de diamètre.', pMin: 28, pMax: 42, stock: [4, 12] },
    { title: 'Vase en verre soufflé bouche', desc: 'Vase réalisé par soufflage à la bouche, forme organique, verre légèrement teinté fumé.', pMin: 48, pMax: 72, stock: [2, 6] },
    { title: 'Set de 3 bougies colorées', desc: 'Trio de bougies végétales colorées : terracotta, sauge et écru. Mèche en coton.', pMin: 32, pMax: 48, stock: [6, 15] },
    { title: 'Lampe de chevet en grès', desc: 'Base de lampe en grès céramique, livrée sans abat-jour. CÃ¢ble en tissu coton, douille E14.', pMin: 75, pMax: 110, stock: [2, 5] },
  ],
  art: [
    { title: 'Aquarelle originale "Brume de mer"', desc: 'Peinture aquarelle originale sur papier coton 300g. Format 30Ã—40cm. Signée, avec certificat d\'authenticité.', pMin: 85, pMax: 140, stock: [1, 3] },
    { title: 'Linogravure "Nuit de lune"', desc: 'Estampe originale en linogravure noire sur papier japonais, 20Ã—28cm. Edition de 12.', pMin: 45, pMax: 68, stock: [2, 8] },
    { title: 'Huile sur toile "Portrait rouge"', desc: 'Peinture à l\'huile sur toile de lin, 50Ã—60cm. Portrait expressionniste. Œuvre unique, signée.', pMin: 280, pMax: 420, stock: [1, 1] },
    { title: 'Dessin au fusain "Forêt endormie"', desc: 'Dessin original au fusain et craie blanche sur papier teint, 42Ã—60cm. Encadrement possible.', pMin: 95, pMax: 145, stock: [1, 2] },
    { title: 'Cyanotype "Herbier bleu"', desc: 'Cyanotype original réalisé au soleil avec des plantes séchées. 21Ã—29.7cm sur papier aquarelle.', pMin: 38, pMax: 58, stock: [2, 8] },
    { title: 'Acrylique "Coucher de soleil urbain"', desc: 'Peinture acrylique sur toile, 40Ã—40cm. Atmosphères de ville au crépuscule, couleurs vives.', pMin: 120, pMax: 185, stock: [1, 2] },
    { title: 'Gravure sur bois "Géométrie sacrée"', desc: 'Xylographie en noir sur papier Rives 250g, 15Ã—15cm. Edition de 20, numérotée et signée.', pMin: 35, pMax: 55, stock: [3, 8] },
    { title: 'Monotype "Arbre dans le brouillard"', desc: 'Monotype unique, encre noire sur papier aquarelle, 30Ã—40cm. Technique du lissage à froid.', pMin: 65, pMax: 95, stock: [1, 3] },
    { title: 'Sérigraphie "Abstraite #7"', desc: 'Sérigraphie 3 couleurs sur papier vergé 250g, 40Ã—50cm. Edition de 15, signée et numérotée.', pMin: 52, pMax: 78, stock: [3, 8] },
    { title: 'Aquarelle "Jardin secret"', desc: 'Aquarelle botanique originale sur papier 300g. Fleurs et feuillages. 24Ã—32cm, signée.', pMin: 72, pMax: 105, stock: [1, 3] },
    { title: 'Encre de chine "Calligraphie Silence"', desc: 'Œuvre originale à l\'encre de Chine, le mot Silence écrit en écriture automatique libre.', pMin: 55, pMax: 80, stock: [1, 2] },
    { title: 'Pastel sec "Plage en hiver"', desc: 'Paysage au pastel sec sur papier Canson, 29.7Ã—42cm. Tons doux, sablés et bleus froids.', pMin: 80, pMax: 120, stock: [1, 2] },
  ],
  papeterie: [
    { title: 'Carnet A5 couverture lin', desc: 'Carnet A5 relié à la main, couverture en lin naturel ciré, 160 pages papier crème 80g.', pMin: 18, pMax: 28, stock: [10, 30] },
    { title: 'Set de 10 cartes illustrées', desc: 'Coffret de 10 cartes postales illustrées à la main sur papier 300g. Thème botanique.', pMin: 14, pMax: 22, stock: [15, 40] },
    { title: 'Stickers botaniques â€“ planche A5', desc: 'Planche de 30 stickers botaniques dessinés à la main, plastifiés mat. A5.', pMin: 8, pMax: 14, stock: [20, 60] },
    { title: 'Cahier illustré "Saisons"', desc: 'Cahier A5 broché, couverture illustrée à quatre saisons, papier intérieur ivoire 90g. 96 pages.', pMin: 12, pMax: 18, stock: [12, 35] },
    { title: 'Carnet de voyage cuir', desc: 'Carnet de voyage en cuir pleine fleur tanné végétal, format A6, 192 pages papier banane.', pMin: 35, pMax: 52, stock: [5, 15] },
    { title: 'Set de papier à lettres fleuri', desc: 'Coffret 20 feuilles A5 + 10 enveloppes, papier vélin 120g avec motifs floraux gravés.', pMin: 12, pMax: 18, stock: [10, 25] },
    { title: 'Agenda perpétuel illustré', desc: 'Agenda perpétuel sans date en A5, couverture riso-graphiée, papier PEFC 100g.', pMin: 22, pMax: 32, stock: [8, 20] },
    { title: 'Lot de marque-pages botaniques', desc: 'Set de 5 marque-pages en papier aquarelle 300g, illustrations botaniques peintes à la main.', pMin: 10, pMax: 16, stock: [12, 30] },
    { title: 'Stickers planètes â€“ planche A5', desc: 'Planche de 24 stickers planètes et étoiles, style dessiné à la main, fond mat.', pMin: 8, pMax: 14, stock: [15, 40] },
    { title: 'Mini carnet 10Ã—10 coton', desc: 'Mini carnet carré en tissu coton imprimé, 64 pages blanches. Format 10Ã—10cm.', pMin: 9, pMax: 15, stock: [10, 30] },
    { title: 'Calendrier mural illustré A3', desc: 'Calendrier mural 12 pages A3 avec illustrations originales, impression risographie. Année en cours.', pMin: 18, pMax: 28, stock: [8, 20] },
    { title: 'Pack cartes de vœux "Merci"', desc: 'Set de 6 cartes "Merci" avec enveloppes assorties, impressions dorées à chaud sur papier 300g.', pMin: 12, pMax: 18, stock: [10, 25] },
  ],
};

const TAGS = [
  'fait-main', 'artisanal', 'unique', 'naturel', 'éco-responsable',
  'recyclé', 'local', 'édition-limitée', 'signé', 'numéroté',
  'cadeau', 'personnalisable', 'contemporain', 'minimaliste', 'bohème',
  'vintage', 'scandinave', 'wabi-sabi', 'nature', 'géométrique',
];

const TAGS_BY_CATEGORY = {
  ceramique:  ['fait-main', 'artisanal', 'naturel', 'unique', 'wabi-sabi'],
  poster:     ['édition-limitée', 'signé', 'numéroté', 'minimaliste', 'contemporain'],
  bijoux:     ['fait-main', 'unique', 'naturel', 'cadeau', 'personnel isable'],
  vetements:  ['fait-main', 'artisanal', 'éco-responsable', 'naturel', 'local'],
  decoration: ['fait-main', 'naturel', 'bohème', 'minimaliste', 'wabi-sabi'],
  art:        ['unique', 'signé', 'édition-limitée', 'contemporain', 'naturel'],
  papeterie:  ['fait-main', 'cadeau', 'naturel', 'minimaliste', 'artisanal'],
};

const BUYERS_DATA = [
  { firstname: 'Sophie',    lastname: 'Arnaud',     email: 'sophie.arnaud@craftea.dev' },
  { firstname: 'Lucas',     lastname: 'Perrin',     email: 'lucas.perrin@craftea.dev' },
  { firstname: 'Isabelle',  lastname: 'Collin',     email: 'isabelle.collin@craftea.dev' },
  { firstname: 'Nathan',    lastname: 'Brunet',     email: 'nathan.brunet@craftea.dev' },
  { firstname: 'Élise',     lastname: 'Mercier',    email: 'elise.mercier@craftea.dev' },
  { firstname: 'Théo',      lastname: 'Guerin',     email: 'theo.guerin@craftea.dev' },
  { firstname: 'Nathalie',  lastname: 'Jacquet',    email: 'nathalie.jacquet@craftea.dev' },
  { firstname: 'Clément',   lastname: 'Picard',     email: 'clement.picard@craftea.dev' },
  { firstname: 'Lucie',     lastname: 'Bourgeois',  email: 'lucie.bourgeois@craftea.dev' },
  { firstname: 'Yann',      lastname: 'Carpentier', email: 'yann.carpentier@craftea.dev' },
  { firstname: 'Béatrice',  lastname: 'Lemaire',    email: 'beatrice.lemaire@craftea.dev' },
  { firstname: 'Quentin',   lastname: 'Denis',      email: 'quentin.denis@craftea.dev' },
];

const REVIEW_COMMENTS = {
  ceramique: [
    'Superbe pièce, exactement comme sur les photos. La texture du grès est magnifique.',
    'Livraison soignée, emballage parfait. La céramique est de très belle qualité.',
    "J'utilise ce bol chaque matin, il est devenu indispensable. Merci !",
    "Artisanat remarquable, on sent vraiment le travail à la main. Je recommande.",
    "La pièce est encore plus belle en vrai. L'émail est sublime.",
    'Parfait pour un cadeau, ma mère a adoré. Très beau travail.',
    'Qualité exceptionnelle, la cuisson est parfaite. Bravo à l\'artiste !',
    'Troisième commande chez cet artiste, toujours aussi satisfaite.',
    'Le rendu de l\'émail est bluffant. Une vraie pièce de collection.',
    'Rapport qualité/prix imbattable pour de l\'artisanat de cette qualité.',
  ],
  poster: [
    "L'affiche est encore plus belle que sur l'écran. Les couleurs sont fidèles.",
    'Impression de qualité, le papier est épais et le rendu est net. Très satisfait.',
    'Encadré et accroché, il habille parfaitement mon salon. Merci !',
    'Emballage sécurisé, pas un pli à la réception. Commande parfaite.',
    'Le minimalisme de cette affiche est exactement ce que je cherchais.',
    'Tirage limité et numéroté, c\'est un vrai plus. Belle pièce.',
    'Cadeau apprécié, mes amis ont tous voulu savoir où je l\'avais trouvé.',
    'La qualité d\'impression est au rendez-vous. Couleurs vives et papier solide.',
    'Très beau travail graphique, l\'affiche apporte du caractère à la pièce.',
    'Deuxième commande, toujours aussi satisfait de la qualité.',
  ],
  bijoux: [
    'Bijou magnifique, exactement comme décrit. Je l\'adore !',
    'Très belle finition, le métal est solide et la pierre est superbe.',
    'Je le porte tous les jours depuis la réception, parfait en termes de confort.',
    'Emballage cadeau soigné, idéal pour offrir. Très beau bijou.',
    'La qualité de l\'argent est irréprochable. Beau travail artisanal.',
    'Exactement comme sur les photos, voire encore plus beau en vrai.',
    'J\'ai reçu beaucoup de compliments, tout le monde me demande d\'où il vient !',
    'Quatrième achat chez cet artiste, fidèle au poste. Toujours au top.',
    'La pierre est magnifique, bien sertie. Un vrai bijou fait main.',
    'Léger et confortable à porter, je suis ravie de mon achat.',
  ],
  vetements: [
    'Le tissu est doux et de bonne qualité. La coupe est parfaite.',
    'Conforme à la description, la finition est soignée. Je recommande.',
    'Je l\'ai lavé plusieurs fois, il ne perd pas sa forme. Top qualité.',
    'La sérigraphie est bien accrochée, même après plusieurs lavages.',
    'Très beau vêtement artisanal, on sent que c\'est fait avec soin.',
    'Taille conforme au guide, livraison rapide. Très contente.',
    'Le lin est magnifique, il tombe très bien. J\'en recommanderai.',
    'Superbe pull, la laine est douce et chaude sans piquer.',
    'Belle pièce intemporelle qui s\'associe avec tout dans mon dressing.',
    'Artisanat de qualité, on voit clairement le soin apporté à chaque pièce.',
  ],
  decoration: [
    'Très bel objet décoratif, il apporte exactement l\'ambiance que je voulais.',
    'La qualité des matériaux est excellente. Un vrai bel objet.',
    'Livré avec soin, rien n\'a bougé pendant le transport. Parfait.',
    'Le rendu dans ma pièce est exactement ce que j\'espérais.',
    'Objet unique et original, j\'adore avoir quelque chose de vraiment artisanal chez moi.',
    'La bougie sent merveilleusement bon et la flamme est stable. Bravo.',
    'Le macramé est encore plus grand et travaillé que sur la photo.',
    'Belle pièce sobre et élégante qui s\'intègre parfaitement dans mon intérieur.',
    'Je suis bluffée par la qualité du bois et le soin apporté aux détails.',
    'Cadeau très apprécié, tout le monde a remarqué l\'objet chez moi.',
  ],
  art: [
    'Œuvre encore plus saisissante en vrai. Les couleurs sont vibrantes.',
    'Emballage professionnel avec coin renforcé. L\'œuvre est arrivée parfaite.',
    'Accrochée dans mon bureau, elle attire tous les regards. Magnifique.',
    'L\'artiste a une vraie sensibilité, on ressent l\'émotion dans chaque trait.',
    'Certificat d\'authenticité inclus, c\'est un vrai plus pour une pièce unique.',
    'Belle qualité du papier et de l\'encre, l\'estampe est d\'une grande finesse.',
    'Je cherchais une œuvre originale depuis longtemps, je suis comblée.',
    'Technique maîtrisée et résultat bluffant. Je recommande cet artiste.',
    'L\'aquarelle est lumineuse et délicate à la fois. Un vrai coup de cœur.',
    'Pièce encadrée et accrochée, elle transforme complètement la pièce.',
  ],
  papeterie: [
    'Le carnet est solide et très bien relié. J\'adore l\'utiliser chaque jour.',
    'Les illustrations sont mignonnes et la qualité du papier est top.',
    'Les stickers tiennent bien, ils ne se décollent pas facilement. Parfait.',
    'Cadeau idéal pour les amateurs de papeterie. Ma collègue a adoré.',
    'Le papier est épais et agréable à écrire dessus. Très satisfaite.',
    'L\'agenda est pratique et beau à la fois. Je l\'emporte partout.',
    'Travail soigné, les illustrations sont fines et détaillées.',
    'Emballage cadeau soigné, même les enveloppes sont jolies.',
    'J\'ai offert le set de cartes, elles ont eu un grand succès. À recommander.',
    'Rapport qualité/prix excellent pour de la papeterie artisanale.',
  ],
};

const LOCATIONS = [
  'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Strasbourg',
  'Nantes', 'Lille', 'Rennes', 'Montpellier', 'Nice', 'Grenoble',
  'Aix-en-Provence', 'Annecy', 'Bayonne', 'Périgueux', 'Uzès', 'Vannes',
];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MAIN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function main() {
  console.log('ðŸŒ± Connexion aux bases de données...');
  await Promise.all([usersDb.connect(), artistsDb.connect(), catalogDb.connect(), interactionsDb.connect()]);
  console.log('✅ Connecté\n');
  console.log('âœ… Connecté\n');

  try {
    // == 1. TAGS =============================================================
    console.log('ðŸ·ï¸  Insertion des tags...');
    const tagIds = {};
    for (const tagName of TAGS) {
      const res = await catalogDb.query(
        `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [tagName]
      );
      tagIds[tagName] = res.rows[0].id;
    }
    console.log(`   â†’ ${Object.keys(tagIds).length} tags\n`);

    // == 2. CATEGORIES (ensure IDs match) ====================================
    console.log('ðŸ“‚ Vérification des catégories...');
    const catRes = await catalogDb.query(`SELECT id, name FROM categories ORDER BY id`);
    const categoryIds = {};
    for (const row of catRes.rows) {
      const key = row.name.toLowerCase()
        .replace('céramique', 'ceramique')
        .replace('poster', 'poster')
        .replace('bijoux', 'bijoux')
        .replace('vêtements', 'vetements')
        .replace('décoration', 'decoration')
        .replace('art & illustrations', 'art')
        .replace('papeterie', 'papeterie');
      categoryIds[key] = row.id;
    }
    console.log('   Catégories trouvées :', categoryIds);

    // Complete any missing categories
    const catMap = {
      ceramique:  { name: 'Céramique',         icon: 'Package', desc: 'Objets en céramique artisanale' },
      poster:     { name: 'Poster',             icon: 'Package', desc: 'Affiche dont l\'objectif est la décoration' },
      bijoux:     { name: 'Bijoux',             icon: 'Diamond', desc: 'Créations artisanales : colliers, bagues, bracelets faits main.' },
      vetements:  { name: 'Vêtements',          icon: 'Tshirt',  desc: 'Mode artisanale, vêtements uniques et personnalisés.' },
      decoration: { name: 'Décoration',         icon: 'Home',    desc: 'Objets décoratifs pour la maison faits main.' },
      art:        { name: 'Art & Illustrations', icon: 'Palette', desc: 'Peintures, dessins, affiches et œuvres originales.' },
      papeterie:  { name: 'Papeterie',          icon: 'Notebook',desc: 'Carnets, cartes, stickers et fournitures créatives.' },
    };
    for (const [key, cat] of Object.entries(catMap)) {
      if (!categoryIds[key]) {
        const r = await catalogDb.query(
          `INSERT INTO categories (name, icon, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET icon=EXCLUDED.icon RETURNING id`,
          [cat.name, cat.icon, cat.desc]
        );
        categoryIds[key] = r.rows[0].id;
        console.log(`   + Catégorie créée : ${cat.name} (${r.rows[0].id})`);
      }
    }
    console.log();

    // == 3. USERS =============================================================
    console.log('ðŸ‘¤ Insertion des utilisateurs artistes...');
    const insertedUsers = [];
    for (const u of USERS_DATA) {
      const existing = await usersDb.query(`SELECT id FROM users WHERE email = $1`, [u.email]);
      if (existing.rows.length > 0) {
        insertedUsers.push({ ...u, id: existing.rows[0].id });
        process.stdout.write('.');
        continue;
      }
      const res = await usersDb.query(
        `INSERT INTO users (role, firstname, lastname, email, password, is_active)
         VALUES ('artist', $1, $2, $3, $4, true)
         RETURNING id`,
        [u.firstname, u.lastname, u.email, PASSWORD_HASH]
      );
      insertedUsers.push({ ...u, id: res.rows[0].id });
      process.stdout.write('+');
    }
    console.log(`\n   â†’ ${insertedUsers.length} utilisateurs\n`);

    // == 4. ARTIST PROFILES ===================================================
    console.log('ðŸŽ¨ Insertion des profils artistes...');
    const insertedProfiles = [];
    for (const u of insertedUsers) {
      const bios = BIOS[u.specialty] || BIOS.ceramique;
      const bio = rand(bios);

      const existing = await artistsDb.query(`SELECT id FROM artist_profiles WHERE user_id = $1`, [u.id]);
      if (existing.rows.length > 0) {
        insertedProfiles.push({ userId: u.id, profileId: existing.rows[0].id, specialty: u.specialty });
        process.stdout.write('.');
        continue;
      }
      const res = await artistsDb.query(
        `INSERT INTO artist_profiles (user_id, bio, validated, validation_status)
         VALUES ($1, $2, true, 'approved')
         RETURNING id`,
        [u.id, bio]
      );
      insertedProfiles.push({ userId: u.id, profileId: res.rows[0].id, specialty: u.specialty });
      process.stdout.write('+');
    }
    console.log(`\n   â†’ ${insertedProfiles.length} profils artistes\n`);

    // == 5. SHOPS =============================================================
    console.log('ðŸª Insertion des boutiques...');
    const insertedShops = [];
    for (const profile of insertedProfiles) {
      const shopList = SHOPS[profile.specialty] || SHOPS.ceramique;
      // Each artist gets 1 or 2 shops
      const numShops = Math.random() > 0.45 ? 2 : 1;
      const chosenShops = [];
      const available = [...shopList];
      for (let i = 0; i < numShops && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        chosenShops.push(available.splice(idx, 1)[0]);
      }

      for (const shop of chosenShops) {
        const existing = await artistsDb.query(
          `SELECT id FROM shops WHERE artist_id = $1 AND name = $2`,
          [profile.profileId, shop.name]
        );
        if (existing.rows.length > 0) {
          insertedShops.push({ shopId: existing.rows[0].id, specialty: profile.specialty });
          process.stdout.write('.');
          continue;
        }
        const location = rand(LOCATIONS);
        const res = await artistsDb.query(
          `INSERT INTO shops (artist_id, name, description, location)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [profile.profileId, shop.name, shop.description, location]
        );
        insertedShops.push({ shopId: res.rows[0].id, specialty: profile.specialty });
        process.stdout.write('+');
      }
    }
    console.log(`\n   â†’ ${insertedShops.length} boutiques\n`);

    // == 6. SHIPPING PROFILES =================================================
    console.log('🚚 Insertion des profils de livraison...');
    let shippingCount = 0;
    for (const shop of insertedShops) {
      // France : toujours présent
      await artistsDb.query(
        `INSERT INTO shop_shipping_profiles (shop_id, zone, base_fee, additional_item_fee, free_shipping_threshold)
         VALUES ($1, 'france', $2, $3, $4)
         ON CONFLICT (shop_id, zone) DO NOTHING`,
        [shop.shopId, (range(390, 690) / 100).toFixed(2), (range(50, 150) / 100).toFixed(2), range(0, 1) ? (range(5000, 8000) / 100).toFixed(2) : null]
      );
      shippingCount++;

      // Europe : ~60 % des boutiques
      if (Math.random() < 0.6) {
        await artistsDb.query(
          `INSERT INTO shop_shipping_profiles (shop_id, zone, base_fee, additional_item_fee, free_shipping_threshold)
           VALUES ($1, 'europe', $2, $3, NULL)
           ON CONFLICT (shop_id, zone) DO NOTHING`,
          [shop.shopId, (range(790, 1290) / 100).toFixed(2), (range(150, 300) / 100).toFixed(2)]
        );
        shippingCount++;
      }

      // Monde : ~25 % des boutiques
      if (Math.random() < 0.25) {
        await artistsDb.query(
          `INSERT INTO shop_shipping_profiles (shop_id, zone, base_fee, additional_item_fee, free_shipping_threshold)
           VALUES ($1, 'world', $2, $3, NULL)
           ON CONFLICT (shop_id, zone) DO NOTHING`,
          [shop.shopId, (range(1290, 1990) / 100).toFixed(2), (range(200, 400) / 100).toFixed(2)]
        );
        shippingCount++;
      }

      process.stdout.write('+');
    }
    console.log(`\n   → ${shippingCount} profils de livraison\n`);

    // == 7. PRODUCTS ==========================================================
    console.log('ðŸ“¦ Insertion des produits...');
    let productCount = 0;
    const productIds = [];

    for (const shop of insertedShops) {
      const productPool = PRODUCTS[shop.specialty] || PRODUCTS.ceramique;
      const catKey = shop.specialty;
      const catId = categoryIds[catKey];
      if (!catId) { console.warn(`âš ï¸  Catégorie introuvable : ${catKey}`); continue; }

      // Shuffle and pick 6-10 products per shop
      const shuffled = [...productPool].sort(() => Math.random() - 0.5);
      const count = range(6, Math.min(10, shuffled.length));
      const selected = shuffled.slice(0, count);

      for (const p of selected) {
        const price = (range(p.pMin * 100, p.pMax * 100) / 100).toFixed(2);
        const variants = p.variants ?? null;
        const stock = variants
          ? variants.reduce((s, v) => s + v.options.reduce((os, o) => os + o.stock, 0), 0)
          : range(p.stock[0], p.stock[1]);
        const processingMin = range(1, 3);
        const processingMax = processingMin + range(1, 4);
        const deliveryMin = range(3, 7);
        const deliveryMax = deliveryMin + range(2, 5);

        const existing = await catalogDb.query(
          `SELECT id FROM products WHERE shop_id = $1 AND title = $2`,
          [shop.shopId, p.title]
        );
        if (existing.rows.length > 0) {
          productIds.push({ productId: existing.rows[0].id, specialty: shop.specialty });
          process.stdout.write('.');
          productCount++;
          continue;
        }

        const res = await catalogDb.query(
          `INSERT INTO products
             (shop_id, category_id, title, description, price, stock, variants, is_active,
              processing_time_min, processing_time_max, processing_time_unit,
              delivery_time_min, delivery_time_max, delivery_time_unit)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,true,$8,$9,'days',$10,$11,'days')
           RETURNING id`,
          [shop.shopId, catId, p.title, p.desc, price, stock, variants ? JSON.stringify(variants) : null,
           processingMin, processingMax, deliveryMin, deliveryMax]
        );
        const productId = res.rows[0].id;
        productIds.push({ productId, specialty: shop.specialty });
        productCount++;

        // Images: ensure at least as many images as the max imageIndex in variants
        const maxImageIndex = variants
          ? variants.flatMap((v) => v.options).reduce((m, o) => o.imageIndex != null ? Math.max(m, o.imageIndex) : m, -1)
          : -1;
        const numImages = Math.max(maxImageIndex + 1, range(1, 3));
        for (let i = 0; i < numImages; i++) {
          await catalogDb.query(
            `INSERT INTO product_images (product_id, image_url, position) VALUES ($1, $2, $3)`,
            [productId, nextImg(), i]
          );
        }

        process.stdout.write('+');
      }
    }
    console.log(`\n   â†’ ${productCount} produits\n`);

    // == 8. PRODUCT TAGS ======================================================
    console.log('ðŸ·ï¸  Association des tags aux produits...');
    let tagAssocCount = 0;
    for (const { productId, specialty } of productIds) {
      const applicableTags = TAGS_BY_CATEGORY[specialty] || TAGS_BY_CATEGORY.ceramique;
      // Pick 2-4 tags randomly
      const shuffledTags = [...applicableTags].sort(() => Math.random() - 0.5);
      const picked = shuffledTags.slice(0, range(2, Math.min(4, shuffledTags.length)));
      for (const tagName of picked) {
        const tagId = tagIds[tagName.trim()];
        if (!tagId) continue;
        await catalogDb.query(
          `INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [productId, tagId]
        );
        tagAssocCount++;
      }
    }
    console.log(`   â†’ ${tagAssocCount} associations tag-produit\n`);

    // == 9. BUYERS ============================================================
    console.log('-- Insertion des acheteurs...');
    const buyerIds = [];
    for (const b of BUYERS_DATA) {
      const existing = await usersDb.query(`SELECT id FROM users WHERE email = $1`, [b.email]);
      if (existing.rows.length > 0) {
        buyerIds.push(existing.rows[0].id);
        process.stdout.write('.');
        continue;
      }
      const res = await usersDb.query(
        `INSERT INTO users (role, firstname, lastname, email, password, is_active)
         VALUES ('buyer', $1, $2, $3, $4, true)
         RETURNING id`,
        [b.firstname, b.lastname, b.email, PASSWORD_HASH]
      );
      buyerIds.push(res.rows[0].id);
      process.stdout.write('+');
    }
    console.log(`\n   â†' ${buyerIds.length} acheteurs\n`);

    // == 10. REVIEWS ===========================================================
    console.log('â­ Insertion des avis...');
    let reviewCount = 0;
    const ratingWeights = [3, 3, 4, 4, 4, 5, 5, 5, 5, 5];
    const reviewedPairs = new Set();
    const shuffledProducts = [...productIds].sort(() => Math.random() - 0.5);

    for (const { productId, specialty } of shuffledProducts) {
      // ~70% of products get at least one review
      if (Math.random() > 0.70) continue;
      const comments = REVIEW_COMMENTS[specialty] || REVIEW_COMMENTS.ceramique;
      const numReviews = range(1, Math.min(5, buyerIds.length));
      const shuffledBuyers = [...buyerIds].sort(() => Math.random() - 0.5);

      for (let i = 0; i < numReviews; i++) {
        const userId = shuffledBuyers[i];
        const pairKey = `${userId}:${productId}`;
        if (reviewedPairs.has(pairKey)) continue;

        const existing = await interactionsDb.query(
          `SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2`,
          [userId, productId]
        );
        if (existing.rows.length > 0) {
          reviewedPairs.add(pairKey);
          continue;
        }

        const rating = ratingWeights[Math.floor(Math.random() * ratingWeights.length)];
        const comment = Math.random() > 0.15 ? rand(comments) : null;

        await interactionsDb.query(
          `INSERT INTO reviews (user_id, product_id, rating, comment) VALUES ($1, $2, $3, $4)`,
          [userId, productId, rating, comment]
        );
        reviewedPairs.add(pairKey);
        reviewCount++;
        process.stdout.write('+');
      }
    }
    console.log(`\n   â†' ${reviewCount} avis\n`);

    console.log('ðŸŽ‰ Seed terminé avec succès !');
    console.log(`   Utilisateurs : ${insertedUsers.length}`);
    console.log(`   Profils artistes : ${insertedProfiles.length}`);
    console.log(`   Boutiques : ${insertedShops.length}`);
    console.log(`   Produits : ${productCount}`);
    console.log(`   Tags : ${Object.keys(tagIds).length}`);
    console.log(`   Acheteurs : ${buyerIds.length}`);
    console.log(`   Avis : ${reviewCount}`);

  } finally {
    await Promise.all([usersDb.end(), artistsDb.end(), catalogDb.end(), interactionsDb.end()]);
  }
}

main().catch((err) => {
  console.error('âŒ Erreur :', err.message);
  process.exit(1);
});

