import 'server-only';
import { getFunctions } from 'firebase/functions';
import { app } from './config';

export const functions = getFunctions(app);
