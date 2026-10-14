# FairAI

Pay per answer. Never more than ₹1,950 per billing period.

A Monad Testnet hackathon app for students and freelancers. Mera passkeys control prepaid balance; an in-memory meter key signs cumulative EIP-712 receipts. The relayer settles at most the available balance and remaining cap. Refunds become available after 120 seconds; a deposit cancels a pending refund. Billing periods are 30-day network epochs (`timestamp / 2592000`), not calendar months.

## Status

Contracts implemented and 14 Foundry tests passed in the initial build. Backend implemented; provider/pricing tests pass. Four frontend screens are implemented and the local preview has served successfully. **Contracts are not deployed; real payment flow, phone authentication, hosting, Envio, and production smoke tests remain pending.** Zero addresses in `shared/deployments.json` are undeployed placeholders, not live deployments. Privy is a stub.

## Setup

Use Node 20+, Foundry, and a fresh test-only deployer and relayer. Never commit private keys. `.env*` files are ignored except examples.

```powershell
npm install --ignore-scripts
npm install --prefix backend
npm install --prefix frontend
npm run contracts:test
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run dev
```

Windows root installation uses `--ignore-scripts` because the npm Foundry package has a Unix-style postinstall. `scripts/forge.mjs` launches its platform binary. On other systems, a normal Foundry installation works too.

Set `MONAD_RPC`, `DEPLOYER_PRIVATE_KEY`, and `RELAYER_ADDRESS` in `contracts/.env`. Set RPC, relayer key, provider settings and the exact allowed frontend origin in `backend/.env`. Frontend variables follow `frontend/.env.example`.

### AI provider

The generic `LLM_*` settings take priority when `LLM_API_KEY` is present. The legacy Qwen settings still work if it is absent. Never mix a provider key with another provider's endpoint.

```env
LLM_API_KEY=YOUR_GROQ_KEY
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=qwen/qwen3.8-27b
```

After building the backend, run `node dist/scripts/check-ai.js` from `backend/` to check streaming and provider usage. This sends one small real prompt; it prints no key. Groq is distinct from xAI's Grok. Output is limited to 1,024 units and billing requires provider-reported usage. The default selling price is 5 input and 15 output paise per 1,000 units, rounded up per answer, independent of provider cost.

### Deployed contracts

- [MockINR](https://testnet.monadvision.com/address/0x758087d5967667270A8B17F7eEd2c943B09382fd) — 0x758087d5967667270A8B17F7eEd2c943B09382fd
- [FairAI](https://testnet.monadvision.com/address/0xe1185e9d91202c4da45805F4c8Ca003b22dF8F45) — 0xe1185e9d91202c4da45805F4c8Ca003b22dF8F45

Both source matches were confirmed exact by the Monad Sourcify verifier. FairAI deployment block: 70919080.

### Deployment

Fund both fresh test-only accounts using https://faucet.monad.xyz. From `contracts/`, run Foundry tests before broadcasting `script/Deploy.s.sol:Deploy` with your configured RPC. Export the resulting broadcast from the repo root:

```powershell
npm run export -- contracts/broadcast/Deploy.s.sol/10143/run-latest.json
```

Verify both contracts on MonadVision using the current official Monad Sourcify instructions and ABI-encoded constructor parameters. Host backend on Render/Railway with a persistent SQLite volume and a single service instance. Host frontend on Vercel with root directory `frontend` and shared-file access. Set backend CORS to the exact deployed frontend origin. `render.yaml` is a starting blueprint, not evidence of deployment.

## Security and testing

Wallet ownership is authenticated with a signed single-use challenge. Receipts bind the user, session, amount, network, and contract; only the relayer settles. Money uses bigint. The meter key lives only in memory; closing the app stops signing. A crash before receipt signing can leave one answer unpaid. Rotating the meter key invalidates older receipts; finish the old session before replacing it. Welcome credit is idempotent per account but does not prevent fresh-account abuse.

The SQLite queue persists signed outgoing payments before broadcast and serializes sends. Failed settlements retry with backoff. Testnet credit is MockINR, not actual bank money: refunds return MockINR to the user's account, not to a bank.

The live smoke script is `backend/scripts/e2e.ts`: onboard, deposit, three AI answers and receipts, settlement, wait and refund. It has not passed on testnet yet. Complete that test and the actual phone passkey flow before presenting the project as finished.

Inspiration: StreamFlow and TickPay. Planned integrations: Mera, Alchemy, Envio and an AI provider. Do not claim Qwen integration while demonstrating Groq, or Envio until its indexer is complete.
