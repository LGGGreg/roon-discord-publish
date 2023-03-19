# roon-discord-publish
Uses the Discord Presence API to show what you're listening to on Roon.

Based on 
* an [implementation](https://github.com/jamesxsc/roon-discord-rp) by 615283 (James Conway).
* an  [implementation](https://github.com/williamtdr/roon-discord-publish) by williamtdr
* an [implementation](https://github.com/jaredallard/roon-discord-publish) by jaredallard

Changes
- Does not crash on songs with no artist set
- Supports album and artist images
- 
## Using

Modify `config.example.json`, removing the comments, and copy into `config.json`.

Run `npm install`

Run `node roon-discord-publish.js`. This will create an extension on your Roon instance. You will need to go to "Extensions" in the Roon client and enable "Discord Rich Presence".

Note: You may need to run this in an Administrator Command Prompt or powershell

## License

GPL-3