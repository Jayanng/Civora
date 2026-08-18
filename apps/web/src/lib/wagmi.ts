import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, defineChain } from "viem";

export const BOT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 677);

export const botChain = defineChain({
  id: BOT_CHAIN_ID,
  name: "BOT Chain",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.botchain.ai"] },
  },
  blockExplorers: {
    default: { name: "BOT Scan", url: "https://scan.botchain.ai" },
  },
});

const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectId && process.env.NODE_ENV !== "test") {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing — WalletConnect will not work.",
  );
}

export const config = getDefaultConfig({
  appName: "Civora",
  projectId: walletConnectId ?? "civora-missing-walletconnect-id",
  chains: [botChain],
  ssr: true,
  transports: {
    [botChain.id]: http("https://rpc.botchain.ai"),
  },
});
