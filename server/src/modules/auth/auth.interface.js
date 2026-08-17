// Public contract: exposes verifyToken()/getUser() to middleware/authenticate.js
// and socket handshakes. See ARCHITECTURE.md §2.1.
import { authService } from './auth.service.js';

export const authInterface = {
  verifyToken: authService.verifyToken,
  getUser: authService.getUser,
};
