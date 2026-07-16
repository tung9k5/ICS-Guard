import { RefreshToken } from '../models/index.js';

class AuthRepository {
  async createRefreshToken(data) {
    return RefreshToken.create(data);
  }

  async findRefreshToken(token) {
    return RefreshToken.findOne({ token });
  }

  async revokeRefreshToken(token) {
    return RefreshToken.updateOne({ token }, { revoked: true });
  }

  async revokeAllUserTokens(userId) {
    return RefreshToken.updateMany({ userId }, { revoked: true });
  }
}

export default new AuthRepository();
