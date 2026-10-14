import { mera } from './mera';
import { privy } from './privy';
export const auth = process.env.NEXT_PUBLIC_AUTH === 'privy' ? privy : mera;
