console.log('1. Script starting...');

import { USDT_ADDRESS } from '../config/usdt';
console.log('2. Config loaded:', USDT_ADDRESS);

import { publicClient } from '../lib/seedUsdt';
console.log('3. Seed lib loaded successfully');
