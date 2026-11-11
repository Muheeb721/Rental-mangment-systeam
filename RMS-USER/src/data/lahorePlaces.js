// Offline fallback for /api/places — used only until (or whenever) the backend endpoint is unavailable.
// Coordinates are approximate centroids; every distance/time derived from them is shown as an estimate.

const A = (name, lat, lng, tier, extra = {}) => ({ type: 'area', category: 'area', name, lat, lng, tier, aliases: [], parent: '', ...extra });
const L = (name, category, lat, lng, extra = {}) => ({ type: 'landmark', category, name, lat, lng, aliases: [], parent: '', ...extra });

const RAW = [
  // Societies (umbrella areas)
  A('DHA Lahore', 31.4730, 74.4200, 'premium', { aliases: ['DHA', 'Defence', 'Defence Housing Authority'], description: 'Defence Housing Authority — Lahore\'s largest planned society, with wide roads, 24/7 security, parks and commercial hubs across nine phases.' }),
  A('Askari', 31.4860, 74.3930, 'upscale', { aliases: ['Askari Housing'], description: 'Army-managed gated housing schemes known for quiet streets, apartments and strict security.' }),
  A('Bahria Town', 31.3695, 74.1846, 'upscale', { aliases: ['Bahria', 'Bahria Town Lahore'], description: 'Self-contained gated city off Canal Road with its own hospital, schools, Grand Jamia Mosque and theme parks.' }),
  // DHA phases
  ...[[1, 31.4805, 74.3925], [2, 31.4727, 74.4122], [3, 31.4772, 74.3793], [4, 31.4683, 74.3866], [5, 31.4632, 74.4103], [6, 31.4718, 74.4515], [7, 31.4547, 74.4712], [8, 31.4906, 74.4282], [9, 31.4485, 74.4932]]
    .map(([n, lat, lng]) => A(`DHA Phase ${n}`, lat, lng, n <= 6 ? 'premium' : 'upscale', { parent: 'dha-lahore', aliases: [`Phase ${n}`, `DHA ${n}`, `Defence Phase ${n}`] })),
  A('Askari 10', 31.5206, 74.4025, 'upscale', { parent: 'askari', aliases: ['Askari X'] }),
  A('Askari 11', 31.4505, 74.3842, 'upscale', { parent: 'askari', aliases: ['Askari XI'] }),
  // Central & west Lahore
  A('Gulberg', 31.5165, 74.3487, 'premium', { aliases: ['Gulberg III', 'Gulberg II', 'Gulberg 3'], description: 'Lahore\'s commercial heart — MM Alam Road, Liberty Market and premium offices, with leafy residential blocks.' }),
  A('Lahore Cantt', 31.5080, 74.3800, 'premium', { aliases: ['Cantt', 'Cantonment'], description: 'Green, well-kept cantonment close to the airport, Fortress Square and CMH.' }),
  A('Model Town', 31.4835, 74.3255, 'premium', { description: 'One of Lahore\'s oldest planned towns: circular layout, large plots and the much-loved Model Town Park.' }),
  A('Garden Town', 31.5040, 74.3200, 'upscale', { description: 'Central, established residential area between Gulberg and Model Town with good school and hospital access.' }),
  A('Faisal Town', 31.4800, 74.3050, 'upscale', { description: 'Family-friendly blocks next to Model Town, close to FAST and Jinnah Hospital.' }),
  A('Cavalry Ground', 31.4970, 74.3720, 'upscale', { description: 'Quiet society in Cantt with easy access to Walton Road and DHA.' }),
  A('Shadman', 31.5390, 74.3300, 'upscale', { description: 'Central neighbourhood near Jail Road, Services Hospital and Kinnaird College.' }),
  A('Johar Town', 31.4697, 74.2728, 'mid', { aliases: ['Johar', 'Johartown'], description: 'Popular, well-connected area with Emporium Mall, UCP, UMT, Shaukat Khanum and the Expo Centre.' }),
  A('Allama Iqbal Town', 31.5085, 74.2880, 'mid', { aliases: ['Iqbal Town'], description: 'Large established area with markets like Moon Market and easy Canal Road access.' }),
  A('Wapda Town', 31.4335, 74.2640, 'mid', { description: 'Planned society off Raiwind Road with wide roads, parks and community facilities.' }),
  A('Township', 31.4500, 74.3070, 'affordable', { description: 'Affordable, centrally located sectors near Kot Lakhpat and Ferozepur Road.' }),
  A('Valencia Town', 31.4120, 74.2590, 'mid', { aliases: ['Valencia'], description: 'Gated society on Defence Road with parks, a commercial area and a calm setting.' }),
  A('Lake City', 31.3770, 74.2490, 'upscale', { description: 'Modern gated community on Raiwind Road with a golf course and lake views.' }),
  A('EME Society', 31.4400, 74.2350, 'mid', { aliases: ['EME'], description: 'Army-run gated society near Multan Road and Thokar Niaz Baig.' }),
  A('Gulshan-e-Ravi', 31.5460, 74.2920, 'affordable', { description: 'Affordable residential area in north-west Lahore near Bund Road.' }),
  A('Samanabad', 31.5340, 74.3010, 'affordable', { description: 'Dense, central and affordable neighbourhood with good public transport.' }),
  A('Thokar Niaz Baig', 31.4730, 74.2420, 'affordable', { aliases: ['Thokar'], description: 'Gateway to the M-2 Motorway with fast-growing housing around it.' }),
  A('State Life Housing Society', 31.4600, 74.3990, 'upscale', { aliases: ['State Life'], description: 'Compact society beside DHA Phase 1 with easy access to Walton Road.' }),
  A('Paragon City', 31.4950, 74.4620, 'mid', { description: 'Gated society on Barki Road near DHA Phase 8.' }),
  A('Central Park', 31.3910, 74.2010, 'affordable', { aliases: ['Central Park Housing'], description: 'Value-for-money gated society off Ferozepur Road.' }),
  // Universities
  L('LUMS', 'university', 31.4704, 74.4094, { aliases: ['Lahore University of Management Sciences'], parent: 'dha-phase-5' }),
  L('University of the Punjab', 'university', 31.4920, 74.2990, { aliases: ['Punjab University', 'PU', 'PU New Campus'] }),
  L('FAST NUCES Lahore', 'university', 31.4810, 74.3030, { aliases: ['FAST', 'NUCES'] }),
  L('UET Lahore', 'university', 31.5797, 74.3560, { aliases: ['UET', 'University of Engineering and Technology'] }),
  L('UCP', 'university', 31.4466, 74.2681, { aliases: ['University of Central Punjab'] }),
  L('UMT', 'university', 31.4490, 74.2680, { aliases: ['University of Management and Technology'] }),
  L('Government College University', 'university', 31.5730, 74.3090, { aliases: ['GCU', 'GC University'] }),
  L('Kinnaird College', 'university', 31.5300, 74.3360, { aliases: ['Kinnaird'] }),
  L('University of Lahore', 'university', 31.3920, 74.2410, { aliases: ['UOL'] }),
  L('COMSATS Lahore', 'university', 31.4010, 74.2110, { aliases: ['COMSATS', 'CUI Lahore'] }),
  L('ITU Lahore', 'university', 31.4757, 74.3426, { aliases: ['Information Technology University', 'Arfa Tower'] }),
  // Hospitals
  L('Shaukat Khanum Hospital', 'hospital', 31.4473, 74.2667, { aliases: ['Shaukat Khanum', 'SKMCH'] }),
  L('Services Hospital', 'hospital', 31.5402, 74.3380),
  L('Jinnah Hospital', 'hospital', 31.4840, 74.2980),
  L('Mayo Hospital', 'hospital', 31.5720, 74.3175),
  L('CMH Lahore', 'hospital', 31.5195, 74.3897, { aliases: ['Combined Military Hospital'] }),
  L('National Hospital DHA', 'hospital', 31.4760, 74.3950, { aliases: ['National Hospital'] }),
  L('Doctors Hospital', 'hospital', 31.4635, 74.2810),
  L('Hameed Latif Hospital', 'hospital', 31.5160, 74.3420, { aliases: ['Hameed Latif'] }),
  L('Ittefaq Hospital', 'hospital', 31.4790, 74.3200),
  // Schools
  L('Aitchison College', 'school', 31.5450, 74.3370, { aliases: ['Aitchison'] }),
  L('Lahore Grammar School DHA', 'school', 31.4745, 74.3985, { aliases: ['LGS DHA', 'LGS'] }),
  L('Beaconhouse Garden Town', 'school', 31.5020, 74.3230, { aliases: ['Beaconhouse', 'BSS'] }),
  L('LACAS Johar Town', 'school', 31.4690, 74.2760, { aliases: ['LACAS'] }),
  L('The City School DHA', 'school', 31.4650, 74.4060, { aliases: ['City School'] }),
  // Shopping
  L('Packages Mall', 'mall', 31.4705, 74.3560),
  L('Emporium Mall', 'mall', 31.4675, 74.2660, { aliases: ['Emporium'] }),
  L('Fortress Square', 'mall', 31.5260, 74.3700, { aliases: ['Fortress Stadium'] }),
  L('Liberty Market', 'mall', 31.5110, 74.3450, { aliases: ['Liberty'] }),
  L('MM Alam Road', 'mall', 31.5135, 74.3500, { aliases: ['M.M. Alam Road', 'MM Alam'] }),
  L('DHA Y Block Market', 'mall', 31.4750, 74.3805, { aliases: ['Y Block'] }),
  L('Amanah Mall', 'mall', 31.4985, 74.3105),
  // Transport
  L('Allama Iqbal International Airport', 'transport', 31.5216, 74.4036, { aliases: ['Airport', 'Lahore Airport', 'LHE'] }),
  L('Lahore Railway Station', 'transport', 31.5770, 74.3360, { aliases: ['Railway Station'] }),
  L('Kalma Chowk Metro Station', 'transport', 31.5050, 74.3310, { aliases: ['Kalma Chowk', 'Metro Bus'] }),
  L('Thokar Niaz Baig Interchange', 'transport', 31.4710, 74.2410, { aliases: ['Motorway M-2', 'M2 Motorway'] }),
  L('Orange Line — Anarkali Station', 'transport', 31.5640, 74.3110, { aliases: ['Orange Line', 'Anarkali'] }),
  // Parks
  L('Jilani Park (Racecourse)', 'park', 31.5380, 74.3330, { aliases: ['Racecourse Park', 'Jilani Park'] }),
  L('Bagh-e-Jinnah', 'park', 31.5525, 74.3290, { aliases: ['Lawrence Garden'] }),
  L('Model Town Park', 'park', 31.4830, 74.3260),
  L('Gulshan-e-Iqbal Park', 'park', 31.5080, 74.2930),
  // Mosques
  L('Badshahi Mosque', 'mosque', 31.5880, 74.3100, { aliases: ['Badshahi Masjid'] }),
  L('Grand Jamia Mosque Bahria', 'mosque', 31.3640, 74.1850, { aliases: ['Grand Jamia Masjid'] }),
  L('DHA Phase 5 Jamia Mosque', 'mosque', 31.4615, 74.4080, { aliases: ['DHA Mosque'] }),
];

export const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const FALLBACK_PLACES = RAW.map((p) => ({ ...p, slug: slugify(p.name), description: p.description || '' }));
