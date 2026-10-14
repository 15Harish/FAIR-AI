# FairAI API

Run from `backend/`: copy `.env.example` to `.env`, populate test relayer credentials and Qwen credentials, then `npm install`, `npm run build`, `npm start`. Populate `../shared/deployments.json` from the verified contract deployment first. Never use a mainnet key. Store `SQLITE_PATH` on a persistent volume. Run one backend instance per database/relayer; the transaction queue is process-local. Set `FRONTEND_ORIGIN` to the exact frontend origin. Set `TRUST_PROXY=1` only behind one trusted reverse proxy.

Authentication: request `POST /api/auth/challenge` with `{wallet}`, sign its `message` with account 0 using `signMessage`, then `POST /api/auth/verify` with `{wallet, nonce, signature}`. Keep the returned `token` in memory and send `Authorization: Bearer <token>` on all account routes. For a beacon include `authToken` in its JSON body. Tokens expire after 24 hours. Challenges expire after five minutes and cannot be reused. The API verifies account signatures through viem's public action, including ERC-1271 accounts.

Account routes reject requests for another signed-in account. Session routes check stored ownership. Onboarding and chat have both IP and account rate limits. Keep signup funding limited to testnet: one-per-account funding is not Sybil resistant.

`/api/session/current/:wallet` returns `{session: null}` or `{session: {..., messages: [...]}}`. `/api/sessions/:wallet` returns `{sessions: [...]}` with millisecond timestamps, amounts as wei strings, and settlement status. Chat returns NDJSON lines, including a terminal `error` line if the provider fails. No charge is stored unless complete usage is returned. Only completed answers enter conversation history.

Signed serialized payments are saved before broadcast and reused after a restart. Do not delete this database while reusing a relayer: it contains the welcome-credit ledger. Settlement retries reuse the same payment bytes. Broadcast ambiguity blocks subsequent queued work until the previous receipt is known. Sessions with a terminal reverted payment remain failed for operator review; no silent replacement is sent. The API checks `settled(sessionId)` before settlement and can recover its event after a crash. `DEPLOY_BLOCK` can restrict recovery event scans.

Run `npm test` for pricing checks and `npm run e2e` for the live testnet flow. The end-to-end script needs a deployed contract, a funded relayer, an active AI API key, and a running backend. It uses fresh random test accounts; three real AI answers are billed and the remaining balance is refunded after the configured wait.
