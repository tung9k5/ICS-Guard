import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isInitialized: false,
  isAuthenticated: false,
  user: null,
  token: null, // Keep token in memory for Axios interceptor
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.isInitialized = true;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.accessToken;
    },
    logout: (state) => {
      state.isInitialized = true;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
    },
    setToken: (state, action) => {
      state.token = action.payload;
      // If we have a token, we might assume authenticated (or wait for user profile)
      if (action.payload) {
        state.isAuthenticated = true;
      }
    },
    setInitialized: (state) => {
      state.isInitialized = true;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    }
  },
});

export const { loginSuccess, logout, setToken, setUser, setInitialized } = authSlice.actions;
export default authSlice.reducer;
