# TheSlapBot

A local Discord bot that turns a short update, a feeling, and the user's Discord avatar into a pear-phone image. `/slap` replies with a private preview; the image is posted to the channel only after the user presses **Post**.

## Requirements

- Node.js 22.12 or newer
- A Discord application and bot token
- A Discord server where you can install the bot

Create a Discord application in the [Discord Developer Portal](https://discord.com/developers/applications), add a bot, and keep its token private. Invite it to a test server with the `bot` and `applications.commands` scopes. Grant **View Channel**, **Send Messages**, and **Attach Files** in the channel where it will post. The bot uses the Gateway and needs no public web endpoint or privileged intents.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in the application values. In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Register `/slap` in your test server with `npm run register`.
4. Start the bot with `npm start`.

`DISCORD_GUILD_ID` makes the slash command available in that server immediately. Keep `.env` private; it is ignored by Git.

## Use

Run `/slap` with `text` (up to 280 characters) and `feeling` (up to 32 characters). The bot makes a private preview using your server avatar when available, then your account avatar, and finally Discord's default avatar. Press **Post** to publish the preview or **Cancel** to discard it. Previews expire after 10 minutes. The bot holds pending preview images in memory and does not keep a message history.

The template image is in `assets/pear-phone-template.png`. Its source and separate usage notice are in [ASSET-NOTICE.md](ASSET-NOTICE.md). The MIT license covers the bot's source code; it does not grant rights to the template artwork or bundled font.

## Verify

Run `npm test` for the offline test suite. A live Discord test also requires a configured bot and test server.
