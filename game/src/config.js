// Verde Bay — every tuning number, colour and story beat in one place.
// The city is a small coastal grid: 5 avenues cross 5 streets, a beach and an
// ocean to the south, a marina to the east. Nothing here is borrowed from any
// commercial game: the city, people, gangs and missions are all original.

export const STEP = 1 / 60;
export const CITY_NAME = 'Verde Bay';
export const GAME_TITLE = 'VERDE BAY';
export const SAVE_KEY = 'verde-bay-save-v1';

/** City layout: roads run along these x and z lines; blocks sit between them. */
export const CITY = {
  half: 200,
  roads: [-160, -80, 0, 80, 160],
  roadWidth: 12,
  blockSize: 68,
  beachZ: 185,
  oceanZ: 235,
  safehouse: { x: -120, z: 120 },
  shop: { x: 120, z: -120 },
  marina: { x: 170, z: 40 },
  pier: { x: 150, z: 170 },
  warehouse: { x: -150, z: -150 },
  bank: { x: 40, z: -40 },
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 10,
  turnSpeed: 2.6,
  radius: 0.7,
  maxHealth: 100,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 30,
  maxReverse: 9,
  steer: 1.9,
  drag: 0.6,
};

export const WEAPONS = {
  fist: { name: 'Fists', damage: 12, range: 2.2, rate: 0.45, auto: false, ammo: Infinity, price: 0 },
  pistol: { name: 'P-9 Pistol', damage: 25, range: 55, rate: 0.32, auto: false, ammo: 120, price: 350 },
  smg: { name: 'VB-10 SMG', damage: 14, range: 45, rate: 0.09, auto: true, ammo: 300, price: 1200 },
};

export const WANTED = {
  max: 5,
  decaySeconds: 14,
  bustDistance: 3.2,
  bustSeconds: 2.5,
  heliAt: 4,
};

/** Seven story missions: a getaway-driver arc for Leo Marin in Verde Bay. */
export const MISSIONS = [
  {
    id: 1, name: 'First Fare', giver: 'Carmen Reyes',
    brief: 'Carmen needs her coupe at the marina by sunset. Drive it there — no scratches, no cops.',
    reward: 500,
    steps: [
      { type: 'enterCar', text: 'Get in Carmen\u2019s coupe (E)', car: 'coupe', at: { x: -40, z: 80 } },
      { type: 'goto', text: 'Drive to the Marina', at: { x: 170, z: 40 } },
    ],
  },
  {
    id: 2, name: 'Hot Wheels', giver: 'Carmen Reyes',
    brief: 'A rival crew left a sports car parked by the plaza. Take it. Bring it to the garage.',
    reward: 800,
    steps: [
      { type: 'stealCar', text: 'Steal the parked sports car (E)', at: { x: 40, z: 0 } },
      { type: 'goto', text: 'Deliver it to the garage', at: { x: -150, z: -150 } },
    ],
  },
  {
    id: 3, name: 'Payback at the Pier', giver: 'Carmen Reyes',
    brief: 'Los Tiburones jumped one of ours at the pier. Go settle it — pistol or fists, your call.',
    reward: 1200,
    steps: [
      { type: 'goto', text: 'Reach the pier', at: { x: 150, z: 170 } },
      { type: 'kill', text: 'Deal with the Tiburones crew (0/3)', at: { x: 150, z: 170 }, count: 3 },
    ],
  },
  {
    id: 4, name: 'The Getaway', giver: 'Carmen Reyes',
    brief: 'The bank job went loud. Lose the heat, then meet me at the safehouse. Do not get busted.',
    reward: 1500,
    steps: [
      { type: 'wanted', text: 'Heat is on — escape the police', level: 2 },
      { type: 'goto', text: 'Reach the safehouse', at: { x: -120, z: 120 } },
    ],
  },
  {
    id: 5, name: 'Bank of Verde', giver: 'Dario Font',
    brief: 'Dario stashed a cash bag behind the Bank of Verde. Grab it and bring it to the warehouse.',
    reward: 2200,
    steps: [
      { type: 'goto', text: 'Pick up the cash bag', at: { x: 40, z: -40 } },
      { type: 'goto', text: 'Deliver the bag to the warehouse', at: { x: -150, z: -150 } },
    ],
  },
  {
    id: 6, name: 'Harbor Heist', giver: 'Dario Font',
    brief: 'A delivery truck full of imported goods is parked at the harbor. Take it to the garage.',
    reward: 3000,
    steps: [
      { type: 'stealCar', text: 'Steal the delivery truck (E)', at: { x: 170, z: 120 }, truck: true },
      { type: 'goto', text: 'Deliver the truck to the garage', at: { x: -150, z: -150 } },
    ],
  },
  {
    id: 7, name: 'King of Verde Bay', giver: 'Carmen Reyes',
    brief: 'Tiburon himself is at the marina with his crew. End it, then drive home a legend.',
    reward: 5000,
    steps: [
      { type: 'goto', text: 'Reach the marina', at: { x: 170, z: 40 } },
      { type: 'kill', text: 'Take down the Tiburones crew (0/5)', at: { x: 170, z: 40 }, count: 5 },
      { type: 'goto', text: 'Drive home to the safehouse', at: { x: -120, z: 120 } },
    ],
  },
];

export const PALETTE = {
  sky: 0xffb36b,
  sun: 0xffd9a0,
  ocean: 0x1d7f9e,
  sand: 0xe8cf9a,
  asphalt: 0x3a3f47,
  sidewalk: 0x9aa0a8,
  grass: 0x5da24a,
  building: [0xe8b04b, 0xd96a4f, 0x7fb3d5, 0xf2e3c6, 0x9b7ec4, 0x6fbf73],
  player: 0x2e86ff,
  police: 0x1c2733,
  taxi: 0xf2c94c,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
