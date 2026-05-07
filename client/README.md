# Saferide Guardian — Client (Expo)

Recommended commands to start the app from the `client` folder:

```bash
# install dependencies (first time or after changes)
npm install

# start using the project's local Expo install (recommended)
npm run start -- --tunnel   # tunnel mode (remote device)
npm run start -- --lan      # LAN mode (same network)

# avoid using `npx expo start` because it may install a different expo
# version than the one in `package.json` which can cause tunnel failures
```

Notes
- If you see ngrok/tunnel errors, try `--lan` as a quick workaround.
- To keep tunnel behaviour consistent, use the project's `expo` via `npm run start`.
- To use a persistent ngrok identity, configure an ngrok authtoken and ensure `@expo/ngrok` is installed.

If you want, I can update package versions to match Expo recommendations or add a short troubleshooting section.
