import { coinbaseWallet, injected } from "wagmi/connectors";
import { createClient, http } from "viem";
import { base } from "wagmi/chains";
import { createConfig } from "wagmi";

export const BUILDER_CODE_SUFFIX =
  "0x62635f6f6d70783775397a0b0080218021802180218021802180218021" as `0x${string}`;

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "GasHero",
      appLogoUrl: "https://gashero.vercel.app/icon.png",
      preference: "all",
      version: "4",
    }),
  ],
  client({ chain }) {
    return createClient({
      chain,
      transport: http(),
      dataSuffix: BUILDER_CODE_SUFFIX,
    });
  },
  ssr: true,
});
