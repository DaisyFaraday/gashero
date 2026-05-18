import type { Address } from "viem";

export const GAS_HERO_ADDRESS = "0x45347BBEB8e1b0298E8a7a4501fDd112FAc680ef" as Address;

export const GAS_HERO_ABI = [
  {
    type: "function",
    name: "dailyAdventure",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "exploreWorld",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getHero",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalXP", type: "uint256" },
      { name: "totalAdventures", type: "uint256" },
      { name: "dailyAdventures", type: "uint256" },
      { name: "exploreActions", type: "uint256" },
      { name: "treasuresFound", type: "uint256" },
      { name: "trapsTriggered", type: "uint256" },
      { name: "criticalHits", type: "uint256" },
      { name: "streak", type: "uint256" },
      { name: "level", type: "uint256" },
      { name: "title", type: "string" },
    ],
  },
  {
    type: "function",
    name: "heroes",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "totalXP", type: "uint256" },
      { name: "totalAdventures", type: "uint256" },
      { name: "dailyAdventures", type: "uint256" },
      { name: "exploreActions", type: "uint256" },
      { name: "treasuresFound", type: "uint256" },
      { name: "trapsTriggered", type: "uint256" },
      { name: "criticalHits", type: "uint256" },
      { name: "streak", type: "uint256" },
      { name: "level", type: "uint256" },
      { name: "lastDailyAdventure", type: "uint256" },
      { name: "title", type: "string" },
    ],
  },
  {
    type: "function",
    name: "getHistoryLength",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getHistoryRecord",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "timestamp", type: "uint256" },
      { name: "eventName", type: "string" },
      { name: "xpChange", type: "int256" },
      { name: "isDaily", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getAllHeroesLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allHeroes",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getTopHero",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "hero", type: "address" },
      { name: "xp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "DailyAdventure",
    inputs: [
      { name: "hero", type: "address", indexed: true },
      { name: "eventName", type: "string", indexed: false },
      { name: "xpChange", type: "int256", indexed: false },
      { name: "level", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Explore",
    inputs: [
      { name: "hero", type: "address", indexed: true },
      { name: "eventName", type: "string", indexed: false },
      { name: "xpChange", type: "int256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NewTitle",
    inputs: [
      { name: "hero", type: "address", indexed: true },
      { name: "title", type: "string", indexed: false },
    ],
  },
] as const;

export type HeroTuple = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  string,
];

export type RawHeroTuple = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  string,
];

export type HistoryRecordTuple = readonly [bigint, string, bigint, boolean];
