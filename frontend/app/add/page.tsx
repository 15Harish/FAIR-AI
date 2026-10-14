'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Fingerprint, Gift, ShieldCheck } from 'lucide-react';
import { parseUnits } from 'viem';
import { Shell } from '@/components/shell';
import { useFair } from '@/components/provider';
import { money, friendly } from '@/lib/api';
import { assertDeployment, fair, inr, network, publicClient } from '@/lib/chain';
export default function Add() {
 const { account, usage, refresh, notify } = useFair(); const [amount, setAmount] = useState('200'); const [step, setStep] = useState(''); const router = useRouter();
 async function deposit() { if (!account) { notify('Please sign in to add balance.'); return; } try {
   assertDeployment(); if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 100000) { notify('Enter an amount between ₹0.01 and ₹1,00,000.'); return; }
   const value = parseUnits(amount, 18); const allowance = await publicClient.readContract({ ...inr, functionName: 'allowance', args: [account.walletAddress, fair.address] }) as bigint;
   if (allowance < value) { setStep('Step 1 of 2: Confirm'); const hash = await account.wallet.writeContract({ ...inr, account: account.wallet.account!, chain: network, functionName: 'approve', args: [fair.address, value], gas: await publicClient.estimateContractGas({ ...inr, account: account.walletAddress, functionName: 'approve', args: [fair.address, value] }) }); setStep('Confirming step 1…'); const r = await publicClient.waitForTransactionReceipt({ hash }); if (r.status !== 'success') throw new Error('Payment failed'); }
   setStep('Step 2 of 2: Confirm'); const args = [value, account.meterKey.address]; const hash = await account.wallet.writeContract({ ...fair, account: account.wallet.account!, chain: network, functionName: 'depositAndSetKey', args, gas: await publicClient.estimateContractGas({ ...fair, account: account.walletAddress, functionName: 'depositAndSetKey', args }) }); setStep('Adding your balance…'); const r = await publicClient.waitForTransactionReceipt({ hash }); if (r.status !== 'success') throw new Error('Payment failed'); await refresh(); notify(`${money(value)} added. You’re ready to go.`); router.push('/chat');
 } catch (e) { notify(friendly(e)); } finally { setStep(''); } }
 return <Shell><div className="page-content add-content"><div className="eyebrow">A LITTLE GOES A LONG WAY</div><h1>More possibilities.<br /><em>On your terms.</em></h1><p className="page-intro">Add a little balance. Use it whenever inspiration strikes.</p><div className="add-card"><div className="muted">YOUR CURRENT BALANCE</div><div className="large-money">{money(usage?.balance || '0')}</div><div className="welcome-credit"><Gift size={19} /><div><strong>{usage?.onboarded ? '₹500 welcome credit added' : 'A warm welcome, on us.'}</strong><span>Your first ideas deserve a head start.</span></div></div><label htmlFor="amount">How much would you like to add?</label><div className="amount-options">{['100', '200', '500'].map(v => <button className={amount === v ? 'selected' : ''} onClick={() => setAmount(v)} key={v}>₹{v}{v === '200' && <small>A GOOD START</small>}</button>)}</div><div className="custom-amount"><span>₹</span><input id="amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" aria-label="Custom amount" /><span>Custom amount</span></div>{account ? <button className="primary full" onClick={deposit} disabled={!!step}><Fingerprint size={21} />{step || `Add ₹${amount || '0'}`}<ArrowRight size={18} /></button> : <Link className="primary full" href="/">Sign in to continue <ArrowRight size={18} /></Link>}<div className="secure-note"><ShieldCheck size={14} /> You confirm each step. Your balance stays yours.</div></div><p className="below-card">Changed your mind? Get your unused balance back anytime.<br />And you’ll never spend more than ₹1,950 a month.</p></div></Shell>;
}
