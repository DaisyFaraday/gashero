"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base } from "wagmi/chains";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseEventLogs, type Address, type TransactionReceipt } from "viem";
import {
  GAS_HERO_ABI,
  GAS_HERO_ADDRESS,
  type HeroTuple,
  type HistoryRecordTuple,
  type RawHeroTuple,
} from "@/lib/contract";

type View = "profile" | "adventure" | "log" | "leaderboard" | "rewards" | "invite" | "missions";
type RunKind = "daily" | "explore";

type HistoryItem = {
  mode: "Daily" | "Explore";
  event: string;
  xp: number;
  time: string;
};

type Leader = {
  rank: number;
  address: Address;
  title: string;
  level: number;
  xp: number;
};

const EMPTY_HERO = {
  xp: 0,
  level: 1,
  title: "Gas Rookie",
  streak: 0,
  totalAdventures: 0,
  dailyAdventures: 0,
  exploreActions: 0,
  treasuresFound: 0,
  trapsTriggered: 0,
  criticalHits: 0,
  lastDailyAdventure: 0,
};

const rewardCards = [
  { label: "First Spark", value: "+25 XP", note: "Previewed after your first onchain action" },
  { label: "Streak Core", value: "Live", note: "Updates after daily runs and quick explores" },
  { label: "Chest Radar", value: "Synced", note: "Treasures are read directly from the arena" },
];

const inviteSteps = [
  "Share your hero code with a friend.",
  "They connect and run their first gas-only adventure.",
  "Both heroes can track XP and rank from the same arena.",
];

export default function Home() {
  const [view, setView] = useState<View>("profile");
  const [walletOpen, setWalletOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<RunKind | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: base.id });
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: base.id });

  const heroRead = useReadContract({
    address: GAS_HERO_ADDRESS,
    abi: GAS_HERO_ABI,
    functionName: "getHero",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });

  const rawHeroRead = useReadContract({
    address: GAS_HERO_ADDRESS,
    abi: GAS_HERO_ABI,
    functionName: "heroes",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });

  const historyLengthRead = useReadContract({
    address: GAS_HERO_ADDRESS,
    abi: GAS_HERO_ABI,
    functionName: "getHistoryLength",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });

  const allHeroesLengthRead = useReadContract({
    address: GAS_HERO_ADDRESS,
    abi: GAS_HERO_ABI,
    functionName: "getAllHeroesLength",
    chainId: base.id,
    query: { refetchInterval: 15_000 },
  });

  const topHeroRead = useReadContract({
    address: GAS_HERO_ADDRESS,
    abi: GAS_HERO_ABI,
    functionName: "getTopHero",
    chainId: base.id,
    query: { refetchInterval: 15_000 },
  });

  const hero = useMemo(() => normalizeHero(heroRead.data as HeroTuple | undefined, rawHeroRead.data as RawHeroTuple | undefined), [
    heroRead.data,
    rawHeroRead.data,
  ]);
  const progress = hero.xp % 100;
  const dailyRemaining = Math.max(0, hero.lastDailyAdventure + 86_400 - now);
  const dailyReady = isConnected && dailyRemaining === 0;
  const wrongChain = isConnected && chainId !== base.id;
  const lastResult = parseReceiptResult(receipt.data) ?? history[0];

  const cityStats = [
    ["Arena Pulse", `${Number(allHeroesLengthRead.data ?? 0n)} Heroes`],
    ["Gas Mode", "EOA"],
    ["Rewards", receipt.isSuccess ? "Settled" : "Instant"],
  ];

  const missions = [
    { name: "Run one daily adventure", reward: "+20 XP or more", status: dailyReady ? "Ready" : formatDuration(dailyRemaining) },
    { name: "Explore the neon world three times", reward: "+6 XP average", status: `${hero.exploreActions} Done` },
    { name: "Share your invite link", reward: "Referral boost", status: "Ready" },
    { name: "Reach Level 10", reward: "Treasure Hunter", status: `Level ${hero.level}` },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (receipt.isSuccess) {
      setPendingKind(null);
      queryClient.invalidateQueries();
    }
  }, [queryClient, receipt.isSuccess]);

  useEffect(() => {
    const shouldAutoConnect =
      typeof window !== "undefined" &&
      !window.localStorage.getItem("gashero-disconnected") &&
      /base|coinbase/i.test(window.navigator.userAgent);

    if (!isConnected && shouldAutoConnect) {
      const injectedConnector = connectors.find((connector) => connector.type === "injected");
      if (injectedConnector) connect({ connector: injectedConnector });
    }
  }, [connect, connectors, isConnected]);

  useEffect(() => {
    async function loadHistory() {
      if (!address || !publicClient || !historyLengthRead.data) {
        setHistory([]);
        return;
      }

      const length = Number(historyLengthRead.data);
      const start = Math.max(0, length - 24);
      const indexes = Array.from({ length: length - start }, (_, index) => BigInt(length - 1 - index));
      const records = await Promise.all(
        indexes.map((index) =>
          publicClient.readContract({
            address: GAS_HERO_ADDRESS,
            abi: GAS_HERO_ABI,
            functionName: "getHistoryRecord",
            args: [address, index],
          }),
        ),
      );

      setHistory(records.map((record) => normalizeHistory(record as HistoryRecordTuple)));
    }

    loadHistory().catch(() => setHistory([]));
  }, [address, historyLengthRead.data, publicClient, receipt.isSuccess]);

  useEffect(() => {
    async function loadLeaders() {
      if (!publicClient || !allHeroesLengthRead.data) {
        setLeaders([]);
        return;
      }

      const length = Math.min(Number(allHeroesLengthRead.data), 50);
      const addresses = await Promise.all(
        Array.from({ length }, (_, index) =>
          publicClient.readContract({
            address: GAS_HERO_ADDRESS,
            abi: GAS_HERO_ABI,
            functionName: "allHeroes",
            args: [BigInt(index)],
          }),
        ),
      );

      const heroes = await Promise.all(
        addresses.map((heroAddress) =>
          publicClient.readContract({
            address: GAS_HERO_ADDRESS,
            abi: GAS_HERO_ABI,
            functionName: "getHero",
            args: [heroAddress],
          }),
        ),
      );

      const ranked = addresses
        .map((heroAddress, index) => {
          const row = heroes[index] as HeroTuple;
          return {
            rank: 0,
            address: heroAddress as Address,
            title: row[9] || "Gas Rookie",
            level: Number(row[8] || 1n),
            xp: Number(row[0] || 0n),
          };
        })
        .sort((a, b) => b.xp - a.xp)
        .map((leader, index) => ({ ...leader, rank: index + 1 }));

      setLeaders(ranked);
    }

    loadLeaders().catch(() => setLeaders([]));
  }, [allHeroesLengthRead.data, publicClient, receipt.isSuccess]);

  async function runAdventure(kind: RunKind) {
    if (!isConnected) {
      setWalletOpen(true);
      return;
    }

    if (wrongChain) {
      switchChain({ chainId: base.id });
      return;
    }

    if (kind === "daily" && !dailyReady) return;

    setPendingKind(kind);
    setView("adventure");
    const hash = await writeContractAsync({
      address: GAS_HERO_ADDRESS,
      abi: GAS_HERO_ABI,
      functionName: kind === "daily" ? "dailyAdventure" : "exploreWorld",
      chainId: base.id,
    });
    setTxHash(hash);
  }

  function connectWallet(connectorId: string) {
    const connector = connectors.find((item) => item.uid === connectorId);
    if (!connector) return;
    window.localStorage.removeItem("gashero-disconnected");
    connect({ connector, chainId: base.id });
    setWalletOpen(false);
  }

  function disconnectWallet() {
    window.localStorage.setItem("gashero-disconnected", "1");
    disconnect();
  }

  return (
    <main className="shell">
      <div className="skyline" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <section className="device">
        <header className="status-bar">
          <div className="brand-lockup">
            <span className="brand-mark">GH</span>
            <div>
              <span className="tiny-label">Base Mini App</span>
              <strong>GasHero</strong>
            </div>
          </div>
          {isConnected ? (
            <button className="wallet-button" type="button" onClick={disconnectWallet}>
              {shortAddress(address)} / Disconnect
            </button>
          ) : (
            <button className="wallet-button" type="button" onClick={() => setWalletOpen((open) => !open)}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </header>

        {walletOpen && !isConnected && (
          <section className="wallet-panel">
            {connectors.map((connector) => (
              <button key={connector.uid} type="button" onClick={() => connectWallet(connector.uid)}>
                <span>{connector.name}</span>
                <small>{connector.type === "injected" ? "MetaMask / OKX / Base App" : "Coinbase Wallet"}</small>
              </button>
            ))}
          </section>
        )}

        <section className="city-strip" aria-label="Arena status">
          {cityStats.map(([label, value]) => (
            <div className="city-chip" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <nav className="tabs" aria-label="GasHero views">
          {[
            ["profile", "Hero"],
            ["adventure", "Run"],
            ["log", "Log"],
            ["leaderboard", "Rank"],
            ["rewards", "Rewards"],
            ["missions", "Missions"],
            ["invite", "Invite"],
          ].map(([id, label]) => (
            <button
              className={view === id ? "tab active" : "tab"}
              key={id}
              onClick={() => setView(id as View)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="screen">
          {wrongChain && (
            <div className="chain-warning">
              <span>GasHero runs on Base.</span>
              <button type="button" onClick={() => switchChain({ chainId: base.id })}>
                {isSwitching ? "Switching..." : "Switch to Base"}
              </button>
            </div>
          )}

          {view === "profile" && (
            <div className="profile-grid">
              <div className="hero-card">
                <div className="avatar" aria-hidden="true">
                  <span className="helmet">G</span>
                  <span className="visor" />
                  <span className="signal one" />
                  <span className="signal two" />
                </div>
                <div className="hero-copy">
                  <span className="tiny-label">Hero Profile</span>
                  <h1>{hero.title}</h1>
                  <p>{address ? shortAddress(address) : "Connect to activate your hero"}</p>
                  <div className="tag-row">
                    <span>No Token Needed</span>
                    <span>Onchain XP</span>
                  </div>
                </div>
              </div>

              <div className="mission-panel">
                <div>
                  <span className="tiny-label">Today Mission</span>
                  <strong>Spend gas once. Reveal your event. Climb the city board.</strong>
                </div>
                <span className="mission-code">{dailyReady ? "READY" : formatDuration(dailyRemaining)}</span>
              </div>

              <div className="xp-panel">
                <div className="xp-header">
                  <span>Level {hero.level}</span>
                  <strong>{hero.xp} XP</strong>
                </div>
                <div className="xp-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="xp-meta">
                  <span>{progress}% to next level</span>
                  <span>Streak x{hero.streak}</span>
                </div>
              </div>

              <div className="stats-grid">
                <Stat label="Adventures" value={hero.totalAdventures} />
                <Stat label="Daily Runs" value={hero.dailyAdventures} />
                <Stat label="Explores" value={hero.exploreActions} />
                <Stat label="Streak" value={hero.streak} />
                <Stat label="Treasures" value={hero.treasuresFound} positive />
                <Stat label="Traps" value={hero.trapsTriggered} danger />
                <Stat label="Criticals" value={hero.criticalHits} warning />
                <Stat label="Next Daily" value={dailyReady ? "Ready" : formatDuration(dailyRemaining)} compact />
              </div>
            </div>
          )}

          {view === "adventure" && (
            <div className="adventure-view">
              <div className={`event-stage ${lastResult?.xp && lastResult.xp < 0 ? "trap" : "treasure"}`}>
                <div className="scan-ring" />
                <div className="holo-card">
                  <span>{pendingKind ? pendingKind.toUpperCase() : lastResult ? lastResult.mode.toUpperCase() : "RUN"}</span>
                </div>
                <h2>{lastResult?.event ?? "Choose Your Run"}</h2>
                <strong className={lastResult && lastResult.xp < 0 ? "loss" : "gain"}>
                  {lastResult ? `${lastResult.xp > 0 ? "+" : ""}${lastResult.xp} XP` : "Onchain adventure awaits"}
                </strong>
                <div className="data-rain" aria-hidden="true">
                  <span>0110</span>
                  <span>BASE</span>
                  <span>XP++</span>
                </div>
              </div>
              <div className="dialogue">
                <span className="tiny-label">Onchain Result</span>
                <p>{adventureMessage(pendingKind, receipt.isLoading, receipt.isSuccess, txHash)}</p>
                <div className="confirm-row">
                  <span className="loader" />
                  <span>{txHash ? shortHash(txHash) : "No transaction submitted yet"}</span>
                </div>
              </div>
              <div className="level-toast">
                <span>Current Level</span>
                <strong>Level {hero.level}</strong>
              </div>
            </div>
          )}

          {view === "log" && (
            <div className="list-view">
              <div className="section-heading">
                <span className="tiny-label">Adventure Log</span>
                <strong>{Number(historyLengthRead.data ?? 0n)} Records</strong>
              </div>
              <div className="history-list">
                {history.length ? (
                  history.map((item) => (
                    <article className="log-row" key={`${item.event}-${item.time}`}>
                      <span className={item.mode === "Daily" ? "badge daily" : "badge"}>{item.mode}</span>
                      <div>
                        <strong>{item.event}</strong>
                        <small>{item.time}</small>
                      </div>
                      <b className={item.xp > 0 ? "gain" : "loss"}>
                        {item.xp > 0 ? "+" : ""}{item.xp}
                      </b>
                    </article>
                  ))
                ) : (
                  <EmptyState text="No adventure records yet. Run your first onchain action." />
                )}
              </div>
            </div>
          )}

          {view === "leaderboard" && (
            <div className="list-view">
              <div className="top-hero">
                <span className="crown">TOP</span>
                <div>
                  <span className="tiny-label">Top Hero</span>
                  <strong>{shortAddress((topHeroRead.data as readonly [Address, bigint] | undefined)?.[0])}</strong>
                  <small>{Number((topHeroRead.data as readonly [Address, bigint] | undefined)?.[1] ?? 0n)} XP</small>
                </div>
                <b>{leaders[0]?.xp ?? 0} XP</b>
              </div>
              <div className="rank-list">
                {leaders.length ? (
                  leaders.map((leader) => (
                    <article className={leader.address === address ? "rank-row self" : "rank-row"} key={leader.address}>
                      <span className="rank-mark">{leader.rank <= 3 ? `T${leader.rank}` : `#${leader.rank}`}</span>
                      <div>
                        <strong>{shortAddress(leader.address)}</strong>
                        <small>{leader.title}</small>
                      </div>
                      <span>LVL {leader.level}</span>
                      <b>{leader.xp}</b>
                    </article>
                  ))
                ) : (
                  <EmptyState text="The leaderboard will populate after heroes register onchain." />
                )}
              </div>
            </div>
          )}

          {view === "rewards" && (
            <div className="list-view">
              <div className="section-heading">
                <span className="tiny-label">Reward Vault</span>
                <strong>Instant XP</strong>
              </div>
              <div className="reward-hero">
                <span className="reward-orbit" />
                <div>
                  <span className="tiny-label">Live Balance</span>
                  <h2>{hero.xp} XP</h2>
                  <p>Rewards appear immediately after your first interaction. Final results settle on Base.</p>
                </div>
              </div>
              <div className="reward-grid">
                {rewardCards.map((reward) => (
                  <article className="reward-card" key={reward.label}>
                    <span>{reward.label}</span>
                    <strong>{reward.value}</strong>
                    <small>{reward.note}</small>
                  </article>
                ))}
              </div>
              <button className="claim-button" type="button" onClick={() => runAdventure("explore")}>
                Claim With Explore
              </button>
            </div>
          )}

          {view === "missions" && (
            <div className="list-view">
              <div className="section-heading">
                <span className="tiny-label">Mission Board</span>
                <strong>4 Active</strong>
              </div>
              <div className="mission-map">
                <span>Daily</span>
                <span>Explore</span>
                <span>Invite</span>
                <span>Level</span>
              </div>
              <div className="mission-list">
                {missions.map((mission) => (
                  <article className="mission-row" key={mission.name}>
                    <div>
                      <strong>{mission.name}</strong>
                      <small>{mission.reward}</small>
                    </div>
                    <span>{mission.status}</span>
                  </article>
                ))}
              </div>
            </div>
          )}

          {view === "invite" && (
            <div className="list-view">
              <div className="invite-card">
                <span className="tiny-label">Referral Grid</span>
                <h2>Bring heroes. Split the boost.</h2>
                <p>Your invite code is attached to every shared run card. New players can join without buying a token.</p>
                <div className="invite-code">{address ? `GASHERO-${address.slice(2, 6).toUpperCase()}` : "CONNECT-FOR-CODE"}</div>
              </div>
              <div className="invite-steps">
                {inviteSteps.map((step, index) => (
                  <article className="invite-step" key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </article>
                ))}
              </div>
              <div className="share-panel">
                <button className="share-button" type="button" onClick={() => copyInvite(address)}>
                  Copy Invite Link
                </button>
                <button className="share-button alt" type="button" onClick={() => setView("adventure")}>
                  Share Run Card
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="action-bar">
          <button className="primary-action" disabled={isWriting || receipt.isLoading || !dailyReady} onClick={() => runAdventure("daily")} type="button">
            <span>Daily Adventure</span>
            <b>{dailyReady ? "Spend gas and reveal a major event" : `Ready in ${formatDuration(dailyRemaining)}`}</b>
          </button>
          <button className="secondary-action" disabled={isWriting || receipt.isLoading} onClick={() => runAdventure("explore")} type="button">
            <span>Explore World</span>
            <b>Unlimited gas-only runs</b>
          </button>
        </footer>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  positive,
  danger,
  warning,
  compact,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
  danger?: boolean;
  warning?: boolean;
  compact?: boolean;
}) {
  return (
    <article className={`stat ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <strong className={positive ? "gain" : danger ? "loss" : warning ? "coin" : ""}>{value}</strong>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function normalizeHero(hero?: HeroTuple, raw?: RawHeroTuple) {
  if (!hero) return EMPTY_HERO;
  return {
    xp: Number(hero[0]),
    totalAdventures: Number(hero[1]),
    dailyAdventures: Number(hero[2]),
    exploreActions: Number(hero[3]),
    treasuresFound: Number(hero[4]),
    trapsTriggered: Number(hero[5]),
    criticalHits: Number(hero[6]),
    streak: Number(hero[7]),
    level: Number(hero[8] || 1n),
    title: hero[9] || "Gas Rookie",
    lastDailyAdventure: Number(raw?.[9] ?? 0n),
  };
}

function normalizeHistory(record: HistoryRecordTuple): HistoryItem {
  return {
    time: new Date(Number(record[0]) * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    event: record[1],
    xp: Number(record[2]),
    mode: record[3] ? "Daily" : "Explore",
  };
}

function parseReceiptResult(receipt?: TransactionReceipt): HistoryItem | undefined {
  if (!receipt) return undefined;
  const logs = parseEventLogs({
    abi: GAS_HERO_ABI,
    logs: receipt.logs,
    eventName: ["DailyAdventure", "Explore"],
  });
  const event = logs[0];
  if (!event) return undefined;
  return {
    mode: event.eventName === "DailyAdventure" ? "Daily" : "Explore",
    event: String(event.args.eventName),
    xp: Number(event.args.xpChange),
    time: "Just now",
  };
}

function adventureMessage(kind: RunKind | null, loading: boolean, success: boolean, hash?: string) {
  if (loading) return "Transaction submitted. Waiting for Base confirmation and arena event logs.";
  if (success) return "Confirmed on Base. Your XP, title, log, and leaderboard are refreshing now.";
  if (hash) return "Transaction is in flight. Keep this screen open for the reveal.";
  if (kind) return "Your wallet is preparing the adventure transaction.";
  return "Daily Adventure has a cooldown. Explore World is always available for gas-only runs.";
}

function shortAddress(address?: Address) {
  if (!address || address === "0x0000000000000000000000000000000000000000") return "No hero yet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "Ready";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":");
}

function copyInvite(address?: Address) {
  const code = address ? `?ref=${address}` : "";
  const url = `${window.location.origin}${code}`;
  window.navigator.clipboard?.writeText(url).catch(() => undefined);
}
