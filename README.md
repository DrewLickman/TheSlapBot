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

3. Register `/slap` globally with `npm run register`.
4. Start the bot with `npm start`.

Global registration makes `/slap` available automatically in every server that installs the bot; no per-server registration or process restart is needed. Register again when the command definition changes. Keep `.env` private; it is ignored by Git.

`DISCORD_GUILD_ID` is optional. When set, global registration removes the old test-server `/slap` override after verifying the global command. For development only, `npm run register -- --guild` registers in that test server instead.

[Add TheSlap.com to a server](https://discord.com/oauth2/authorize?client_id=1549571448371286137&integration_type=0&scope=bot%20applications.commands&permissions=35840). Select the destination server and finish authorization. This requests View Channel, Send Messages, and Attach Files. The bot must be installed in the server and its local process must be online. Server/channel permission overrides can restrict command use or posting.

## Local health

The bot listens on `http://127.0.0.1:4320/health` for the local Server Manager. Set `HEALTH_PORT` to use another local port. The endpoint returns HTTP 200 only when Discord is connected and Sharp and the bundled ffmpeg executable are usable; otherwise it returns HTTP 503 with the status of each dependency. It binds only to localhost and does not expose credentials.

## Use

Run `/slap` with `text` (up to 280 characters) and `feeling` (up to 32 characters). The bot makes a private preview using your server avatar when available, then your account avatar, and finally Discord's default avatar. Press **Post** to publish the preview or **Cancel** to discard it. Previews expire after 10 minutes. The bot holds pending preview images in memory and does not keep a message history.

The template image is in `assets/pear-phone-template.png`. Its source and separate usage notice are in [ASSET-NOTICE.md](ASSET-NOTICE.md). The MIT license covers the bot's source code; it does not grant rights to the template artwork or bundled font.

Add an optional `media:` attachment to upload an image directly from your device, or use `media_link:` with a Discord **Copy Media Link** URL. Use one or the other. Both place the image on the right of the update text; direct uploads do not need to be posted in a channel first. Links can point to Discord-hosted media or a message with an image attachment in the same server. For message links, you and the bot need channel access and Read Message History. The first image attachment is used. Message links also require Message Content Intent enabled in the Discord Developer Portal; direct uploads and Copy Media Link URLs do not. PNG, JPEG, WebP, GIF, and AVIF are supported up to 10 MB and 20 megapixels; animated GIFs retain their frames, timing, and looping in previews and posts, including after recoloring. GIFs are limited to 120 frames, 40 million total frame pixels, and a 10 MB rendered output. Other animated formats use the first frame. Images fit without cropping, and remain in place when recoloring. Text uses a narrower column when media is attached; if it cannot fit legibly, shorten it.

## Verify

When `color` is omitted, each new preview starts with a random phone color from green, teal, blue, purple, pink, red, orange, or yellow. Set optional `color:` in `/slap` to a palette name or six-digit hex (for example `color:blue` or `color:#FF8800`). The preview includes **Choose a phone color** directly above **Post**, **Cancel**, and **Custom hex**. Discord requires select menus to occupy their own row. Selecting a color updates the original preview; **Post** publishes that updated image. Color changes retain the original ten-minute expiry. The feeling text follows the printed label's tilt. Recoloring preserves the template's shading and uses a fixed shell mask.

Run `npm test` for the offline test suite. A live Discord test also requires a configured bot and test server.

Discord external-media proxy links (images-ext-1/2.discordapp.net) and MP4 uploads are supported. MP4 clips up to 12 seconds and 10 MB become silent, looping GIFs at 10 frames per second. Conversion uses the bundled ffmpeg-static dependency; the phone and text stay static. Media now chooses the largest readable fit beside or below the text, preserving its aspect ratio and animation.
