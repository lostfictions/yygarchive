## yoyogames archive bot

random games from the yoyogames game maker sandbox (2007-2016), posted to mastodon and bsky every few hours.

based on the database assembled at https://www.yygarchive.org/, with additional images scraped from the wayback machine.

you can download and play these games!

https://mastodon.social/@yygarchive

https://bsky.app/profile/yygarchive.bsky.social

![image from crimelife 2, one of the most downloaded games from the yoyogames game maker sandbox. a 3d character of slightly odd proportions stands in front of a wardrobe in a nondescript room. in white italic cursive text in the top-left corner it says: Use Q or E to rotate character. W, A, S, D to change clothes. below that in papyrus font it says: TORSO (with chevrons highlighting it as selected), LEGS, SHOES](img.jpg)

---

this is a bot that posts a queue of images to bsky and mastodon. it's written in [typescript](https://www.typescriptlang.org/) and runs on [node.js](http://nodejs.org/).

you can run it on your computer and even remix it into something new! you'll need node and git installed. if you install node manually, you should match the node version listed in [the `.node-version`](.node-version) file — but instead of installing node directly i recommend using [fnm](https://github.com/Schniz/fnm), which can automatically handle installing and switching node versions by detecting `.node-version` files.

once you're set, run:

```sh
git clone https://github.com/lostfictions/yygarchive
cd yygarchive
corepack enable # enables use of the pnpm package manager
pnpm install
pnpm dev
```

running `pnpm dev` will generate an image and save it to a file on your computer. when posting to the internet, this bot runs using github actions' [scheduled events](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events). check out the [workflow file](.github/workflows/twoot.yml) for more details.

if you clone the repository you can run your own remixed version that posts to mastodon using github actions too! no need to edit the workflow file — you'll just need to set some environment variables in the github repository settings:

- `MASTODON_TOKEN`: a Mastodon user API token
- `BSKY_USERNAME`: the bot's username on Bluesky
- `BSKY_PASSWORD`: the app password for the bot's account on Bluesky

additionally, `MASTODON_SERVER` (hardcoded in [src/env.ts](src/env.ts)) controls the mastodon instance to which API calls should be made (usually where the bot user lives.)

this bot uses [dotenv](https://github.com/motdotla/dotenv), so if you're testing things locally, you can stick any of the above environment variables in a file named `.env` in the project root. (it's gitignored, so there's no risk of accidentally committing private API tokens you put in there.)
