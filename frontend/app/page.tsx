'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Fingerprint, MoveUpRight, CircleCheck } from 'lucide-react';
import { Mark } from '@/components/shell';
import { useFair } from '@/components/provider';
import { friendly } from '@/lib/api';

export default function Welcome() {
  const { login, notify } = useFair();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function enter() {
    setBusy(true);
    try {
      const usage = await login();
      router.push(BigInt(usage.balance) > 0n && usage.hasKey ? '/chat' : '/add');
    } catch (error) { notify(friendly(error)); }
    finally { setBusy(false); }
  }
  return <div className="landing-stage">
    <main className="landing-frame">
      <header className="landing-header">
        <Mark />
        <nav className="landing-links" aria-label="On this page">
          <a href="#how">How it works</a>
          <a href="#limit">The limit</a>
          <Link href="/usage">Your usage</Link>
        </nav>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-kicker"><span /> FAIRAI / EVERYDAY INTELLIGENCE</p>
          <h1>Good ideas<br />deserve a <span>fairer</span><br />way to grow.</h1>
          <p className="landing-description">A useful answer when you need one. Pay only for the help you use, with a clear limit on your monthly spend.</p>
          <div className="landing-actions"><button className="landing-primary" onClick={enter} disabled={busy}><Fingerprint size={18} />{busy ? 'Setting up your account…' : 'Continue with Face ID'}<ArrowUpRight size={16} /></button><a className="landing-secondary" href="#how">See how it works <MoveUpRight size={14} /></a></div>
          <p className="landing-trust"><CircleCheck size={15} /> ₹500 welcome credit included</p>
        </div>
        <div className="landing-visual" aria-hidden="true"><div className="visual-glow" /><img src="/fairai-orbit.png" alt="" /><div className="visual-caption"><span>001 / FAIR BY DESIGN</span><strong>Make room for more.</strong></div></div>
      </section>
      <div className="landing-lower" id="how"><div className="lower-intro" id="limit"><span>THE FAIRAI WAY</span><strong>Clear from the first answer.</strong></div><div className="lower-item"><span>01 / USE IT</span><strong>Ask when it matters.</strong><p>Study, write, plan, or untangle a thought.</p></div><div className="lower-item"><span>02 / SEE IT</span><strong>Know what each answer costs.</strong><p>Your spending stays visible while you chat.</p></div><div className="lower-item"><span>03 / RELAX</span><strong>₹1,950 is the limit.</strong><p>Once you reach it, answers are free for the rest of the period.</p></div></div>
      <footer className="landing-end"><span>FAIRAI © 2026</span><span>MADE FOR THE MOMENTS YOU NEED A HAND.</span></footer>
    </main>
  </div>;
}
